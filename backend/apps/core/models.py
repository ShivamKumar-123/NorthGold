import uuid

from django.conf import settings
from django.db import models


class TimeStampedUUIDModel(models.Model):
    """UUID primary keys everywhere — referral links and admin URLs leak row
    counts otherwise."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SystemSetting(models.Model):
    """Runtime knobs the admin panel flips without a redeploy.

    Canonical keys (see apps.core.defaults):
      mlm_deposit_enabled, mlm_roi_enabled, mlm_max_levels,
      auto_invest_on_deposit, withdrawal_min_amount, roi_credit_target,
      platform_name, support_email
    """

    key = models.CharField(max_length=100, primary_key=True)
    value = models.JSONField()
    description = models.TextField(blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "system_settings"
        ordering = ["key"]

    def __str__(self):
        return self.key


class Notification(TimeStampedUUIDModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications",
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notif_type = models.CharField(max_length=40, default="general", db_index=True)
    action_url = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]


class AuditLog(TimeStampedUUIDModel):
    """Every admin money action lands here — approvals, config edits, manual
    credits. Non-repudiation for the verification workflow."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="audit_logs",
    )
    action = models.CharField(max_length=60, db_index=True)
    entity_type = models.CharField(max_length=60, blank=True)
    entity_id = models.CharField(max_length=64, blank=True, db_index=True)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]
