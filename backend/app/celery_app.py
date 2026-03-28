"""Celery application for asynchronous task processing."""

from celery import Celery
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
celery_app.autodiscover_tasks(["app.tasks", "app.services.crystallization"])
