from rest_framework import serializers

from .models import SupportMessage

MAX_BODY = 4000


class SupportMessageSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = SupportMessage
        fields = ["id", "sender", "body", "author_name", "read_at", "created_at"]
        read_only_fields = ["id", "sender", "author_name", "read_at", "created_at"]

    def get_author_name(self, obj) -> str:
        return obj.author.full_name if obj.author else ""


class SendMessageSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=MAX_BODY, trim_whitespace=True)

    def validate_body(self, value):
        # `trim_whitespace` leaves an all-whitespace body as "", which would
        # otherwise post an empty bubble into the thread.
        if not value.strip():
            raise serializers.ValidationError("Write a message first.")
        return value.strip()
