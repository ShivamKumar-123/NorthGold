from rest_framework import serializers

from .models import Commission, ReferralPlan, ReferralPlanMonth


class ReferralPlanMonthSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReferralPlanMonth
        fields = ["month_index", "percent"]


class ReferralPlanSerializer(serializers.ModelSerializer):
    months = ReferralPlanMonthSerializer(many=True, read_only=True)
    total_percent = serializers.DecimalField(
        max_digits=8, decimal_places=3, read_only=True,
    )

    class Meta:
        model = ReferralPlan
        fields = [
            "id", "name", "description", "min_amount", "max_amount",
            "tenure_months", "is_active", "display_order", "months",
            "total_percent",
        ]
        read_only_fields = ["id", "months", "total_percent"]


class ReferralPlanWriteSerializer(serializers.Serializer):
    """A whole slab, matrix included, written in one call.

    The months arrive as a complete set rather than a patch: an editor that
    saves cell by cell can leave a matrix half-updated if the tab is closed
    between two of them, and a half-updated rate table pays real money.
    """

    name = serializers.CharField(max_length=100)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    min_amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=0)
    max_amount = serializers.DecimalField(
        max_digits=18, decimal_places=2, required=False, allow_null=True,
    )
    tenure_months = serializers.IntegerField(min_value=1, max_value=120)
    is_active = serializers.BooleanField(required=False, default=True)
    display_order = serializers.IntegerField(required=False, default=0)
    months = serializers.ListField(
        child=serializers.DecimalField(max_digits=6, decimal_places=3, min_value=0),
        allow_empty=False,
    )

    def validate(self, attrs):
        top = attrs.get("max_amount")
        if top is not None and top < attrs["min_amount"]:
            raise serializers.ValidationError(
                "The top of a slab cannot sit below its floor.",
            )
        if len(attrs["months"]) != attrs["tenure_months"]:
            raise serializers.ValidationError(
                f"Give one percentage per month: {attrs['tenure_months']} expected, "
                f"{len(attrs['months'])} given.",
            )
        return attrs


class CommissionSerializer(serializers.ModelSerializer):
    from_name = serializers.CharField(source="source_user.full_name", read_only=True)
    from_email = serializers.CharField(source="source_user.email", read_only=True)

    class Meta:
        model = Commission
        fields = [
            "id", "from_name", "from_email", "month_index", "base_amount",
            "percent", "amount", "status", "skip_reason", "description",
            "created_at",
        ]


class AdminCommissionSerializer(CommissionSerializer):
    earner_name = serializers.CharField(source="earner.full_name", read_only=True)
    earner_email = serializers.CharField(source="earner.email", read_only=True)

    class Meta(CommissionSerializer.Meta):
        fields = CommissionSerializer.Meta.fields + ["earner_name", "earner_email"]
