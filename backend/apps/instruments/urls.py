from django.urls import path

from .views import (
    AdminInstrumentDetailView, AdminInstrumentListView, AdminIssuerDetailView,
    AdminIssuerListView, AdminSetPriceView, LivePricesView,
    PublicInstrumentDetailView, PublicInstrumentListView, PublicIssuerListView,
)

urlpatterns = [
    path("", PublicInstrumentListView.as_view(), name="instrument-list"),
    path("prices/", LivePricesView.as_view(), name="live-prices"),
    path("issuers/", PublicIssuerListView.as_view(), name="issuer-list"),
    path("symbol/<str:symbol>/", PublicInstrumentDetailView.as_view(), name="instrument-detail"),

    path("admin/", AdminInstrumentListView.as_view(), name="admin-instruments"),
    path("admin/issuers/", AdminIssuerListView.as_view(), name="admin-issuers"),
    path("admin/issuers/<uuid:issuer_id>/", AdminIssuerDetailView.as_view(), name="admin-issuer-detail"),
    path("admin/<uuid:instrument_id>/", AdminInstrumentDetailView.as_view(), name="admin-instrument-detail"),
    path("admin/<uuid:instrument_id>/price/", AdminSetPriceView.as_view(), name="admin-set-price"),
]
