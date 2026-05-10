"""FDE (Forward Deployed Engineer) workspace services — Layer 10.

The FDE workspace tracks active customer engagements and the custom
operators developed during each engagement. The data model here is
deliberately minimal so the workspace is usable from the FDE page
before the full CRM integration lands.

Public surface:
    EngagementStatus   — enum of engagement lifecycle states
    Engagement         — dataclass representing one customer engagement
    list_engagements   — return all engagements (filter by status / org)
    get_engagement     — fetch one
    upsert_engagement  — create or update
"""
from __future__ import annotations

import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, asdict, field
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class EngagementStatus(str, Enum):
    SCOPING = "scoping"
    ACTIVE = "active"
    HANDED_OFF = "handed_off"
    PAUSED = "paused"
    CLOSED = "closed"


@dataclass
class Engagement:
    id: str
    org_id: str
    customer_name: str
    status: EngagementStatus
    primary_fde: str
    started_at: float
    last_update_at: float
    workflows_built: int = 0
    custom_operators_deployed: int = 0
    notes: str = ""
    open_items: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["status"] = self.status.value
        return d


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


_KEY_PREFIX = "fde:engagement"
_INDEX_KEY = "fde:engagements:index"


async def list_engagements(status: str | None = None, org_id: str | None = None) -> list[Engagement]:
    client = await _redis()
    if client is None:
        return []
    try:
        ids = await client.smembers(_INDEX_KEY)
        if not ids:
            return []
        keys = [f"{_KEY_PREFIX}:{eid}" for eid in ids]
        raws = await client.mget(*keys)
        out: list[Engagement] = []
        for raw in raws:
            if not raw:
                continue
            try:
                d = json.loads(raw)
                e = Engagement(
                    id=d["id"], org_id=d["org_id"], customer_name=d["customer_name"],
                    status=EngagementStatus(d.get("status", EngagementStatus.SCOPING.value)),
                    primary_fde=d.get("primary_fde", ""),
                    started_at=d.get("started_at", time.time()),
                    last_update_at=d.get("last_update_at", time.time()),
                    workflows_built=d.get("workflows_built", 0),
                    custom_operators_deployed=d.get("custom_operators_deployed", 0),
                    notes=d.get("notes", ""),
                    open_items=d.get("open_items", []),
                )
                if status and e.status.value != status:
                    continue
                if org_id and e.org_id != org_id:
                    continue
                out.append(e)
            except Exception:
                continue
        out.sort(key=lambda e: e.last_update_at, reverse=True)
        return out
    finally:
        try:
            await client.aclose()
        except Exception:
            pass


async def get_engagement(engagement_id: str) -> Engagement | None:
    client = await _redis()
    if client is None:
        return None
    try:
        raw = await client.get(f"{_KEY_PREFIX}:{engagement_id}")
        if not raw:
            return None
        d = json.loads(raw)
        return Engagement(
            id=d["id"], org_id=d["org_id"], customer_name=d["customer_name"],
            status=EngagementStatus(d.get("status", EngagementStatus.SCOPING.value)),
            primary_fde=d.get("primary_fde", ""),
            started_at=d.get("started_at", time.time()),
            last_update_at=d.get("last_update_at", time.time()),
            workflows_built=d.get("workflows_built", 0),
            custom_operators_deployed=d.get("custom_operators_deployed", 0),
            notes=d.get("notes", ""),
            open_items=d.get("open_items", []),
        )
    finally:
        try:
            await client.aclose()
        except Exception:
            pass


async def upsert_engagement(
    engagement_id: str | None,
    org_id: str,
    customer_name: str,
    status: str,
    primary_fde: str,
    notes: str = "",
    workflows_built: int = 0,
    custom_operators_deployed: int = 0,
    open_items: list[str] | None = None,
) -> Engagement:
    client = await _redis()
    if client is None:
        raise RuntimeError("FDE store unavailable: Redis required")
    eid = engagement_id or str(uuid.uuid4())
    now = time.time()
    started_at = now
    existing = await get_engagement(eid) if engagement_id else None
    if existing:
        started_at = existing.started_at

    eng = Engagement(
        id=eid, org_id=org_id, customer_name=customer_name,
        status=EngagementStatus(status),
        primary_fde=primary_fde,
        started_at=started_at, last_update_at=now,
        workflows_built=workflows_built,
        custom_operators_deployed=custom_operators_deployed,
        notes=notes,
        open_items=open_items or [],
    )
    try:
        await client.set(f"{_KEY_PREFIX}:{eid}", json.dumps(eng.to_dict()))
        await client.sadd(_INDEX_KEY, eid)
    finally:
        try:
            await client.aclose()
        except Exception:
            pass
    return eng
