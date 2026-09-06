from django.contrib import admin

from .models import Deposit, PaymentChannel, Transaction, Withdrawal


@admin.register(PaymentChannel)
class PaymentChannelAdmin(admin.ModelAdmin):
    list_display = ("name", "channel_type", "min_amount", "max_amount",
                    "is_active", "display_order")
    list_filter = ("channel_type", "is_active")


@admin.register(Deposit)
class DepositAdmin(admin.ModelAdmin):
    list_display = ("user", "amount", "method", "status", "reference_no",
                    "reviewed_by", "created_at")
    list_filter = ("status", "method")
    search_fields = ("user__email", "reference_no", "user_message")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Withdrawal)
class WithdrawalAdmin(admin.ModelAdmin):
    list_display = ("user", "amount", "fee", "net_amount", "method", "status",
                    "reviewed_by", "created_at")
    list_filter = ("status", "method")
    search_fields = ("user__email",)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("user", "tx_type", "amount", "balance_after", "created_at")
    list_filter = ("tx_type",)
    search_fields = ("user__email", "description")
