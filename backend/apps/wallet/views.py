from decimal import Decimal, InvalidOperation

from django.db.models import Count, Q, Sum
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.core.permissions import IsAdmin
from apps.core.services import client_ip

from .models import Deposit, PaymentChannel, Transaction, Withdrawal
from .serializers import (
    AdminDepositSerializer, AdminWithdrawalSerializer, CreateDepositSerializer,
    CreateWithdrawalSerializer, DepositSerializer, PaymentChannelSerializer,
    TransactionSerializer, WithdrawalSerializer,
)
from .services import (
    WalletError, admin_adjust_balance, approve_deposit, approve_withdrawal,
    create_deposit_request, create_withdrawal_request, reject_deposit,
    reject_withdrawal,
)


class PaymentChannelListView(ListAPIView):
    """Where to send money, filtered to the method the user picked."""

    serializer_class = PaymentChannelSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = PaymentChannel.objects.filter(is_active=True)
        method = self.request.query_params.get("method")
        if method:
            qs = qs.filter(channel_type=method)
        return qs


class WalletSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        pending_deposits = Deposit.objects.filter(user=user, status="pending")
        pending_withdrawals = Withdrawal.objects.filter(user=user, status="pending")
        return Response({
            "wallet_balance": float(user.wallet_balance or 0),
            "invested_balance": float(user.invested_balance or 0),
            "total_deposited": float(user.total_deposited or 0),
            "total_withdrawn": float(user.total_withdrawn or 0),
            "total_roi_earned": float(user.total_roi_earned or 0),
            "total_commission_earned": float(user.total_commission_earned or 0),
            "pending_deposit_amount": float(
                pending_deposits.aggregate(t=Sum("amount"))["t"] or 0
            ),
            "pending_deposit_count": pending_deposits.count(),
            "pending_withdrawal_amount": float(
                pending_withdrawals.aggregate(t=Sum("amount"))["t"] or 0
            ),
            "pending_withdrawal_count": pending_withdrawals.count(),
        })


class DepositListCreateView(ListAPIView):
    queryset = Deposit.objects.none()
    serializer_class = DepositSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ["status", "method"]

    def get_queryset(self):
        return Deposit.objects.select_related("channel").filter(user=self.request.user)

    def post(self, request):
        serializer = CreateDepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        channel = None
        if data.get("channel_id"):
            channel = PaymentChannel.objects.filter(id=data["channel_id"]).first()
            if channel is None:
                return Response({"detail": "Payment channel not found."},
                                status=status.HTTP_404_NOT_FOUND)

        try:
            deposit = create_deposit_request(
                user=request.user, amount=data["amount"], method=data["method"],
                channel=channel, user_message=data.get("user_message", ""),
                reference_no=data.get("reference_no", ""), proof=data.get("proof"),
            )
        except WalletError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(DepositSerializer(deposit).data, status=status.HTTP_201_CREATED)


class WithdrawalListCreateView(ListAPIView):
    queryset = Withdrawal.objects.none()
    serializer_class = WithdrawalSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status", "method"]

    def get_queryset(self):
        return Withdrawal.objects.filter(user=self.request.user)

    def post(self, request):
        serializer = CreateWithdrawalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            withdrawal = create_withdrawal_request(
                user=request.user, amount=data["amount"], method=data["method"],
                payout_details=data.get("payout_details"),
                user_message=data.get("user_message", ""),
            )
        except WalletError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(WithdrawalSerializer(withdrawal).data,
                        status=status.HTTP_201_CREATED)


class TransactionListView(ListAPIView):
    queryset = Transaction.objects.none()
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["tx_type"]

    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user)


# ─── Admin verification queues ────────────────────────────────────────────

class AdminDepositListView(ListAPIView):
    """The verification queue. Defaults to pending, which is what the reviewer
    actually opens the page for."""

    serializer_class = AdminDepositSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["status", "method", "user"]
    search_fields = ["user__email", "reference_no", "user_message"]
    ordering_fields = ["created_at", "amount"]

    def get_queryset(self):
        qs = Deposit.objects.select_related("user", "channel").all()
        requested = self.request.query_params.get("status")
        if requested is None:
            qs = qs.filter(status="pending")
        return qs


class AdminDepositReviewView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, deposit_id):
        deposit = Deposit.objects.filter(id=deposit_id).first()
        if deposit is None:
            return Response({"detail": "Deposit not found."},
                            status=status.HTTP_404_NOT_FOUND)

        action = request.data.get("action")
        if action not in ("approve", "reject"):
            return Response({"detail": "action must be 'approve' or 'reject'."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            if action == "approve":
                deposit, investment = approve_deposit(
                    deposit, request.user,
                    admin_note=request.data.get("admin_note", ""),
                    auto_invest=request.data.get("auto_invest"),
                    ip_address=client_ip(request),
                )
                payload = AdminDepositSerializer(deposit).data
                payload["investment_created"] = str(investment.id) if investment else None
                return Response(payload)

            deposit = reject_deposit(
                deposit, request.user, reason=request.data.get("reason", ""),
                ip_address=client_ip(request),
            )
            return Response(AdminDepositSerializer(deposit).data)
        except WalletError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class AdminWithdrawalListView(ListAPIView):
    serializer_class = AdminWithdrawalSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["status", "method", "user"]
    search_fields = ["user__email", "user_message"]
    ordering_fields = ["created_at", "amount"]

    def get_queryset(self):
        qs = Withdrawal.objects.select_related("user").all()
        if self.request.query_params.get("status") is None:
            qs = qs.filter(status="pending")
        return qs


class AdminWithdrawalReviewView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, withdrawal_id):
        withdrawal = Withdrawal.objects.filter(id=withdrawal_id).first()
        if withdrawal is None:
            return Response({"detail": "Withdrawal not found."},
                            status=status.HTTP_404_NOT_FOUND)

        action = request.data.get("action")
        if action not in ("approve", "reject"):
            return Response({"detail": "action must be 'approve' or 'reject'."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            if action == "approve":
                withdrawal = approve_withdrawal(
                    withdrawal, request.user,
                    payout_reference=request.data.get("payout_reference", ""),
                    admin_note=request.data.get("admin_note", ""),
                    ip_address=client_ip(request),
                )
            else:
                withdrawal = reject_withdrawal(
                    withdrawal, request.user, reason=request.data.get("reason", ""),
                    ip_address=client_ip(request),
                )
        except WalletError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(AdminWithdrawalSerializer(withdrawal).data)


class AdminPaymentChannelView(ListAPIView):
    serializer_class = PaymentChannelSerializer
    permission_classes = [IsAdmin]
    pagination_class = None
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return PaymentChannel.objects.all()

    def post(self, request):
        serializer = PaymentChannelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        channel = serializer.save()
        return Response(PaymentChannelSerializer(channel).data,
                        status=status.HTTP_201_CREATED)


class AdminPaymentChannelDetailView(APIView):
    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request, channel_id):
        channel = PaymentChannel.objects.filter(id=channel_id).first()
        if channel is None:
            return Response({"detail": "Channel not found."},
                            status=status.HTTP_404_NOT_FOUND)
        serializer = PaymentChannelSerializer(channel, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(PaymentChannelSerializer(channel).data)

    def delete(self, request, channel_id):
        channel = PaymentChannel.objects.filter(id=channel_id).first()
        if channel is None:
            return Response({"detail": "Channel not found."},
                            status=status.HTTP_404_NOT_FOUND)
        channel.is_active = False
        channel.save(update_fields=["is_active", "updated_at"])
        return Response({"detail": "Channel deactivated."})


class AdminAdjustBalanceView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, user_id):
        user = User.objects.filter(id=user_id).first()
        if user is None:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            amount = Decimal(str(request.data.get("amount")))
        except (TypeError, InvalidOperation):
            return Response({"detail": "A numeric amount is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        description = (request.data.get("description") or "").strip()
        if not description:
            return Response({"detail": "A description is required for manual adjustments."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            tx = admin_adjust_balance(
                user=user, amount=amount, admin=request.user,
                description=description, ip_address=client_ip(request),
            )
        except WalletError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(TransactionSerializer(tx).data, status=status.HTTP_201_CREATED)


class AdminWalletStatsView(APIView):
    """Numbers for the admin dashboard header."""

    permission_classes = [IsAdmin]

    def get(self, request):
        from apps.investments.models import Investment, RoiPayout
        from apps.mlm.models import Commission

        approved_deposits = Deposit.objects.filter(status="approved")
        approved_withdrawals = Withdrawal.objects.filter(status="approved")

        return Response({
            "pending_deposits": Deposit.objects.filter(status="pending").aggregate(
                count=Count("id"), amount=Sum("amount"),
            ),
            "pending_withdrawals": Withdrawal.objects.filter(status="pending").aggregate(
                count=Count("id"), amount=Sum("amount"),
            ),
            "total_deposited": float(
                approved_deposits.aggregate(t=Sum("amount"))["t"] or 0
            ),
            "total_withdrawn": float(
                approved_withdrawals.aggregate(t=Sum("amount"))["t"] or 0
            ),
            "active_principal": float(
                Investment.objects.filter(status="active").aggregate(
                    t=Sum("principal"))["t"] or 0
            ),
            "total_roi_paid": float(
                RoiPayout.objects.filter(status="paid").aggregate(t=Sum("amount"))["t"] or 0
            ),
            "total_commission_paid": float(
                Commission.objects.filter(status="paid").aggregate(t=Sum("amount"))["t"] or 0
            ),
            "users": User.objects.aggregate(
                total=Count("id"),
                active=Count("id", filter=Q(status="active")),
                with_investments=Count("id", filter=Q(investments__status="active"),
                                       distinct=True),
            ),
        })
