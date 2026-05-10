"""Celery application for asynchronous task processing."""

from celery import Celery
from celery.schedules import crontab
from kombu import Exchange, Queue

from app.config import settings

celery_app = Celery(
    "latent_intelligence",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

# ── Serialization ───────────────────────────────────────────────────
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]

# ── Timezone ────────────────────────────────────────────────────────
celery_app.conf.timezone = "UTC"
celery_app.conf.enable_utc = True

# ── Task queues ─────────────────────────────────────────────────────
default_exchange = Exchange("default", type="direct")

celery_app.conf.task_queues = (
    Queue("default", default_exchange, routing_key="default"),
    Queue("crystallization", Exchange("crystallization", type="direct"), routing_key="crystallization"),
    Queue("interpretation", Exchange("interpretation", type="direct"), routing_key="interpretation"),
    Queue("reports", Exchange("reports", type="direct"), routing_key="reports"),
)

celery_app.conf.task_default_queue = "default"
celery_app.conf.task_default_exchange = "default"
celery_app.conf.task_default_routing_key = "default"

# ── Auto-discover tasks ────────────────────────────────────────────
celery_app.autodiscover_tasks(["app.services.crystallization"])

# Explicit imports for task modules not following autodiscovery conventions
import app.tasks.fsd_crystallize  # noqa: E402, F401
import app.tasks.btut_ingest  # noqa: E402, F401
import app.tasks.btut_report  # noqa: E402, F401
import app.tasks.data_layer_run  # noqa: E402, F401
import app.tasks.ocean_build  # noqa: E402, F401
import app.tasks.tcd_crystallize  # noqa: E402, F401
import app.services.crystallization.job_manager  # noqa: E402, F401
import app.tasks.data_estate_crystallize  # noqa: E402, F401
import app.tasks.lsc_stripe_sync  # noqa: E402, F401

# ── Periodic tasks (Celery Beat) ───────────────────────────────────
beat: dict = {
    # Layer 8 — Stripe Meter API sync every 60s. No-op (dry-run + logs)
    # when STRIPE_API_KEY is absent. Idempotent per job_id via Stripe's
    # identifier field.
    "lsc-stripe-sync": {
        "task": "lsc.stripe_sync",
        "schedule": 60.0,
    },
}
if settings.FSD_ENABLED:
    beat["fsd-daily-crystallize"] = {
        "task": "fsd.daily_crystallize",
        "schedule": crontab(hour=settings.FSD_DAILY_CRON_HOUR, minute=0),
    }
celery_app.conf.beat_schedule = beat
