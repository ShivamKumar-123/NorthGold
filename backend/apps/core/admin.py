from django.contrib import admin

from .models import AuditLog, Notification, SystemSetting


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "value", "updated_at")
    search_fields = ("key",)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "title", "notif_type", "is_read", "created_at")
    list_filter = ("notif_type", "is_read")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "actor", "entity_type", "entity_id", "created_at")
    list_filter = ("action", "entity_type")
