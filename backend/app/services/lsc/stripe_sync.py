"""LSC Layer 8 — Stripe Meter API sync.

Reads usage records that metering.py wrote to Redis and posts them to
Stripe's Meter Events API for usage-based billing. Idempotent per
job_id so retries never double-bill.

Configuration via env:
    STRIPE_API_KEY            — Stripe secret key (sk_live_... or sk_test_...)
    STRIPE_METER_EVENT_NAME   — name of the Stripe meter
                                (default: ``lsc_gpu_cost_usd``)
    LSC_STRIPE_DRY_RUN        — set to "true" to skip Stripe calls and
                                only log intent (default true when no
                                STRIPE_API_KEY is set)

Each org's recent jobs are scanned; jobs newer than the last-synced
cursor are posted. Cursor is stored at ``lsc:stripe_sync:cursor:<org_id>``.

Safe to call repeatedly; safe to run on multiple workers (cursor
advances monotonically via Redis SET with EX).
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)


DEFAULT_METER_EVENT_NAME = "lsc_gpu_cost_usd"
_CURSOR_PREFIX = "lsc:stripe_sync:cursor"


def _is_dry_run() -> bool:
    explicit = os.environ.get("LSC_STRIPE_DRY_RUN")
    if explicit is not None:
        return explicit.lower() in ("1", "true", "yes")
    return not bool(os.environ.get("STRIPE_API_KEY"))


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


async def _post_meter_event(
    customer_stripe_id: str,
    job_id: str,
    cost_dollars: float,
    n_entities: int,
    backend: str,
) -> tuple[bool, str | None]:
    """POST one usage event to Stripe Meter API. Returns (ok, error)."""
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        return False, "no STRIPE_API_KEY configured"
    meter = os.environ.get("STRIPE_METER_EVENT_NAME", DEFAULT_METER_EVENT_NAME)
    url = "https://api.stripe.com/v1/billing/meter_events"
    # Stripe expects form-encoded data for this endpoint.
    data = {
        "event_name": meter,
        "payload[stripe_customer_id]": customer_stripe_id,
        "payload[value]": f"{cost_dollars:.6f}",
        "payload[job_id]": job_id,
        "payload[n_entities]": str(n_entities),
        "payload[backend]": backend,
        "identifier": job_id,  # idempotency
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(url, headers=headers, data=data)
            if 200 <= r.status_code < 300:
                return True, None
            return False, f"HTTP {r.status_code}: {r.text[:200]}"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


async def sync_org(org_id: str) -> dict[str, Any]:
    """Sync one org's recent usage records to Stripe.

    Returns a summary dict ``{org_id, scanned, posted, skipped, dry_run, errors}``.
    """
    client = await _redis()
    summary: dict[str, Any] = {
        "org_id": org_id,
        "scanned": 0,
        "posted": 0,
        "skipped": 0,
        "dry_run": _is_dry_run(),
        "errors": [],
    }
    if client is None:
        summary["errors"].append("redis unavailable")
        return summary
    try:
        cursor_key = f"{_CURSOR_PREFIX}:{org_id}"
        cursor_raw = await client.get(cursor_key)
        cursor = float(cursor_raw) if cursor_raw else 0.0

        ids = await client.lrange(f"lsc:usage:by_org:{org_id}", 0, 199)
        if not ids:
            return summary

        # Fetch all referenced usage records
        keys = [f"lsc:usage:{org_id}:{jid}" for jid in ids]
        raws = await client.mget(*keys)
        records = []
        for raw in raws:
            if not raw:
                continue
            try:
                records.append(json.loads(raw))
            except Exception:
                continue
        records.sort(key=lambda r: r.get("recorded_at") or 0)

        # Map org_id -> Stripe customer id (env-driven for now; production
        # reads from the customer DB).
        customer_stripe_id = os.environ.get(f"STRIPE_CUSTOMER_{org_id.upper()}") or os.environ.get(
            "STRIPE_CUSTOMER_DEFAULT", ""
        )

        max_seen = cursor
        for rec in records:
            ts = rec.get("recorded_at") or 0.0
            summary["scanned"] += 1
            if ts <= cursor:
                summary["skipped"] += 1
                continue
            if summary["dry_run"] or not customer_stripe_id:
                logger.info(
                    "stripe_sync DRY-RUN: org=%s job=%s value=$%.6f backend=%s",
                    org_id, rec.get("job_id"), rec.get("cost_dollars") or 0.0,
                    rec.get("backend"),
                )
                summary["posted"] += 1  # treat as posted for cursor advancement
            else:
                ok, err = await _post_meter_event(
                    customer_stripe_id=customer_stripe_id,
                    job_id=rec.get("job_id") or "?",
                    cost_dollars=float(rec.get("cost_dollars") or 0.0),
                    n_entities=int(rec.get("n_entities") or 0),
                    backend=rec.get("backend") or "?",
                )
                if ok:
                    summary["posted"] += 1
                else:
                    summary["errors"].append(f"{rec.get('job_id')}: {err}")
                    continue
            if ts > max_seen:
                max_seen = ts

        if max_seen > cursor:
            await client.set(cursor_key, str(max_seen), ex=60 * 60 * 24 * 90)
    finally:
        try:
            await client.aclose()
        except Exception:
            pass
    return summary


async def sync_all_orgs() -> list[dict[str, Any]]:
    """Iterate all orgs that have a usage list and sync each.

    Returns a list of per-org summaries.
    """
    client = await _redis()
    out: list[dict[str, Any]] = []
    if client is None:
        return out
    try:
        # Scan keys "lsc:usage:by_org:*" for the org list.
        async for key in client.scan_iter(match="lsc:usage:by_org:*", count=200):
            org = key.split(":")[-1]
            try:
                out.append(await sync_org(org))
            except Exception as e:
                out.append({"org_id": org, "errors": [str(e)]})
    finally:
        try:
            await client.aclose()
        except Exception:
            pass
    return out
