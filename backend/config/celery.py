"""Celery app + the two schedules that drive the money.

  * run-roi-payouts   — hourly; credits any investment month that has matured.
  * publish-price-tick — every PRICE_TICK_SECONDS; pushes live instrument
    prices onto the Channels group the landing page subscribes to.
"""
import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("financial_platform")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    # Hourly, not monthly: each investment matures on its OWN deposit-relative
    # anniversary, so the runner sweeps continuously and pays whatever is due.
    "run-roi-payouts": {
        "task": "apps.investments.tasks.run_due_roi_payouts",
        "schedule": crontab(minute=5),
    },
    "publish-price-tick": {
        "task": "apps.instruments.tasks.publish_price_tick",
        "schedule": 5.0,
    },
}
