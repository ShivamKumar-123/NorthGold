from decimal import Decimal

from django.db.models import Sum
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdmin
from apps.core.services import client_ip, write_audit
from apps.instruments.models import Instrument

from .models import Investment, RoiPayout, RoiPlan
from .serializers import (
    AdminInvestmentSerializer, CreateInvestmentSerializer, InvestmentListSerializer,
    InvestmentSerializer, ProjectionSerializer, RoiPayoutSerializer,
    RoiPlanSerializer, RoiPlanWriteSerializer,
)
from .services import (
    InvestmentError, create_investment, mature_investment, projected_schedule,
    run_due_payouts,
)


class PublicPlanListView(ListAPIView):
    """Plans shown on the landing page, each with its full month curve."""

    serializer_class = RoiPlanSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return RoiPlan.objects.filter(is_active=True).prefetch_related("months")


class ProjectionView(APIView):
    """Returns calculator. Nothing is written — this is a quote, not an order."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ProjectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]
        plan_id = serializer.validated_data.get("plan_id")

        plan = (RoiPlan.objects.filter(id=plan_id, is_active=True).first()
                if plan_id else RoiPlan.for_amount(amount))
        if plan is None:
            return Response(
                {"detail": f"No active plan covers an amount of {amount}."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(projected_schedule(plan, amount))


class MyInvestmentListView(ListAPIView):
    queryset = Investment.objects.none()
    serializer_class = InvestmentListSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status", "plan"]

    def get_queryset(self):
        return (Investment.objects.select_related("plan", "instrument")
                .filter(user=self.request.user))

    def post(self, request):
        serializer = CreateInvestmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        plan = None
        if data.get("plan_id"):
            plan = RoiPlan.objects.filter(id=data["plan_id"], is_active=True).first()
            if plan is None:
                return Response({"detail": "Plan not found or inactive."},
                                status=status.HTTP_404_NOT_FOUND)
        instrument = None
        if data.get("instrument_id"):
            instrument = Instrument.objects.filter(
                id=data["instrument_id"], is_active=True,
            ).first()
            if instrument is None:
                return Response({"detail": "Instrument not found or inactive."},
                                status=status.HTTP_404_NOT_FOUND)
            if instrument.min_investment and data["amount"] < instrument.min_investment:
                return Response(
                    {"detail": f"{instrument.name} requires at least {instrument.min_investment}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if instrument.max_investment is not None and data["amount"] > instrument.max_investment:
                return Response(
                    {"detail": f"{instrument.name} accepts at most {instrument.max_investment}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            investment = create_investment(
                user=request.user, amount=data["amount"], plan=plan,
                instrument=instrument, from_wallet=True,
            )
        except InvestmentError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(InvestmentSerializer(investment).data,
                        status=status.HTTP_201_CREATED)


class MyInvestmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, investment_id):
        investment = (Investment.objects.select_related("plan", "instrument")
                      .prefetch_related("payouts")
                      .filter(id=investment_id, user=request.user).first())
        if investment is None:
            return Response({"detail": "Investment not found."},
                            status=status.HTTP_404_NOT_FOUND)
        return Response(InvestmentSerializer(investment).data)


class MyPayoutListView(ListAPIView):
    queryset = RoiPayout.objects.none()
    serializer_class = RoiPayoutSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status", "investment"]

    def get_queryset(self):
        return RoiPayout.objects.filter(user=self.request.user)


class MyInvestmentSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        active = Investment.objects.filter(user=user, status="active")
        paid = RoiPayout.objects.filter(user=user, status="paid")

        next_payouts = []
        for investment in active.select_related("plan")[:50]:
            row = InvestmentSerializer().get_next_payout(investment)
            if row:
                row["investment_id"] = str(investment.id)
                row["plan_name"] = investment.plan.name
                next_payouts.append(row)
        next_payouts.sort(key=lambda r: r["due_at"])

        return Response({
            "active_count": active.count(),
            "active_principal": float(
                active.aggregate(t=Sum("principal"))["t"] or Decimal("0")
            ),
            "total_roi_received": float(
                paid.aggregate(t=Sum("amount"))["t"] or Decimal("0")
            ),
            "matured_count": Investment.objects.filter(user=user, status="matured").count(),
            "upcoming_payouts": next_payouts[:10],
            "wallet_balance": float(user.wallet_balance or 0),
        })


# ─── Admin ────────────────────────────────────────────────────────────────

class AdminPlanListView(ListAPIView):
    """The 12-month percentage matrix lives here — GET to list, POST to create
    a plan together with its whole curve."""

    serializer_class = RoiPlanSerializer
    permission_classes = [IsAdmin]
    pagination_class = None

    def get_queryset(self):
        return RoiPlan.objects.prefetch_related("months").all()

    def post(self, request):
        serializer = RoiPlanWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = serializer.save()
        write_audit(request.user, "create_roi_plan", entity_type="roi_plan",
                    entity_id=plan.id, new_values={"name": plan.name},
                    ip_address=client_ip(request))
        return Response(RoiPlanSerializer(plan).data, status=status.HTTP_201_CREATED)


class AdminPlanDetailView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, plan_id):
        plan = RoiPlan.objects.prefetch_related("months").filter(id=plan_id).first()
        if plan is None:
            return Response({"detail": "Plan not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(RoiPlanSerializer(plan).data)

    def put(self, request, plan_id):
        plan = RoiPlan.objects.filter(id=plan_id).first()
        if plan is None:
            return Response({"detail": "Plan not found."}, status=status.HTTP_404_NOT_FOUND)
        before = {"name": plan.name, "months": {
            str(m.month_index): str(m.percent) for m in plan.months.all()
        }}
        serializer = RoiPlanWriteSerializer(plan, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        plan = serializer.save()
        write_audit(request.user, "update_roi_plan", entity_type="roi_plan",
                    entity_id=plan.id, old_values=before, new_values=request.data,
                    ip_address=client_ip(request))
        return Response(RoiPlanSerializer(plan).data)

    def delete(self, request, plan_id):
        plan = RoiPlan.objects.filter(id=plan_id).first()
        if plan is None:
            return Response({"detail": "Plan not found."}, status=status.HTTP_404_NOT_FOUND)
        # Never hard-delete: live investments PROTECT this row, and their
        # snapshots would lose their name.
        plan.is_active = False
        plan.save(update_fields=["is_active", "updated_at"])
        write_audit(request.user, "deactivate_roi_plan", entity_type="roi_plan",
                    entity_id=plan.id, ip_address=client_ip(request))
        return Response({"detail": "Plan deactivated."})


class AdminInvestmentListView(ListAPIView):
    queryset = Investment.objects.none()
    serializer_class = AdminInvestmentSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["status", "plan", "user"]
    search_fields = ["user__email", "user__first_name", "user__last_name"]
    ordering_fields = ["created_at", "principal", "maturity_date"]

    def get_queryset(self):
        return Investment.objects.select_related("user", "plan", "instrument").all()


class AdminRunPayoutsView(APIView):
    """Manual "run payouts now" button.

    The hourly Celery beat does this automatically; this exists for the first
    deploy, for catching up after downtime, and for paying one investment
    out of band.
    """

    permission_classes = [IsAdmin]

    def post(self, request):
        investment_ids = request.data.get("investment_ids") or None
        if investment_ids is not None and not isinstance(investment_ids, list):
            return Response({"detail": "investment_ids must be a list."},
                            status=status.HTTP_400_BAD_REQUEST)
        summary = run_due_payouts(investment_ids=investment_ids)
        write_audit(request.user, "run_roi_payouts", entity_type="investment",
                    new_values=summary, ip_address=client_ip(request))
        return Response(summary)


class AdminMatureInvestmentView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, investment_id):
        investment = Investment.objects.filter(id=investment_id).first()
        if investment is None:
            return Response({"detail": "Investment not found."},
                            status=status.HTTP_404_NOT_FOUND)
        if investment.status != "active":
            return Response({"detail": f"Investment is already {investment.status}."},
                            status=status.HTTP_400_BAD_REQUEST)
        mature_investment(investment)
        write_audit(request.user, "mature_investment", entity_type="investment",
                    entity_id=investment.id, ip_address=client_ip(request))
        return Response(AdminInvestmentSerializer(investment).data)
