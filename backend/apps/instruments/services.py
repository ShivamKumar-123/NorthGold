"""Price movement and WebSocket fan-out.

Two price sources coexist. `manual` instruments only ever change when an admin
saves a new rate. `feed` instruments are moved by `advance_feed_prices()` on
the ticker schedule.

The bundled feed is a bounded random walk, not a market data licence. It exists
so the live-price UI is demonstrably working end to end; point
`EXTERNAL_PRICE_PROVIDER` at a real provider before going live, and replace
`_next_price` with that provider's quote.
"""
import logging
import random
from decimal import ROUND_HALF_UP, Decimal

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from .consumers import PRICE_GROUP
from .models import Instrument, PriceTick

logger = logging.getLogger(__name__)

QUANT = Decimal("0.0001")
TICK_HISTORY_LIMIT = 500


def _round(value):
    return Decimal(str(value)).quantize(QUANT, rounding=ROUND_HALF_UP)


def _next_price(instrument):
    """Bounded random walk around the current price.

    Clamped to +/-25% of `previous_close` so a long-running simulation cannot
    drift an instrument to an absurd number overnight.
    """
    current = instrument.current_price or Decimal("1")
    if current <= 0:
        current = Decimal("1")

    volatility = instrument.feed_volatility_percent or Decimal("0.25")
    drift = Decimal(str(random.uniform(-float(volatility), float(volatility))))
    candidate = current * (Decimal("1") + drift / Decimal("100"))

    anchor = instrument.previous_close or current
    if anchor > 0:
        floor, ceiling = anchor * Decimal("0.75"), anchor * Decimal("1.25")
        candidate = max(floor, min(ceiling, candidate))
    return _round(candidate)


def serialize_tick(instrument):
    return {
        "symbol": instrument.symbol,
        "name": instrument.name,
        "price": float(instrument.current_price or 0),
        "previous_close": float(instrument.previous_close or 0),
        "change": float(instrument.change_amount),
        "change_percent": float(instrument.change_percent),
        "day_high": float(instrument.day_high or 0),
        "day_low": float(instrument.day_low or 0),
        "currency": instrument.currency,
        "updated_at": (instrument.price_updated_at or timezone.now()).isoformat(),
    }


def advance_feed_prices():
    """Move every `feed` instrument one tick and persist the history."""
    instruments = list(Instrument.objects.filter(is_active=True, price_source="feed"))
    if not instruments:
        return []

    now = timezone.now()
    ticks, history = [], []
    for instrument in instruments:
        if not instrument.previous_close:
            instrument.previous_close = instrument.current_price or Decimal("1")

        instrument.current_price = _next_price(instrument)
        instrument.day_high = max(instrument.day_high or Decimal("0"), instrument.current_price)
        low = instrument.day_low or instrument.current_price
        instrument.day_low = min(low, instrument.current_price) if low > 0 else instrument.current_price
        instrument.price_updated_at = now
        history.append(PriceTick(instrument=instrument, price=instrument.current_price))
        ticks.append(serialize_tick(instrument))

    Instrument.objects.bulk_update(
        instruments,
        ["current_price", "previous_close", "day_high", "day_low", "price_updated_at"],
    )
    PriceTick.objects.bulk_create(history)
    return ticks


def broadcast(ticks):
    """Push a batch of ticks to every connected landing page.

    Strictly best-effort. Resolving the channel layer is inside the try because
    a missing or misconfigured backend raises there, and a failed broadcast must
    never undo the price write that triggered it — the admin's edit is saved,
    and clients pick it up from the REST snapshot instead.
    """
    if not ticks:
        return
    try:
        layer = get_channel_layer()
        if layer is None:
            logger.warning("No channel layer configured; price broadcast skipped")
            return
        async_to_sync(layer.group_send)(
            PRICE_GROUP, {"type": "price.update", "ticks": ticks},
        )
    except Exception:
        logger.exception("Price broadcast failed; the price itself was still saved")


def set_manual_price(instrument, price, *, actor=None):
    """Admin-set price. Rolls the current value into `previous_close` so the
    change indicator on the card reflects the edit."""
    price = _round(price)
    instrument.previous_close = instrument.current_price or price
    instrument.current_price = price
    instrument.day_high = max(instrument.day_high or Decimal("0"), price)
    low = instrument.day_low or price
    instrument.day_low = min(low, price) if low > 0 else price
    instrument.price_updated_at = timezone.now()
    instrument.save(update_fields=["current_price", "previous_close", "day_high",
                                   "day_low", "price_updated_at", "updated_at"])
    PriceTick.objects.create(instrument=instrument, price=price)
    broadcast([serialize_tick(instrument)])
    return instrument


def recent_ticks(instrument, limit=60):
    rows = instrument.ticks.all()[:limit]
    return [
        {"price": float(t.price), "at": t.recorded_at.isoformat()}
        for t in reversed(list(rows))
    ]


def prune_tick_history(keep=TICK_HISTORY_LIMIT):
    """Trim per-instrument tick history. Called from the ticker task so the
    table does not grow without bound at one row per instrument per 5s."""
    deleted = 0
    for instrument_id in Instrument.objects.values_list("id", flat=True):
        cutoff_ids = list(
            PriceTick.objects.filter(instrument_id=instrument_id)
            .order_by("-recorded_at")
            .values_list("id", flat=True)[keep:keep + 5000]
        )
        if cutoff_ids:
            deleted += PriceTick.objects.filter(id__in=cutoff_ids).delete()[0]
    return deleted
