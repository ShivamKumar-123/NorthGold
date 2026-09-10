"""The referral engine.

One payment, to one person, once a month.

When a member's investment pays its month-N return, the member's direct
sponsor earns a percentage of what that member *deposited* — not of the return
they just received. The percentage comes from the referral matrix: the deposit
picks a slab, the slab holds a rate for each month.

This replaced a five-level chain that paid on two separate events at five
depths. What is gone with it: indirect levels, qualification gates, and the
one-off payment on the deposit itself. What is kept: idempotency. `Commission`
is unique on (earner, trigger, reference_id) keyed to the payout, so a retried
task or two overlapping sweeps converge on exactly one payment.
"""
import logging
from decimal import ROUND_DOWN, Decimal

from django.db import IntegrityError, transaction
from django.db.models import Count, Sum

from apps.accounts.models import User
from apps.core.services import get_setting, notify

from .models import Commission, ReferralPlan

logger = logging.getLogger(__name__)

CENT = Decimal("0.01")


def quantize(amount):
    """Round DOWN to cents. Rounding up would let the platform pay out
    fractions of a cent more than it collected, on every single payment."""
    return Decimal(str(amount)).quantize(CENT, rounding=ROUND_DOWN)


@transaction.atomic
def pay_referral_commission(*, investment, month_index, reference_id,
                            reference_type="roi_payout"):
    """Pay the direct sponsor for one month of one investment.

    Returns the Commission row, or None when there is nothing to pay — no
    sponsor, no slab covering the deposit, an unconfigured month, or a rate
    that rounds to nothing.

    The base is the investment principal, so a $1,000 deposit at 1% earns the
    sponsor $10 in that month regardless of what the investor's own return was.
    """
    if not get_setting("referral_enabled"):
        logger.info("Referral payouts disabled by setting; skipping")
        return None

    member = investment.user
    sponsor = member.sponsor
    if sponsor is None:
        return None
    if sponsor.status != "active":
        # Recorded rather than dropped: a sponsor asking why a month is
        # missing deserves an answer that is written down.
        return _record(
            earner=sponsor, source_user=member, month_index=month_index,
            base_amount=investment.principal, percent=Decimal("0"),
            amount=Decimal("0"), status="skipped",
            skip_reason=f"Sponsor account is {sponsor.status}",
            reference_id=reference_id, reference_type=reference_type,
            description=f"Month {month_index} referral commission",
        )

    plan = ReferralPlan.for_amount(investment.principal)
    if plan is None:
        logger.warning("No referral slab covers %s; nothing to pay",
                       investment.principal)
        return None

    percent = plan.percent_for_month(month_index)
    if percent is None or percent <= 0:
        return None

    amount = quantize(investment.principal * percent / Decimal("100"))
    if amount <= 0:
        return None

    row = _record(
        earner=sponsor, source_user=member, month_index=month_index,
        base_amount=investment.principal, percent=percent, amount=amount,
        status="paid", reference_id=reference_id, reference_type=reference_type,
        description=f"Month {month_index} referral commission ({plan.name})",
    )
    if row is None:
        # Already paid for this payout — a retry. Nothing more to do.
        return None

    _credit(sponsor, amount, row, member, month_index)
    return row


def _record(**kwargs):
    """Insert one Commission row, or return None if this payout already paid
    this sponsor (the unique constraint fires)."""
    try:
        with transaction.atomic():
            return Commission.objects.create(**kwargs)
    except IntegrityError:
        logger.info(
            "Referral commission already recorded earner=%s ref=%s",
            kwargs.get("earner").id, kwargs.get("reference_id"),
        )
        return None


def _credit(sponsor, amount, commission, member, month_index):
    """Move the money. Row-locks the earner so two concurrent payments to the
    same sponsor cannot both read a stale balance."""
    from apps.wallet.models import Transaction

    locked = User.objects.select_for_update().get(pk=sponsor.pk)
    locked.wallet_balance = (locked.wallet_balance or Decimal("0")) + amount
    locked.total_commission_earned = (locked.total_commission_earned or Decimal("0")) + amount
    locked.save(update_fields=["wallet_balance", "total_commission_earned", "updated_at"])

    Transaction.objects.create(
        user=locked,
        tx_type="commission",
        amount=amount,
        balance_after=locked.wallet_balance,
        description=f"Referral commission on {member.full_name}'s deposit, month {month_index}",
        reference_id=commission.id,
        reference_type="commission",
    )
    notify(
        locked,
        title="Referral commission credited",
        message=(f"You earned {amount} from {member.full_name}'s deposit "
                 f"(month {month_index}, {commission.percent}%)."),
        notif_type="commission",
        action_url="/referrals",
    )


# ─── Reporting ────────────────────────────────────────────────────────────

def earnings_breakdown(user):
    """Totals for the member's referral dashboard.

    Reported per referral rather than per level: with the chain gone, "who is
    paying me" is the only breakdown that still means anything.
    """
    paid = Commission.objects.filter(earner=user, status="paid")

    by_referral = [
        {
            "user_id": str(row["source_user"]),
            "name": row["source_user__first_name"] + " " + row["source_user__last_name"],
            "email": row["source_user__email"],
            "total": float(row["total"] or 0),
            "months": row["months"],
        }
        for row in paid.values(
            "source_user", "source_user__first_name",
            "source_user__last_name", "source_user__email",
        ).annotate(total=Sum("amount"), months=Count("id")).order_by("-total")
    ]
    total = paid.aggregate(t=Sum("amount"))["t"] or Decimal("0")

    return {
        "total_earned": float(total),
        "paying_referrals": len(by_referral),
        "by_referral": by_referral,
    }


def referral_matrix():
    """The whole matrix, for the public structure endpoint and the editor."""
    return [
        {
            "id": str(plan.id),
            "name": plan.name,
            "description": plan.description,
            "min_amount": float(plan.min_amount),
            "max_amount": float(plan.max_amount) if plan.max_amount is not None else None,
            "tenure_months": plan.tenure_months,
            "is_active": plan.is_active,
            "display_order": plan.display_order,
            "total_percent": float(plan.total_percent),
            "months": [
                {"month_index": m.month_index, "percent": float(m.percent)}
                for m in plan.months.all()
            ],
        }
        for plan in ReferralPlan.objects.filter(is_active=True).prefetch_related("months")
    ]
