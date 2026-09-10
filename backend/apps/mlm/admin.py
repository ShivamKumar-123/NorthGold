from django.contrib import admin

from .models import Commission, ReferralPlan, ReferralPlanMonth


class ReferralPlanMonthInline(admin.TabularInline):
    model = ReferralPlanMonth
    extra = 0


@admin.register(ReferralPlan)
class ReferralPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "min_amount", "max_amount", "tenure_months", "is_active")
    list_filter = ("is_active",)
    inlines = [ReferralPlanMonthInline]


@admin.register(Commission)
class CommissionAdmin(admin.ModelAdmin):
    list_display = ("earner", "source_user", "month_index", "percent", "amount",
                    "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("earner__email", "source_user__email")
    raw_id_fields = ("earner", "source_user")
