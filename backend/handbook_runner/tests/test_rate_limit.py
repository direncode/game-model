"""Tests for rate_limit: per-IP token bucket."""
from __future__ import annotations
import time

import pytest

from backend.handbook_runner.rate_limit import (
    RateLimiter,
    RateLimitDecision,
)


class FakeRedis:
    """A tiny in-memory Redis stand-in that supports just the commands we use."""
    def __init__(self) -> None:
        self.kv: dict[str, str] = {}
        self.now = 1000.0

    def get(self, k: str):
        return self.kv.get(k)

    def setex(self, k: str, ttl_seconds: int, v: str) -> None:
        self.kv[k] = v

    def incrby(self, k: str, n: int) -> int:
        current = int(self.kv.get(k, "0"))
        new = current + n
        self.kv[k] = str(new)
        return new

    def decrby(self, k: str, n: int) -> int:
        current = int(self.kv.get(k, "0"))
        new = current - n
        self.kv[k] = str(new)
        return new

    def expire(self, k: str, ttl_seconds: int) -> None:
        pass  # ignore in fake


def test_first_request_allowed():
    limiter = RateLimiter(redis=FakeRedis(), burst=30, concurrent=4, sustained_per_hour=200)
    decision = limiter.try_acquire(ip="1.2.3.4")
    assert decision.allowed
    limiter.release(ip="1.2.3.4")


def test_concurrent_limit_blocks_fifth_active():
    limiter = RateLimiter(redis=FakeRedis(), burst=30, concurrent=4, sustained_per_hour=200)
    for _ in range(4):
        d = limiter.try_acquire(ip="1.2.3.4")
        assert d.allowed
    blocked = limiter.try_acquire(ip="1.2.3.4")
    assert not blocked.allowed
    assert blocked.retry_after_seconds > 0


def test_per_ip_isolation():
    limiter = RateLimiter(redis=FakeRedis(), burst=30, concurrent=2, sustained_per_hour=200)
    for _ in range(2):
        assert limiter.try_acquire(ip="1.2.3.4").allowed
    # Different IP unaffected
    assert limiter.try_acquire(ip="5.6.7.8").allowed
