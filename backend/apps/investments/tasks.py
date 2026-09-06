"""Celery tasks that pay the monthly returns."""
import logging

from celery import shared_task

from .services import run_due_payouts

logger = logging.getLogger(__name__)


@shared_task(name="apps.investments.tasks.run_due_roi_payouts")
def run_due_roi_payouts():
    """Hourly sweep. Idempotent, so an extra run is harmless and a missed run
    is caught up by the next one."""
    summary = run_due_payouts()
    logger.info("ROI sweep: %s", summary)
    return summary
