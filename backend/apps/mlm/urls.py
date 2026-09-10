from django.urls import path

from .views import (
    AdminCommissionListView, AdminNetworkOverviewView, AdminReferralPlanDetailView,
    AdminReferralPlanListView, AdminUserNetworkView, MyCommissionListView,
    MyEarningsView, PublicReferralStructureView,
)

urlpatterns = [
    path("structure/", PublicReferralStructureView.as_view(), name="referral-structure"),
    path("commissions/", MyCommissionListView.as_view(), name="my-commissions"),
    path("earnings/", MyEarningsView.as_view(), name="my-earnings"),

    path("admin/plans/", AdminReferralPlanListView.as_view(), name="admin-referral-plans"),
    path("admin/plans/<uuid:plan_id>/", AdminReferralPlanDetailView.as_view(),
         name="admin-referral-plan"),
    path("admin/commissions/", AdminCommissionListView.as_view(), name="admin-commissions"),
    path("admin/overview/", AdminNetworkOverviewView.as_view(), name="admin-network-overview"),
    path("admin/users/<uuid:user_id>/network/", AdminUserNetworkView.as_view(),
         name="admin-user-network"),
]
