from django.urls import path

from .views import (
    AdminCommissionListView, AdminMlmConfigView, AdminNetworkOverviewView,
    AdminUserNetworkView, MyCommissionListView, MyEarningsView,
    PublicPlanStructureView,
)

urlpatterns = [
    path("structure/", PublicPlanStructureView.as_view(), name="mlm-structure"),
    path("commissions/", MyCommissionListView.as_view(), name="my-commissions"),
    path("earnings/", MyEarningsView.as_view(), name="my-earnings"),

    path("admin/config/", AdminMlmConfigView.as_view(), name="admin-mlm-config"),
    path("admin/commissions/", AdminCommissionListView.as_view(), name="admin-commissions"),
    path("admin/overview/", AdminNetworkOverviewView.as_view(), name="admin-network-overview"),
    path("admin/users/<uuid:user_id>/network/", AdminUserNetworkView.as_view(), name="admin-user-network"),
]
