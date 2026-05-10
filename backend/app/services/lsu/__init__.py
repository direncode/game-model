"""LSU (Latent Stretcher Unit) hardware bridge — Layer 12.

The LSU registry tracks customer-owned on-prem hardware that has paired
with the LSC control plane. Each LSU heartbeats periodically; jobs that
the cost-aware router decides to send to a customer's LSU instead of
cloud backends use the LSU's registered endpoint.

Public surface:
    LSU              — dataclass for a registered unit
    register_lsu     — initial pairing
    heartbeat_lsu    — keep-alive
    list_lsus        — query (filter by org / status)
    deregister_lsu   — remove
"""
from __future__ import annotations

import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, asdict, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class LSU:
    id: str
    org_id: str
    name: str
    endpoint_url: str
    fingerprint: str
    registered_at: float
    last_heartbeat_at: float
    status: str  # "online" | "offline" | "draining"
    capabilities: dict[str, Any] = field(default_factory=dict)
    workload_tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


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


_KEY_PREFIX = "lsu:registry"
_INDEX_KEY = "lsu:registry:index"
HEARTBEAT_TIMEOUT_S = 120.0


async def register_lsu(
    org_id: str,
    name: str,
    endpoint_url: str,
    fingerprint: str,
    capabilities: dict[str, Any] | None = None,
    workload_tags: list[str] | None = None,
) -> LSU:
    """Register a new LSU under an org.

    Idempotent on (org_id, fingerprint): if a unit with the same
    fingerprint already exists for this org, update its endpoint and
    return it instead of creating a duplicate.
    """
    client = await _redis()
    if client is None:
        raise RuntimeError("LSU registry unavailable: Redis required")
    try:
        ids = await client.smembers(_INDEX_KEY)
        for existing_id in ids:
            raw = await client.get(f"{_KEY_PREFIX}:{existing_id}")
            if not raw:
                continue
            try:
                d = json.loads(raw)
                if d.get("org_id") == org_id and d.get("fingerprint") == fingerprint:
                    now = time.time()
                    d["endpoint_url"] = endpoint_url
                    d["last_heartbeat_at"] = now
                    d["status"] = "online"
                    if capabilities is not None:
                        d["capabilities"] = capabilities
                    if workload_tags is not None:
                        d["workload_tags"] = workload_tags
                    await client.set(f"{_KEY_PREFIX}:{existing_id}", json.dumps(d))
                    return LSU(**d)
            except Exception:
                continue

        lsu = LSU(
            id=str(uuid.uuid4()),
            org_id=org_id,
            name=name,
            endpoint_url=endpoint_url,
            fingerprint=fingerprint,
            registered_at=time.time(),
            last_heartbeat_at=time.time(),
            status="online",
            capabilities=capabilities or {},
            workload_tags=workload_tags or [],
        )
        await client.set(f"{_KEY_PREFIX}:{lsu.id}", json.dumps(lsu.to_dict()))
        await client.sadd(_INDEX_KEY, lsu.id)
        return lsu
    finally:
        try:
            await client.aclose()
        except Exception:
            pass


async def heartbeat_lsu(lsu_id: str, status: str = "online") -> bool:
    client = await _redis()
    if client is None:
        return False
    try:
        raw = await client.get(f"{_KEY_PREFIX}:{lsu_id}")
        if not raw:
            return False
        d = json.loads(raw)
        d["last_heartbeat_at"] = time.time()
        d["status"] = status
        await client.set(f"{_KEY_PREFIX}:{lsu_id}", json.dumps(d))
        return True
    finally:
        try:
            await client.aclose()
        except Exception:
            pass


async def list_lsus(org_id: str | None = None) -> list[LSU]:
    client = await _redis()
    if client is None:
        return []
    try:
        ids = await client.smembers(_INDEX_KEY)
        if not ids:
            return []
        keys = [f"{_KEY_PREFIX}:{lid}" for lid in ids]
        raws = await client.mget(*keys)
        out: list[LSU] = []
        now = time.time()
        for raw in raws:
            if not raw:
                continue
            try:
                d = json.loads(raw)
                # mark stale heartbeats as offline
                if (now - d.get("last_heartbeat_at", 0)) > HEARTBEAT_TIMEOUT_S:
                    d["status"] = "offline"
                if org_id and d.get("org_id") != org_id:
                    continue
                out.append(LSU(**d))
            except Exception:
                continue
        out.sort(key=lambda lsu: lsu.last_heartbeat_at, reverse=True)
        return out
    finally:
        try:
            await client.aclose()
        except Exception:
            pass


async def deregister_lsu(lsu_id: str) -> bool:
    client = await _redis()
    if client is None:
        return False
    try:
        await client.delete(f"{_KEY_PREFIX}:{lsu_id}")
        await client.srem(_INDEX_KEY, lsu_id)
        return True
    finally:
        try:
            await client.aclose()
        except Exception:
            pass
