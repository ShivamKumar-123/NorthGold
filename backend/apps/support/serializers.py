from rest_framework import serializers

from .models import SupportMessage

MAX_BODY = 4000

# The quick row on the message menu. Kept short deliberately — a picker with
# forty faces in it is a decision, and reacting should not be one.
ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"]


class QuotedMessageSerializer(serializers.ModelSerializer):
    """Just enough of the quoted message to draw the strip above a reply."""

    class Meta:
        model = SupportMessage
        fields = ["id", "sender", "body"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # The strip is two lines tall; sending the whole essay would be waste.
        data["body"] = (instance.body[:160] + "…") if len(instance.body) > 160 else instance.body
        return data


class SupportMessageSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    reply_to = QuotedMessageSerializer(read_only=True)
    starred = serializers.SerializerMethodField()
    my_reaction = serializers.SerializerMethodField()
    reaction_counts = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = SupportMessage
        fields = [
            "id", "sender", "body", "author_name", "read_at", "created_at",
            "reply_to", "starred", "my_reaction", "reaction_counts",
            "edited_at", "forwarded", "can_edit",
        ]
        read_only_fields = fields

    def _viewer_id(self):
        request = self.context.get("request")
        return str(request.user.id) if request and request.user.is_authenticated else ""

    def get_author_name(self, obj) -> str:
        return obj.author.full_name if obj.author else ""

    def get_starred(self, obj) -> bool:
        return self._viewer_id() in (obj.starred_by or [])

    def get_my_reaction(self, obj) -> str:
        viewer = self._viewer_id()
        for emoji, ids in (obj.reactions or {}).items():
            if viewer in ids:
                return emoji
        return ""

    def get_reaction_counts(self, obj) -> dict:
        return {e: len(ids) for e, ids in (obj.reactions or {}).items() if ids}

    def get_can_edit(self, obj) -> bool:
        """Own message, and only while the other side has not read it.

        Editing words somebody has already acted on rewrites history — the
        member would be looking at an answer to a question that no longer
        appears to have been asked.
        """
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.author_id == request.user.id and obj.read_at is None


class SendMessageSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=MAX_BODY, trim_whitespace=True)
    reply_to = serializers.UUIDField(required=False, allow_null=True)
    forwarded = serializers.BooleanField(required=False, default=False)

    def validate_body(self, value):
        # `trim_whitespace` leaves an all-whitespace body as "", which would
        # otherwise post an empty bubble into the thread.
        if not value.strip():
            raise serializers.ValidationError("Write a message first.")
        return value.strip()


class EditMessageSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=MAX_BODY, trim_whitespace=True)

    def validate_body(self, value):
        if not value.strip():
            raise serializers.ValidationError("A message cannot be emptied — delete it instead.")
        return value.strip()


class ReactionSerializer(serializers.Serializer):
    emoji = serializers.CharField(max_length=8)

    def validate_emoji(self, value):
        if value not in ALLOWED_REACTIONS:
            raise serializers.ValidationError(
                "Pick one of: " + " ".join(ALLOWED_REACTIONS),
            )
        return value
