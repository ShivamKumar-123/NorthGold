"""Deposit / withdrawal verification and the ledger writes behind them.

Approving a deposit is the single busiest moment in the system. In one atomic
block it: credits the wallet, writes the ledger row, optionally starts the
investment that will pay monthly ROI, and pays the upline their one-off deposit
commission. Any failure rolls the whole thing back — a half-approved deposit is
far worse than a rejected one.
"""
import logging
from decimal import ROUND_DOWN, Decimal

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.core.services import get_setting, notify, write_audit

from .models import Deposit, Transaction, Withdrawal

logger = logging.getLogger(__name__)

CENT = Decimal("0.01")


def quantize(amount):
    return Decimal(str(amount)).quantize(CENT, rounding=ROUND_DOWN)


class WalletError(Exception):
    """Business-rule failure — surfaced as a 400."""


# ─── Deposits ─────────────────────────────────────────────────────────────

def create_deposit_request(*, user, amount, method, channel=None,
                           user_message="", reference_no="", proof=None):
    amount = quantize(amount)
    minimum = Decimal(str(get_setting("deposit_min_amount") or 0))
    if amount < minimum:
        raise WalletError(f"Minimum deposit is {minimum}.")

    # Cash has no bank trail, so the message IS the evidence the verifier works
    # from. Every other method can lean on a UTR or tx hash instead.
    if method == "cash" and not (user_message or "").strip():
        raise WalletError(
            "For a cash deposit, describe the handover (who, where, when) in the message."
        )
    if channel is not None:
        if not channel.is_active:
            raise WalletError("That payment channel is no longer available.")
        if amount < channel.min_amount:
            raise WalletError(f"This channel accepts a minimum of {channel.min_amount}.")
        if channel.max_amount is not None and amount > channel.max_amount:
            raise WalletError(f"This channel accepts a maximum of {channel.max_amount}.")

    deposit = Deposit.objects.create(
        user=user, amount=amount, method=method, channel=channel,
        user_message=user_message, reference_no=reference_no, proof=proof,
    )
    notify(user, title="Deposit request submitted",
           message=f"Your {method} deposit of {amount} is awaiting verification.",
           notif_type="deposit", action_url="/wallet")
    return deposit


@transaction.atomic
def approve_deposit(deposit, admin, *, admin_note="", ip_address=None,
                    auto_invest=None, plan=None):
    """Verify a deposit: credit the wallet, then start the ROI clock and pay
    the upline.

    `auto_invest` defaults to the platform setting. When it is on, the whole
    deposit is immediately locked into the plan matching its amount slab, which
    is what makes "deposit $1,000, receive 1-2% monthly" true without the user
    taking a second action.
    """
    locked_deposit = Deposit.objects.select_for_update().get(pk=deposit.pk)
    if locked_deposit.status != "pending":
        raise WalletError(f"Deposit is already {locked_deposit.status}.")

    user = User.objects.select_for_update().get(pk=locked_deposit.user_id)
    amount = locked_deposit.amount

    user.wallet_balance = (user.wallet_balance or Decimal("0")) + amount
    user.total_deposited = (user.total_deposited or Decimal("0")) + amount
    user.save(update_fields=["wallet_balance", "total_deposited", "updated_at"])

    locked_deposit.status = "approved"
    locked_deposit.reviewed_by = admin
    locked_deposit.reviewed_at = timezone.now()
    if admin_note:
        locked_deposit.admin_note = admin_note
    locked_deposit.save(update_fields=["status", "reviewed_by", "reviewed_at",
                                       "admin_note", "updated_at"])

    Transaction.objects.create(
        user=user, tx_type="deposit", amount=amount,
        balance_after=user.wallet_balance,
        description=f"{locked_deposit.get_method_display()} deposit verified",
        reference_id=locked_deposit.id, reference_type="deposit",
        created_by=admin,
    )

    investment = None
    should_invest = get_setting("auto_invest_on_deposit") if auto_invest is None else auto_invest
    if should_invest:
        from apps.investments.services import InvestmentError, create_investment
        try:
            investment = create_investment(
                user=user, amount=amount, plan=plan,
                source_deposit=locked_deposit, from_wallet=True,
            )
        except InvestmentError as exc:
            # No slab covers this amount (or none is configured yet). The
            # deposit still stands — the money sits in the wallet and the user
            # can invest manually once a plan exists.
            logger.warning("Auto-invest skipped for deposit %s: %s", locked_deposit.id, exc)
            notify(user, title="Deposit credited",
                   message=(f"{amount} was added to your wallet. "
                            f"It is not yet earning: {exc}"),
                   notif_type="deposit", action_url="/wallet")

    # One-off upline commission on the deposit itself.
    from apps.mlm.services import distribute_commission
    distribute_commission(
        source_user=user, base_amount=amount, trigger="deposit",
        reference_id=locked_deposit.id, reference_type="deposit",
        description=f"Deposit commission ({locked_deposit.get_method_display()})",
    )

    notify(user, title="Deposit approved",
           message=(f"Your deposit of {amount} was verified and credited."
                    + (" It is now earning monthly returns." if investment else "")),
           notif_type="deposit", action_url="/wallet")
    write_audit(admin, "approve_deposit", entity_type="deposit",
                entity_id=locked_deposit.id,
                new_values={"amount": str(amount), "auto_invested": bool(investment)},
                ip_address=ip_address)
    return locked_deposit, investment


@transaction.atomic
def reject_deposit(deposit, admin, *, reason="", ip_address=None):
    locked = Deposit.objects.select_for_update().get(pk=deposit.pk)
    if locked.status != "pending":
        raise WalletError(f"Deposit is already {locked.status}.")
    locked.status = "rejected"
    locked.rejection_reason = reason
    locked.reviewed_by = admin
    locked.reviewed_at = timezone.now()
    locked.save(update_fields=["status", "rejection_reason", "reviewed_by",
                               "reviewed_at", "updated_at"])
    notify(locked.user, title="Deposit rejected",
           message=reason or f"Your deposit of {locked.amount} could not be verified.",
           notif_type="deposit", action_url="/wallet")
    write_audit(admin, "reject_deposit", entity_type="deposit", entity_id=locked.id,
                new_values={"reason": reason}, ip_address=ip_address)
    return locked


# ─── Withdrawals ──────────────────────────────────────────────────────────

@transaction.atomic
def create_withdrawal_request(*, user, amount, method, payout_details=None,
                              user_message=""):
    """Debit the wallet at REQUEST time, not at approval.

    Holding the funds up front stops a user from queuing five withdrawals of
    their entire balance and having all five approved. A rejection refunds.
    """
    amount = quantize(amount)
    minimum = Decimal(str(get_setting("withdrawal_min_amount") or 0))
    if amount < minimum:
        raise WalletError(f"Minimum withdrawal is {minimum}.")

    if method == "cash" and not (user_message or "").strip():
        raise WalletError(
            "For a cash withdrawal, tell us where and when you want to collect it."
        )
    if method != "cash" and not payout_details:
        raise WalletError("Payout details are required for this method.")

    locked = User.objects.select_for_update().get(pk=user.pk)
    if (locked.wallet_balance or Decimal("0")) < amount:
        raise WalletError("Insufficient wallet balance.")

    fee_percent = Decimal(str(get_setting("withdrawal_fee_percent") or 0))
    fee = quantize(amount * fee_percent / Decimal("100"))
    net = quantize(amount - fee)

    locked.wallet_balance -= amount
    locked.save(update_fields=["wallet_balance", "updated_at"])

    withdrawal = Withdrawal.objects.create(
        user=locked, amount=amount, fee=fee, net_amount=net, method=method,
        payout_details=payout_details or {}, user_message=user_message,
    )
    Transaction.objects.create(
        user=locked, tx_type="withdrawal", amount=-amount,
        balance_after=locked.wallet_balance,
        description=f"{withdrawal.get_method_display()} withdrawal requested (held)",
        reference_id=withdrawal.id, reference_type="withdrawal",
    )
    notify(locked, title="Withdrawal requested",
           message=f"{amount} is on hold pending approval. You will receive {net}.",
           notif_type="withdrawal", action_url="/wallet")
    return withdrawal


@transaction.atomic
def approve_withdrawal(withdrawal, admin, *, payout_reference="", admin_note="",
                       ip_address=None):
    """Confirm the payout went out. The balance already moved at request time,
    so this only settles the record."""
    locked = Withdrawal.objects.select_for_update().get(pk=withdrawal.pk)
    if locked.status != "pending":
        raise WalletError(f"Withdrawal is already {locked.status}.")

    locked.status = "approved"
    locked.payout_reference = payout_reference
    locked.admin_note = admin_note
    locked.reviewed_by = admin
    locked.reviewed_at = timezone.now()
    locked.save(update_fields=["status", "payout_reference", "admin_note",
                               "reviewed_by", "reviewed_at", "updated_at"])

    user = User.objects.select_for_update().get(pk=locked.user_id)
    user.total_withdrawn = (user.total_withdrawn or Decimal("0")) + locked.amount
    user.save(update_fields=["total_withdrawn", "updated_at"])

    notify(user, title="Withdrawal approved",
           message=f"{locked.net_amount} has been sent via {locked.get_method_display()}.",
           notif_type="withdrawal", action_url="/wallet")
    write_audit(admin, "approve_withdrawal", entity_type="withdrawal",
                entity_id=locked.id, new_values={"amount": str(locked.amount)},
                ip_address=ip_address)
    return locked


@transaction.atomic
def reject_withdrawal(withdrawal, admin, *, reason="", ip_address=None):
    """Refund the hold placed at request time."""
    locked = Withdrawal.objects.select_for_update().get(pk=withdrawal.pk)
    if locked.status != "pending":
        raise WalletError(f"Withdrawal is already {locked.status}.")

    user = User.objects.select_for_update().get(pk=locked.user_id)
    user.wallet_balance = (user.wallet_balance or Decimal("0")) + locked.amount
    user.save(update_fields=["wallet_balance", "updated_at"])

    locked.status = "rejected"
    locked.rejection_reason = reason
    locked.reviewed_by = admin
    locked.reviewed_at = timezone.now()
    locked.save(update_fields=["status", "rejection_reason", "reviewed_by",
                               "reviewed_at", "updated_at"])

    Transaction.objects.create(
        user=user, tx_type="withdrawal", amount=locked.amount,
        balance_after=user.wallet_balance,
        description="Withdrawal rejected - hold released",
        reference_id=locked.id, reference_type="withdrawal", created_by=admin,
    )
    notify(user, title="Withdrawal rejected",
           message=reason or f"{locked.amount} has been returned to your wallet.",
           notif_type="withdrawal", action_url="/wallet")
    write_audit(admin, "reject_withdrawal", entity_type="withdrawal",
                entity_id=locked.id, new_values={"reason": reason},
                ip_address=ip_address)
    return locked


@transaction.atomic
def admin_set_balance(*, user, target, admin, description, ip_address=None):
    """Set a wallet to an exact figure.

    The difference is worked out under the row lock, not in the browser: an
    admin reading 500 on a stale screen and posting "add 300" would overwrite a
    payout that landed in between. Asking for the *destination* and computing
    the delta here means the ledger records the correction that actually
    happened, whatever the balance was a moment ago.
    """
    target = quantize(target)
    if target < 0:
        raise WalletError("A balance cannot be set below zero.")

    locked = User.objects.select_for_update().get(pk=user.pk)
    delta = quantize(target - (locked.wallet_balance or Decimal("0")))
    if delta == 0:
        raise WalletError("That is already the balance.")

    locked.wallet_balance = target
    locked.save(update_fields=["wallet_balance", "updated_at"])

    tx = Transaction.objects.create(
        user=locked, tx_type="adjustment", amount=delta, balance_after=target,
        description=description or f"Balance set to {target} by an administrator",
        reference_type="adjustment", created_by=admin,
    )
    notify(locked, title="Balance adjusted",
           message=f"An administrator set your balance to {target}. {description}",
           notif_type="adjustment", action_url="/wallet")
    write_audit(admin, "set_balance", entity_type="user", entity_id=locked.id,
                new_values={"target": str(target), "delta": str(delta),
                            "description": description},
                ip_address=ip_address)
    return tx


@transaction.atomic
def admin_adjust_balance(*, user, amount, admin, description, ip_address=None):
    """Manual credit or debit. Signed: negative debits."""
    amount = quantize(amount)
    if amount == 0:
        raise WalletError("Adjustment amount cannot be zero.")

    locked = User.objects.select_for_update().get(pk=user.pk)
    new_balance = (locked.wallet_balance or Decimal("0")) + amount
    if new_balance < 0:
        raise WalletError("Adjustment would leave a negative balance.")
    locked.wallet_balance = new_balance
    locked.save(update_fields=["wallet_balance", "updated_at"])

    tx = Transaction.objects.create(
        user=locked, tx_type="adjustment", amount=amount,
        balance_after=new_balance, description=description or "Admin adjustment",
        reference_type="adjustment", created_by=admin,
    )
    notify(locked, title="Balance adjusted",
           message=f"An administrator adjusted your balance by {amount}. {description}",
           notif_type="adjustment", action_url="/wallet")
    write_audit(admin, "adjust_balance", entity_type="user", entity_id=locked.id,
                new_values={"amount": str(amount), "description": description},
                ip_address=ip_address)
    return tx
