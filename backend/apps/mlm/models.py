"""MLM configuration and the commission ledger.

Level 1 is a DIRECT referral; levels 2 and beyond are INDIRECT. Each level
carries two independent rates because the two earning events are different in
kind:

  * `deposit_percent` — one-off, paid when a downline member's deposit is
    approved. This is joining/business income.
  * `roi_percent`     — recurring, paid every time a downline member receives a
    monthly ROI payout. This is the passive override.

Both are admin-editable and each can be switched off platform-wide from
SystemSetting (`mlm_deposit_enabled` / `mlm_roi_enabled`).
"""
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.accounts.models import User
from apps.core.models import TimeStampedUUIDModel

COMMISSION_TRIGGERS = [
    ("deposit", "Deposit"),
    ("roi", "ROI Payout"),
    ("investment", "Investment Purchase"),
]

COMMISSION_STATUS = [
    ("paid", "Paid"),
    ("skipped", "Skipped (unqualified)"),
    ("reversed", "Reversed"),
]


class MlmLevelConfig(models.Model):
    """One row per level. Level 1 = direct referral."""

    level = models.PositiveIntegerField(unique=True)
    label = models.CharField(max_length=60, blank=True)
    deposit_percent = models.DecimalField(
        max_digits=6, decimal_places=3, default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Percent of a downline deposit paid to this level.",
    )
    roi_percent = models.DecimalField(
        max_digits=6, decimal_places=3, default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Percent of a downline monthly ROI payout paid to this level.",
    )
    # Qualification gates — an upline that fails these is recorded as 'skipped'
    # rather than paid, so the audit trail shows why nothing was earned.
    min_direct_referrals = models.PositiveIntegerField(
        default=0, help_text="Direct referrals required to unlock this level.",
    )
    min_self_investment = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal("0"),
        help_text="Active principal the upline must hold to earn at this level.",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "mlm_level_configs"
        ordering = ["level"]

    def __str__(self):
        kind = "direct" if self.level == 1 else "indirect"
        return f"L{self.level} ({kind}) dep {self.deposit_percent}% / roi {self.roi_percent}%"

    def percent_for(self, trigger):
        if trigger == "roi":
            return self.roi_percent
        return self.deposit_percent


class Commission(TimeStampedUUIDModel):
    """One earning event for one upline member.

    `(earner, trigger, reference_id)` is unique: the same source event can never
    pay the same upline twice, however many times a task is retried.
    """

    earner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="commissions_earned",
    )
    source_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="commissions_generated",
        help_text="The downline member whose activity produced this commission.",
    )
    level = models.PositiveIntegerField(db_index=True)
    trigger = models.CharField(max_length=20, choices=COMMISSION_TRIGGERS, db_index=True)
    base_amount = models.DecimalField(
        max_digits=18, decimal_places=2, help_text="Amount the percent applied to.",
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
        return f"L{self.level} {self.amount} -> {self.earner_id}"
