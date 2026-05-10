"""Periodic Stripe Meter API sync task — Layer 8 worker.

Runs on Celery Beat every 60 seconds. Reads recent usage records from
Redis and posts them to Stripe (or logs them in dry-run mode when
STRIPE_API_KEY is unset). Cursor-based so repeat runs are idempotent.

Wired in app/celery_app.py.
"""
from __future__ import annotations

import asyncio
import logging

from app.celery_app import celery_app
from app.services.lsc.stripe_sync import sync_all_orgs

logger = logging.getLogger(__name__)


@celery_app.task(name="lsc.stripe_sync", bind=True, max_retries=3)
def lsc_stripe_sync(self) -> dict:
    """Run a sync pass and return a per-org summary list."""
    try:
        out = asyncio.run(sync_all_orgs())
        posted_total = sum(s.get("posted", 0) for s in out)
        errors_total = sum(len(s.get("errors", [])) for s in out)
        logger.info(
            "lsc.stripe_sync: %d orgs scanned, %d events posted, %d errors",
            len(out), posted_total, errors_total,
        )
        return {"orgs": len(out), "posted": posted_total, "errors": errors_total, "details": out}
    except Exception as exc:
        logger.warning("lsc.stripe_sync failed: %s", exc)
        raise self.retry(exc=exc, countdown=60)
