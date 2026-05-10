"""ASGI factory shim used by uvicorn in production.

The handbook_runner is constructed via `create_app(redis=<client>)` so the
unit tests can pass a `fakeredis` instance. In production, this shim builds
a real Redis client from `REDIS_URL` (default: redis://redis:6379/0) and
hands it to `create_app`.

uvicorn entry point:
    uvicorn backend.handbook_runner.asgi:app
"""
from __future__ import annotations

import os

import redis as redis_lib

from backend.handbook_runner.server import create_app


def _build_redis_client() -> redis_lib.Redis:
    """Construct a Redis client from REDIS_URL with reasonable defaults.

    Returns a sync client. The rate limiter uses sync methods so async/sync
    coexistence stays simple. `decode_responses=True` keeps the rate-limiter
    free of bytes vs str juggling.
    """
    url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
    return redis_lib.Redis.from_url(
        url,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
        health_check_interval=30,
    )


app = create_app(redis=_build_redis_client())
