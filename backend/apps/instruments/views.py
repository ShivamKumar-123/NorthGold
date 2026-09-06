from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdmin
from apps.core.services import client_ip, write_audit

from .models import Instrument, Issuer
from .serializers import (
    InstrumentAdminSerializer, InstrumentSerializer, IssuerSerializer,
)
from .services import recent_ticks, serialize_tick, set_manual_price


class PublicInstrumentListView(ListAPIView):
    """The landing page grid. Open to everyone — prices are public."""

    serializer_class = InstrumentSerializer
    permission_classes = [AllowAny]
    filterset_fields = ["category", "issuer", "is_featured", "currency"]
    search_fields = ["name", "symbol", "issuer__name"]
    ordering_fields = ["display_order", "interest_rate", "current_price", "name"]

    def get_queryset(self):
        return Instrument.objects.select_related("issuer", "roi_plan").filter(is_active=True)


class PublicInstrumentDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, symbol):
        instrument = (
            Instrument.objects.select_related("issuer", "roi_plan")
            .filter(symbol__iexact=symbol, is_active=True).first()
        )
        if instrument is None:
            return Response({"detail": "Instrument not found."},
                            status=status.HTTP_404_NOT_FOUND)

        payload = InstrumentSerializer(instrument).data
        payload["ticks"] = recent_ticks(instrument, limit=90)

        if instrument.roi_plan_id:
            from apps.investments.serializers import RoiPlanSerializer
            payload["plan"] = RoiPlanSerializer(instrument.roi_plan).data
        return Response(payload)


class PublicIssuerListView(ListAPIView):
    serializer_class = IssuerSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return Issuer.objects.filter(is_active=True)


class LivePricesView(APIView):
    """Snapshot of every live price.

    The landing page calls this once on load, then keeps itself current over
    the WebSocket — this exists so the first paint is never empty and so
    clients that cannot open a socket still work.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        qs = Instrument.objects.filter(is_active=True)
        symbols = request.query_params.get("symbols")
        if symbols:
            wanted = [s.strip().upper() for s in symbols.split(",") if s.strip()]
            qs = qs.filter(symbol__in=wanted)
        return Response({"ticks": [serialize_tick(i) for i in qs]})


# ─── Admin ────────────────────────────────────────────────────────────────

class AdminInstrumentListView(ListAPIView):
    serializer_class = InstrumentAdminSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["category", "issuer", "is_active", "is_featured", "price_source"]
    search_fields = ["name", "symbol"]

    def get_queryset(self):
        return Instrument.objects.select_related("issuer", "roi_plan").all()

    def post(self, request):
        serializer = InstrumentAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instrument = serializer.save()
        write_audit(request.user, "create_instrument", entity_type="instrument",
                    entity_id=instrument.id, new_values={"symbol": instrument.symbol},
                    ip_address=client_ip(request))
        return Response(InstrumentAdminSerializer(instrument).data,
                        status=status.HTTP_201_CREATED)


class AdminInstrumentDetailView(APIView):
    permission_classes = [IsAdmin]

    def get_object(self, instrument_id):
        return Instrument.objects.filter(id=instrument_id).first()

    def get(self, request, instrument_id):
        instrument = self.get_object(instrument_id)
        if instrument is None:
            return Response({"detail": "Instrument not found."},
                            status=status.HTTP_404_NOT_FOUND)
        data = InstrumentAdminSerializer(instrument).data
        data["ticks"] = recent_ticks(instrument, limit=120)
        return Response(data)

    def patch(self, request, instrument_id):
        instrument = self.get_object(instrument_id)
        if instrument is None:
            return Response({"detail": "Instrument not found."},
                            status=status.HTTP_404_NOT_FOUND)
        serializer = InstrumentAdminSerializer(instrument, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        write_audit(request.user, "update_instrument", entity_type="instrument",
                    entity_id=instrument.id, new_values=request.data,
                    ip_address=client_ip(request))
        return Response(InstrumentAdminSerializer(instrument).data)

    def delete(self, request, instrument_id):
        instrument = self.get_object(instrument_id)
        if instrument is None:
            return Response({"detail": "Instrument not found."},
                            status=status.HTTP_404_NOT_FOUND)
        # Soft delete: investments reference instruments, and hiding it from the
        # storefront is what "delete" means here.
        instrument.is_active = False
        instrument.save(update_fields=["is_active", "updated_at"])
        write_audit(request.user, "deactivate_instrument", entity_type="instrument",
                    entity_id=instrument.id, ip_address=client_ip(request))
        return Response({"detail": "Instrument deactivated."})


class AdminSetPriceView(APIView):
    """Manual price push — broadcasts to every connected landing page at once."""

    permission_classes = [IsAdmin]

    def post(self, request, instrument_id):
        instrument = Instrument.objects.filter(id=instrument_id).first()
        if instrument is None:
            return Response({"detail": "Instrument not found."},
                            status=status.HTTP_404_NOT_FOUND)
        raw = request.data.get("price")
        try:
            from decimal import Decimal
            price = Decimal(str(raw))
        except Exception:
            return Response({"detail": "A numeric price is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        if price <= 0:
            return Response({"detail": "Price must be greater than zero."},
                            status=status.HTTP_400_BAD_REQUEST)

        set_manual_price(instrument, price, actor=request.user)
        write_audit(request.user, "set_price", entity_type="instrument",
                    entity_id=instrument.id, new_values={"price": str(price)},
                    ip_address=client_ip(request))
        return Response(serialize_tick(instrument))


class AdminIssuerListView(ListAPIView):
    serializer_class = IssuerSerializer
    permission_classes = [IsAdmin]
    pagination_class = None

    def get_queryset(self):
        return Issuer.objects.all()

    def post(self, request):
        serializer = IssuerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        issuer = serializer.save()
        return Response(IssuerSerializer(issuer).data, status=status.HTTP_201_CREATED)


class AdminIssuerDetailView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, issuer_id):
        issuer = Issuer.objects.filter(id=issuer_id).first()
        if issuer is None:
            return Response({"detail": "Issuer not found."},
                            status=status.HTTP_404_NOT_FOUND)
        serializer = IssuerSerializer(issuer, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(IssuerSerializer(issuer).data)
