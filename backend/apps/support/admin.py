from django.contrib import admin

from .models import SupportMessage


@admin.register(SupportMessage)
class SupportMessageAdmin(admin.ModelAdmin):
    list_display = ("member", "sender", "short_body", "read_at", "created_at")
    list_filter = ("sender", "created_at")
    search_fields = ("member__email", "body")
    raw_id_fields = ("member", "author")

    @admin.display(description="Message")
    def short_body(self, obj):
        return obj.body[:60]
