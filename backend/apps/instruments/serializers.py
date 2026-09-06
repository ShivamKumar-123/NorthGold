from rest_framework import serializers

from .models import Instrument, Issuer, PriceTick


class IssuerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Issuer
        fields = ["id", "name", "short_name", "logo", "country", "website",
                  "is_active", "display_order"]


class InstrumentSerializer(serializers.ModelSerializer):
    issuer_name = serializers.CharField(source="issuer.name", default=None, read_only=True)
    issuer_logo = serializers.ImageField(source="issuer.logo", default=None, read_only=True)
    change = serializers.DecimalField(
        source="change_amount", max_digits=18, decimal_places=4, read_only=True,
    )
    change_percent = serializers.DecimalField(
        max_digits=8, decimal_places=2, read_only=True,
    )
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    plan_name = serializers.CharField(source="roi_plan.name", default=None, read_only=True)

    class Meta:
        model = Instrument
        fields = [
            "id", "name", "symbol", "issuer", "issuer_name", "issuer_logo",
            "category", "category_label", "description", "currency",
            "interest_rate", "tenure_months", "min_investment", "max_investment",
            "roi_plan", "plan_name", "price_source", "current_price",
            "previous_close", "day_high", "day_low", "change", "change_percent",
            "price_updated_at", "is_active", "is_featured", "display_order",
        ]
        read_only_fields = ["change", "change_percent", "price_updated_at"]


class InstrumentAdminSerializer(InstrumentSerializer):
    """Admin can edit the price fields the public serializer exposes read-only."""

    class Meta(InstrumentSerializer.Meta):
        read_only_fields = ["change", "change_percent", "price_updated_at"]

    def validate(self, attrs):
        min_inv = attrs.get("min_investment",
                            getattr(self.instance, "min_investment", None))
        max_inv = attrs.get("max_investment",
                            getattr(self.instance, "max_investment", None))
        if min_inv is not None and max_inv is not None and max_inv < min_inv:
            raise serializers.ValidationError(
                {"max_investment": "Must be greater than or equal to min_investment."}
            )
        return attrs


class PriceTickSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceTick
        fields = ["price", "recorded_at"]
