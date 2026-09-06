"""ROI plans and the investments that run on them.

The product rule: how much a user earns each month depends on TWO axes —

    (a) how much they put in   -> RoiPlan, selected by amount slab
    (b) how long they hold it  -> RoiPlanMonth, one row per month 1..tenure

So a $1,000 deposit lands in the "Silver" plan and earns Silver's month-1
percent in its first month, month-2 percent in its second, and so on. A $50,000
deposit lands in "Platinum" and follows a completely different 12-month curve.
Both curves are admin-editable from the dashboard.

Months are DEPOSIT-RELATIVE, not calendar: month 1 falls one month after the
investment starts, whenever that was.
"""
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.accounts.models import User
from apps.core.models import TimeStampedUUIDModel

INVESTMENT_STATUS = [
    ("active", "Active"),
    ("matured", "Matured"),
    ("cancelled", "Cancelled"),
]

PAYOUT_STATUS = [
    ("paid", "Paid"),
    ("skipped", "Skipped"),
    ("failed", "Failed"),
]


def add_months(dt, months):
    """Shift a datetime by whole months, clamping to the shorter month.

    Jan 31 + 1 month = Feb 28 (or 29). Without the clamp, a month-31 start date
    would silently skip February's payout every year.
    """
    year = dt.year + (dt.month - 1 + months) // 12
    month = (dt.month - 1 + months) % 12 + 1
    days_in_month = [31, 29 if (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0))
                     else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
    return dt.replace(year=year, month=month, day=min(dt.day, days_in_month))


class RoiPlan(TimeStampedUUIDModel):
    """One deposit slab and its holding-period curve."""

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    # Slab bounds. `max_amount` NULL means open-ended (the top tier).
    min_amount = models.DecimalField(
        max_digits=18, decimal_places=2, validators=[MinValueValidator(Decimal("0"))],
    )
    max_amount = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True,
        help_text="Leave blank for an open-ended top tier.",
    )
    tenure_months = models.PositiveIntegerField(
        default=12, help_text="How many monthly payouts this plan runs for.",
    )
    # When true the principal is released back to the wallet at maturity;
    # when false it stays locked until an admin releases it manually.
    return_principal_at_maturity = models.BooleanField(default=True)
    allow_early_exit = models.BooleanField(default=False)
    early_exit_penalty_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0"),
    )
    is_active = models.BooleanField(default=True, db_index=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "roi_plans"
        ordering = ["display_order", "min_amount"]

    def __str__(self):
        ceiling = f"{self.max_amount:,.0f}" if self.max_amount is not None else "∞"
        return f"{self.name} ({self.min_amount:,.0f}-{ceiling})"

    def percent_for_month(self, month_index):
        """The configured percent for month N, or 0 when unconfigured.

        Unconfigured months pay nothing rather than falling back to a default —
        a missing row must never silently invent a rate.
        """
        row = self.months.filter(month_index=month_index).first()
        return row.percent if row else Decimal("0")

    @property
    def total_return_percent(self):
        total = self.months.aggregate(t=models.Sum("percent"))["t"]
        return total or Decimal("0")

    @classmethod
    def for_amount(cls, amount):
        """The active plan whose slab contains `amount`.

        Ties break toward the higher `min_amount`, so overlapping slabs resolve
        to the most specific (highest) tier rather than an arbitrary one.
        """
        amount = Decimal(str(amount))
        return (
            cls.objects.filter(is_active=True, min_amount__lte=amount)
            .filter(models.Q(max_amount__isnull=True) | models.Q(max_amount__gte=amount))
            .order_by("-min_amount")
            .first()
        )


class RoiPlanMonth(models.Model):
    """One cell of the plan matrix: month N pays this percent of the principal."""

    plan = models.ForeignKey(RoiPlan, on_delete=models.CASCADE, related_name="months")
    month_index = models.PositiveIntegerField(help_text="1 = first month after the deposit.")
    percent = models.DecimalField(
        max_digits=6, decimal_places=3,
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Percent of the original principal paid in this month.",
    )

    class Meta:
        db_table = "roi_plan_months"
        ordering = ["plan", "month_index"]
        constraints = [
            models.UniqueConstraint(
                fields=["plan", "month_index"], name="uniq_plan_month",
            ),
        ]

    def __str__(self):
        return f"{self.plan.name} M{self.month_index}: {self.percent}%"


class Investment(TimeStampedUUIDModel):
    """A single locked principal running its plan's schedule.

    `plan_snapshot` freezes the month->percent curve at the moment of purchase.
    If an admin later edits the plan, existing investments keep the terms the
    user actually agreed to; only new investments get the new curve.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="investments")
    plan = models.ForeignKey(
        RoiPlan, on_delete=models.PROTECT, related_name="investments",
    )
    instrument = models.ForeignKey(
        "instruments.Instrument", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="investments",
    )
    principal = models.DecimalField(max_digits=18, decimal_places=2)
    plan_snapshot = models.JSONField(
        default=dict,
        help_text="Frozen plan terms: {tenure_months, months: {'1': '1.500', ...}}",
    )
    start_date = models.DateTimeField(db_index=True)
    maturity_date = models.DateTimeField(db_index=True)
    status = models.CharField(
        max_length=20, choices=INVESTMENT_STATUS, default="active", db_index=True,
    )
    months_paid = models.PositiveIntegerField(default=0)
    total_roi_paid = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    principal_released = models.BooleanField(default=False)
    source_deposit = models.ForeignKey(
        "wallet.Deposit", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="investments",
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "investments"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "start_date"])]

    def __str__(self):
        return f"{self.user_id} {self.principal} ({self.plan_id})"

    @property
    def tenure_months(self):
        return int(self.plan_snapshot.get("tenure_months") or self.plan.tenure_months)

    def snapshot_percent(self, month_index):
        months = self.plan_snapshot.get("months") or {}
        raw = months.get(str(month_index))
        if raw is None:
            return Decimal("0")
        return Decimal(str(raw))

    def due_date_for_month(self, month_index):
        return add_months(self.start_date, month_index)


class RoiPayout(TimeStampedUUIDModel):
    """One monthly credit. Unique per (investment, month) — the payout runner is
    idempotent, so a retried or overlapping sweep can never double-pay."""

    investment = models.ForeignKey(
        Investment, on_delete=models.CASCADE, related_name="payouts",
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="roi_payouts")
    month_index = models.PositiveIntegerField()
    percent = models.DecimalField(max_digits=6, decimal_places=3)
    base_amount = models.DecimalField(
        max_digits=18, decimal_places=2, help_text="Principal the percent applied to.",
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    due_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=PAYOUT_STATUS, default="paid")
    credited_to = models.CharField(
        max_length=20, default="wallet",
        help_text="'wallet' (withdrawable) or 'principal' (compounded).",
    )

    class Meta:
        db_table = "roi_payouts"
        ordering = ["-due_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["investment", "month_index"], name="uniq_investment_month_payout",
            ),
        ]

    def __str__(self):
        return f"M{self.month_index} {self.amount} -> {self.user_id}"
