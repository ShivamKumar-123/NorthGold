"""Tests for the live price feed — the consumer, the fan-out, and the walk.

The channel layer is overridden to the in-memory backend so these run without
Redis; the consumer code under test is identical either way.
"""
from decimal import Decimal

from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.test import TestCase, TransactionTestCase, override_settings

from apps.instruments.models import Instrument, Issuer, PriceTick
from apps.instruments.routing import websocket_urlpatterns
from apps.instruments.services import (
    advance_feed_prices, broadcast, prune_tick_history, serialize_tick, set_manual_price,
)

IN_MEMORY = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


def make_instrument(symbol, *, source="feed", price="100.0000", **extra):
    return Instrument.objects.create(
        name=f"{symbol} Instrument",
        symbol=symbol,
        price_source=source,
        current_price=Decimal(price),
        previous_close=Decimal(price),
        day_high=Decimal(price),
        day_low=Decimal(price),
        **extra,
    )


@override_settings(CHANNEL_LAYERS=IN_MEMORY)
class PriceServiceTests(TestCase):
    def test_feed_prices_move_and_record_history(self):
        instrument = make_instrument("FEED1")
        ticks = advance_feed_prices()

        self.assertEqual(len(ticks), 1)
        self.assertEqual(ticks[0]["symbol"], "FEED1")
        self.assertEqual(PriceTick.objects.filter(instrument=instrument).count(), 1)

        instrument.refresh_from_db()
        self.assertIsNotNone(instrument.price_updated_at)

    def test_manual_instruments_are_not_moved_by_the_ticker(self):
        instrument = make_instrument("MANUAL1", source="manual", price="250.0000")
        advance_feed_prices()

        instrument.refresh_from_db()
        self.assertEqual(instrument.current_price, Decimal("250.0000"))
        self.assertFalse(PriceTick.objects.filter(instrument=instrument).exists())

    def test_walk_stays_within_25_percent_of_the_anchor(self):
        """A long-running simulation must not drift an instrument to an absurd
        number overnight."""
        instrument = make_instrument("FEED2", price="100.0000")
        for _ in range(150):
            advance_feed_prices()

        instrument.refresh_from_db()
        anchor = Decimal("100.0000")
        self.assertGreaterEqual(instrument.current_price, anchor * Decimal("0.75"))
        self.assertLessEqual(instrument.current_price, anchor * Decimal("1.25"))

    def test_inactive_instruments_are_skipped(self):
        make_instrument("HIDDEN", is_active=False)
        self.assertEqual(advance_feed_prices(), [])

    def test_manual_price_rolls_previous_close(self):
        instrument = make_instrument("MANUAL2", source="manual", price="100.0000")
        set_manual_price(instrument, Decimal("110.0000"))

        instrument.refresh_from_db()
        self.assertEqual(instrument.current_price, Decimal("110.0000"))
        self.assertEqual(instrument.previous_close, Decimal("100.0000"))
        self.assertEqual(instrument.change_percent, Decimal("10.00"))
        self.assertTrue(PriceTick.objects.filter(instrument=instrument).exists())

    def test_change_percent_handles_a_zero_base(self):
        instrument = make_instrument("ZERO", price="0.0000")
        instrument.previous_close = Decimal("0")
        self.assertEqual(instrument.change_percent, Decimal("0"))

    def test_history_is_pruned(self):
        instrument = make_instrument("PRUNE")
        PriceTick.objects.bulk_create(
            [PriceTick(instrument=instrument, price=Decimal("100")) for _ in range(40)]
        )
        prune_tick_history(keep=10)
        self.assertEqual(PriceTick.objects.filter(instrument=instrument).count(), 10)

    def test_serialize_tick_shape(self):
        issuer = Issuer.objects.create(name="Test Bank")
        instrument = make_instrument("SER1", issuer=issuer)
        tick = serialize_tick(instrument)
        self.assertEqual(
            sorted(tick),
            ["change", "change_percent", "currency", "day_high", "day_low",
             "name", "previous_close", "price", "symbol", "updated_at"],
        )


@override_settings(CHANNEL_LAYERS=IN_MEMORY)
class PriceConsumerTests(TransactionTestCase):
    """The consumer is exercised end to end: connect, subscribe, receive."""

    async def _connect(self):
        from channels.routing import URLRouter

        communicator = WebsocketCommunicator(URLRouter(websocket_urlpatterns), "/ws/prices/")
        connected, _ = await communicator.connect()
        self.assertTrue(connected, "WebSocket handshake was refused")
        greeting = await communicator.receive_json_from()
        self.assertEqual(greeting["type"], "connected")
        return communicator

    async def test_connects_without_authentication(self):
        """Prices are public — the landing page shows them before login."""
        communicator = await self._connect()
        await communicator.disconnect()

    async def test_receives_a_broadcast(self):
        communicator = await self._connect()

        layer = get_channel_layer()
        await layer.group_send(
            "prices",
            {"type": "price.update", "ticks": [{"symbol": "ABC", "price": 12.5}]},
        )

        message = await communicator.receive_json_from()
        self.assertEqual(message["type"], "prices")
        self.assertEqual(message["ticks"][0]["symbol"], "ABC")
        await communicator.disconnect()

    async def test_subscription_filters_the_fan_out(self):
        communicator = await self._connect()

        await communicator.send_json_to({"action": "subscribe", "symbols": ["WANTED"]})
        ack = await communicator.receive_json_from()
        self.assertEqual(ack["symbols"], ["WANTED"])

        layer = get_channel_layer()
        # An unsubscribed symbol must produce no frame at all.
        await layer.group_send(
            "prices",
            {"type": "price.update", "ticks": [{"symbol": "IGNORED", "price": 1}]},
        )
        self.assertTrue(await communicator.receive_nothing(timeout=0.3))

        await layer.group_send(
            "prices",
            {"type": "price.update", "ticks": [{"symbol": "WANTED", "price": 2}]},
        )
        message = await communicator.receive_json_from()
        self.assertEqual(message["ticks"][0]["symbol"], "WANTED")

        await communicator.disconnect()

    async def test_malformed_frames_do_not_drop_the_socket(self):
        communicator = await self._connect()
        await communicator.send_to(text_data="this is not json")
        self.assertTrue(await communicator.receive_nothing(timeout=0.2))

        # Still alive and still delivering.
        layer = get_channel_layer()
        await layer.group_send(
            "prices", {"type": "price.update", "ticks": [{"symbol": "OK", "price": 3}]},
        )
        message = await communicator.receive_json_from()
        self.assertEqual(message["ticks"][0]["symbol"], "OK")
        await communicator.disconnect()


@override_settings(CHANNEL_LAYERS=IN_MEMORY)
class BroadcastTests(TestCase):
    def test_broadcast_of_an_empty_batch_is_a_no_op(self):
        broadcast([])  # must not raise
