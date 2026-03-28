"""Redis utilities for token blacklisting and session activity tracking."""

from __future__ import annotations

import redis.asyncio as aioredis

from app.config import settings

# Lazy-initialized async Redis client
_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    """Return a shared async Redis connection."""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


# ── Token Blacklist ──────────────────────────────────────────────────


async def blacklist_token(token_hash: str, ttl_seconds: int) -> None:
    """Add an access token hash to the blacklist with auto-expiry.

    Used when a user logs out — the access token is blacklisted for its
    remaining lifetime so it can't be reused.
    """
    r = await get_redis()
    await r.setex(f"blacklist:{token_hash}", ttl_seconds, "1")


async def is_token_blacklisted(token_hash: str) -> bool:
    """Check if an access token has been revoked."""
    r = await get_redis()
    return await r.exists(f"blacklist:{token_hash}") > 0


# ── Session Activity ─────────────────────────────────────────────────


async def update_session_activity(session_id: str) -> None:
    """Touch the last-active timestamp for a session in Redis.

    Avoids a DB write on every authenticated request. A periodic job
    flushes these to PostgreSQL.
    """
    from datetime import datetime, timezone

    r = await get_redis()
    now = datetime.now(timezone.utc).isoformat()
    await r.set(f"session_activity:{session_id}", now, ex=3600)


# ── Rate Limiting ────────────────────────────────────────────────────


async def check_rate_limit(key: str, max_attempts: int, window_seconds: int) -> bool:
    """Sliding window rate limiter. Returns True if the request is allowed."""
    r = await get_redis()
    current = await r.get(f"ratelimit:{key}")
    if current is not None and int(current) >= max_attempts:
        return False
    pipe = r.pipeline()
    pipe.incr(f"ratelimit:{key}")
    pipe.expire(f"ratelimit:{key}", window_seconds)
    await pipe.execute()
    return True
