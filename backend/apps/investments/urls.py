from django.urls import path

from .views import (
    AdminInvestmentListView, AdminMatureInvestmentView, AdminPlanDetailView,
    AdminPlanListView, AdminRunPayoutsView, MyInvestmentDetailView,
    MyInvestmentListView, MyInvestmentSummaryView, MyPayoutListView,
    ProjectionView, PublicPlanListView,
)

urlpatterns = [
    path("plans/", PublicPlanListView.as_view(), name="plan-list"),
    path("projection/", ProjectionView.as_view(), name="projection"),
    path("", MyInvestmentListView.as_view(), name="my-investments"),
    path("summary/", MyInvestmentSummaryView.as_view(), name="investment-summary"),
    path("payouts/", MyPayoutListView.as_view(), name="my-payouts"),
    path("<uuid:investment_id>/", MyInvestmentDetailView.as_view(), name="investment-detail"),

    path("admin/plans/", AdminPlanListView.as_view(), name="admin-plans"),
    path("admin/plans/<uuid:plan_id>/", AdminPlanDetailView.as_view(), name="admin-plan-detail"),
    path("admin/list/", AdminInvestmentListView.as_view(), name="admin-investments"),
    path("admin/run-payouts/", AdminRunPayoutsView.as_view(), name="admin-run-payouts"),
    path("admin/<uuid:investment_id>/mature/", AdminMatureInvestmentView.as_view(), name="admin-mature"),
]
