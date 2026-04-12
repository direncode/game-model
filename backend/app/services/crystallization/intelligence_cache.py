"""Redis cache for TCD-JEPA intelligence engine results.

Keys: tcd_intelligence:{session_id}:{engine_name}
TTL: 24 hours
"""
from __future__ import annotations

import json
from typing import Any

from app.core.redis import get_redis

_PREFIX = "tcd_intelligence"
_TTL = 24 * 3600


async def store_engine_result(
    session_id: str, engine: str, insights: list[dict]
) -> None:
    r = await get_redis()
    await r.setex(
        f"{_PREFIX}:{session_id}:{engine}",
        _TTL,
        json.dumps(insights, default=str),
    )


async def get_engine_result(
    session_id: str, engine: str
) -> list[dict] | None:
    r = await get_redis()
    raw = await r.get(f"{_PREFIX}:{session_id}:{engine}")
    if raw is None:
        return None
    return json.loads(raw)


async def get_all_results(session_id: str) -> dict[str, list[dict]]:
    engines = [
        "deep_signals", "causal", "topological",
        "temporal", "meta", "oracle", "uncertainty",
    ]
    results = {}
    for eng in engines:
        data = await get_engine_result(session_id, eng)
        if data is not None:
            results[eng] = data
    return results
