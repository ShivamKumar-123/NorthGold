from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AdminKYCReviewView, AdminLoginView, AdminSetPasswordView, AdminUserDetailView,
    AdminUserListView, AdminUserTreeView, ChangePasswordView, DownlineUserDetailView, KYCView,
    LoginView, LogoutView, MeView, MyNetworkSummaryView, MyReferralsView,
    MyTreeView, RegisterView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("admin-login/", AdminLoginView.as_view(), name="admin-login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("kyc/", KYCView.as_view(), name="kyc"),

    # referral network
    path("referrals/", MyReferralsView.as_view(), name="my-referrals"),
    path("tree/", MyTreeView.as_view(), name="my-tree"),
    path("network-summary/", MyNetworkSummaryView.as_view(), name="network-summary"),
    path("network/<uuid:user_id>/", DownlineUserDetailView.as_view(), name="downline-detail"),

    # admin
    path("admin/users/", AdminUserListView.as_view(), name="admin-users"),
    path("admin/users/<uuid:user_id>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/users/<uuid:user_id>/tree/", AdminUserTreeView.as_view(), name="admin-user-tree"),
    path("admin/users/<uuid:user_id>/password/", AdminSetPasswordView.as_view(), name="admin-set-password"),
    path("admin/kyc/", AdminKYCReviewView.as_view(), name="admin-kyc"),
    path("admin/kyc/<uuid:doc_id>/", AdminKYCReviewView.as_view(), name="admin-kyc-review"),
]
