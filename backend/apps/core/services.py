"""Shared helpers: settings access, notifications, audit trail."""
import logging

from .defaults import SETTING_DEFAULTS, coerce
from .models import AuditLog, Notification, SystemSetting

logger = logging.getLogger(__name__)


def get_setting(key, default=None):
    """Read a runtime setting, falling back to SETTING_DEFAULTS then `default`."""
    try:
        row = SystemSetting.objects.filter(pk=key).first()
    except Exception:
        logger.exception("system setting read failed key=%s", key)
        row = None
    if row is not None:
        return coerce(key, row.value)
    if key in SETTING_DEFAULTS:
        return coerce(key, SETTING_DEFAULTS[key])
    return default


def set_setting(key, value, *, actor=None, description=""):
    row, _ = SystemSetting.objects.update_or_create(
        pk=key,
        defaults={"value": value, "updated_by": actor,
                  **({"description": description} if description else {})},
    )
    return row


def notify(user, title, message, *, notif_type="general", action_url=""):
    """Best-effort — a failed notification must never roll back a money move."""
    try:
        return Notification.objects.create(
            user=user, title=title, message=message,
            notif_type=notif_type, action_url=action_url,
        )
    except Exception:
        logger.exception("notification failed user=%s", getattr(user, "id", None))
        return None


def write_audit(actor, action, *, entity_type="", entity_id="",
                old_values=None, new_values=None, ip_address=None):
    try:
        return AuditLog.objects.create(
            actor=actor, action=action, entity_type=entity_type,
            entity_id=str(entity_id or ""), old_values=old_values,
            new_values=new_values, ip_address=ip_address,
        )
    except Exception:
        logger.exception("audit log failed action=%s", action)
        return None


def client_ip(request):
    fwd = request.META.get("HTTP_X_FORWARDED_FOR")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")
