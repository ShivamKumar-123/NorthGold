"""Support chat: who may read, write and delete what.

The rules worth pinning down are the asymmetric ones — a member may remove
their own words but not the answer they were given, and the desk's inbox must
not leak one member's thread into another's.
"""
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from django.test import TestCase

from apps.accounts.models import User
from apps.support.models import SupportMessage


class SupportChatTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.alice = User.objects.create_user(email="alice@t.local", password="Testpass!2026")
        self.bob = User.objects.create_user(email="bob@t.local", password="Testpass!2026")
        self.admin = User.objects.create_superuser(
            email="desk@t.local", password="Testpass!2026",
        )

    def send_as(self, user, body):
        self.client.force_authenticate(user)
        return self.client.post(reverse("support-thread"), {"body": body}, format="json")

    # ── Member ───────────────────────────────────────────────────────────

    def test_a_member_only_ever_sees_their_own_thread(self):
        self.send_as(self.alice, "Alice here")
        self.send_as(self.bob, "Bob here")

        self.client.force_authenticate(self.alice)
        res = self.client.get(reverse("support-thread"))

        self.assertEqual(res.status_code, 200)
        bodies = [m["body"] for m in res.data["items"]]
        self.assertEqual(bodies, ["Alice here"])

    def test_an_empty_message_is_refused(self):
        res = self.send_as(self.alice, "   ")
        self.assertEqual(res.status_code, 400)
        self.assertFalse(SupportMessage.objects.exists())

    def test_reading_the_thread_marks_the_desk_replies_seen(self):
        self.send_as(self.alice, "A question")
        self.client.force_authenticate(self.admin)
        self.client.post(
            reverse("admin-support-thread", args=[self.alice.id]),
            {"body": "An answer"}, format="json",
        )
        reply = SupportMessage.objects.get(sender="admin")
        self.assertIsNone(reply.read_at)

        self.client.force_authenticate(self.alice)
        self.client.get(reverse("support-thread"))

        reply.refresh_from_db()
        self.assertIsNotNone(reply.read_at)

    def test_unread_count_only_counts_the_desk(self):
        self.send_as(self.alice, "mine")  # own message must never count
        self.client.force_authenticate(self.admin)
        self.client.post(
            reverse("admin-support-thread", args=[self.alice.id]),
            {"body": "theirs"}, format="json",
        )

        self.client.force_authenticate(self.alice)
        res = self.client.get(reverse("support-unread"))
        self.assertEqual(res.data["unread"], 1)

    def test_a_member_may_delete_their_own_message(self):
        self.send_as(self.alice, "Ignore that")
        mine = SupportMessage.objects.get()

        self.client.force_authenticate(self.alice)
        res = self.client.delete(reverse("support-message", args=[mine.id]))

        self.assertEqual(res.status_code, 204)
        self.assertFalse(SupportMessage.objects.exists())

    def test_a_member_may_not_delete_the_answer_they_were_given(self):
        self.client.force_authenticate(self.admin)
        self.client.post(
            reverse("admin-support-thread", args=[self.alice.id]),
            {"body": "Our answer"}, format="json",
        )
        reply = SupportMessage.objects.get()

        self.client.force_authenticate(self.alice)
        res = self.client.delete(reverse("support-message", args=[reply.id]))

        self.assertEqual(res.status_code, 403)
        self.assertTrue(SupportMessage.objects.filter(id=reply.id).exists())

    def test_a_member_cannot_touch_another_members_message(self):
        self.send_as(self.bob, "Bob's")
        theirs = SupportMessage.objects.get()

        self.client.force_authenticate(self.alice)
        res = self.client.delete(reverse("support-message", args=[theirs.id]))

        # Not found rather than forbidden: Alice has no business learning that
        # this id exists at all.
        self.assertEqual(res.status_code, 404)
        self.assertTrue(SupportMessage.objects.filter(id=theirs.id).exists())

    # ── Administrator ────────────────────────────────────────────────────

    def test_the_inbox_lists_a_thread_per_member_newest_first(self):
        self.send_as(self.alice, "first")
        self.send_as(self.bob, "second")

        self.client.force_authenticate(self.admin)
        res = self.client.get(reverse("admin-support-threads"))

        self.assertEqual(res.status_code, 200)
        emails = [t["email"] for t in res.data["items"]]
        self.assertEqual(emails, [self.bob.email, self.alice.email])
        self.assertEqual(res.data["items"][0]["unread"], 1)

    def test_the_inbox_filters_by_member(self):
        self.send_as(self.alice, "hello")
        self.send_as(self.bob, "hello")

        self.client.force_authenticate(self.admin)
        res = self.client.get(reverse("admin-support-threads"), {"search": "bob@"})

        self.assertEqual([t["email"] for t in res.data["items"]], [self.bob.email])

    def test_a_thread_filters_by_date(self):
        self.send_as(self.alice, "old")
        old = SupportMessage.objects.get()
        old.created_at = timezone.now() - timezone.timedelta(days=10)
        old.save(update_fields=["created_at"])
        self.send_as(self.alice, "new")

        self.client.force_authenticate(self.admin)
        today = timezone.now().date().isoformat()
        res = self.client.get(
            reverse("admin-support-thread", args=[self.alice.id]), {"from": today},
        )

        self.assertEqual([m["body"] for m in res.data["items"]], ["new"])

    def test_an_admin_reply_belongs_to_the_member_thread(self):
        self.client.force_authenticate(self.admin)
        self.client.post(
            reverse("admin-support-thread", args=[self.alice.id]),
            {"body": "Answered"}, format="json",
        )

        reply = SupportMessage.objects.get()
        # The thread is the member's; the words are the administrator's.
        self.assertEqual(reply.member_id, self.alice.id)
        self.assertEqual(reply.author_id, self.admin.id)
        self.assertEqual(reply.sender, "admin")

    def test_an_admin_can_clear_a_whole_conversation(self):
        self.send_as(self.alice, "one")
        self.send_as(self.alice, "two")
        self.send_as(self.bob, "untouched")

        self.client.force_authenticate(self.admin)
        res = self.client.delete(reverse("admin-support-thread", args=[self.alice.id]))

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["deleted"], 2)
        self.assertEqual(SupportMessage.objects.count(), 1)

    def test_the_inbox_is_closed_to_members(self):
        self.client.force_authenticate(self.alice)
        self.assertEqual(self.client.get(reverse("admin-support-threads")).status_code, 403)
        self.assertEqual(
            self.client.get(reverse("admin-support-thread", args=[self.bob.id])).status_code,
            403,
        )
