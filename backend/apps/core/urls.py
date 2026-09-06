from django.urls import path

from .views import (
    AdminAuditLogView, AdminSettingsView, NotificationListView, PublicSettingsView,
)

urlpatterns = [
    path("public-settings/", PublicSettingsView.as_view(), name="public-settings"),
    path("notifications/", NotificationListView.as_view(), name="notifications"),
    path("admin/settings/", AdminSettingsView.as_view(), name="admin-settings"),
    path("admin/audit-logs/", AdminAuditLogView.as_view(), name="admin-audit-logs"),
]
