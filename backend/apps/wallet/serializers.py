from decimal import Decimal

from rest_framework import serializers

from .models import Deposit, PaymentChannel, Transaction, Withdrawal


class PaymentChannelSerializer(serializers.ModelSerializer):
    channel_type_label = serializers.CharField(
        source="get_channel_type_display", read_only=True,
    )

    class Meta:
        model = PaymentChannel
        fields = [
            "id", "name", "channel_type", "channel_type_label", "account_name",
            "account_number", "bank_name", "ifsc_code", "branch", "upi_id",
            "wallet_address", "network", "qr_code", "contact_person",
            "contact_phone", "office_address", "instructions",
            "min_amount", "max_amount", "is_active", "display_order",
        ]


class DepositSerializer(serializers.ModelSerializer):
    method_label = serializers.CharField(source="get_method_display", read_only=True)
    channel_name = serializers.CharField(source="channel.name", default=None, read_only=True)

    class Meta:
        model = Deposit
        fields = [
            "id", "amount", "currency", "method", "method_label", "channel",
            "channel_name", "user_message", "reference_no", "proof", "status",
            "admin_note", "rejection_reason", "reviewed_at", "created_at",
        ]
        read_only_fields = ["status", "admin_note", "rejection_reason",
                            "reviewed_at", "created_at"]


class CreateDepositSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=18, decimal_places=2, min_value=Decimal("0.01"),
    )
    method = serializers.ChoiceField(choices=[c[0] for c in Deposit._meta.get_field("method").choices])
    channel_id = serializers.UUIDField(required=False, allow_null=True)
    # Required when method == 'cash'; validated in services so the rule lives in
    # one place for both the API and the admin panel.
    user_message = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    reference_no = serializers.CharField(required=False, allow_blank=True, max_length=120)
    proof = serializers.ImageField(required=False, allow_null=True)


class WithdrawalSerializer(serializers.ModelSerializer):
    method_label = serializers.CharField(source="get_method_display", read_only=True)

    class Meta:
        model = Withdrawal
        fields = [
            "id", "amount", "fee", "net_amount", "currency", "method",
            "method_label", "payout_details", "user_message", "status",
            "admin_note", "rejection_reason", "payout_reference", "payout_proof",
            "reviewed_at", "created_at",
        ]
        read_only_fields = ["fee", "net_amount", "status", "admin_note",
                            "rejection_reason", "payout_reference", "payout_proof",
                            "reviewed_at", "created_at"]


class CreateWithdrawalSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=18, decimal_places=2, min_value=Decimal("0.01"),
    )
    method = serializers.ChoiceField(
        choices=[c[0] for c in Withdrawal._meta.get_field("method").choices]
    )
    payout_details = serializers.JSONField(required=False)
    user_message = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class TransactionSerializer(serializers.ModelSerializer):
    tx_type_label = serializers.CharField(source="get_tx_type_display", read_only=True)

    class Meta:
        model = Transaction
        fields = ["id", "tx_type", "tx_type_label", "amount", "balance_after",
                  "description", "reference_id", "reference_type", "created_at"]


class AdminDepositSerializer(DepositSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    user_total_deposited = serializers.DecimalField(
        source="user.total_deposited", max_digits=18, decimal_places=2, read_only=True,
    )

    class Meta(DepositSerializer.Meta):
        fields = DepositSerializer.Meta.fields + [
            "user", "user_email", "user_name", "user_total_deposited",
        ]


class AdminWithdrawalSerializer(WithdrawalSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    user_wallet_balance = serializers.DecimalField(
        source="user.wallet_balance", max_digits=18, decimal_places=2, read_only=True,
    )

    class Meta(WithdrawalSerializer.Meta):
        fields = WithdrawalSerializer.Meta.fields + [
            "user", "user_email", "user_name", "user_wallet_balance",
        ]
