"""Bank instruments shown on the landing page.

An instrument is the shop-front for a plan: "HDFC 12-Month Fixed Deposit,
$25,000 minimum, 8.4% p.a." Its `roi_plan` decides what an investment in it
actually pays, month by month.

Prices come from either source, per instrument:
  * `manual` — an admin types the rate in the dashboard. Nothing moves it.
  * `feed`   — the ticker task moves it and broadcasts over WebSocket.
"""
from decimal import Decimal

from django.db import models

from apps.core.models import TimeStampedUUIDModel

CATEGORY_CHOICES = [
    ("fixed_deposit", "Fixed Deposit"),
    ("recurring_deposit", "Recurring Deposit"),
    ("bond", "Bond"),
    ("mutual_fund", "Mutual Fund"),
    ("etf", "ETF"),
    ("commodity", "Commodity"),
    ("forex", "Forex"),
    ("crypto", "Crypto"),
    ("other", "Other"),
]

PRICE_SOURCE_CHOICES = [
    ("manual", "Admin-managed"),
    ("feed", "Live feed"),
]


class Issuer(TimeStampedUUIDModel):
    """The bank or institution behind an instrument."""

    name = models.CharField(max_length=120, unique=True)
    short_name = models.CharField(max_length=40, blank=True)
    logo = models.ImageField(upload_to="issuers/", null=True, blank=True)
    country = models.CharField(max_length=100, blank=True)
    website = models.URLField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "issuers"
        ordering = ["display_order", "name"]

    def __str__(self):
        return self.name


class Instrument(TimeStampedUUIDModel):
    name = models.CharField(max_length=150)
    symbol = models.CharField(max_length=30, unique=True, db_index=True)
    issuer = models.ForeignKey(
        Issuer, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="instruments",
    )
    category = models.CharField(
        max_length=30, choices=CATEGORY_CHOICES, default="fixed_deposit", db_index=True,
    )
    description = models.TextField(blank=True)
    currency = models.CharField(max_length=10, default="USD")

    # Headline rate quoted on the card, e.g. 8.400 for "8.4% p.a."
    interest_rate = models.DecimalField(
        max_digits=6, decimal_places=3, default=Decimal("0"),
        help_text="Advertised annual rate shown on the landing card.",
    )
    tenure_months = models.PositiveIntegerField(default=12)
    min_investment = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    max_investment = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True,
    )

    # What an investment here actually pays out, month by month.
    roi_plan = models.ForeignKey(
        "investments.RoiPlan", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="instruments",
        help_text="Leave blank to select a plan from the invested amount instead.",
    )

    # --- Live price -------------------------------------------------------
    price_source = models.CharField(
        max_length=10, choices=PRICE_SOURCE_CHOICES, default="manual", db_index=True,
    )
    current_price = models.DecimalField(max_digits=18, decimal_places=4, default=Decimal("0"))
    previous_close = models.DecimalField(max_digits=18, decimal_places=4, default=Decimal("0"))
    day_high = models.DecimalField(max_digits=18, decimal_places=4, default=Decimal("0"))
    day_low = models.DecimalField(max_digits=18, decimal_places=4, default=Decimal("0"))
    # Bounded random-walk width for simulated feed instruments, in percent.
    feed_volatility_percent = models.DecimalField(
        max_digits=5, decimal_places=3, default=Decimal("0.250"),
    )
    price_updated_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "instruments"
        ordering = ["display_order", "name"]
        indexes = [models.Index(fields=["is_active", "is_featured"])]

    def __str__(self):
        return f"{self.symbol} - {self.name}"

    @property
    def change_amount(self):
        return (self.current_price or Decimal("0")) - (self.previous_close or Decimal("0"))

    @property
    def change_percent(self):
        base = self.previous_close or Decimal("0")
        if base == 0:
            return Decimal("0")
        return (self.change_amount / base * Decimal("100")).quantize(Decimal("0.01"))


class PriceTick(models.Model):
    """Price history for the sparkline on each instrument card.

    Deliberately a plain model with a BigAutoField — this is the highest-volume
    table in the system and does not need a UUID.
    """

    instrument = models.ForeignKey(
        Instrument, on_delete=models.CASCADE, related_name="ticks",
    )
    price = models.DecimalField(max_digits=18, decimal_places=4)
    recorded_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "price_ticks"
        ordering = ["-recorded_at"]
        indexes = [models.Index(fields=["instrument", "-recorded_at"])]

    def __str__(self):
        return f"{self.instrument_id} @ {self.price}"
