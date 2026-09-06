"""Celery tasks for the live price feed."""
import logging

from celery import shared_task

from .services import advance_feed_prices, broadcast, prune_tick_history

logger = logging.getLogger(__name__)


@shared_task(name="apps.instruments.tasks.publish_price_tick")
def publish_price_tick():
    """Advance every feed-sourced instrument and push the batch to subscribers."""
    ticks = advance_feed_prices()
    broadcast(ticks)
    return {"ticks": len(ticks)}


@shared_task(name="apps.instruments.tasks.prune_price_history")
def prune_price_history(keep=500):
    deleted = prune_tick_history(keep=keep)
    logger.info("Pruned %s price ticks", deleted)
    return {"deleted": deleted}
