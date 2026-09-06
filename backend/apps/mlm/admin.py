from django.contrib import admin

from .models import Commission, MlmLevelConfig


@admin.register(MlmLevelConfig)
class MlmLevelConfigAdmin(admin.ModelAdmin):
    list_display = ("level", "label", "deposit_percent", "roi_percent",
                    "min_direct_referrals", "min_self_investment", "is_active")
    list_editable = ("deposit_percent", "roi_percent", "is_active")
    ordering = ("level",)


@admin.register(Commission)
class CommissionAdmin(admin.ModelAdmin):
    list_display = ("earner", "source_user", "level", "trigger", "base_amount",
                    "percent", "amount", "status", "created_at")
    list_filter = ("level", "trigger", "status")
    search_fields = ("earner__email", "source_user__email")
    readonly_fields = ("created_at", "updated_at")
