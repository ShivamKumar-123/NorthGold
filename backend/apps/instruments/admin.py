from django.contrib import admin

from .models import Instrument, Issuer, PriceTick


@admin.register(Issuer)
class IssuerAdmin(admin.ModelAdmin):
    list_display = ("name", "short_name", "country", "is_active", "display_order")
    list_filter = ("is_active", "country")
    search_fields = ("name",)


@admin.register(Instrument)
class InstrumentAdmin(admin.ModelAdmin):
    list_display = ("symbol", "name", "issuer", "category", "interest_rate",
                    "current_price", "price_source", "is_active", "is_featured")
    list_filter = ("category", "price_source", "is_active", "is_featured")
    search_fields = ("symbol", "name")
    autocomplete_fields = ("issuer",)


@admin.register(PriceTick)
class PriceTickAdmin(admin.ModelAdmin):
    list_display = ("instrument", "price", "recorded_at")
    list_filter = ("instrument",)
