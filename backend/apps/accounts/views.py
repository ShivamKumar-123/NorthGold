from django.db.models import Q
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.permissions import IsAdmin
from apps.core.services import client_ip, notify, write_audit

from .models import KYCDocument, Referral, User
from .serializers import (
    KYC_SIGNUP_DOCS, AdminLoginSerializer, AdminSetPasswordSerializer, AdminUserSerializer,
    ChangePasswordSerializer, KYCDocumentSerializer, LoginSerializer,
    ProfileUpdateSerializer, ReferralSerializer, RegisterSerializer,
    TokenPairSerializer, UserSerializer,
)
from .services import build_downline_tree, downline_summary, register_user, submit_kyc


def issue_tokens(user):
    refresh = TokenPairSerializer.get_token(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = register_user(
            email=data["email"],
            password=data["password"],
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            phone=data.get("phone", ""),
            country=data.get("country", ""),
            referral_code=data.get("referral_code", ""),
            utm={k: data.get(k, "") for k in
                 ("utm_source", "utm_medium", "utm_campaign")},
            ip_address=client_ip(request),
            kyc_files={doc: data[doc] for doc in KYC_SIGNUP_DOCS if doc in data},
        )
        return Response(
            {"user": UserSerializer(user).data, "tokens": issue_tokens(user)},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        user.last_login_ip = client_ip(request)
        user.save(update_fields=["last_login_ip", "updated_at"])
        return Response({"user": UserSerializer(user).data, "tokens": issue_tokens(user)})


class AdminLoginView(LoginView):
    serializer_class = AdminLoginSerializer


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("refresh")
        if token:
            try:
                RefreshToken(token).blacklist()
            except Exception:
                pass
        return Response({"detail": "Logged out."})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password", "updated_at"])
        return Response({"detail": "Password changed."})


class KYCView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        docs = KYCDocument.objects.filter(user=request.user)
        return Response({
            "kyc_status": request.user.kyc_status,
            "documents": KYCDocumentSerializer(docs, many=True).data,
        })

    def post(self, request):
        doc_type = request.data.get("doc_type")
        file_obj = request.FILES.get("file")
        valid_types = [c[0] for c in KYCDocument.DOC_TYPES]
        if doc_type not in valid_types:
            return Response({"detail": "doc_type must be one of: " + ", ".join(valid_types)},
                            status=status.HTTP_400_BAD_REQUEST)
        if not file_obj:
            return Response({"detail": "A file is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        doc = submit_kyc(request.user, doc_type, file_obj)
        return Response(KYCDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


# ─── Referral / tree ──────────────────────────────────────────────────────

class MyReferralsView(ListAPIView):
    """Direct referrals only — the flat list behind the "My Team" table."""

    # Explicit empty queryset: schema generation introspects this view with an
    # AnonymousUser, which get_queryset() cannot filter on.
    queryset = Referral.objects.none()
    serializer_class = ReferralSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["referred__email", "referred__first_name", "referred__last_name"]

    def get_queryset(self):
        return Referral.objects.select_related("referred").filter(referrer=self.request.user)


class MyTreeView(APIView):
    """Full downline tree with per-node user details.

    `?depth=` caps how deep the tree is walked (default 10) — the UI lazily
    expands, so there is no reason to ship 20 levels on first paint.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            depth = int(request.query_params.get("depth", 10))
        except (TypeError, ValueError):
            depth = 10
        result = build_downline_tree(request.user, max_depth=depth)
        result["root"] = {
            "user_id": str(request.user.id),
            "name": request.user.full_name,
            "email": request.user.email,
            "referral_code": request.user.referral_code,
            "level": 0,
            "total_commission_earned": float(request.user.total_commission_earned or 0),
        }
        return Response(result)


class MyNetworkSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        summary = downline_summary(request.user)
        summary["referral_code"] = request.user.referral_code
        summary["referral_link"] = self._link(request)
        return Response(summary)

    def _link(self, request):
        base = request.query_params.get("base") or request.build_absolute_uri("/")
        return f"{base.rstrip('/')}/register?ref={request.user.referral_code}"


class DownlineUserDetailView(APIView):
    """A single downline member's detail card.

    Access control: the target must actually sit under the requesting user
    (or the requester must be an admin). Without this an authenticated user
    could read any account by guessing a UUID.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        from .services import downline_rows

        target = User.objects.filter(id=user_id).first()
        if target is None:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if not request.user.is_admin and target.id != request.user.id:
            allowed = {row[0] for row in downline_rows(request.user.id)}
            if target.id not in allowed:
                return Response({"detail": "This user is not in your network."},
                                status=status.HTTP_403_FORBIDDEN)

        from apps.investments.models import Investment
        from apps.mlm.models import Commission
        from apps.wallet.models import Deposit

        investments = Investment.objects.filter(user=target).order_by("-created_at")[:20]
        deposits = Deposit.objects.filter(user=target).order_by("-created_at")[:20]
        earned_from = Commission.objects.filter(
            earner=request.user, source_user=target, status="paid",
        )

        from apps.investments.serializers import InvestmentSerializer
        from apps.mlm.serializers import CommissionSerializer
        from apps.wallet.serializers import DepositSerializer

        return Response({
            "user": UserSerializer(target).data,
            "investments": InvestmentSerializer(investments, many=True).data,
            "deposits": DepositSerializer(deposits, many=True).data,
            "commission_earned_from_user": CommissionSerializer(earned_from, many=True).data,
            "direct_referrals": target.direct_referrals.count(),
        })


# ─── Admin ────────────────────────────────────────────────────────────────

class AdminUserListView(ListAPIView):
    queryset = User.objects.none()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["status", "role", "kyc_status", "country"]
    ordering_fields = ["created_at", "total_deposited", "wallet_balance"]

    def get_queryset(self):
        qs = User.objects.select_related("sponsor").all()
        # Archived accounts are closed; they stay out of the working list
        # unless somebody asks for them by status.
        if not self.request.query_params.get("status"):
            qs = qs.exclude(status="archived")
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(email__icontains=q) | Q(first_name__icontains=q)
                | Q(last_name__icontains=q) | Q(referral_code__iexact=q)
                | Q(phone__icontains=q)
            )
        return qs


class AdminUserDetailView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, user_id):
        user = User.objects.filter(id=user_id).select_related("sponsor").first()
        if user is None:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            "user": AdminUserSerializer(user).data,
            "network": downline_summary(user),
            "kyc_documents": KYCDocumentSerializer(
                KYCDocument.objects.filter(user=user), many=True,
            ).data,
        })

    def patch(self, request, user_id):
        user = User.objects.filter(id=user_id).first()
        if user is None:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        before = {"status": user.status, "kyc_status": user.kyc_status, "role": user.role}
        serializer = AdminUserSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        write_audit(request.user, "update_user", entity_type="user", entity_id=user.id,
                    old_values=before,
                    new_values={k: getattr(user, k) for k in before},
                    ip_address=client_ip(request))
        return Response(AdminUserSerializer(user).data)


class AdminSetPasswordView(APIView):
    """Set a member's password for them.

    The old one is never shown or needed — the point of the screen is that
    somebody has lost access. An administrator may not reset another
    administrator's password unless they are a super-admin: a compromised admin
    account should not be able to take over the rest of the desk.
    """

    permission_classes = [IsAdmin]

    def post(self, request, user_id):
        user = User.objects.filter(id=user_id).first()
        if user is None:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if user.is_admin and request.user.role != "superadmin":
            return Response(
                {"detail": "Only a super-admin can reset another administrator's password."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AdminSetPasswordSerializer(data=request.data, context={"target": user})
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password", "updated_at"])

        notify(user, title="Your password was changed",
               message="An administrator set a new password on your account. "
                       "If you did not ask for this, contact support immediately.",
               notif_type="security", action_url="/profile")
        # The password itself is never written to the log — only that it moved.
        write_audit(request.user, "set_password", entity_type="user", entity_id=user.id,
                    ip_address=client_ip(request))
        return Response({"detail": "Password updated."})


class AdminUserTreeView(APIView):
    """Any user's downline — the admin-side version of MyTreeView."""

    permission_classes = [IsAdmin]

    def get(self, request, user_id):
        user = User.objects.filter(id=user_id).first()
        if user is None:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            depth = int(request.query_params.get("depth", 10))
        except (TypeError, ValueError):
            depth = 10
        result = build_downline_tree(user, max_depth=depth)
        result["root"] = {
            "user_id": str(user.id),
            "name": user.full_name,
            "email": user.email,
            "referral_code": user.referral_code,
            "level": 0,
            "total_commission_earned": float(user.total_commission_earned or 0),
        }
        return Response(result)


class AdminKYCReviewView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        # Defaults to the review queue. `?status=all` (or a specific status)
        # is what the admin page uses to show what it has already decided,
        # so a mistaken rejection can be found again rather than vanishing.
        wanted = request.query_params.get("status") or "submitted"
        qs = KYCDocument.objects.select_related("user").order_by("created_at")
        if wanted != "all":
            qs = qs.filter(status=wanted)
        return Response({"items": [
            {**KYCDocumentSerializer(d).data,
             "user_email": d.user.email,
             "user_name": d.user.full_name,
             "user_kyc_status": d.user.kyc_status,
             "user_id": str(d.user_id)}
            for d in qs
        ]})

    def post(self, request, doc_id):
        doc = KYCDocument.objects.filter(id=doc_id).select_related("user").first()
        if doc is None:
            return Response({"detail": "Document not found."}, status=status.HTTP_404_NOT_FOUND)
        action = request.data.get("action")
        if action not in ("approve", "reject"):
            return Response({"detail": "action must be 'approve' or 'reject'."},
                            status=status.HTTP_400_BAD_REQUEST)

        from django.utils import timezone
        doc.status = "approved" if action == "approve" else "rejected"
        doc.rejection_reason = request.data.get("reason", "") if action == "reject" else ""
        doc.reviewed_by = request.user
        doc.reviewed_at = timezone.now()
        doc.save()

        user = doc.user
        if action == "approve":
            # A user is KYC-approved once every submitted document is approved.
            outstanding = KYCDocument.objects.filter(
                user=user, status__in=["submitted", "rejected"],
            ).exists()
            user.kyc_status = "pending" if outstanding else "approved"
        else:
            user.kyc_status = "rejected"
        user.save(update_fields=["kyc_status", "updated_at"])

        notify(user, title=f"KYC document {doc.status}",
               message=doc.rejection_reason or f"Your {doc.get_doc_type_display()} was {doc.status}.",
               notif_type="kyc", action_url="/profile")
        write_audit(request.user, f"kyc_{action}", entity_type="kyc_document",
                    entity_id=doc.id, ip_address=client_ip(request))
        return Response(KYCDocumentSerializer(doc).data)
