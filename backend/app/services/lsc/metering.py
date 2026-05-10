"""LSC Layer 8 — billing + metering scaffold.

Per-job usage records persist into Redis (hot, recent jobs) and Postgres
(cold rollup). A Stripe sync job rolls usage records into metered Stripe
subscription line items on a schedule.

Public surface:
    record_job_usage(org_id, user_id, api_key_id, job_id, ...) -> None

The record_job_usage call is non-fatal: if Redis or Postgres is
unavailable, the job still succeeds for the customer, and a warning is
logged. Billing reconciliation can replay from the LSC submission log.
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)


# Stripe customer / subscription resolution is delegated to a dedicated
# billing module; here we just record raw usage. Real implementation queues
# usage events to Stripe's Meter API in a background worker.


async def record_job_usage(
    org_id: str | None,
    user_id: str | None,
    api_key_id: str | None,
    job_id: str,
    backend: str,
    n_entities: int,
    gpu_exec_ms: int,
    cost_dollars: float,
    regime_card_compliant: bool,
) -> None:
    """Persist a per-job usage record.

    Writes to Redis under the key ``lsc:usage:<org_id>:<job_id>`` with a
    TTL appropriate for the customer's billing cycle. A separate worker
    rolls these into Postgres + Stripe.

    Failures are logged but never raised; metering must not fail the
    customer's substrate job.
    """
    record: dict[str, Any] = {
        "org_id": org_id,
        "user_id": user_id,
        "api_key_id": api_key_id,
        "job_id": job_id,
        "backend": backend,
        "n_entities": n_entities,
        "gpu_exec_ms": gpu_exec_ms,
        "cost_dollars": round(cost_dollars, 6),
        "regime_card_compliant": regime_card_compliant,
        "recorded_at": time.time(),
    }
    try:
        # Soft import: Redis is optional in dev. Tests can run without it.
        import redis.asyncio as redis_async  # type: ignore
    except Exception:
        logger.info("metering: redis unavailable, record dropped: %s", job_id)
        return

    redis_url = os.environ.get("REDIS_URL") or "redis://localhost:6379/0"
    try:
        client = redis_async.from_url(redis_url, decode_responses=True)
        key = f"lsc:usage:{org_id or 'anon'}:{job_id}"
        await client.set(key, json.dumps(record), ex=60 * 60 * 24 * 35)  # 35 days
        # Rolling list per org for fast dashboard queries
        org_list_key = f"lsc:usage:by_org:{org_id or 'anon'}"
        await client.lpush(org_list_key, job_id)
        await client.ltrim(org_list_key, 0, 999)  # keep last 1000 jobs
        await client.aclose()
    except Exception as e:
        logger.warning("metering: failed to record usage %s: %s", job_id, e)
