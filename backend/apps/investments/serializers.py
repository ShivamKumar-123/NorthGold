from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import Investment, RoiPayout, RoiPlan, RoiPlanMonth


class RoiPlanMonthSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoiPlanMonth
        fields = ["month_index", "percent"]


class RoiPlanSerializer(serializers.ModelSerializer):
    months = RoiPlanMonthSerializer(many=True, read_only=True)
    total_return_percent = serializers.DecimalField(
        max_digits=10, decimal_places=3, read_only=True,
    )

    class Meta:
        model = RoiPlan
        fields = [
            "id", "name", "description", "min_amount", "max_amount",
            "tenure_months", "return_principal_at_maturity", "allow_early_exit",
            "early_exit_penalty_percent", "is_active", "display_order",
            "months", "total_return_percent", "created_at",
        ]


class RoiPlanWriteSerializer(serializers.ModelSerializer):
    """Admin create/update. Accepts the whole 12-month matrix in one call:

        {"name": "Silver", "min_amount": 1000, "max_amount": 4999,
         "tenure_months": 12,
         "months": [{"month_index": 1, "percent": "1.000"}, ...]}

    Months are replaced wholesale, so the payload is always the complete curve
    and a partial save can never leave a half-configured plan behind.
    """

    months = RoiPlanMonthSerializer(many=True, required=False)

    class Meta:
        model = RoiPlan
        fields = [
            "id", "name", "description", "min_amount", "max_amount",
            "tenure_months", "return_principal_at_maturity", "allow_early_exit",
            "early_exit_penalty_percent", "is_active", "display_order", "months",
        ]

    def validate(self, attrs):
        min_amount = attrs.get("min_amount", getattr(self.instance, "min_amount", None))
        max_amount = attrs.get("max_amount", getattr(self.instance, "max_amount", None))
        if min_amount is not None and max_amount is not None and max_amount < min_amount:
            raise serializers.ValidationError(
                {"max_amount": "Must be greater than or equal to min_amount."}
            )

        tenure = attrs.get("tenure_months", getattr(self.instance, "tenure_months", 12))
        months = attrs.get("months")
        if months is not None:
            seen = set()
            for row in months:
                idx = row["month_index"]
                if idx < 1 or idx > tenure:
                    raise serializers.ValidationError(
                        {"months": f"month_index {idx} is outside 1..{tenure}."}
                    )
                if idx in seen:
                    raise serializers.ValidationError(
                        {"months": f"Duplicate entry for month {idx}."}
                    )
                seen.add(idx)
                if row["percent"] < 0:
                    raise serializers.ValidationError(
                        {"months": f"Month {idx} percent cannot be negative."}
                    )
        return attrs

    def _write_months(self, plan, months):
        plan.months.all().delete()
        RoiPlanMonth.objects.bulk_create([
            RoiPlanMonth(plan=plan, month_index=row["month_index"], percent=row["percent"])
            for row in months
        ])

    @transaction.atomic
    def create(self, validated_data):
        months = validated_data.pop("months", [])
        plan = RoiPlan.objects.create(**validated_data)
        if months:
            self._write_months(plan, months)
        return plan

    @transaction.atomic
    def update(self, instance, validated_data):
        months = validated_data.pop("months", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if months is not None:
            self._write_months(instance, months)
        return instance


class RoiPayoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoiPayout
        fields = ["id", "month_index", "percent", "base_amount", "amount",
                  "due_at", "status", "credited_to", "created_at"]


class InvestmentSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    instrument_name = serializers.CharField(
        source="instrument.name", default=None, read_only=True,
    )
    instrument_symbol = serializers.CharField(
        source="instrument.symbol", default=None, read_only=True,
    )
    tenure_months = serializers.IntegerField(read_only=True)
    next_payout = serializers.SerializerMethodField()
    payouts = RoiPayoutSerializer(many=True, read_only=True)

    class Meta:
        model = Investment
        fields = [
            "id", "plan", "plan_name", "instrument", "instrument_name",
            "instrument_symbol", "principal", "start_date", "maturity_date",
            "status", "months_paid", "tenure_months", "total_roi_paid",
            "principal_released", "plan_snapshot", "next_payout", "payouts",
            "created_at",
        ]

    def get_next_payout(self, obj) -> dict | None:
        if obj.status != "active":
            return None
        paid = set(obj.payouts.values_list("month_index", flat=True))
        for month in range(1, obj.tenure_months + 1):
            if month in paid:
                continue
            return {
                "month_index": month,
                "due_at": obj.due_date_for_month(month).isoformat(),
                "percent": float(obj.snapshot_percent(month)),
                "estimated_amount": float(
                    (obj.principal * obj.snapshot_percent(month) / Decimal("100"))
                    .quantize(Decimal("0.01"))
                ),
            }
        return None


class InvestmentListSerializer(InvestmentSerializer):
    """List view drops the per-month payout array — it is the heaviest field and
    the table never renders it."""

    class Meta(InvestmentSerializer.Meta):
        fields = [f for f in InvestmentSerializer.Meta.fields
                  if f not in ("payouts", "plan_snapshot")]


class CreateInvestmentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0.01"))
    plan_id = serializers.UUIDField(required=False, allow_null=True)
    instrument_id = serializers.UUIDField(required=False, allow_null=True)


class ProjectionSerializer(serializers.Serializer):
    """Public returns calculator input."""

    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0.01"))
    plan_id = serializers.UUIDField(required=False, allow_null=True)


class AdminInvestmentSerializer(InvestmentSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta(InvestmentSerializer.Meta):
        fields = InvestmentSerializer.Meta.fields + ["user", "user_email", "user_name"]
