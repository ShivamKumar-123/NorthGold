from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Sum
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.services import downline_rows, downline_summary
from apps.core.permissions import IsAdmin
from apps.core.services import client_ip, get_setting, write_audit

from .models import Commission, MlmLevelConfig
from .serializers import (
    AdminCommissionSerializer, CommissionSerializer, MlmConfigWriteSerializer,
    MlmLevelConfigSerializer,
)
from .services import earnings_breakdown


class PublicPlanStructureView(APIView):
    """The commission table shown on the "Refer & Earn" marketing page.

    Percentages are public — they are the offer. Qualification thresholds are
    included so nobody is surprised later.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        levels = MlmLevelConfig.objects.filter(is_active=True)
        return Response({
            "deposit_commission_enabled": bool(get_setting("mlm_deposit_enabled")),
            "roi_commission_enabled": bool(get_setting("mlm_roi_enabled")),
            "max_levels": int(get_setting("mlm_max_levels") or 5),
            "levels": MlmLevelConfigSerializer(levels, many=True).data,
        })


class MyCommissionListView(ListAPIView):
    queryset = Commission.objects.none()
    serializer_class = CommissionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["level", "trigger", "status"]
    search_fields = ["source_user__email"]

    def get_queryset(self):
        return Commission.objects.select_related("source_user").filter(
            earner=self.request.user,
        )


class MyEarningsView(APIView):
    """Everything the user's "Referral Earnings" screen needs in one call."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        breakdown = earnings_breakdown(user)
        network = downline_summary(user)

        top_earners = [
            {
                "user_id": str(row["source_user"]),
                "name": row["source_user__first_name"] or row["source_user__email"],
                "email": row["source_user__email"],
                "total": float(row["total"] or 0),
            }
            for row in Commission.objects.filter(earner=user, status="paid")
            .values("source_user", "source_user__first_name", "source_user__email")
            .annotate(total=Sum("amount")).order_by("-total")[:10]
        ]

        return Response({
            **breakdown,
            "network": network,
            "referral_code": user.referral_code,
            "top_producing_members": top_earners,
            "structure": MlmLevelConfigSerializer(
                MlmLevelConfig.objects.filter(is_active=True), many=True,
            ).data,
        })


# ─── Admin ────────────────────────────────────────────────────────────────

class AdminMlmConfigView(APIView):
    """Read and replace the level table.

    PUT takes the complete set of levels; anything not in the payload is
    deleted. That is deliberate — see MlmConfigWriteSerializer.
    """

    permission_classes = [IsAdmin]

    def get(self, request):
        return Response({
            "levels": MlmLevelConfigSerializer(
                MlmLevelConfig.objects.all(), many=True,
            ).data,
            "deposit_commission_enabled": bool(get_setting("mlm_deposit_enabled")),
            "roi_commission_enabled": bool(get_setting("mlm_roi_enabled")),
            "max_levels": int(get_setting("mlm_max_levels") or 5),
            "require_active_investment": bool(get_setting("mlm_require_active_investment")),
        })

    @transaction.atomic
    def put(self, request):
        serializer = MlmConfigWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        levels = serializer.validated_data["levels"]

        before = list(
            MlmLevelConfig.objects.values("level", "deposit_percent", "roi_percent")
        )
        MlmLevelConfig.objects.all().delete()
        MlmLevelConfig.objects.bulk_create([
            MlmLevelConfig(
                level=row["level"],
                label=row.get("label", ""),
                deposit_percent=row.get("deposit_percent", Decimal("0")),
                roi_percent=row.get("roi_percent", Decimal("0")),
                min_direct_referrals=row.get("min_direct_referrals", 0),
                min_self_investment=row.get("min_self_investment", Decimal("0")),
                is_active=row.get("is_active", True),
            )
            for row in levels
        ])
        write_audit(request.user, "update_mlm_config", entity_type="mlm_level_config",
                    old_values={"levels": [
                        {k: str(v) for k, v in row.items()} for row in before
                    ]},
                    new_values={"levels": [
                        {k: str(v) for k, v in row.items()} for row in levels
                    ]},
                    ip_address=client_ip(request))
        return Response({
            "levels": MlmLevelConfigSerializer(
                MlmLevelConfig.objects.all(), many=True,
            ).data,
        })


class AdminCommissionListView(ListAPIView):
    queryset = Commission.objects.none()
    serializer_class = AdminCommissionSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["level", "trigger", "status", "earner", "source_user"]
    search_fields = ["earner__email", "source_user__email"]
    ordering_fields = ["created_at", "amount"]

    def get_queryset(self):
        return Commission.objects.select_related("earner", "source_user").all()


class AdminNetworkOverviewView(APIView):
    """Platform-wide network health — the numbers that tell an operator whether
    the MLM side is behaving."""

    permission_classes = [IsAdmin]

    def get(self, request):
        paid = Commission.objects.filter(status="paid")

        by_level = [
            {"level": row["level"], "total": float(row["total"] or 0),
             "count": row["count"]}
            for row in paid.values("level").annotate(
                total=Sum("amount"), count=Count("id"),
            ).order_by("level")
        ]

        top_sponsors = [
            {
                "user_id": str(row["earner"]),
                "email": row["earner__email"],
                "name": (row["earner__first_name"] or "") + " " + (row["earner__last_name"] or ""),
                "total_earned": float(row["total"] or 0),
                "direct_referrals": User.objects.filter(sponsor_id=row["earner"]).count(),
            }
            for row in paid.values("earner", "earner__email", "earner__first_name",
                                   "earner__last_name")
            .annotate(total=Sum("amount")).order_by("-total")[:20]
        ]

        return Response({
            "total_commission_paid": float(paid.aggregate(t=Sum("amount"))["t"] or 0),
            "direct_paid": float(
                paid.filter(level=1).aggregate(t=Sum("amount"))["t"] or 0
            ),
            "indirect_paid": float(
                paid.filter(level__gt=1).aggregate(t=Sum("amount"))["t"] or 0
            ),
            "skipped_count": Commission.objects.filter(status="skipped").count(),
            "by_level": by_level,
            "by_trigger": {
                row["trigger"]: float(row["total"] or 0)
                for row in paid.values("trigger").annotate(total=Sum("amount"))
            },
            "users_with_sponsor": User.objects.filter(sponsor__isnull=False).count(),
            "users_without_sponsor": User.objects.filter(sponsor__isnull=True).count(),
            "top_sponsors": top_sponsors,
        })


class AdminUserNetworkView(APIView):
    """Per-user network rollup used by the admin user detail page."""

    permission_classes = [IsAdmin]

    def get(self, request, user_id):
        user = User.objects.filter(id=user_id).first()
        if user is None:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        rows = downline_rows(user.id)
        return Response({
            "summary": downline_summary(user),
            "earnings": earnings_breakdown(user),
            "downline_user_ids": [str(r[0]) for r in rows[:500]],
            "commissions": AdminCommissionSerializer(
                Commission.objects.select_related("earner", "source_user")
                .filter(earner=user)[:100], many=True,
            ).data,
        })
