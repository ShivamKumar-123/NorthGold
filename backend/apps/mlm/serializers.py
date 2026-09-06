from rest_framework import serializers

from .models import Commission, MlmLevelConfig


class MlmLevelConfigSerializer(serializers.ModelSerializer):
    kind = serializers.SerializerMethodField()

    class Meta:
        model = MlmLevelConfig
        fields = ["level", "label", "kind", "deposit_percent", "roi_percent",
                  "min_direct_referrals", "min_self_investment", "is_active"]

    def get_kind(self, obj) -> str:
        return "direct" if obj.level == 1 else "indirect"


class MlmConfigWriteSerializer(serializers.Serializer):
    """Replace the whole level table in one call.

    Levels are meaningful only as a set — editing them one row at a time is how
    you end up with a gap at level 3 that silently stops paying.
    """

    levels = MlmLevelConfigSerializer(many=True)

    def validate_levels(self, value):
        if not value:
            raise serializers.ValidationError("At least one level is required.")
        seen = set()
        for row in value:
            level = row["level"]
            if level < 1:
                raise serializers.ValidationError("Levels start at 1.")
            if level in seen:
                raise serializers.ValidationError(f"Duplicate entry for level {level}.")
            seen.add(level)

        expected = set(range(1, max(seen) + 1))
        missing = sorted(expected - seen)
        if missing:
            raise serializers.ValidationError(
                "Levels must be contiguous from 1. Missing: "
                + ", ".join(str(m) for m in missing)
            )
        return value


class CommissionSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source="source_user.full_name", read_only=True)
    source_email = serializers.CharField(source="source_user.email", read_only=True)
    kind = serializers.SerializerMethodField()
    trigger_label = serializers.CharField(source="get_trigger_display", read_only=True)

    class Meta:
        model = Commission
        fields = ["id", "level", "kind", "trigger", "trigger_label", "source_user",
                  "source_name", "source_email", "base_amount", "percent", "amount",
                  "status", "skip_reason", "description", "created_at"]

    def get_kind(self, obj) -> str:
        return "direct" if obj.level == 1 else "indirect"


class AdminCommissionSerializer(CommissionSerializer):
    earner_name = serializers.CharField(source="earner.full_name", read_only=True)
    earner_email = serializers.CharField(source="earner.email", read_only=True)

    class Meta(CommissionSerializer.Meta):
        fields = CommissionSerializer.Meta.fields + ["earner", "earner_name", "earner_email"]
