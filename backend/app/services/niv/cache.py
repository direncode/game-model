"""Redis-backed FRED series cache. FRED rate-limits at 120 req/min."""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


class NIVCache:
    """Simple Redis cache for FRED API responses."""

    def __init__(self, redis_url: str, ttl: int = 7 * 86400):
        import redis as redis_lib
        self._r = redis_lib.from_url(redis_url, decode_responses=True)
        self._ttl = ttl

    def get(self, key: str) -> Any | None:
        try:
            raw = self._r.get(f"niv:{key}")
            return json.loads(raw) if raw else None
        except Exception:
            return None

    def set(self, key: str, value: Any) -> None:
        try:
            self._r.setex(f"niv:{key}", self._ttl, json.dumps(value))
        except Exception:
            logger.warning("Cache write failed for key=%s", key)

    def invalidate(self, key: str) -> None:
        try:
            self._r.delete(f"niv:{key}")
        except Exception:
            pass
