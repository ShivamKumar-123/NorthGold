from django.urls import path

from .views import (
    AdminAdjustBalanceView, AdminDepositListView, AdminDepositReviewView,
    AdminPaymentChannelDetailView, AdminPaymentChannelView, AdminWalletStatsView,
    AdminWithdrawalListView, AdminWithdrawalReviewView, DepositListCreateView,
    PaymentChannelListView, TransactionListView, WalletSummaryView,
    WithdrawalListCreateView,
)

urlpatterns = [
    path("summary/", WalletSummaryView.as_view(), name="wallet-summary"),
    path("channels/", PaymentChannelListView.as_view(), name="payment-channels"),
    path("deposits/", DepositListCreateView.as_view(), name="deposits"),
    path("withdrawals/", WithdrawalListCreateView.as_view(), name="withdrawals"),
    path("transactions/", TransactionListView.as_view(), name="transactions"),

    path("admin/stats/", AdminWalletStatsView.as_view(), name="admin-wallet-stats"),
    path("admin/deposits/", AdminDepositListView.as_view(), name="admin-deposits"),
    path("admin/deposits/<uuid:deposit_id>/review/", AdminDepositReviewView.as_view(), name="admin-deposit-review"),
    path("admin/withdrawals/", AdminWithdrawalListView.as_view(), name="admin-withdrawals"),
    path("admin/withdrawals/<uuid:withdrawal_id>/review/", AdminWithdrawalReviewView.as_view(), name="admin-withdrawal-review"),
    path("admin/channels/", AdminPaymentChannelView.as_view(), name="admin-channels"),
    path("admin/channels/<uuid:channel_id>/", AdminPaymentChannelDetailView.as_view(), name="admin-channel-detail"),
    path("admin/users/<uuid:user_id>/adjust/", AdminAdjustBalanceView.as_view(), name="admin-adjust-balance"),
]
