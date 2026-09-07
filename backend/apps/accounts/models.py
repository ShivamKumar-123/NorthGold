"""Users are the MLM tree.

Unlike the reference platform — where a separate `ib_profiles` table carried
`parent_ib_id` and only approved partners were nodes — here EVERY user is a
node in one tree, joined by `sponsor`. Direct referrals are a user's children;
indirect referrals are everything deeper. `Referral` keeps the immutable
join record (who, when, which campaign) for reporting.
"""
import secrets
import string

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedUUIDModel

REFERRAL_CODE_ALPHABET = string.ascii_uppercase + string.digits
REFERRAL_CODE_LENGTH = 8

ROLE_CHOICES = [
    ("user", "User"),
    ("admin", "Admin"),
    ("superadmin", "Super Admin"),
]

STATUS_CHOICES = [
    ("active", "Active"),
    ("suspended", "Suspended"),
    ("blocked", "Blocked"),
    # Closed, not erased. Sign-in is refused and the account drops out of the
    # member list, but every deposit, payout and commission it generated stays
    # in the books — deleting the row would take the upline's earnings with it
    # and leave the ledger unable to explain itself.
    ("archived", "Archived"),
]

KYC_CHOICES = [
    ("pending", "Pending"),
    ("submitted", "Submitted"),
    ("approved", "Approved"),
    ("rejected", "Rejected"),
]


def generate_referral_code():
    """Collision-checked short code. Loops because uniqueness is enforced at
    the DB level and a duplicate would fail the insert."""
    for _ in range(20):
        code = "".join(secrets.choice(REFERRAL_CODE_ALPHABET)
                       for _ in range(REFERRAL_CODE_LENGTH))
        if not User.objects.filter(referral_code=code).exists():
            return code
    raise RuntimeError("Could not generate a unique referral code")


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("An email address is required")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("role", "user")
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("role", "superadmin")
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("email_verified", True)
        if extra["is_staff"] is not True:
            raise ValueError("Superuser must have is_staff=True")
        return self._create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin, TimeStampedUUIDModel):
    email = models.EmailField(max_length=255, unique=True, db_index=True)
    phone = models.CharField(max_length=20, blank=True)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    country = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    address = models.TextField(blank=True)
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="user", db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active", db_index=True)
    kyc_status = models.CharField(max_length=20, choices=KYC_CHOICES, default="pending")
    email_verified = models.BooleanField(default=False)

    # --- MLM tree ---------------------------------------------------------
    referral_code = models.CharField(max_length=20, unique=True, db_index=True)
    sponsor = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="direct_referrals", db_index=True,
        help_text="The user who referred this user. Set once at signup.",
    )
    # Depth from the root of this user's chain (root = 0). Denormalised so the
    # admin tree can be paged without walking upward per row.
    tree_depth = models.PositiveIntegerField(default=0, db_index=True)

    # --- Money ------------------------------------------------------------
    # Withdrawable. Approved deposits, ROI payouts and MLM commission land here.
    wallet_balance = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    # Sum of principal currently locked in active investments.
    invested_balance = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    # Lifetime totals — denormalised for dashboards, never used as a source of truth.
    total_roi_earned = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total_commission_earned = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total_deposited = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total_withdrawn = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "users"
        ordering = ["-created_at"]

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        if not self.referral_code:
            self.referral_code = generate_referral_code()
        self.email = (self.email or "").lower()
        super().save(*args, **kwargs)

    @property
    def full_name(self):
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.email.split("@")[0]

    @property
    def is_admin(self):
        return self.role in ("admin", "superadmin")

    def upline_chain(self, max_levels):
        """Ancestors nearest-first: [direct sponsor, sponsor's sponsor, ...].

        Cycle-guarded — a corrupted sponsor loop would otherwise hang the
        commission engine.
        """
        chain = []
        seen = {self.id}
        node = self.sponsor
        while node is not None and len(chain) < max_levels:
            if node.id in seen:
                break
            seen.add(node.id)
            chain.append(node)
            node = node.sponsor
        return chain


class Referral(TimeStampedUUIDModel):
    """Immutable attribution record written once at signup.

    `User.sponsor` is the source of truth for the tree; this table exists so
    campaign attribution survives even if a sponsor account is later deleted
    (which nulls the FK).
    """

    referrer = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="referrals_made",
    )
    referred = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="referral_record",
    )
    referrer_code = models.CharField(max_length=20, blank=True, db_index=True)
    level_at_join = models.PositiveIntegerField(default=1)
    utm_source = models.CharField(max_length=100, blank=True)
    utm_medium = models.CharField(max_length=100, blank=True)
    utm_campaign = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "referrals"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.referrer_code} -> {self.referred_id}"


class KYCDocument(TimeStampedUUIDModel):
    DOC_TYPES = [
        ("id_front", "ID Front"),
        ("id_back", "ID Back"),
        ("selfie", "Selfie"),
        ("address_proof", "Address Proof"),
        ("bank_proof", "Bank Proof"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="kyc_documents")
    doc_type = models.CharField(max_length=30, choices=DOC_TYPES)
    file = models.FileField(upload_to="kyc/")
    status = models.CharField(max_length=20, choices=KYC_CHOICES, default="submitted")
    rejection_reason = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "kyc_documents"
        ordering = ["-created_at"]


class EmailOTP(TimeStampedUUIDModel):
    """Six-digit signup verification code."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="email_otps")
    code = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "email_otps"
        ordering = ["-created_at"]

    @property
    def is_valid(self):
        return self.consumed_at is None and self.expires_at > timezone.now() and self.attempts < 5
