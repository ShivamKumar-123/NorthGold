"""Support messages between a member and the desk.

There is no conversation table. A thread IS every message carrying the same
`member`, which is what makes "one thread per member" true by construction —
two rows can never disagree about which conversation they belong to, and a
member can never end up with two parallel threads.

`sender` says which side of the desk a message came from; `author` says who
actually typed it. They differ only for admin replies, where the thread still
belongs to the member but the words belong to whichever administrator was on
shift. Keeping both means an admin account can be deleted without taking the
reply out of the member's history.
"""
from django.db import models

from apps.accounts.models import User
from apps.core.models import TimeStampedUUIDModel

SENDER_CHOICES = [
    ("user", "Member"),
    ("admin", "Administrator"),
]


class SupportMessage(TimeStampedUUIDModel):
    member = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="support_messages",
        help_text="The member whose thread this message belongs to.",
    )
    sender = models.CharField(max_length=10, choices=SENDER_CHOICES, db_index=True)
    author = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
        help_text="Who wrote it. Differs from `member` on an admin reply.",
    )
    body = models.TextField()
    # Read by the other side. A member's own message is never 'unread' to them,
    # so this only ever tracks the opposite party.
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "support_messages"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["member", "created_at"]),
            models.Index(fields=["sender", "read_at"]),
        ]

    def __str__(self):
        return f"{self.sender} -> {self.member_id}: {self.body[:40]}"
