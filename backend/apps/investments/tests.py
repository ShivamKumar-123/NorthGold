"""End-to-end tests for the money flow.

Covers the two rules the whole product rests on:
  * a deposit's monthly return depends on its AMOUNT SLAB and its HOLDING MONTH
  * every deposit and every monthly return pays the upline chain

Run with:  python manage.py test apps.investments
"""
from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.services import build_downline_tree, downline_summary, register_user
from apps.investments.models import Investment, RoiPayout, RoiPlan, add_months
from apps.investments.services import projected_schedule, run_due_payouts
from apps.mlm.models import Commission
from apps.mlm.services import distribute_commission, earnings_breakdown
from apps.wallet.models import Transaction
from apps.wallet.services import (
    WalletError, approve_deposit, approve_withdrawal, create_deposit_request,
    create_withdrawal_request,
)


class MoneyFlowTests(TestCase):
    """A four-deep referral chain: alice -> bob -> carol -> dave."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_platform", verbosity=0)
        cls.admin = User.objects.create_superuser(
            email="ops@test.local", password="Adm1nPass!2026",
        )

    def setUp(self):
        self.alice = register_user(email="alice@t.local", password="Testpass!2026",
                                   first_name="Alice")
        self.bob = register_user(email="bob@t.local", password="Testpass!2026",
                                 first_name="Bob", referral_code=self.alice.referral_code)
        self.carol = register_user(email="carol@t.local", password="Testpass!2026",
                                   first_name="Carol", referral_code=self.bob.referral_code)
        self.dave = register_user(email="dave@t.local", password="Testpass!2026",
                                  first_name="Dave", referral_code=self.carol.referral_code)

    def _refresh(self):
        for user in (self.alice, self.bob, self.carol, self.dave):
            user.refresh_from_db()

    def _approved_deposit(self, amount="1000"):
        deposit = create_deposit_request(
            user=self.dave, amount=Decimal(amount), method="cash",
            user_message="Cash handed over at the counter, receipt #4471.",
        )
        return approve_deposit(deposit, self.admin)

    # --- tree ------------------------------------------------------------

    def test_signup_builds_the_referral_chain(self):
        self.assertEqual(self.bob.sponsor_id, self.alice.id)
        self.assertEqual(self.dave.tree_depth, 3)
        self.assertEqual(
            [u.email for u in self.dave.upline_chain(5)],
            ["carol@t.local", "bob@t.local", "alice@t.local"],
        )

    def test_downline_tree_nests_with_user_details(self):
        self._approved_deposit()
        tree = build_downline_tree(self.alice)

        self.assertEqual(tree["total_nodes"], 3)
        self.assertEqual(len(tree["tree"]), 1)

        node_bob = tree["tree"][0]
        self.assertEqual(node_bob["email"], "bob@t.local")
        self.assertEqual(node_bob["level"], 1)

        node_dave = node_bob["children"][0]["children"][0]
        self.assertEqual(node_dave["level"], 3)
        self.assertEqual(node_dave["total_deposited"], 1000.0)
        self.assertTrue(node_dave["referral_code"])

        summary = downline_summary(self.alice)
        self.assertEqual(summary["total_downline"], 3)
        self.assertEqual(summary["direct_count"], 1)
        self.assertEqual(summary["team_business"], 1000.0)

    def test_tree_is_depth_capped(self):
        self.assertEqual(build_downline_tree(self.alice, max_depth=1)["total_nodes"], 1)
        self.assertEqual(build_downline_tree(self.alice, max_depth=2)["total_nodes"], 2)

    def test_boundary_node_reports_its_real_direct_referral_count(self):
        """A node where the tree is cut off must still report how many people
        sit under it — the UI uses that to show "N more below". Counting from
        the truncated slice would report zero, which is wrong, not partial."""
        tree = build_downline_tree(self.alice, max_depth=2)

        bob = tree["tree"][0]
        carol = bob["children"][0]
        self.assertEqual(carol["name"], "Carol")
        self.assertEqual(carol["children"], [], "depth cap should drop carol's children")
        self.assertEqual(carol["direct_referrals"], 1, "carol still refers dave")

    def test_direct_referral_counts_are_correct_at_full_depth(self):
        tree = build_downline_tree(self.alice)
        bob = tree["tree"][0]
        self.assertEqual(bob["direct_referrals"], 1)
        self.assertEqual(bob["children"][0]["direct_referrals"], 1)   # carol -> dave
        self.assertEqual(bob["children"][0]["children"][0]["direct_referrals"], 0)  # dave

    # --- deposits --------------------------------------------------------

    def test_cash_deposit_requires_a_message(self):
        with self.assertRaises(WalletError):
            create_deposit_request(user=self.dave, amount=Decimal("1000"),
                                   method="cash", user_message="   ")

    def test_deposit_credits_nothing_until_verified(self):
        create_deposit_request(user=self.dave, amount=Decimal("1000"), method="cash",
                               user_message="Cash at counter.")
        self.dave.refresh_from_db()
        self.assertEqual(self.dave.wallet_balance, Decimal("0.00"))

    def test_approval_auto_invests_into_the_matching_slab(self):
        _, investment = self._approved_deposit("1000")
        self.dave.refresh_from_db()

        # 1000 falls in Silver's 1000-4999 slab.
        self.assertEqual(investment.plan.name, "Silver")
        self.assertEqual(investment.principal, Decimal("1000.00"))
        self.assertEqual(self.dave.invested_balance, Decimal("1000.00"))
        self.assertEqual(self.dave.wallet_balance, Decimal("0.00"))

    def test_amount_selects_a_different_slab(self):
        deposit = create_deposit_request(
            user=self.dave, amount=Decimal("30000"), method="bank",
            reference_no="UTR123",
        )
        _, investment = approve_deposit(deposit, self.admin)
        self.assertEqual(investment.plan.name, "Platinum")

    def test_double_approval_is_refused(self):
        deposit, _ = self._approved_deposit()
        with self.assertRaises(WalletError):
            approve_deposit(deposit, self.admin)

    # --- MLM -------------------------------------------------------------

    def test_deposit_pays_direct_and_indirect_upline(self):
        deposit, _ = self._approved_deposit("1000")
        self._refresh()

        # Seeded: L1 5% (0 directs needed), L2 3% (1 needed), L3 2% (2 needed).
        self.assertEqual(self.carol.wallet_balance, Decimal("50.00"))   # direct
        self.assertEqual(self.bob.wallet_balance, Decimal("30.00"))     # indirect L2
        # Alice holds only one direct referral, so level 3 stays locked.
        self.assertEqual(self.alice.wallet_balance, Decimal("0.00"))

        skipped = Commission.objects.get(earner=self.alice, status="skipped")
        self.assertIn("direct referrals", skipped.skip_reason)

    def test_commission_is_idempotent_per_source_event(self):
        deposit, _ = self._approved_deposit()
        self.carol.refresh_from_db()
        before = self.carol.wallet_balance

        replay = distribute_commission(
            source_user=self.dave, base_amount=Decimal("1000"), trigger="deposit",
            reference_id=deposit.id, reference_type="deposit",
        )
        self.carol.refresh_from_db()
        self.assertEqual(replay, [])
        self.assertEqual(self.carol.wallet_balance, before)

    def test_earnings_split_direct_from_indirect(self):
        self._approved_deposit()
        self.assertEqual(earnings_breakdown(self.carol)["direct_earned"], 50.0)
        self.assertEqual(earnings_breakdown(self.carol)["indirect_earned"], 0.0)
        self.assertEqual(earnings_breakdown(self.bob)["indirect_earned"], 30.0)
        self.assertEqual(earnings_breakdown(self.bob)["direct_earned"], 0.0)

    # --- ROI -------------------------------------------------------------

    def test_projection_matches_the_configured_matrix(self):
        projection = projected_schedule(RoiPlan.objects.get(name="Silver"), Decimal("1000"))
        self.assertEqual(len(projection["schedule"]), 12)
        self.assertEqual(projection["schedule"][0]["payout"], 10.0)    # M1 1.00%
        self.assertEqual(projection["schedule"][11]["payout"], 25.0)   # M12 2.50%
        self.assertEqual(projection["total_return"], 197.5)

    def _age_investment(self, investment, months):
        investment.start_date = add_months(timezone.now(), -months)
        investment.maturity_date = add_months(investment.start_date,
                                              investment.plan.tenure_months)
        investment.save(update_fields=["start_date", "maturity_date"])

    def test_sweep_pays_each_due_month_at_its_own_rate(self):
        _, investment = self._approved_deposit("1000")
        self._age_investment(investment, 3)

        summary = run_due_payouts()
        self.assertEqual(summary["months_paid"], 3)
        # M1 1.00% + M2 1.25% + M3 1.25% of 1000
        self.assertEqual(summary["amount_paid"], 35.0)

        self.dave.refresh_from_db()
        self.assertEqual(self.dave.wallet_balance, Decimal("35.00"))
        self.assertEqual(self.dave.total_roi_earned, Decimal("35.00"))

    def test_sweep_is_idempotent(self):
        _, investment = self._approved_deposit()
        self._age_investment(investment, 3)
        run_due_payouts()
        self.dave.refresh_from_db()
        balance = self.dave.wallet_balance

        self.assertEqual(run_due_payouts()["months_paid"], 0)
        self.dave.refresh_from_db()
        self.assertEqual(self.dave.wallet_balance, balance)

    def test_roi_payout_pays_the_upline_override(self):
        _, investment = self._approved_deposit("1000")
        self._age_investment(investment, 3)
        run_due_payouts()
        self._refresh()

        # Overrides are computed per payout and rounded DOWN to the cent:
        #   carol L1 10%: 1.00 + 1.25 + 1.25 = 3.50
        #   bob   L2  5%: 0.50 + 0.62 + 0.62 = 1.74  (0.625 truncates twice)
        self.assertEqual(self.carol.wallet_balance, Decimal("53.50"))
        self.assertEqual(self.bob.wallet_balance, Decimal("31.74"))
        self.assertTrue(
            Commission.objects.filter(earner=self.carol, trigger="roi").exists()
        )

    def test_maturity_returns_the_principal(self):
        _, investment = self._approved_deposit("1000")
        self._age_investment(investment, 13)
        run_due_payouts()

        investment.refresh_from_db()
        self.dave.refresh_from_db()
        self.assertEqual(investment.status, "matured")
        self.assertEqual(RoiPayout.objects.filter(investment=investment).count(), 12)
        self.assertEqual(investment.total_roi_paid, Decimal("197.50"))
        self.assertEqual(self.dave.wallet_balance, Decimal("1197.50"))
        self.assertEqual(self.dave.invested_balance, Decimal("0.00"))

    def test_month_anniversaries_clamp_to_short_months(self):
        jan31 = timezone.now().replace(year=2026, month=1, day=31)
        self.assertEqual(add_months(jan31, 1).day, 28)   # Feb 2026
        self.assertEqual(add_months(jan31, 3).day, 30)   # Apr 2026

    # --- withdrawals & ledger --------------------------------------------

    def test_withdrawal_holds_funds_at_request_time(self):
        _, investment = self._approved_deposit()
        self._age_investment(investment, 13)
        run_due_payouts()

        withdrawal = create_withdrawal_request(
            user=self.dave, amount=Decimal("200"), method="cash",
            user_message="Collect at head office on Friday.",
        )
        self.dave.refresh_from_db()
        self.assertEqual(self.dave.wallet_balance, Decimal("997.50"))

        approve_withdrawal(withdrawal, self.admin, payout_reference="CASH-0091")
        self.dave.refresh_from_db()
        self.assertEqual(self.dave.wallet_balance, Decimal("997.50"))
        self.assertEqual(self.dave.total_withdrawn, Decimal("200.00"))

    def test_rejected_withdrawal_refunds_the_hold(self):
        from apps.wallet.services import reject_withdrawal

        self._approved_deposit()
        self.carol.refresh_from_db()
        withdrawal = create_withdrawal_request(
            user=self.carol, amount=Decimal("25"), method="upi",
            payout_details={"upi_id": "carol@upi"},
        )
        self.carol.refresh_from_db()
        self.assertEqual(self.carol.wallet_balance, Decimal("25.00"))

        reject_withdrawal(withdrawal, self.admin, reason="Details did not match.")
        self.carol.refresh_from_db()
        self.assertEqual(self.carol.wallet_balance, Decimal("50.00"))

    def test_ledger_replays_to_the_stored_balance(self):
        _, investment = self._approved_deposit()
        self._age_investment(investment, 13)
        run_due_payouts()
        create_withdrawal_request(user=self.dave, amount=Decimal("200"),
                                  method="cash", user_message="Collect Friday.")

        running = Decimal("0")
        for tx in Transaction.objects.filter(user=self.dave).order_by("created_at"):
            running += tx.amount
            self.assertEqual(running, tx.balance_after,
                             f"ledger drift at {tx.tx_type} {tx.amount}")

        self.dave.refresh_from_db()
        self.assertEqual(running, self.dave.wallet_balance)
