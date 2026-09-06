from django.urls import path

from .consumers import PriceConsumer

websocket_urlpatterns = [
    path("ws/prices/", PriceConsumer.as_asgi()),
]
