"""Support chat: one thread per member, and the desk's side of all of them.

Deleting is scoped by who is asking. A member may remove their own words and
nothing else — letting them delete the desk's replies would let them erase the
answer they were given. An administrator may remove anything, including a whole
thread, because they are the ones who have to keep the record defensible.
"""
from django.db.models import Count, Max, Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.core.permissions import IsAdmin
from apps.core.services import notify, write_audit
from apps.core.services import client_ip

from .models import SupportMessage
from .serializers import SendMessageSerializer, SupportMessageSerializer


def _apply_date_range(qs, request):
    """`?from=YYYY-MM-DD&to=YYYY-MM-DD`, inclusive at both ends.

    `to` is widened to the end of that day; filtering on a bare date would
    otherwise exclude everything said after midnight on the closing day, which
    reads as messages going missing.
    """
    start = parse_date(request.query_params.get("from") or "")
    end = parse_date(request.query_params.get("to") or "")
    if start:
        qs = qs.filter(created_at__date__gte=start)
    if end:
        qs = qs.filter(created_at__date__lte=end)
    return qs


# ─── Member ───────────────────────────────────────────────────────────────

class MyThreadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = _apply_date_range(
            SupportMessage.objects.filter(member=request.user), request,
        )
        # Opening the thread marks the desk's replies as seen.
        SupportMessage.objects.filter(
            member=request.user, sender="admin", read_at__isnull=True,
        ).update(read_at=timezone.now())
        return Response({"items": SupportMessageSerializer(qs, many=True).data})

    def post(self, request):
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = SupportMessage.objects.create(
            member=request.user, sender="user", author=request.user,
            body=serializer.validated_data["body"],
        )
        return Response(
            SupportMessageSerializer(message).data, status=status.HTTP_201_CREATED,
        )


class MyMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, message_id):
        message = SupportMessage.objects.filter(
            id=message_id, member=request.user,
        ).first()
        if message is None:
            return Response({"detail": "Message not found."},
                            status=status.HTTP_404_NOT_FOUND)
        if message.sender != "user":
            return Response(
                {"detail": "You can only delete your own messages."},
                status=status.HTTP_403_FORBIDDEN,
            )
        message.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyUnreadCountView(APIView):
    """Drives the dot on the floating launcher."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = SupportMessage.objects.filter(
            member=request.user, sender="admin", read_at__isnull=True,
        ).count()
        return Response({"unread": count})


# ─── Administrator ────────────────────────────────────────────────────────

class AdminThreadListView(APIView):
    """Every member who has ever written in, newest activity first.

    `?search=` filters by name or email — the user-wise filter the inbox needs
    when the list grows past a screenful.
    """

    permission_classes = [IsAdmin]

    def get(self, request):
        rows = (
            SupportMessage.objects.values("member_id")
            .annotate(
                last_at=Max("created_at"),
                total=Count("id"),
                unread=Count("id", filter=Q(sender="user", read_at__isnull=True)),
            )
            .order_by("-last_at")
        )
        by_member = {r["member_id"]: r for r in rows}
        if not by_member:
            return Response({"items": []})

        members = User.objects.filter(id__in=list(by_member))
        search = (request.query_params.get("search") or "").strip()
        if search:
            members = members.filter(
                Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        # The last line of each thread, in one query rather than one per row.
        latest = {}
        for message in SupportMessage.objects.filter(
            member_id__in=[m.id for m in members],
        ).order_by("member_id", "-created_at"):
            latest.setdefault(message.member_id, message)

        items = []
        for member in members:
            row = by_member[member.id]
            tail = latest.get(member.id)
            items.append({
                "user_id": str(member.id),
                "name": member.full_name,
                "email": member.email,
                "kyc_status": member.kyc_status,
                "messages": row["total"],
                "unread": row["unread"],
                "last_at": row["last_at"],
                "last_sender": tail.sender if tail else "",
                "last_body": tail.body[:120] if tail else "",
            })
        items.sort(key=lambda i: i["last_at"], reverse=True)
        return Response({"items": items})


class AdminThreadView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, user_id):
        member = User.objects.filter(id=user_id).first()
        if member is None:
            return Response({"detail": "Member not found."},
                            status=status.HTTP_404_NOT_FOUND)

        qs = _apply_date_range(SupportMessage.objects.filter(member=member), request)
        # Opening a thread marks the member's side as seen.
        SupportMessage.objects.filter(
            member=member, sender="user", read_at__isnull=True,
        ).update(read_at=timezone.now())

        return Response({
            "user": {
                "id": str(member.id),
                "name": member.full_name,
                "email": member.email,
                "phone": member.phone,
                "kyc_status": member.kyc_status,
            },
            "items": SupportMessageSerializer(qs, many=True).data,
        })

    def post(self, request, user_id):
        member = User.objects.filter(id=user_id).first()
        if member is None:
            return Response({"detail": "Member not found."},
                            status=status.HTTP_404_NOT_FOUND)

        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = SupportMessage.objects.create(
            member=member, sender="admin", author=request.user,
            body=serializer.validated_data["body"],
        )
        notify(member, title="Reply from support",
               message=serializer.validated_data["body"][:160],
               notif_type="support", action_url="/support")
        return Response(
            SupportMessageSerializer(message).data, status=status.HTTP_201_CREATED,
        )

    def delete(self, request, user_id):
        """Clear a whole conversation."""
        deleted, _ = SupportMessage.objects.filter(member_id=user_id).delete()
        write_audit(request.user, "delete_support_thread", entity_type="user",
                    entity_id=user_id, new_values={"messages": deleted},
                    ip_address=client_ip(request))
        return Response({"deleted": deleted})


class AdminMessageView(APIView):
    permission_classes = [IsAdmin]

    def delete(self, request, message_id):
        message = SupportMessage.objects.filter(id=message_id).first()
        if message is None:
            return Response({"detail": "Message not found."},
                            status=status.HTTP_404_NOT_FOUND)
        write_audit(request.user, "delete_support_message", entity_type="support_message",
                    entity_id=message.id, new_values={"member": str(message.member_id)},
                    ip_address=client_ip(request))
        message.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
