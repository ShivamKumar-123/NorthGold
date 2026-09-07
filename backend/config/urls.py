from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.views import HealthView

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/health/", HealthView.as_view(), name="health"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/instruments/", include("apps.instruments.urls")),
    path("api/v1/wallet/", include("apps.wallet.urls")),
    path("api/v1/investments/", include("apps.investments.urls")),
    path("api/v1/mlm/", include("apps.mlm.urls")),
    path("api/v1/core/", include("apps.core.urls")),
    path("api/v1/support/", include("apps.support.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
