"""Deposits, withdrawals and the transaction ledger.

Every deposit method — including CASH — is a request, not a credit. The user
files it (with a free-text `user_message`, which is the whole point of the cash
flow: "I handed ₹80,000 to Rakesh at the Andheri branch on Tuesday"), and an
admin verifies it before a single unit of balance moves. Nothing here touches
`User.wallet_balance` directly; that only happens in services.py, inside a
transaction, against a row-locked user.
"""
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.accounts.models import User
from apps.core.models import TimeStampedUUIDModel

METHOD_CHOICES = [
    ("cash", "Cash"),
    ("bank", "Bank Transfer"),
    ("upi", "UPI"),
    ("crypto", "Crypto"),
]

REQUEST_STATUS = [
    ("pending", "Pending Verification"),
    ("approved", "Approved"),
    ("rejected", "Rejected"),
]

TRANSACTION_TYPES = [
    ("deposit", "Deposit"),
    ("withdrawal", "Withdrawal"),
    ("roi", "ROI Payout"),
    ("commission", "Referral Commission"),
    ("investment", "Investment Purchase"),
    ("principal_return", "Principal Returned"),
    ("adjustment", "Admin Adjustment"),
    ("fee", "Fee"),
]


class PaymentChannel(TimeStampedUUIDModel):
    """Where users send money. Admin-managed; the user app shows the active
    channels for the method they picked."""

    name = models.CharField(max_length=100)
    channel_type = models.CharField(max_length=20, choices=METHOD_CHOICES)
    # Bank / UPI
    account_name = models.CharField(max_length=120, blank=True)
    account_number = models.CharField(max_length=64, blank=True)
    bank_name = models.CharField(max_length=120, blank=True)
    ifsc_code = models.CharField(max_length=20, blank=True)
    branch = models.CharField(max_length=120, blank=True)
    upi_id = models.CharField(max_length=100, blank=True)
    # Crypto
    wallet_address = models.CharField(max_length=200, blank=True)
    network = models.CharField(max_length=40, blank=True)
    qr_code = models.ImageField(upload_to="payment_qr/", null=True, blank=True)
    # Cash — a branch/agent contact rather than an account
    contact_person = models.CharField(max_length=120, blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)
    office_address = models.TextField(blank=True)

    instructions = models.TextField(blank=True)
    min_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    max_amount = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True,
    )
    is_active = models.BooleanField(default=True, db_index=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "payment_channels"
        ordering = ["display_order", "name"]

    def __str__(self):
        return f"{self.name} ({self.channel_type})"


class Deposit(TimeStampedUUIDModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="deposits")
    amount = models.DecimalField(
        max_digits=18, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    currency = models.CharField(max_length=10, default="INR")
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, db_index=True)
    channel = models.ForeignKey(
        PaymentChannel, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="deposits",
    )
    # Whatever the user needs to tell the verifier. Required for `cash`.
    user_message = models.TextField(blank=True)
    reference_no = models.CharField(
        max_length=120, blank=True, help_text="UTR / txn id / cash receipt no.",
    )
    proof = models.ImageField(upload_to="deposit_proofs/", null=True, blank=True)

    status = models.CharField(
        max_length=20, choices=REQUEST_STATUS, default="pending", db_index=True,
    )
    admin_note = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="deposits_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "deposits"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self):
        return f"{self.user_id} +{self.amount} ({self.status})"


class Withdrawal(TimeStampedUUIDModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="withdrawals")
    amount = models.DecimalField(
        max_digits=18, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Gross amount debited from the wallet.",
    )
    fee = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    net_amount = models.DecimalField(
        max_digits=18, decimal_places=2, default=Decimal("0"),
        help_text="What the user actually receives, after fee.",
    )
    currency = models.CharField(max_length=10, default="INR")
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, db_index=True)
    # Where to send it — bank details, UPI id, wallet address, or cash pickup.
    payout_details = models.JSONField(default=dict, blank=True)
    user_message = models.TextField(blank=True)

    status = models.CharField(
        max_length=20, choices=REQUEST_STATUS, default="pending", db_index=True,
    )
    admin_note = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    payout_reference = models.CharField(max_length=120, blank=True)
    payout_proof = models.ImageField(upload_to="payout_proofs/", null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="withdrawals_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "withdrawals"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self):
        return f"{self.user_id} -{self.amount} ({self.status})"


class Transaction(TimeStampedUUIDModel):
    """Append-only ledger. Every balance change writes exactly one row, with the
    resulting balance captured so statements reconcile without replaying."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="transactions")
    tx_type = models.CharField(max_length=30, choices=TRANSACTION_TYPES, db_index=True)
    # Signed: positive credits the wallet, negative debits it.
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    balance_after = models.DecimalField(max_digits=18, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)
    reference_id = models.UUIDField(null=True, blank=True, db_index=True)
    reference_type = models.CharField(max_length=40, blank=True)
    created_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        db_table = "transactions"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "tx_type", "created_at"])]

    def __str__(self):
        return f"{self.tx_type} {self.amount} ({self.user_id})"
