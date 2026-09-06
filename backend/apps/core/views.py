from django.db import connection
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .defaults import SETTING_DEFAULTS
from .models import AuditLog, Notification, SystemSetting
from .permissions import IsAdmin
from .serializers import (
    AuditLogSerializer, NotificationSerializer, SystemSettingSerializer,
)
from .services import client_ip, get_setting, write_audit


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
            db_ok = True
        except Exception:
            db_ok = False
        return Response(
            {"status": "ok" if db_ok else "degraded", "database": db_ok},
            status=status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class PublicSettingsView(APIView):
    """The handful of settings the landing page needs before login."""

    permission_classes = [AllowAny]
    PUBLIC_KEYS = ["platform_name", "support_email", "support_phone",
                   "support_whatsapp", "support_hours", "support_address",
                   "deposit_min_amount", "withdrawal_min_amount"]

    def get(self, request):
        return Response({k: str(get_setting(k)) for k in self.PUBLIC_KEYS})


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(user=request.user)[:100]
        return Response({
            "items": NotificationSerializer(qs, many=True).data,
            "unread": Notification.objects.filter(user=request.user, is_read=False).count(),
        })

    def post(self, request):
        """Mark read — a specific id, or all of them when none is supplied."""
        notif_id = request.data.get("id")
        qs = Notification.objects.filter(user=request.user, is_read=False)
        if notif_id:
            qs = qs.filter(id=notif_id)
        return Response({"marked_read": qs.update(is_read=True)})


class AdminSettingsView(APIView):
    """Full runtime config for the admin panel. GET merges stored rows over
    defaults, so unset keys still report their effective value."""

    permission_classes = [IsAdmin]

    def get(self, request):
        stored = {s.key: s.value for s in SystemSetting.objects.all()}
        merged = {**SETTING_DEFAULTS, **stored}
        return Response({
            "settings": merged,
            "rows": SystemSettingSerializer(SystemSetting.objects.all(), many=True).data,
        })

    def put(self, request):
        payload = request.data.get("settings")
        if not isinstance(payload, dict) or not payload:
            return Response({"detail": "A non-empty settings object is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        unknown = [k for k in payload if k not in SETTING_DEFAULTS]
        if unknown:
            return Response({"detail": "Unknown setting keys: " + ", ".join(unknown)},
                            status=status.HTTP_400_BAD_REQUEST)
        old = {k: str(get_setting(k)) for k in payload}
        for key, value in payload.items():
            SystemSetting.objects.update_or_create(
                pk=key, defaults={"value": value, "updated_by": request.user},
            )
        write_audit(request.user, "update_settings", entity_type="system_setting",
                    old_values=old,
                    new_values={k: str(v) for k, v in payload.items()},
                    ip_address=client_ip(request))
        return Response({"detail": "Settings updated.", "settings": payload})


class AdminAuditLogView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = AuditLog.objects.select_related("actor").all()
        action = request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        return Response({"items": AuditLogSerializer(qs[:200], many=True).data})
