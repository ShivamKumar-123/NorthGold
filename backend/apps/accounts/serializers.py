from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import KYCDocument, Referral, User

# Identity documents collected during signup. An account cannot be opened
# without all of them, so verification starts the moment the user exists rather
# than waiting for them to come back to the profile page later.
KYC_SIGNUP_DOCS = ["id_front", "id_back", "selfie", "address_proof", "bank_proof"]

# The ID pages are two sides of one document, so the choice is made once and
# stored on both rather than asked for twice.
ID_DOCS = ["id_front", "id_back"]

MAX_KYC_FILE_BYTES = 5 * 1024 * 1024
ALLOWED_KYC_CONTENT_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic",
    "application/pdf",
}


def validate_kyc_upload(value):
    """Shared guard for every signup document.

    Size is checked before anything touches disk. The content type is only
    checked when the client sent one — a missing type is a quirk of some
    upload clients, not evidence of a bad file, and rejecting on absence would
    block legitimate signups.
    """
    if value.size > MAX_KYC_FILE_BYTES:
        raise serializers.ValidationError("Each document must be 5 MB or smaller.")
    content_type = (getattr(value, "content_type", "") or "").lower()
    if content_type and content_type not in ALLOWED_KYC_CONTENT_TYPES:
        raise serializers.ValidationError("Upload a JPEG, PNG, WebP or PDF.")
    return value


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    country = serializers.CharField(max_length=100, required=False, allow_blank=True)

    # --- KYC, required to open the account -------------------------------
    proof_type = serializers.ChoiceField(
        choices=[c[0] for c in KYCDocument.PROOF_TYPES], write_only=True,
    )
    id_front = serializers.FileField(write_only=True, validators=[validate_kyc_upload])
    id_back = serializers.FileField(write_only=True, validators=[validate_kyc_upload])
    selfie = serializers.FileField(write_only=True, validators=[validate_kyc_upload])
    address_proof = serializers.FileField(write_only=True, validators=[validate_kyc_upload])
    bank_proof = serializers.FileField(write_only=True, validators=[validate_kyc_upload])
    # The referral link's ?ref= code. Unknown codes are ignored, not rejected —
    # a mistyped link must never block a signup.
    referral_code = serializers.CharField(max_length=20, required=False, allow_blank=True)
    utm_source = serializers.CharField(max_length=100, required=False, allow_blank=True)
    utm_medium = serializers.CharField(max_length=100, required=False, allow_blank=True)
    utm_campaign = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate_password(self, value):
        validate_password(value)
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            username=attrs["email"].lower(), password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError("Invalid email or password.")
        if user.status != "active":
            raise serializers.ValidationError(f"Account is {user.status}.")
        attrs["user"] = user
        return attrs


class AdminLoginSerializer(LoginSerializer):
    """Same credentials check, but the admin-app rejects non-staff up front so a
    normal user's token is never minted by the admin login route."""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if not attrs["user"].is_admin:
            raise serializers.ValidationError("This account is not an administrator.")
        return attrs


class TokenPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["email"] = user.email
        return token


class SponsorBriefSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="full_name", read_only=True)

    class Meta:
        model = User
        fields = ["id", "name", "email", "referral_code"]


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="full_name", read_only=True)
    sponsor = SponsorBriefSerializer(read_only=True)
    direct_referral_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "name", "first_name", "last_name", "phone",
            "country", "state", "city", "address", "avatar",
            "role", "status", "kyc_status", "email_verified",
            "referral_code", "sponsor", "tree_depth", "direct_referral_count",
            "wallet_balance", "invested_balance", "total_roi_earned",
            "total_commission_earned", "total_deposited", "total_withdrawn",
            "created_at",
        ]
        read_only_fields = [
            "id", "email", "role", "status", "kyc_status", "email_verified",
            "referral_code", "tree_depth", "wallet_balance", "invested_balance",
            "total_roi_earned", "total_commission_earned", "total_deposited",
            "total_withdrawn", "created_at",
        ]

    def get_direct_referral_count(self, obj) -> int:
        return obj.direct_referrals.count()


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "phone", "country", "state",
                  "city", "address", "avatar"]


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value


class AdminSetPasswordSerializer(serializers.Serializer):
    """No current password: the whole point is that somebody lost access to it.

    Django's validators still run, and against the target's own details, so an
    administrator cannot quietly set a member's password to their email
    address.
    """

    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        validate_password(value, self.context["target"])
        return value


class KYCDocumentSerializer(serializers.ModelSerializer):
    proof_type_label = serializers.CharField(
        source="get_proof_type_display", read_only=True,
    )

    class Meta:
        model = KYCDocument
        fields = ["id", "doc_type", "proof_type", "proof_type_label", "file",
                  "status", "rejection_reason", "reviewed_at", "created_at"]
        read_only_fields = ["status", "rejection_reason", "reviewed_at", "created_at"]


class ReferralSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="referred.full_name", read_only=True)
    email = serializers.CharField(source="referred.email", read_only=True)
    status = serializers.CharField(source="referred.status", read_only=True)
    total_deposited = serializers.DecimalField(
        source="referred.total_deposited", max_digits=18, decimal_places=2, read_only=True,
    )
    invested_balance = serializers.DecimalField(
        source="referred.invested_balance", max_digits=18, decimal_places=2, read_only=True,
    )

    class Meta:
        model = Referral
        fields = ["id", "referred", "name", "email", "status", "referrer_code",
                  "total_deposited", "invested_balance", "utm_source",
                  "utm_campaign", "created_at"]


class AdminUserSerializer(UserSerializer):
    """Admin sees the same shape plus fields a user cannot change themselves."""

    class Meta(UserSerializer.Meta):
        read_only_fields = [
            "id", "email", "referral_code", "tree_depth", "wallet_balance",
            "invested_balance", "total_roi_earned", "total_commission_earned",
            "total_deposited", "total_withdrawn", "created_at",
        ]
