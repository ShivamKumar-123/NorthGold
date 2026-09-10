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

from .models import Commission, ReferralPlan, ReferralPlanMonth
from .serializers import (
    AdminCommissionSerializer, CommissionSerializer, ReferralPlanSerializer,
    ReferralPlanWriteSerializer,
)
from .services import earnings_breakdown, referral_matrix


class PublicReferralStructureView(APIView):
    """The referral matrix, for the marketing page.

    The rates are public — they are the offer.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "referral_enabled": bool(get_setting("referral_enabled")),
            "plans": referral_matrix(),
        })


class MyCommissionListView(ListAPIView):
    queryset = Commission.objects.none()
    serializer_class = CommissionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status", "month_index"]
    search_fields = ["source_user__email"]

    def get_queryset(self):
        return Commission.objects.select_related("source_user").filter(
            earner=self.request.user,
        )


class MyEarningsView(APIView):
    """Everything the member's referral screen needs in one call."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            **earnings_breakdown(user),
            "network": downline_summary(user),
            "referral_code": user.referral_code,
            "structure": referral_matrix(),
        })


# ─── Admin ────────────────────────────────────────────────────────────────

class AdminReferralPlanListView(APIView):
    """The whole matrix, and a way to add a slab to it."""

    permission_classes = [IsAdmin]

    def get(self, request):
        plans = ReferralPlan.objects.prefetch_related("months").all()
        return Response({
            "plans": ReferralPlanSerializer(plans, many=True).data,
            "referral_enabled": bool(get_setting("referral_enabled")),
        })

    @transaction.atomic
    def post(self, request):
        serializer = ReferralPlanWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = _write_plan(None, serializer.validated_data)
        write_audit(request.user, "create_referral_plan", entity_type="referral_plan",
                    entity_id=plan.id, new_values={"name": plan.name},
                    ip_address=client_ip(request))
        return Response(ReferralPlanSerializer(plan).data,
                        status=status.HTTP_201_CREATED)


class AdminReferralPlanDetailView(APIView):
    permission_classes = [IsAdmin]

    def _get(self, plan_id):
        return ReferralPlan.objects.filter(id=plan_id).first()

    @transaction.atomic
    def put(self, request, plan_id):
        plan = self._get(plan_id)
        if plan is None:
            return Response({"detail": "Plan not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ReferralPlanWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        before = {
            "name": plan.name,
            "months": [str(m.percent) for m in plan.months.all()],
        }
        plan = _write_plan(plan, serializer.validated_data)
        write_audit(request.user, "update_referral_plan", entity_type="referral_plan",
                    entity_id=plan.id, old_values=before,
                    new_values={"name": plan.name,
                                "months": [str(p) for p in serializer.validated_data["months"]]},
                    ip_address=client_ip(request))
        return Response(ReferralPlanSerializer(plan).data)

    def delete(self, request, plan_id):
        """Deactivated, not deleted.

        Commission already paid points at nothing if the slab disappears, and a
        sponsor asking why a past month paid what it did deserves an answer.
        """
        plan = self._get(plan_id)
        if plan is None:
            return Response({"detail": "Plan not found."}, status=status.HTTP_404_NOT_FOUND)
        plan.is_active = False
        plan.save(update_fields=["is_active", "updated_at"])
        write_audit(request.user, "deactivate_referral_plan", entity_type="referral_plan",
                    entity_id=plan.id, ip_address=client_ip(request))
        return Response(ReferralPlanSerializer(plan).data)


@transaction.atomic
def _write_plan(plan, data):
    """Create or replace one slab and its whole month matrix.

    The months are deleted and rewritten rather than merged: a matrix is only
    meaningful complete, and merging leaves whichever months the payload
    omitted at their old values without saying so.
    """
    fields = {
        "name": data["name"],
        "description": data.get("description", ""),
        "min_amount": data["min_amount"],
        "max_amount": data.get("max_amount"),
        "tenure_months": data["tenure_months"],
        "is_active": data.get("is_active", True),
        "display_order": data.get("display_order", 0),
    }
    if plan is None:
        plan = ReferralPlan.objects.create(**fields)
    else:
        for key, value in fields.items():
            setattr(plan, key, value)
        plan.save()

    plan.months.all().delete()
    ReferralPlanMonth.objects.bulk_create([
        ReferralPlanMonth(plan=plan, month_index=i, percent=percent)
        for i, percent in enumerate(data["months"], start=1)
    ])
    return plan


class AdminCommissionListView(ListAPIView):
    queryset = Commission.objects.none()
    serializer_class = AdminCommissionSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["status", "month_index", "earner", "source_user"]
    search_fields = ["earner__email", "source_user__email"]
    ordering_fields = ["created_at", "amount"]

    def get_queryset(self):
        return Commission.objects.select_related("earner", "source_user").all()


class AdminNetworkOverviewView(APIView):
    """Platform-wide referral health — the numbers that tell an operator
    whether the programme is behaving."""

    permission_classes = [IsAdmin]

    def get(self, request):
        paid = Commission.objects.filter(status="paid")

        by_month = [
            {"month_index": row["month_index"], "total": float(row["total"] or 0),
             "count": row["count"]}
            for row in paid.values("month_index").annotate(
                total=Sum("amount"), count=Count("id"),
            ).order_by("month_index")
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
            "payments_made": paid.count(),
            "skipped_count": Commission.objects.filter(status="skipped").count(),
            "by_month": by_month,
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
