"""The message menu's writes: reply, react, star, edit and forward.

Kept apart from `tests.py`, which covers the thread itself — reading, writing
and the delete rules. These are the actions taken *on* a message that already
exists.
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.support.models import SupportMessage


class MessageMenuTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.alice = User.objects.create_user(email="alice@t.local", password="Testpass!2026")
        self.bob = User.objects.create_user(email="bob@t.local", password="Testpass!2026")
        self.admin = User.objects.create_superuser(
            email="desk@t.local", password="Testpass!2026",
        )

    def member_sends(self, user, body, **extra):
        self.client.force_authenticate(user)
        return self.client.post(
            reverse("support-thread"), {"body": body, **extra}, format="json",
        )

    # ── Reply ────────────────────────────────────────────────────────────

    def test_a_reply_carries_the_quoted_message(self):
        self.member_sends(self.alice, "What is my rate?")
        quoted = SupportMessage.objects.get()

        res = self.member_sends(self.alice, "Still wondering", reply_to=str(quoted.id))

        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["reply_to"]["id"], str(quoted.id))
        self.assertEqual(res.data["reply_to"]["body"], "What is my rate?")

    def test_a_quote_from_another_thread_is_dropped(self):
        self.member_sends(self.bob, "Bob's private line")
        theirs = SupportMessage.objects.get()

        res = self.member_sends(self.alice, "Look at this", reply_to=str(theirs.id))

        # The message still sends; it simply carries no quote. The strip renders
        # quoted text verbatim, so lifting one out of another conversation would
        # leak it.
        self.assertEqual(res.status_code, 201)
        self.assertIsNone(res.data["reply_to"])

    # ── Reactions ────────────────────────────────────────────────────────

    def test_reacting_twice_with_the_same_emoji_clears_it(self):
        self.member_sends(self.alice, "Thanks!")
        message = SupportMessage.objects.get()
        url = reverse("support-react", args=[message.id])

        self.client.force_authenticate(self.admin)
        first = self.client.post(url, {"emoji": "\U0001F44D"}, format="json")
        self.assertEqual(first.data["reaction_counts"], {"\U0001F44D": 1})

        second = self.client.post(url, {"emoji": "\U0001F44D"}, format="json")
        self.assertEqual(second.data["reaction_counts"], {})

    def test_a_second_emoji_replaces_the_first(self):
        self.member_sends(self.alice, "Thanks!")
        message = SupportMessage.objects.get()
        url = reverse("support-react", args=[message.id])

        self.client.force_authenticate(self.admin)
        self.client.post(url, {"emoji": "\U0001F44D"}, format="json")
        res = self.client.post(url, {"emoji": "❤️"}, format="json")

        # One reaction per person: holding two at once has no meaning here.
        self.assertEqual(res.data["reaction_counts"], {"❤️": 1})
        self.assertEqual(res.data["my_reaction"], "❤️")

    def test_an_unlisted_emoji_is_refused(self):
        self.member_sends(self.alice, "hi")
        message = SupportMessage.objects.get()

        self.client.force_authenticate(self.admin)
        res = self.client.post(
            reverse("support-react", args=[message.id]),
            {"emoji": "\U0001F984"}, format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_a_member_cannot_react_in_another_thread(self):
        self.member_sends(self.bob, "Bob's")
        theirs = SupportMessage.objects.get()

        self.client.force_authenticate(self.alice)
        res = self.client.post(
            reverse("support-react", args=[theirs.id]),
            {"emoji": "\U0001F44D"}, format="json",
        )
        self.assertEqual(res.status_code, 404)

    # ── Stars ────────────────────────────────────────────────────────────

    def test_each_side_stars_independently(self):
        self.member_sends(self.alice, "Important")
        message = SupportMessage.objects.get()
        url = reverse("support-star", args=[message.id])

        self.client.force_authenticate(self.alice)
        self.client.post(url)
        self.client.force_authenticate(self.admin)
        res = self.client.post(url)

        message.refresh_from_db()
        # Both marks stand; toggling one must not clear the other.
        self.assertEqual(len(message.starred_by), 2)
        self.assertTrue(res.data["starred"])

    def test_the_thread_filters_down_to_starred(self):
        self.member_sends(self.alice, "ordinary")
        self.member_sends(self.alice, "important")
        important = SupportMessage.objects.order_by("created_at").last()

        self.client.force_authenticate(self.alice)
        self.client.post(reverse("support-star", args=[important.id]))
        res = self.client.get(reverse("support-thread"), {"starred": "1"})

        self.assertEqual([m["body"] for m in res.data["items"]], ["important"])

    # ── Editing ──────────────────────────────────────────────────────────

    def test_a_member_can_edit_their_own_unread_message(self):
        self.member_sends(self.alice, "I sent $6,000")
        message = SupportMessage.objects.get()

        self.client.force_authenticate(self.alice)
        res = self.client.patch(
            reverse("support-message", args=[message.id]),
            {"body": "I sent $8,000"}, format="json",
        )

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["body"], "I sent $8,000")
        self.assertIsNotNone(res.data["edited_at"])

    def test_a_message_the_desk_has_read_can_no_longer_be_edited(self):
        self.member_sends(self.alice, "I sent $6,000")
        # The desk opening the thread is what marks it read.
        self.client.force_authenticate(self.admin)
        self.client.get(reverse("admin-support-thread", args=[self.alice.id]))
        message = SupportMessage.objects.get()

        self.client.force_authenticate(self.alice)
        res = self.client.patch(
            reverse("support-message", args=[message.id]),
            {"body": "I sent $8,000"}, format="json",
        )

        self.assertEqual(res.status_code, 400)
        message.refresh_from_db()
        self.assertEqual(message.body, "I sent $6,000")

    def test_nobody_edits_words_they_did_not_write(self):
        self.member_sends(self.alice, "mine")
        message = SupportMessage.objects.get()

        # Even the desk, which may delete anything, may not rewrite it: an
        # edited message keeps the original author's name on it.
        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            reverse("support-message", args=[message.id]),
            {"body": "not mine"}, format="json",
        )
        self.assertEqual(res.status_code, 403)

    # ── Forwarding ───────────────────────────────────────────────────────

    def test_the_desk_forwards_a_message_into_another_thread(self):
        self.member_sends(self.alice, "How is the rate fixed?")

        self.client.force_authenticate(self.admin)
        res = self.client.post(
            reverse("admin-support-thread", args=[self.bob.id]),
            {"body": "The rate is fixed at purchase.", "forwarded": True},
            format="json",
        )

        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data["forwarded"])
        self.assertEqual(SupportMessage.objects.filter(member=self.bob).count(), 1)

    def test_the_forward_picker_can_reach_a_member_who_never_wrote_in(self):
        self.member_sends(self.alice, "hello")

        self.client.force_authenticate(self.admin)
        default = self.client.get(reverse("admin-support-threads"))
        everyone = self.client.get(reverse("admin-support-threads"), {"all": "1"})

        self.assertEqual([t["email"] for t in default.data["items"]], [self.alice.email])
        self.assertIn(self.bob.email, [t["email"] for t in everyone.data["items"]])
