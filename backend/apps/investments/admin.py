from django.contrib import admin

from .models import Investment, RoiPayout, RoiPlan, RoiPlanMonth


class RoiPlanMonthInline(admin.TabularInline):
    model = RoiPlanMonth
    extra = 12
    ordering = ("month_index",)


@admin.register(RoiPlan)
class RoiPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "min_amount", "max_amount", "tenure_months",
                    "total_return_percent", "is_active")
    list_filter = ("is_active", "tenure_months")
    search_fields = ("name",)
    inlines = [RoiPlanMonthInline]


@admin.register(Investment)
class InvestmentAdmin(admin.ModelAdmin):
    list_display = ("user", "plan", "principal", "status", "months_paid",
                    "total_roi_paid", "start_date", "maturity_date")
    list_filter = ("status", "plan")
    search_fields = ("user__email",)
    readonly_fields = ("plan_snapshot", "created_at", "updated_at")


@admin.register(RoiPayout)
class RoiPayoutAdmin(admin.ModelAdmin):
    list_display = ("user", "investment", "month_index", "percent", "amount",
                    "status", "due_at")
    list_filter = ("status", "credited_to")
    search_fields = ("user__email",)
