"""The commission engine.

Walks up the sponsor chain from whoever generated the money and pays each
ancestor their configured share — the same shape as the reference platform's
`distribute_ib_commission`, but driven by deposits and monthly ROI payouts
instead of trade lots.

Everything here is idempotent: `Commission` carries a unique constraint on
(earner, trigger, reference_id), so a retried Celery task, a double-clicked
approve button, or two overlapping sweeps all converge on one payment.
"""
import logging
from decimal import ROUND_DOWN, Decimal

from django.db import IntegrityError, transaction
from django.db.models import Count, Sum

from apps.accounts.models import User
from apps.core.services import get_setting, notify

from .models import Commission, MlmLevelConfig

logger = logging.getLogger(__name__)

CENT = Decimal("0.01")

TRIGGER_SETTING = {
    "deposit": "mlm_deposit_enabled",
    "investment": "mlm_deposit_enabled",
    "roi": "mlm_roi_enabled",
}


def quantize(amount):
    """Round DOWN to cents. Rounding up would let the platform pay out fractions
    of a cent more than it collected on every single payout."""
    return Decimal(str(amount)).quantize(CENT, rounding=ROUND_DOWN)


def active_level_configs():
    return {c.level: c for c in MlmLevelConfig.objects.filter(is_active=True)}


def _qualifies(upline, config):
    """Returns (ok, reason). A failing upline is recorded as skipped, not
    silently dropped — otherwise nobody can explain a missing payout."""
    if config.min_direct_referrals:
        directs = User.objects.filter(sponsor=upline, status="active").count()
        if directs < config.min_direct_referrals:
            return False, (f"Needs {config.min_direct_referrals} direct referrals, has {directs}")

    required = config.min_self_investment or Decimal("0")
    if get_setting("mlm_require_active_investment") and required <= 0:
        required = Decimal("0.01")
    if required > 0:
        from apps.investments.models import Investment
        held = Investment.objects.filter(
            user=upline, status="active",
        ).aggregate(t=Sum("principal"))["t"] or Decimal("0")
        if held < required:
            return False, f"Needs {required} active principal, holds {held}"

    if upline.status != "active":
        return False, f"Upline account is {upline.status}"

    return True, ""


@transaction.atomic
def distribute_commission(*, source_user, base_amount, trigger, reference_id,
                          reference_type="", description=""):
    """Pay the upline chain above `source_user`.

    Returns the list of Commission rows created (paid and skipped alike).
    Callers should treat a raised exception as fatal to their own transaction —
    money must not move for the source event if the chain half-paid.
    """
    base_amount = Decimal(str(base_amount or 0))
    if base_amount <= 0:
        return []

    setting_key = TRIGGER_SETTING.get(trigger)
    if setting_key and not get_setting(setting_key):
        logger.info("MLM %s payouts disabled by setting; skipping", trigger)
        return []

    max_levels = int(get_setting("mlm_max_levels") or 5)
    configs = active_level_configs()
    if not configs:
        logger.warning("No active MLM level configuration; nothing to distribute")
        return []

    chain = source_user.upline_chain(max_levels)
    if not chain:
        return []

    created = []
    for level, upline in enumerate(chain, start=1):
        config = configs.get(level)
        if config is None:
            continue

        percent = config.percent_for(trigger)
        if percent is None or percent <= 0:
            continue

        ok, reason = _qualifies(upline, config)
        amount = quantize(base_amount * percent / Decimal("100"))

        if not ok or amount <= 0:
            row = _record(
                earner=upline, source_user=source_user, level=level, trigger=trigger,
                base_amount=base_amount, percent=percent, amount=Decimal("0"),
                status="skipped",
                skip_reason=reason or "Computed amount rounded to zero",
                reference_id=reference_id, reference_type=reference_type,
                description=description,
            )
            if row:
                created.append(row)
            continue

        row = _record(
            earner=upline, source_user=source_user, level=level, trigger=trigger,
            base_amount=base_amount, percent=percent, amount=amount, status="paid",
            reference_id=reference_id, reference_type=reference_type,
            description=description,
        )
        if row is None:
            # Already paid for this event — a retry. Nothing more to do.
            continue

        _credit(upline, amount, row, source_user, level, trigger)
        created.append(row)

    return created


def _record(**kwargs):
    """Insert one Commission row, or return None if this event already paid this
    earner (the unique constraint fires)."""
    try:
        with transaction.atomic():
            return Commission.objects.create(**kwargs)
    except IntegrityError:
        logger.info(
            "Commission already recorded earner=%s trigger=%s ref=%s",
            kwargs.get("earner").id, kwargs.get("trigger"), kwargs.get("reference_id"),
        )
        return None


def _credit(upline, amount, commission, source_user, level, trigger):
    """Move the money. Row-locks the earner so two concurrent payouts to the
    same upline cannot both read the same stale balance."""
    from apps.wallet.models import Transaction

    locked = User.objects.select_for_update().get(pk=upline.pk)
    locked.wallet_balance = (locked.wallet_balance or Decimal("0")) + amount
    locked.total_commission_earned = (locked.total_commission_earned or Decimal("0")) + amount
    locked.save(update_fields=["wallet_balance", "total_commission_earned", "updated_at"])

    kind = "Direct" if level == 1 else f"Level {level}"
    label = "deposit" if trigger in ("deposit", "investment") else "monthly ROI"
    Transaction.objects.create(
        user=locked,
        tx_type="commission",
        amount=amount,
        balance_after=locked.wallet_balance,
        description=f"{kind} referral commission on {source_user.full_name}'s {label}",
        reference_id=commission.id,
        reference_type="commission",
    )
    notify(
        locked,
        title="Referral commission credited",
        message=(f"You earned {amount} from {source_user.full_name}'s {label} "
                 f"({kind}, {commission.percent}%)."),
        notif_type="commission",
        action_url="/referrals",
    )


# ─── Reporting ────────────────────────────────────────────────────────────

def earnings_breakdown(user):
    """Per-level and per-trigger totals for the user's earnings dashboard."""
    paid = Commission.objects.filter(earner=user, status="paid")

    by_level = [
        {"level": row["level"], "total": float(row["total"] or 0), "count": row["count"]}
        for row in paid.values("level").annotate(
            total=Sum("amount"), count=Count("id"),
        ).order_by("level")
    ]
    by_trigger = {
        row["trigger"]: float(row["total"] or 0)
        for row in paid.values("trigger").annotate(total=Sum("amount"))
    }
    total = paid.aggregate(t=Sum("amount"))["t"] or Decimal("0")

    return {
        "total_earned": float(total),
        "direct_earned": float(
            paid.filter(level=1).aggregate(t=Sum("amount"))["t"] or 0
        ),
        "indirect_earned": float(
            paid.filter(level__gt=1).aggregate(t=Sum("amount"))["t"] or 0
        ),
        "by_level": by_level,
        "by_trigger": by_trigger,
    }
