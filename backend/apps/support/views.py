"""Support chat: one thread per member, and the desk's side of all of them.

Deleting is scoped by who is asking. A member may remove their own words and
nothing else — letting them delete the desk's replies would let them erase the
answer they were given. An administrator may remove anything, including a whole
thread, because they are the ones who have to keep the record defensible.

Reacting, starring and editing are shared endpoints rather than mirrored member
and admin ones: the rule is the same on both sides ("may I see this thread?"),
and two copies of it would eventually disagree.
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
from apps.core.services import client_ip, notify, write_audit

from .models import SupportMessage
from .serializers import (
    EditMessageSerializer, ReactionSerializer, SendMessageSerializer,
    SupportMessageSerializer,
)


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


def _filter_starred(rows, request):
    """`?starred=1` — only what the person asking has starred.

    Filtered in Python rather than with a JSON `contains` lookup, which SQLite
    does not support at all; matching on the serialised text instead would hit
    a user id appearing anywhere else in the row. A thread is small enough that
    walking it is both honest and portable across both backends.
    """
    if (request.query_params.get("starred") or "").lower() not in ("1", "true", "yes"):
        return rows
    me = str(request.user.id)
    return [m for m in rows if me in (m.starred_by or [])]


def _resolve_quote(message_id, member):
    """A quoted message must belong to the same thread.

    Without the check, a reply could carry a quote lifted out of somebody
    else's conversation — and the strip renders that text verbatim.
    """
    if not message_id:
        return None
    return SupportMessage.objects.filter(id=message_id, member=member).first()


def _visible_to(user, message):
    """Admins see every thread; a member sees only their own."""
    return user.is_admin or message.member_id == user.id


# ─── Member ───────────────────────────────────────────────────────────────

class MyThreadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = _filter_starred(
            _apply_date_range(
                SupportMessage.objects.filter(member=request.user)
                .select_related("reply_to"),
                request,
            ),
            request,
        )
        # Opening the thread marks the desk's replies as seen.
        SupportMessage.objects.filter(
            member=request.user, sender="admin", read_at__isnull=True,
        ).update(read_at=timezone.now())
        return Response({
            "items": SupportMessageSerializer(
                qs, many=True, context={"request": request},
            ).data,
        })

    def post(self, request):
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        message = SupportMessage.objects.create(
            member=request.user, sender="user", author=request.user,
            body=data["body"],
            reply_to=_resolve_quote(data.get("reply_to"), request.user),
            forwarded=data.get("forwarded", False),
        )
        return Response(
            SupportMessageSerializer(message, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MyUnreadCountView(APIView):
    """Drives the dot on the floating launcher."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = SupportMessage.objects.filter(
            member=request.user, sender="admin", read_at__isnull=True,
        ).count()
        return Response({"unread": count})


# ─── One message, either side ─────────────────────────────────────────────

class MessageView(APIView):
    """Delete or edit a single message.

    Both verbs are author-scoped even for administrators: the desk may remove
    anything (that is the moderation power), but nobody edits words they did
    not write, because an edited message keeps the original author's name on it.
    """

    permission_classes = [IsAuthenticated]

    def _get(self, request, message_id):
        message = SupportMessage.objects.filter(id=message_id).first()
        if message is None or not _visible_to(request.user, message):
            # Not found rather than forbidden: a member has no business
            # learning that somebody else's message id exists.
            return None
        return message

    def patch(self, request, message_id):
        message = self._get(request, message_id)
        if message is None:
            return Response({"detail": "Message not found."},
                            status=status.HTTP_404_NOT_FOUND)
        if message.author_id != request.user.id:
            return Response({"detail": "You can only edit your own messages."},
                            status=status.HTTP_403_FORBIDDEN)
        if message.read_at is not None:
            return Response(
                {"detail": "This has already been read — send a correction instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = EditMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message.body = serializer.validated_data["body"]
        message.edited_at = timezone.now()
        message.save(update_fields=["body", "edited_at", "updated_at"])
        return Response(
            SupportMessageSerializer(message, context={"request": request}).data,
        )

    def delete(self, request, message_id):
        message = self._get(request, message_id)
        if message is None:
            return Response({"detail": "Message not found."},
                            status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_admin and message.sender != "user":
            return Response({"detail": "You can only delete your own messages."},
                            status=status.HTTP_403_FORBIDDEN)
        if request.user.is_admin:
            write_audit(request.user, "delete_support_message",
                        entity_type="support_message", entity_id=message.id,
                        new_values={"member": str(message.member_id)},
                        ip_address=client_ip(request))
        message.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MessageReactionView(APIView):
    """One reaction per person per message — picking a second replaces the
    first, and picking the same one again clears it. That is what every chat
    app does, and holding two at once has no meaning here."""

    permission_classes = [IsAuthenticated]

    def post(self, request, message_id):
        message = SupportMessage.objects.filter(id=message_id).first()
        if message is None or not _visible_to(request.user, message):
            return Response({"detail": "Message not found."},
                            status=status.HTTP_404_NOT_FOUND)

        serializer = ReactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        emoji = serializer.validated_data["emoji"]
        me = str(request.user.id)

        reactions = dict(message.reactions or {})
        had = None
        for existing, ids in list(reactions.items()):
            if me in ids:
                had = existing
                reactions[existing] = [i for i in ids if i != me]
                if not reactions[existing]:
                    reactions.pop(existing)
        if had != emoji:
            reactions.setdefault(emoji, []).append(me)

        message.reactions = reactions
        message.save(update_fields=["reactions", "updated_at"])
        return Response(
            SupportMessageSerializer(message, context={"request": request}).data,
        )


class MessageStarView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, message_id):
        message = SupportMessage.objects.filter(id=message_id).first()
        if message is None or not _visible_to(request.user, message):
            return Response({"detail": "Message not found."},
                            status=status.HTTP_404_NOT_FOUND)

        me = str(request.user.id)
        starred = list(message.starred_by or [])
        # Each side's star is their own; toggling mine must not clear theirs.
        message.starred_by = [i for i in starred if i != me] if me in starred else starred + [me]
        message.save(update_fields=["starred_by", "updated_at"])
        return Response(
            SupportMessageSerializer(message, context={"request": request}).data,
        )


# ─── Administrator ────────────────────────────────────────────────────────

class AdminThreadListView(APIView):
    """Every member who has ever written in, newest activity first.

    `?search=` filters by name or email — the user-wise filter the inbox needs
    when the list grows past a screenful. `?all=1` additionally returns members
    with no thread yet, which is what the forward picker needs: the desk has to
    be able to send a message on to somebody who has never written in.
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

        include_all = (request.query_params.get("all") or "").lower() in ("1", "true")
        members = User.objects.filter(role="user") if include_all \
            else User.objects.filter(id__in=list(by_member))

        search = (request.query_params.get("search") or "").strip()
        if search:
            members = members.filter(
                Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )
        members = list(members[:400])
        if not members:
            return Response({"items": []})

        # The last line of each thread, in one query rather than one per row.
        latest = {}
        for message in SupportMessage.objects.filter(
            member_id__in=[m.id for m in members],
        ).order_by("member_id", "-created_at"):
            latest.setdefault(message.member_id, message)

        items = []
        for member in members:
            row = by_member.get(member.id)
            tail = latest.get(member.id)
            items.append({
                "user_id": str(member.id),
                "name": member.full_name,
                "email": member.email,
                "kyc_status": member.kyc_status,
                "messages": row["total"] if row else 0,
                "unread": row["unread"] if row else 0,
                "last_at": row["last_at"] if row else None,
                "last_sender": tail.sender if tail else "",
                "last_body": tail.body[:120] if tail else "",
            })
        items.sort(key=lambda i: (i["last_at"] is not None, i["last_at"] or ""), reverse=True)
        return Response({"items": items})


class AdminThreadView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, user_id):
        member = User.objects.filter(id=user_id).first()
        if member is None:
            return Response({"detail": "Member not found."},
                            status=status.HTTP_404_NOT_FOUND)

        qs = _filter_starred(
            _apply_date_range(
                SupportMessage.objects.filter(member=member).select_related("reply_to"),
                request,
            ),
            request,
        )
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
            "items": SupportMessageSerializer(
                qs, many=True, context={"request": request},
            ).data,
        })

    def post(self, request, user_id):
        member = User.objects.filter(id=user_id).first()
        if member is None:
            return Response({"detail": "Member not found."},
                            status=status.HTTP_404_NOT_FOUND)

        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        message = SupportMessage.objects.create(
            member=member, sender="admin", author=request.user,
            body=data["body"],
            reply_to=_resolve_quote(data.get("reply_to"), member),
            forwarded=data.get("forwarded", False),
        )
        notify(member, title="Reply from support",
               message=data["body"][:160],
               notif_type="support", action_url="/support")
        return Response(
            SupportMessageSerializer(message, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, user_id):
        """Clear a whole conversation."""
        deleted, _ = SupportMessage.objects.filter(member_id=user_id).delete()
        write_audit(request.user, "delete_support_thread", entity_type="user",
                    entity_id=user_id, new_values={"messages": deleted},
                    ip_address=client_ip(request))
        return Response({"deleted": deleted})
