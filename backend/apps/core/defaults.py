"""Default values for every SystemSetting key, with the type each must hold.

`get_setting` falls back here when a key has never been written, so a fresh
database is fully functional before an admin touches anything.
"""
from decimal import Decimal

SETTING_DEFAULTS = {
    # --- Referrals ---------------------------------------------------------
    # The direct sponsor earns a percentage of their referral's deposit, every
    # month that investment pays out. The percentages themselves live in the
    # referral matrix, which the administrator edits.
    "referral_enabled": True,
    # --- Investments -------------------------------------------------------
    "auto_invest_on_deposit": True,   # approved deposit auto-starts an investment
    "roi_credit_target": "wallet",    # 'wallet' (withdrawable) | 'principal' (compounds)
    # --- Wallet ------------------------------------------------------------
    "withdrawal_min_amount": "10",
    "withdrawal_fee_percent": "0",
    # Silver is the entry tier, so nothing below its slab can be invested.
    "deposit_min_amount": "1000",
    # --- Branding ----------------------------------------------------------
    "platform_name": "NorthGold",
    # --- Support -----------------------------------------------------------
    # `support_whatsapp` is dialled as a wa.me link, so it must be digits only
    # with the country code and no '+', spaces or dashes. An empty value hides
    # the chat launcher rather than opening a broken link.
    "support_email": "support@example.com",
    "support_phone": "+91 00000 00000",
    "support_whatsapp": "910000000000",
    "support_hours": "Mon-Sat, 10:00-19:00 IST",
    "support_address": "Grosvenor Place\nLevel 15, 2205 George St, Sydney NSW 2000, Australia",
}

DECIMAL_SETTINGS = {
    "withdrawal_min_amount",
    "withdrawal_fee_percent",
    "deposit_min_amount",
}


def coerce(key, value):
    if key in DECIMAL_SETTINGS:
        return Decimal(str(value))
    return value
