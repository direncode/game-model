"""LSC Layer 9 — observability rollups for customer dashboards.

Reads the per-job usage records that metering.py wrote to Redis and
produces aggregate views. Defensive: returns empty / degraded
responses when Redis is unavailable, so the public /status page and
customer dashboard never 500 on infrastructure hiccups.
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)


async def _redis():
    try:
        import redis.asyncio as redis_async  # type: ignore
    except Exception:
        return None
    url = os.environ.get("REDIS_URL") or "redis://localhost:6379/0"
    try:
        return redis_async.from_url(url, decode_responses=True)
    except Exception:
        return None


async def fetch_org_recent_jobs(org_id: str | None, limit: int = 50) -> list[dict[str, Any]]:
    """Return the most-recent job records for the given org.

    Reads the rolling per-org list written by record_job_usage and
    hydrates each entry to the full usage record. Cheap; bounded by
    `limit`.
    """
    client = await _redis()
    if client is None:
        return []
    org = org_id or "anon"
    try:
        ids = await client.lrange(f"lsc:usage:by_org:{org}", 0, limit - 1)
        if not ids:
            return []
        keys = [f"lsc:usage:{org}:{job_id}" for job_id in ids]
        raws = await client.mget(*keys)
        out: list[dict[str, Any]] = []
        for raw in raws:
            if not raw:
                continue
            try:
                out.append(json.loads(raw))
            except Exception:
                continue
        return out
    except Exception as e:
        logger.info("dashboards: fetch failed for %s: %s", org_id, e)
        return []
    finally:
        try:
            await client.aclose()
        except Exception:
            pass


async def fetch_org_aggregate(org_id: str | None) -> dict[str, Any]:
    """Aggregate the org's recent usage into headline metrics.

    Used by /api/v1/lsc/metrics and the customer dashboard tile row.
    """
    jobs = await fetch_org_recent_jobs(org_id, limit=200)
    if not jobs:
        return {
            "jobs_total": 0,
            "entities_total": 0,
            "gpu_seconds_total": 0.0,
            "cost_dollars_total": 0.0,
            "regime_card_compliant_rate": None,
            "since": None,
        }
    entities = sum(j.get("n_entities") or 0 for j in jobs)
    gpu_seconds = sum((j.get("gpu_exec_ms") or 0) / 1000.0 for j in jobs)
    cost = sum(j.get("cost_dollars") or 0.0 for j in jobs)
    compliant = sum(1 for j in jobs if j.get("regime_card_compliant"))
    earliest = min((j.get("recorded_at") or time.time() for j in jobs), default=time.time())
    return {
        "jobs_total": len(jobs),
        "entities_total": entities,
        "gpu_seconds_total": round(gpu_seconds, 2),
        "cost_dollars_total": round(cost, 4),
        "regime_card_compliant_rate": round(compliant / max(1, len(jobs)), 4),
        "since": earliest,
    }
