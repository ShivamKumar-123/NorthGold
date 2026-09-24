"""Deleting a member outright.

Archiving is the ordinary close; this is the other one, and the only way to be
sure it is safe is to build a member with something of everything hanging off
them, delete them, and check what survived.
"""
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import KYCDocument, Referral, User
from apps.core.models import AuditLog
from apps.investments.models import Investment, RoiPayout
from apps.mlm.models import Commission
from apps.support.models import SupportMessage
from apps.wallet.models import Deposit, Transaction


class DeleteUserTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="desk@t.local", password="Testpass!2026", role="admin", is_staff=True,
        )
        self.boss = User.objects.create_superuser(
            email="boss@t.local", password="Testpass!2026",
        )
        self.sponsor = User.objects.create_user(
            email="sponsor@t.local", password="Testpass!2026",
        )
        self.member = User.objects.create_user(
            email="member@t.local", password="Testpass!2026", sponsor=self.sponsor,
        )
        self.downline = User.objects.create_user(
            email="downline@t.local", password="Testpass!2026", sponsor=self.member,
        )

        # Something of everything, so the cascade has work to do.
        Referral.objects.create(referrer=self.sponsor, referred=self.member)
        Deposit.objects.create(user=self.member, amount=Decimal("1000"), method="cash")
        Transaction.objects.create(
            user=self.member, tx_type="deposit", amount=Decimal("1000"),
            balance_after=Decimal("1000"),
        )
        KYCDocument.objects.create(user=self.member, doc_type="id_front", file="x.png")
        SupportMessage.objects.create(
            member=self.member, sender="user", author=self.member, body="hello",
        )
        # Commission the member GENERATED for their sponsor, and the wallet
        # credit that went with it.
        Commission.objects.create(
            earner=self.sponsor, source_user=self.member, level=1, trigger="roi",
            base_amount=Decimal("1000"), percent=Decimal("1"), amount=Decimal("10"),
            status="paid", month_index=1,
        )
        Transaction.objects.create(
            user=self.sponsor, tx_type="commission", amount=Decimal("10"),
            balance_after=Decimal("10"),
        )
        self.sponsor.wallet_balance = Decimal("10")
        self.sponsor.total_commission_earned = Decimal("10")
        self.sponsor.save()

        self.url = reverse("admin-user-detail", args=[self.member.id])
        self.client.force_authenticate(self.admin)

    def test_everything_belonging_to_them_goes(self):
        res = self.client.delete(self.url)

        self.assertEqual(res.status_code, 200)
        self.assertFalse(User.objects.filter(id=self.member.id).exists())
        self.assertFalse(Deposit.objects.filter(user_id=self.member.id).exists())
        self.assertFalse(Transaction.objects.filter(user_id=self.member.id).exists())
        self.assertFalse(KYCDocument.objects.filter(user_id=self.member.id).exists())
        self.assertFalse(SupportMessage.objects.filter(member_id=self.member.id).exists())
        self.assertFalse(Referral.objects.filter(referred_id=self.member.id).exists())
        self.assertFalse(Investment.objects.filter(user_id=self.member.id).exists())
        self.assertFalse(RoiPayout.objects.filter(user_id=self.member.id).exists())

    def test_their_downline_survives_with_no_sponsor(self):
        self.client.delete(self.url)

        # Deleting somebody must not delete the people they introduced.
        self.downline.refresh_from_db()
        self.assertIsNone(self.downline.sponsor_id)

    def test_the_sponsor_keeps_the_money_and_the_statement_line(self):
        self.client.delete(self.url)

        self.sponsor.refresh_from_db()
        # The commission row is gone with the member who generated it, but the
        # money was really paid and the sponsor's own ledger says so.
        self.assertEqual(self.sponsor.wallet_balance, Decimal("10"))
        self.assertTrue(
            Transaction.objects.filter(user=self.sponsor, tx_type="commission").exists()
        )

    def test_the_sponsors_lifetime_total_is_recomputed(self):
        self.client.delete(self.url)

        self.sponsor.refresh_from_db()
        # Denormalised, and the rows behind it just vanished — left alone it
        # would claim earnings nothing in the database can account for.
        self.assertEqual(self.sponsor.total_commission_earned, Decimal("0"))
        self.assertEqual(
            Commission.objects.filter(source_user_id=self.member.id).count(), 0,
        )

    def test_the_deletion_is_written_down_before_the_row_goes(self):
        self.client.delete(self.url)

        entry = AuditLog.objects.filter(action="delete_user").first()
        self.assertIsNotNone(entry)
        # The id means nothing once the account is gone, so the email is kept.
        self.assertEqual(entry.old_values["email"], "member@t.local")
        self.assertEqual(entry.new_values["deposits"], 1)

    def test_an_admin_cannot_delete_their_own_account(self):
        res = self.client.delete(reverse("admin-user-detail", args=[self.admin.id]))
        self.assertEqual(res.status_code, 400)
        self.assertTrue(User.objects.filter(id=self.admin.id).exists())

    def test_an_admin_cannot_delete_another_admin(self):
        res = self.client.delete(reverse("admin-user-detail", args=[self.boss.id]))
        self.assertEqual(res.status_code, 403)
        self.assertTrue(User.objects.filter(id=self.boss.id).exists())

    def test_a_superadmin_can(self):
        self.client.force_authenticate(self.boss)
        res = self.client.delete(reverse("admin-user-detail", args=[self.admin.id]))
        self.assertEqual(res.status_code, 200)
        self.assertFalse(User.objects.filter(id=self.admin.id).exists())

    def test_members_cannot_delete_anybody(self):
        self.client.force_authenticate(self.sponsor)
        res = self.client.delete(self.url)
        self.assertEqual(res.status_code, 403)
        self.assertTrue(User.objects.filter(id=self.member.id).exists())
