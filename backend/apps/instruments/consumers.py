"""WebSocket endpoint the landing page subscribes to for live prices.

Read-only and unauthenticated by design: instrument prices are public, and the
landing page must show them before anyone logs in. The consumer accepts no
inbound commands other than a subscription filter, so there is nothing a
client can do here beyond choosing which symbols it cares about.
"""
import json

from channels.generic.websocket import AsyncWebsocketConsumer

PRICE_GROUP = "prices"


class PriceConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.symbols = None  # None = every symbol
        await self.channel_layer.group_add(PRICE_GROUP, self.channel_name)
        await self.accept()
        await self.send(json.dumps({"type": "connected", "group": PRICE_GROUP}))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(PRICE_GROUP, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            payload = json.loads(text_data or "{}")
        except (TypeError, ValueError):
            return
        if payload.get("action") == "subscribe":
            requested = payload.get("symbols")
            if isinstance(requested, list) and requested:
                self.symbols = {str(s).upper() for s in requested[:200]}
            else:
                self.symbols = None
            await self.send(json.dumps({
                "type": "subscribed",
                "symbols": sorted(self.symbols) if self.symbols else "all",
            }))

    async def price_update(self, event):
        """Fan-out handler for group_send(type='price.update')."""
        ticks = event.get("ticks") or []
        if self.symbols is not None:
            ticks = [t for t in ticks if t.get("symbol", "").upper() in self.symbols]
            if not ticks:
                return
        await self.send(json.dumps({"type": "prices", "ticks": ticks}))
