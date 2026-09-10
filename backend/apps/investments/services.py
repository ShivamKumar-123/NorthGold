"""Buying an investment, and the monthly ROI payout runner.

The runner is the piece that has to be right. It is:

  * idempotent   — RoiPayout is unique per (investment, month_index)
  * catch-up safe — if the worker is down for six weeks it pays every month
    that came due in the meantime, in order, rather than only the latest
  * deposit-relative — month N is due on the Nth monthly anniversary of the
    investment's own start date, not on the 1st of a calendar month
"""
import logging
from decimal import ROUND_DOWN, Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.core.services import get_setting, notify

from .models import Investment, RoiPayout, RoiPlan, add_months

logger = logging.getLogger(__name__)

CENT = Decimal("0.01")


def quantize(amount):
    return Decimal(str(amount)).quantize(CENT, rounding=ROUND_DOWN)


def build_plan_snapshot(plan):
    """Freeze the plan's month curve so later admin edits cannot retroactively
    change what an existing investor was promised."""
    return {
        "plan_name": plan.name,
        "tenure_months": plan.tenure_months,
        "min_amount": str(plan.min_amount),
        "max_amount": str(plan.max_amount) if plan.max_amount is not None else None,
        "return_principal_at_maturity": plan.return_principal_at_maturity,
        "months": {
            str(m.month_index): str(m.percent)
            for m in plan.months.all().order_by("month_index")
        },
    }


class InvestmentError(Exception):
    """Business-rule failure — surfaced to the API as a 400, not a 500."""


@transaction.atomic
def create_investment(*, user, amount, plan=None, instrument=None,
                      source_deposit=None, from_wallet=True, start_date=None):
    """Lock `amount` of the user's wallet into a plan.

    When `plan` is None the slab is chosen from the amount — that is the whole
    "deposit $1,000, get the $1,000-tier curve" rule.
    """
    amount = quantize(amount)
    if amount <= 0:
        raise InvestmentError("Investment amount must be greater than zero.")

    if plan is None:
        if instrument is not None and instrument.roi_plan_id:
            plan = instrument.roi_plan
        else:
            plan = RoiPlan.for_amount(amount)
    if plan is None:
        raise InvestmentError(
            f"No active plan covers an amount of {amount}. Ask support to configure one."
        )
    if not plan.is_active:
        raise InvestmentError(f"Plan '{plan.name}' is not currently open.")
    if amount < plan.min_amount:
        raise InvestmentError(f"Plan '{plan.name}' requires at least {plan.min_amount}.")
    if plan.max_amount is not None and amount > plan.max_amount:
        raise InvestmentError(f"Plan '{plan.name}' accepts at most {plan.max_amount}.")

    snapshot = build_plan_snapshot(plan)
    if not snapshot["months"]:
        raise InvestmentError(
            f"Plan '{plan.name}' has no monthly percentages configured yet."
        )

    locked = User.objects.select_for_update().get(pk=user.pk)
    if from_wallet:
        if (locked.wallet_balance or Decimal("0")) < amount:
            raise InvestmentError("Insufficient wallet balance.")
        locked.wallet_balance -= amount
    locked.invested_balance = (locked.invested_balance or Decimal("0")) + amount
    locked.save(update_fields=["wallet_balance", "invested_balance", "updated_at"])

    start = start_date or timezone.now()
    investment = Investment.objects.create(
        user=locked,
        plan=plan,
        instrument=instrument,
        principal=amount,
        plan_snapshot=snapshot,
        start_date=start,
        maturity_date=add_months(start, plan.tenure_months),
        source_deposit=source_deposit,
    )

    from apps.wallet.models import Transaction
    Transaction.objects.create(
        user=locked,
        tx_type="investment",
        amount=-amount if from_wallet else Decimal("0"),
        balance_after=locked.wallet_balance,
        description=f"Invested {amount} in {plan.name} ({plan.tenure_months} months)",
        reference_id=investment.id,
        reference_type="investment",
    )
    notify(
        locked,
        title="Investment started",
        message=(f"{amount} is now earning under {plan.name}. "
                 f"First payout due {add_months(start, 1):%d %b %Y}."),
        notif_type="investment",
        action_url="/investments",
    )
    return investment


def due_months(investment, now=None):
    """Month indexes that have come due and are not yet paid, in order."""
    now = now or timezone.now()
    if investment.status != "active":
        return []

    already_paid = set(
        investment.payouts.values_list("month_index", flat=True)
    )
    due = []
    for month_index in range(1, investment.tenure_months + 1):
        if month_index in already_paid:
            continue
        if investment.due_date_for_month(month_index) <= now:
            due.append(month_index)
    return due


@transaction.atomic
def pay_investment_month(investment, month_index, now=None):
    """Credit one month's ROI and cascade the MLM override.

    Returns the RoiPayout, or None when it was already paid (idempotent retry)
    or the configured percent is zero.
    """
    from apps.mlm.services import pay_referral_commission
    from apps.wallet.models import Transaction

    now = now or timezone.now()
    percent = investment.snapshot_percent(month_index)
    due_at = investment.due_date_for_month(month_index)

    if percent <= 0:
        # A configured-zero month still gets a row, so the schedule stays
        # complete and the runner does not re-examine it every hour.
        try:
            return RoiPayout.objects.create(
                investment=investment, user=investment.user, month_index=month_index,
                percent=Decimal("0"), base_amount=investment.principal,
                amount=Decimal("0"), due_at=due_at, status="skipped",
                credited_to="wallet",
            )
        except IntegrityError:
            return None

    amount = quantize(investment.principal * percent / Decimal("100"))
    if amount <= 0:
        return None

    target = str(get_setting("roi_credit_target") or "wallet")
    if target not in ("wallet", "principal"):
        target = "wallet"

    try:
        payout = RoiPayout.objects.create(
            investment=investment, user=investment.user, month_index=month_index,
            percent=percent, base_amount=investment.principal, amount=amount,
            due_at=due_at, status="paid", credited_to=target,
        )
    except IntegrityError:
        logger.info("ROI month already paid investment=%s month=%s",
                    investment.id, month_index)
        return None

    locked = User.objects.select_for_update().get(pk=investment.user_id)
    if target == "principal":
        # Compounding: the payout is added to the locked principal instead of
        # the wallet, so next month's percent applies to a larger base.
        locked.invested_balance = (locked.invested_balance or Decimal("0")) + amount
        investment.principal = investment.principal + amount
    else:
        locked.wallet_balance = (locked.wallet_balance or Decimal("0")) + amount
    locked.total_roi_earned = (locked.total_roi_earned or Decimal("0")) + amount
    locked.save(update_fields=["wallet_balance", "invested_balance",
                               "total_roi_earned", "updated_at"])

    investment.months_paid = investment.payouts.filter(status="paid").count()
    investment.total_roi_paid = (investment.total_roi_paid or Decimal("0")) + amount
    investment.save(update_fields=["months_paid", "total_roi_paid", "principal",
                                   "updated_at"])

    Transaction.objects.create(
        user=locked,
        tx_type="roi",
        amount=amount,
        balance_after=locked.wallet_balance,
        description=(f"Month {month_index} ROI ({percent}%) on "
                     f"{investment.plan_snapshot.get('plan_name', 'plan')}"),
        reference_id=payout.id,
        reference_type="roi_payout",
    )
    notify(
        locked,
        title=f"Monthly return credited ({percent}%)",
        message=(f"{amount} was added to your "
                 f"{'principal' if target == 'principal' else 'wallet'} "
                 f"for month {month_index}."),
        notif_type="roi",
        action_url="/investments",
    )

    # The sponsor's month rides on this payout, and is keyed to it — which is
    # what makes a retried sweep pay them once. The base is the principal, not
    # the return just credited: the referral matrix is a rate on what was
    # deposited.
    pay_referral_commission(
        investment=investment,
        month_index=month_index,
        reference_id=payout.id,
        reference_type="roi_payout",
    )
    return payout


@transaction.atomic
def mature_investment(investment, now=None):
    """Close a fully-paid investment and release the principal if the plan says so."""
    from apps.wallet.models import Transaction

    now = now or timezone.now()
    if investment.status != "active":
        return investment

    investment.status = "matured"
    investment.closed_at = now

    release = investment.plan_snapshot.get("return_principal_at_maturity", True)
    locked = User.objects.select_for_update().get(pk=investment.user_id)
    principal = investment.principal

    locked.invested_balance = max(
        Decimal("0"), (locked.invested_balance or Decimal("0")) - principal,
    )
    if release:
        locked.wallet_balance = (locked.wallet_balance or Decimal("0")) + principal
        investment.principal_released = True
    locked.save(update_fields=["wallet_balance", "invested_balance", "updated_at"])
    investment.save(update_fields=["status", "closed_at", "principal_released",
                                   "updated_at"])

    if release:
        Transaction.objects.create(
            user=locked, tx_type="principal_return", amount=principal,
            balance_after=locked.wallet_balance,
            description=f"Principal returned at maturity ({investment.plan_snapshot.get('plan_name', '')})",
            reference_id=investment.id, reference_type="investment",
        )
    notify(
        locked,
        title="Investment matured",
        message=(f"Your {principal} investment completed its term. "
                 + ("The principal is back in your wallet." if release
                    else "The principal remains held; contact support to release it.")),
        notif_type="investment", action_url="/investments",
    )
    return investment


def run_due_payouts(now=None, investment_ids=None):
    """Sweep every active investment and pay whatever is due.

    Each investment is processed in its own transaction so one bad row cannot
    block the rest of the book.
    """
    now = now or timezone.now()
    qs = Investment.objects.filter(status="active").select_related("user", "plan")
    if investment_ids:
        qs = qs.filter(id__in=investment_ids)

    summary = {"investments_processed": 0, "months_paid": 0,
               "amount_paid": Decimal("0"), "matured": 0, "errors": 0}

    for investment in qs.iterator(chunk_size=200):
        try:
            months = due_months(investment, now)
            for month_index in months:
                payout = pay_investment_month(investment, month_index, now)
                if payout and payout.status == "paid":
                    summary["months_paid"] += 1
                    summary["amount_paid"] += payout.amount

            investment.refresh_from_db()
            total_months = investment.tenure_months
            settled = investment.payouts.count()
            if settled >= total_months and investment.maturity_date <= now:
                mature_investment(investment, now)
                summary["matured"] += 1

            summary["investments_processed"] += 1
        except Exception:
            summary["errors"] += 1
            logger.exception("ROI payout failed for investment %s", investment.id)

    summary["amount_paid"] = float(summary["amount_paid"])
    return summary


def projected_schedule(plan, amount):
    """What a given amount would earn under a plan, month by month.

    Powers the "see your returns" calculator on the landing page — no
    investment is created, nothing is written.
    """
    amount = Decimal(str(amount or 0))
    rows = []
    running = Decimal("0")
    for month in plan.months.all().order_by("month_index"):
        payout = quantize(amount * month.percent / Decimal("100"))
        running += payout
        rows.append({
            "month": month.month_index,
            "percent": float(month.percent),
            "payout": float(payout),
            "cumulative": float(running),
        })
    return {
        "plan": plan.name,
        "principal": float(amount),
        "tenure_months": plan.tenure_months,
        "total_return": float(running),
        "total_return_percent": float(plan.total_return_percent),
        "returns_principal": plan.return_principal_at_maturity,
        "schedule": rows,
    }
