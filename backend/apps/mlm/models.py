"""The referral programme.

A sponsor earns on what the person they introduced *deposited*, every month
that deposit pays out, for as long as the investment runs. Two things decide
the rate, and both are the administrator's to set:

  * how much was deposited — the amount picks a slab, the same way an
    investment picks its ROI plan;
  * which month it is — each slab holds one percentage per month of the term,
    so the rate moves as the investment ages.

There are no levels. Only the direct sponsor earns, and they earn once a month
rather than once on the deposit and again on every return. The five-level
chain this replaced paid two different rates on two different events at five
depths, which is ten numbers to reason about before anyone can answer "what do
I actually earn on this".
"""
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.accounts.models import User
from apps.core.models import TimeStampedUUIDModel

COMMISSION_TRIGGERS = [
    ("referral", "Monthly referral"),
]

COMMISSION_STATUS = [
    ("paid", "Paid"),
    ("skipped", "Skipped"),
    ("reversed", "Reversed"),
]


class ReferralPlan(TimeStampedUUIDModel):
    """One deposit slab and the month-by-month rate its sponsor earns.

    Deliberately the same shape as `RoiPlan`: the two matrices are edited side
    by side in the panel, and an administrator who has understood one has
    understood the other.
    """

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    min_amount = models.DecimalField(
        max_digits=18, decimal_places=2, validators=[MinValueValidator(Decimal("0"))],
    )
    max_amount = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True,
        help_text="Leave blank for an open-ended top slab.",
    )
    tenure_months = models.PositiveIntegerField(
        default=12, help_text="How many monthly payments a sponsor receives.",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "referral_plans"
        ordering = ["display_order", "min_amount"]

    def __str__(self):
        ceiling = f"{self.max_amount:,.0f}" if self.max_amount is not None else "∞"
        return f"{self.name} ({self.min_amount:,.0f}-{ceiling})"

    def percent_for_month(self, month_index):
        """The configured percent for month N, or zero when unconfigured.

        A missing row pays nothing rather than falling back to a default. An
        administrator who has not filled a cell has not agreed to a number, and
        inventing one pays out money nobody approved.
        """
        row = self.months.filter(month_index=month_index).first()
        return row.percent if row else Decimal("0")

    @property
    def total_percent(self):
        return self.months.aggregate(t=models.Sum("percent"))["t"] or Decimal("0")

    @classmethod
    def for_amount(cls, amount):
        """The active slab containing `amount`.

        Ties break toward the higher `min_amount`, so overlapping slabs resolve
        to the most specific rather than an arbitrary one.
        """
        amount = Decimal(str(amount))
        return (
            cls.objects.filter(is_active=True, min_amount__lte=amount)
            .filter(models.Q(max_amount__isnull=True) | models.Q(max_amount__gte=amount))
            .order_by("-min_amount")
            .first()
        )


class ReferralPlanMonth(models.Model):
    """One cell of the referral matrix: in month N the sponsor earns this
    percent of what their referral deposited."""

    plan = models.ForeignKey(
        ReferralPlan, on_delete=models.CASCADE, related_name="months",
    )
    month_index = models.PositiveIntegerField(help_text="1 = the first month after the deposit.")
    percent = models.DecimalField(
        max_digits=6, decimal_places=3,
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Percent of the referral's deposit paid to their sponsor this month.",
    )

    class Meta:
        db_table = "referral_plan_months"
        ordering = ["plan", "month_index"]
        constraints = [
            models.UniqueConstraint(
                fields=["plan", "month_index"], name="uniq_referral_plan_month",
            ),
        ]

    def __str__(self):
        return f"{self.plan.name} M{self.month_index}: {self.percent}%"


class Commission(TimeStampedUUIDModel):
    """One monthly referral payment to one sponsor.

    `(earner, trigger, reference_id)` is unique, keyed on the payout that
    triggered it: the same month can never pay the same sponsor twice, however
    many times the sweep is retried.
    """

    earner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="commissions_earned",
    )
    source_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="commissions_generated",
        help_text="The referral whose deposit produced this payment.",
    )
    # Always 1 now. Kept so commission earned under the old five-level scheme
    # stays readable rather than silently claiming to be something it was not.
    level = models.PositiveIntegerField(default=1, db_index=True)
    trigger = models.CharField(
        max_length=20, choices=COMMISSION_TRIGGERS, default="referral", db_index=True,
    )
    month_index = models.PositiveIntegerField(
        default=0, help_text="Which month of the referral's investment this paid for.",
    )
    base_amount = models.DecimalField(
        max_digits=18, decimal_places=2,
        help_text="The referral's deposit, which the percent applied to.",
    )
    percent = models.DecimalField(max_digits=6, decimal_places=3)
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    status = models.CharField(
        max_length=20, choices=COMMISSION_STATUS, default="paid", db_index=True,
    )
    skip_reason = models.CharField(max_length=200, blank=True)
    reference_id = models.UUIDField(null=True, blank=True, db_index=True)
    reference_type = models.CharField(max_length=40, blank=True)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "mlm_commissions"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["earner", "trigger", "reference_id"],
                name="uniq_commission_per_earner_event",
            ),
        ]
        indexes = [
            models.Index(fields=["earner", "status", "created_at"]),
            models.Index(fields=["source_user", "created_at"]),
        ]

    def __str__(self):
        return f"M{self.month_index} {self.amount} -> {self.earner_id}"
