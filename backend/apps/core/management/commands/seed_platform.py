"""Seed a working platform: MLM levels, ROI plan matrices, instruments, channels.

Idempotent — safe to re-run. Existing rows are updated, not duplicated, so this
doubles as a "reset the config to sane defaults" command.

    python manage.py seed_platform
    python manage.py seed_platform --admin-email you@example.com --admin-password '...'
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.core.defaults import SETTING_DEFAULTS
from apps.core.models import SystemSetting
from apps.instruments.models import Instrument, Issuer
from apps.investments.models import RoiPlan, RoiPlanMonth
from apps.mlm.models import MlmLevelConfig
from apps.wallet.models import PaymentChannel

# level -> (label, deposit %, roi %, min directs to unlock)
MLM_LEVELS = [
    (1, "Direct", Decimal("5.000"), Decimal("10.000"), 0),
    (2, "Indirect L2", Decimal("3.000"), Decimal("5.000"), 1),
    (3, "Indirect L3", Decimal("2.000"), Decimal("3.000"), 2),
    (4, "Indirect L4", Decimal("1.000"), Decimal("2.000"), 3),
    (5, "Indirect L5", Decimal("0.500"), Decimal("1.000"), 4),
]

# Each plan is a deposit slab plus its month-by-month curve. The curves ramp:
# holding longer earns more, which is the incentive to stay invested.
ROI_PLANS = [
    {
        "name": "Starter",
        "description": "Entry tier for deposits from 100 to 999.",
        "min_amount": Decimal("100"), "max_amount": Decimal("999"),
        "tenure_months": 12, "display_order": 1,
        "months": ["1.000", "1.000", "1.000", "1.100", "1.100", "1.100",
                   "1.200", "1.200", "1.200", "1.250", "1.250", "1.500"],
    },
    {
        "name": "Silver",
        "description": "For deposits from 1,000 to 4,999.",
        "min_amount": Decimal("1000"), "max_amount": Decimal("4999"),
        "tenure_months": 12, "display_order": 2,
        "months": ["1.000", "1.250", "1.250", "1.500", "1.500", "1.500",
                   "1.750", "1.750", "1.750", "2.000", "2.000", "2.500"],
    },
    {
        "name": "Gold",
        "description": "For deposits from 5,000 to 24,999.",
        "min_amount": Decimal("5000"), "max_amount": Decimal("24999"),
        "tenure_months": 12, "display_order": 3,
        "months": ["1.500", "1.500", "1.750", "1.750", "2.000", "2.000",
                   "2.000", "2.250", "2.250", "2.500", "2.500", "3.000"],
    },
    {
        "name": "Platinum",
        "description": "Open-ended top tier for deposits of 25,000 and above.",
        "min_amount": Decimal("25000"), "max_amount": None,
        "tenure_months": 12, "display_order": 4,
        "months": ["2.000", "2.000", "2.250", "2.250", "2.500", "2.500",
                   "2.750", "2.750", "3.000", "3.000", "3.250", "3.500"],
    },
]

ISSUERS = [
    {"name": "Meridian Bank", "short_name": "MRD", "country": "India"},
    {"name": "Apex Financial", "short_name": "APX", "country": "Singapore"},
    {"name": "Northgate Trust", "short_name": "NGT", "country": "United Kingdom"},
]

INSTRUMENTS = [
    {"symbol": "MRD-FD12", "name": "Meridian 12-Month Fixed Deposit",
     "issuer": "Meridian Bank", "category": "fixed_deposit",
     "interest_rate": "8.400", "tenure_months": 12, "min_investment": "1000",
     "max_investment": "4999", "plan": "Silver", "price_source": "manual",
     "current_price": "100.0000", "is_featured": True},
    {"symbol": "MRD-RD12", "name": "Meridian Recurring Deposit",
     "issuer": "Meridian Bank", "category": "recurring_deposit",
     "interest_rate": "7.200", "tenure_months": 12, "min_investment": "100",
     "max_investment": "999", "plan": "Starter", "price_source": "manual",
     "current_price": "100.0000", "is_featured": False},
    {"symbol": "APX-BND24", "name": "Apex Corporate Bond Series A",
     "issuer": "Apex Financial", "category": "bond",
     "interest_rate": "9.750", "tenure_months": 12, "min_investment": "5000",
     "max_investment": "24999", "plan": "Gold", "price_source": "feed",
     "current_price": "1024.5000", "is_featured": True},
    {"symbol": "NGT-MF01", "name": "Northgate Balanced Fund",
     "issuer": "Northgate Trust", "category": "mutual_fund",
     "interest_rate": "11.200", "tenure_months": 12, "min_investment": "25000",
     "max_investment": None, "plan": "Platinum", "price_source": "feed",
     "current_price": "486.2500", "is_featured": True},
    {"symbol": "APX-ETF05", "name": "Apex Global Index ETF",
     "issuer": "Apex Financial", "category": "etf",
     "interest_rate": "10.500", "tenure_months": 12, "min_investment": "5000",
     "max_investment": None, "plan": "Gold", "price_source": "feed",
     "current_price": "212.8000", "is_featured": False},
]

CHANNELS = [
    {"name": "Cash Collection - Head Office", "channel_type": "cash",
     "contact_person": "Accounts Desk", "contact_phone": "+91 00000 00000",
     "office_address": "Update this address in the admin panel.",
     "instructions": "Hand the cash over at the counter, collect a receipt, then "
                     "file a deposit request describing the handover.",
     "min_amount": Decimal("100")},
    {"name": "Primary Bank Account", "channel_type": "bank",
     "account_name": "NorthGold", "account_number": "000000000000",
     "bank_name": "Meridian Bank", "ifsc_code": "MRDB0000001",
     "instructions": "Transfer, then enter the UTR as the reference number.",
     "min_amount": Decimal("100")},
    {"name": "UPI", "channel_type": "upi", "upi_id": "example@upi",
     "instructions": "Pay by UPI and upload the payment screenshot.",
     "min_amount": Decimal("100")},
    {"name": "USDT (TRC20)", "channel_type": "crypto",
     "wallet_address": "REPLACE_WITH_YOUR_ADDRESS", "network": "TRC20",
     "instructions": "Send USDT and paste the transaction hash.",
     "min_amount": Decimal("100")},
]


class Command(BaseCommand):
    help = "Seed MLM levels, ROI plans, instruments and payment channels."

    def add_arguments(self, parser):
        parser.add_argument("--admin-email", default=None)
        parser.add_argument("--admin-password", default=None)
        parser.add_argument("--skip-instruments", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        self._seed_settings()
        self._seed_mlm()
        plans = self._seed_plans()
        if not options["skip_instruments"]:
            self._seed_instruments(plans)
        self._seed_channels()
        self._seed_admin(options.get("admin_email"), options.get("admin_password"))
        self.stdout.write(self.style.SUCCESS("Seed complete."))

    def _seed_settings(self):
        created = 0
        for key, value in SETTING_DEFAULTS.items():
            _, was_created = SystemSetting.objects.get_or_create(
                pk=key, defaults={"value": value},
            )
            created += int(was_created)
        self.stdout.write(f"  settings: {created} created, "
                          f"{len(SETTING_DEFAULTS) - created} already present")

    def _seed_mlm(self):
        for level, label, deposit_pct, roi_pct, min_directs in MLM_LEVELS:
            MlmLevelConfig.objects.update_or_create(
                level=level,
                defaults={
                    "label": label,
                    "deposit_percent": deposit_pct,
                    "roi_percent": roi_pct,
                    "min_direct_referrals": min_directs,
                    "is_active": True,
                },
            )
        self.stdout.write(f"  mlm levels: {len(MLM_LEVELS)} configured")

    def _seed_plans(self):
        plans = {}
        for spec in ROI_PLANS:
            months = spec.pop("months")
            plan, _ = RoiPlan.objects.update_or_create(
                name=spec["name"],
                defaults={k: v for k, v in spec.items() if k != "name"},
            )
            plan.months.all().delete()
            RoiPlanMonth.objects.bulk_create([
                RoiPlanMonth(plan=plan, month_index=idx, percent=Decimal(pct))
                for idx, pct in enumerate(months, start=1)
            ])
            spec["months"] = months  # restore, the command may run twice in tests
            plans[plan.name] = plan
            self.stdout.write(
                f"  plan {plan.name}: {len(months)} months, "
                f"{plan.total_return_percent}% total"
            )
        return plans

    def _seed_instruments(self, plans):
        issuers = {}
        for spec in ISSUERS:
            issuer, _ = Issuer.objects.update_or_create(
                name=spec["name"], defaults=spec,
            )
            issuers[issuer.name] = issuer

        for spec in INSTRUMENTS:
            Instrument.objects.update_or_create(
                symbol=spec["symbol"],
                defaults={
                    "name": spec["name"],
                    "issuer": issuers.get(spec["issuer"]),
                    "category": spec["category"],
                    "interest_rate": Decimal(spec["interest_rate"]),
                    "tenure_months": spec["tenure_months"],
                    "min_investment": Decimal(spec["min_investment"]),
                    "max_investment": (Decimal(spec["max_investment"])
                                       if spec["max_investment"] else None),
                    "roi_plan": plans.get(spec["plan"]),
                    "price_source": spec["price_source"],
                    "current_price": Decimal(spec["current_price"]),
                    "previous_close": Decimal(spec["current_price"]),
                    "day_high": Decimal(spec["current_price"]),
                    "day_low": Decimal(spec["current_price"]),
                    "is_featured": spec["is_featured"],
                    "is_active": True,
                },
            )
        self.stdout.write(f"  instruments: {len(INSTRUMENTS)} across "
                          f"{len(ISSUERS)} issuers")

    def _seed_channels(self):
        for order, spec in enumerate(CHANNELS, start=1):
            PaymentChannel.objects.update_or_create(
                name=spec["name"],
                defaults={**spec, "display_order": order, "is_active": True},
            )
        self.stdout.write(f"  payment channels: {len(CHANNELS)}")

    def _seed_admin(self, email, password):
        if not email:
            self.stdout.write("  admin: skipped (pass --admin-email to create one)")
            return
        if not password:
            self.stdout.write(self.style.WARNING(
                "  admin: --admin-password is required alongside --admin-email"
            ))
            return

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            User.objects.create_superuser(email=email, password=password)
            self.stdout.write(self.style.SUCCESS(f"  admin: created {email}"))
        else:
            user.role = "superadmin"
            user.is_staff = True
            user.is_superuser = True
            user.email_verified = True
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"  admin: updated {email}"))
