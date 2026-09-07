"""What an administrator may do to a member's account from the users list.

The money actions are the ones worth pinning down: every one of them has to
leave a ledger row, and setting a balance has to work out its own difference
rather than trusting a figure the browser read some seconds ago.
"""
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.wallet.models import Transaction


class AdminUserActionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.member = User.objects.create_user(
            email="member@t.local", password="Testpass!2026",
        )
        self.admin = User.objects.create_user(
            email="desk@t.local", password="Testpass!2026", role="admin", is_staff=True,
        )
        self.boss = User.objects.create_superuser(
            email="boss@t.local", password="Testpass!2026",
        )
        self.client.force_authenticate(self.admin)
        self.adjust_url = reverse("admin-adjust-balance", args=[self.member.id])

    def balance(self):
        self.member.refresh_from_db()
        return self.member.wallet_balance

    # ── Money in and out ─────────────────────────────────────────────────

    def test_adding_funds_credits_the_wallet_and_writes_a_row(self):
        res = self.client.post(
            self.adjust_url, {"amount": "250.00", "description": "Counter top-up"},
            format="json",
        )

        self.assertEqual(res.status_code, 201)
        self.assertEqual(self.balance(), Decimal("250.00"))
        tx = Transaction.objects.get(user=self.member)
        self.assertEqual(tx.amount, Decimal("250.00"))
        self.assertEqual(tx.balance_after, Decimal("250.00"))
        self.assertEqual(tx.created_by, self.admin)

    def test_taking_funds_out_debits_the_wallet(self):
        self.client.post(self.adjust_url, {"amount": "250", "description": "in"}, format="json")

        res = self.client.post(
            self.adjust_url, {"amount": "-100", "description": "Cash handed back"},
            format="json",
        )

        self.assertEqual(res.status_code, 201)
        self.assertEqual(self.balance(), Decimal("150.00"))

    def test_a_wallet_cannot_be_pushed_below_zero(self):
        res = self.client.post(
            self.adjust_url, {"amount": "-10", "description": "too much"}, format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.balance(), Decimal("0"))

    def test_setting_a_balance_works_out_its_own_difference(self):
        self.client.post(self.adjust_url, {"amount": "500", "description": "in"}, format="json")

        res = self.client.post(
            self.adjust_url, {"set_to": "800", "description": "Corrected after recount"},
            format="json",
        )

        self.assertEqual(res.status_code, 201)
        self.assertEqual(self.balance(), Decimal("800.00"))
        # The row records the correction that actually happened, not the target.
        tx = Transaction.objects.filter(user=self.member).order_by("-created_at").first()
        self.assertEqual(tx.amount, Decimal("300.00"))
        self.assertEqual(tx.balance_after, Decimal("800.00"))

    def test_setting_a_balance_downwards_records_a_negative_row(self):
        self.client.post(self.adjust_url, {"amount": "500", "description": "in"}, format="json")

        self.client.post(
            self.adjust_url, {"set_to": "120", "description": "Recount"}, format="json",
        )

        tx = Transaction.objects.filter(user=self.member).order_by("-created_at").first()
        self.assertEqual(tx.amount, Decimal("-380.00"))
        self.assertEqual(self.balance(), Decimal("120.00"))

    def test_an_adjustment_always_needs_a_reason(self):
        res = self.client.post(self.adjust_url, {"amount": "100"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.balance(), Decimal("0"))

    # ── Blocking and archiving ───────────────────────────────────────────

    def test_blocking_a_member_stops_them_signing_in(self):
        url = reverse("admin-user-detail", args=[self.member.id])
        self.client.patch(url, {"status": "blocked"}, format="json")

        signin = APIClient().post(
            reverse("login"), {"email": self.member.email, "password": "Testpass!2026"},
            format="json",
        )
        self.assertEqual(signin.status_code, 400)

    def test_archiving_keeps_the_ledger_and_hides_the_account(self):
        self.client.post(self.adjust_url, {"amount": "500", "description": "in"}, format="json")
        self.client.patch(
            reverse("admin-user-detail", args=[self.member.id]),
            {"status": "archived"}, format="json",
        )

        # The row is closed, not erased: the account and its ledger survive.
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, "archived")
        self.assertEqual(self.member.wallet_balance, Decimal("500.00"))
        self.assertTrue(Transaction.objects.filter(user=self.member).exists())

        listed = self.client.get(reverse("admin-users"))
        self.assertNotIn(self.member.email, [u["email"] for u in listed.data["items"]])

        # …and it can still be found by asking for it.
        archived = self.client.get(reverse("admin-users"), {"status": "archived"})
        self.assertIn(self.member.email, [u["email"] for u in archived.data["items"]])

    def test_an_archived_member_cannot_sign_in(self):
        self.client.patch(
            reverse("admin-user-detail", args=[self.member.id]),
            {"status": "archived"}, format="json",
        )
        signin = APIClient().post(
            reverse("login"), {"email": self.member.email, "password": "Testpass!2026"},
            format="json",
        )
        self.assertEqual(signin.status_code, 400)

    # ── Passwords ────────────────────────────────────────────────────────

    def test_an_admin_can_set_a_members_password(self):
        url = reverse("admin-set-password", args=[self.member.id])

        res = self.client.post(url, {"new_password": "Freshpass!2026"}, format="json")

        self.assertEqual(res.status_code, 200)
        signin = APIClient().post(
            reverse("login"), {"email": self.member.email, "password": "Freshpass!2026"},
            format="json",
        )
        self.assertEqual(signin.status_code, 200)

    def test_a_weak_password_is_refused(self):
        res = self.client.post(
            reverse("admin-set-password", args=[self.member.id]),
            {"new_password": "password"}, format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_an_admin_cannot_reset_another_admins_password(self):
        # A compromised admin account must not be able to take over the desk.
        res = self.client.post(
            reverse("admin-set-password", args=[self.boss.id]),
            {"new_password": "Freshpass!2026"}, format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_a_superadmin_can(self):
        self.client.force_authenticate(self.boss)
        res = self.client.post(
            reverse("admin-set-password", args=[self.admin.id]),
            {"new_password": "Freshpass!2026"}, format="json",
        )
        self.assertEqual(res.status_code, 200)

    def test_members_cannot_reach_any_of_it(self):
        self.client.force_authenticate(self.member)
        self.assertEqual(
            self.client.post(self.adjust_url, {"amount": "1000", "description": "mine"},
                             format="json").status_code, 403,
        )
        self.assertEqual(
            self.client.post(reverse("admin-set-password", args=[self.member.id]),
                             {"new_password": "Freshpass!2026"}, format="json").status_code, 403,
        )
