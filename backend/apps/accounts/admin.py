from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import EmailOTP, KYCDocument, Referral, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("-created_at",)
    list_display = ("email", "full_name", "referral_code", "sponsor",
                    "role", "status", "wallet_balance", "invested_balance")
    list_filter = ("role", "status", "kyc_status", "email_verified")
    search_fields = ("email", "first_name", "last_name", "referral_code", "phone")
    readonly_fields = ("id", "created_at", "updated_at", "referral_code")
    fieldsets = (
        (None, {"fields": ("id", "email", "password")}),
        ("Profile", {"fields": ("first_name", "last_name", "phone", "date_of_birth",
                                "country", "state", "city", "address", "avatar")}),
        ("Network", {"fields": ("referral_code", "sponsor", "tree_depth")}),
        ("Money", {"fields": ("wallet_balance", "invested_balance", "total_roi_earned",
                              "total_commission_earned", "total_deposited",
                              "total_withdrawn")}),
        ("Access", {"fields": ("role", "status", "kyc_status", "email_verified",
                               "is_active", "is_staff", "is_superuser",
                               "groups", "user_permissions")}),
        ("Timestamps", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",),
                "fields": ("email", "password1", "password2", "role", "is_staff")}),
    )


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ("referrer", "referred", "referrer_code", "utm_source", "created_at")
    search_fields = ("referrer_code", "referred__email", "referrer__email")


@admin.register(KYCDocument)
class KYCDocumentAdmin(admin.ModelAdmin):
    list_display = ("user", "doc_type", "status", "reviewed_at", "created_at")
    list_filter = ("doc_type", "status")


admin.site.register(EmailOTP)
