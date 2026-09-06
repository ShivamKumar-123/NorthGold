from rest_framework import serializers

from .models import AuditLog, Notification, SystemSetting


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = ["key", "value", "description", "updated_at"]
        read_only_fields = ["updated_at"]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "title", "message", "notif_type", "action_url",
                  "is_read", "created_at"]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source="actor.email", default=None, read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "actor", "actor_email", "action", "entity_type",
                  "entity_id", "old_values", "new_values", "ip_address", "created_at"]
