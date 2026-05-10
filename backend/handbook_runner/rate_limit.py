"""Per-IP rate limiting with Redis-backed counters.

Three counters per IP:
  - concurrent: increments on acquire, decrements on release. Capped.
  - burst: requests in the last 60s. Capped.
  - sustained: requests in the last hour. Capped.

The 'concurrent' counter is the tightest constraint and is checked first.
The other two are best-effort sliding windows (1-minute / 1-hour buckets).
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Protocol


class _RedisLike(Protocol):
    def get(self, k: str): ...
    def setex(self, k: str, ttl_seconds: int, v: str) -> None: ...
    def incrby(self, k: str, n: int) -> int: ...
    def decrby(self, k: str, n: int) -> int: ...
    def expire(self, k: str, ttl_seconds: int) -> None: ...


@dataclass
class RateLimitDecision:
    allowed: bool
    retry_after_seconds: int = 0
    reason: str = ""


class RateLimiter:
    def __init__(
        self,
        *,
        redis: _RedisLike,
        burst: int = 30,
        concurrent: int = 4,
        sustained_per_hour: int = 200,
    ) -> None:
        self.redis = redis
        self.burst = burst
        self.concurrent = concurrent
        self.sustained = sustained_per_hour

    def try_acquire(self, *, ip: str) -> RateLimitDecision:
        now_minute = int(time.time() // 60)
        now_hour = int(time.time() // 3600)

        concurrent_key = f"handbook:run:concurrent:{ip}"
        burst_key = f"handbook:run:burst:{ip}:{now_minute}"
        sustained_key = f"handbook:run:hour:{ip}:{now_hour}"

        # Concurrent (tightest constraint - check first).
        current = int(self.redis.get(concurrent_key) or "0")
        if current >= self.concurrent:
            return RateLimitDecision(
                allowed=False, retry_after_seconds=30, reason="concurrent"
            )

        # Burst (per minute).
        burst_count = int(self.redis.get(burst_key) or "0")
        if burst_count >= self.burst:
            return RateLimitDecision(
                allowed=False, retry_after_seconds=60, reason="burst"
            )

        # Sustained (per hour).
        sustained_count = int(self.redis.get(sustained_key) or "0")
        if sustained_count >= self.sustained:
            return RateLimitDecision(
                allowed=False, retry_after_seconds=600, reason="sustained"
            )

        # Commit - all three counters pass.
        self.redis.incrby(concurrent_key, 1)
        self.redis.expire(concurrent_key, 60)
        self.redis.incrby(burst_key, 1)
        self.redis.expire(burst_key, 120)
        self.redis.incrby(sustained_key, 1)
        self.redis.expire(sustained_key, 3700)

        return RateLimitDecision(allowed=True)

    def release(self, *, ip: str) -> None:
        self.redis.decrby(f"handbook:run:concurrent:{ip}", 1)
