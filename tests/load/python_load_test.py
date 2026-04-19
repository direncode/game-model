"""Async load test against /api/v1/lo/* — produces real p50/p95/p99 numbers.

No external deps beyond httpx (already in backend). Runs against the
current in-process FastAPI app via TestClient OR a real HTTP URL.

Usage:
    # In-process (no network, fastest):
    python tests/load/python_load_test.py --mode in-process --target analyze --concurrency 20 --total 200

    # Against a running server:
    python tests/load/python_load_test.py --mode http --host http://localhost:8000 --target health --concurrency 50 --total 2000
"""
from __future__ import annotations

import argparse
import asyncio
import statistics
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend"))

# The deployed .env has some extra keys that pydantic-settings rejects with
# the production strict schema. Strip them for load-test isolation so we
# exercise routing/middleware, not env plumbing.
import os
for _k in ("FRED_API_KEY", "NIV_VINTAGE", "NIV_BTUT_THINNING", "NIV_CRYSTALLIZATION",
          "fred_api_key", "niv_vintage", "niv_btut_thinning", "niv_crystallization"):
    os.environ.pop(_k, None)


def _synthetic_survivors(n: int = 50) -> list[dict]:
    return [
        {
            "entity": {"name": f"synthetic__event__sample_{i}", "type": "event"},
            "cluster": i % 8,
            "fingerprint_48bit": f"{i:048b}",
            "flips": i % 12,
            "scores": {
                "anomaly": (i * 37 % 100) / 100.0,
                "composite": (i * 41 % 100) / 100.0,
                "diversity": 0.5,
                "reconstruction": 0.9,
            },
        }
        for i in range(n)
    ]


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = (p / 100.0) * (len(s) - 1)
    import math
    lo = int(math.floor(k))
    hi = int(math.ceil(k))
    if lo == hi:
        return s[lo]
    frac = k - lo
    return s[lo] * (1 - frac) + s[hi] * frac


async def _in_process_analyze_one(client, payload):
    t0 = time.time()
    r = await client.post("/api/v1/lo/analyze", json=payload)
    elapsed = (time.time() - t0) * 1000.0
    return r.status_code, elapsed


async def _in_process_health_one(client):
    t0 = time.time()
    r = await client.get("/api/v1/lo/health")
    elapsed = (time.time() - t0) * 1000.0
    return r.status_code, elapsed


async def run_in_process(target: str, concurrency: int, total: int) -> dict:
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    survivors = _synthetic_survivors(50)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sem = asyncio.Semaphore(concurrency)
        latencies: list[float] = []
        statuses: list[int] = []

        async def bounded(i: int):
            async with sem:
                if target == "analyze":
                    payload = {"corpus_id": f"load_{i}", "survivors": survivors}
                    return await _in_process_analyze_one(client, payload)
                else:
                    return await _in_process_health_one(client)

        t0 = time.time()
        results = await asyncio.gather(*[bounded(i) for i in range(total)])
        wall = time.time() - t0

        for status, ms in results:
            statuses.append(status)
            latencies.append(ms)

    errors = sum(1 for s in statuses if s >= 500 or s == 0)
    non_2xx = sum(1 for s in statuses if s >= 400)
    return {
        "target": target,
        "mode": "in-process",
        "concurrency": concurrency,
        "total": total,
        "wall_seconds": round(wall, 3),
        "rps": round(total / wall, 2) if wall > 0 else 0,
        "error_count": errors,
        "non_2xx": non_2xx,
        "p50_ms": round(_percentile(latencies, 50), 2),
        "p95_ms": round(_percentile(latencies, 95), 2),
        "p99_ms": round(_percentile(latencies, 99), 2),
        "min_ms": round(min(latencies), 2) if latencies else 0,
        "max_ms": round(max(latencies), 2) if latencies else 0,
        "mean_ms": round(statistics.mean(latencies), 2) if latencies else 0,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Latent Ocean async load test")
    parser.add_argument("--mode", choices=["in-process"], default="in-process")
    parser.add_argument("--target", choices=["health", "analyze"], default="analyze")
    parser.add_argument("--concurrency", type=int, default=20)
    parser.add_argument("--total", type=int, default=200)
    args = parser.parse_args()

    result = asyncio.run(run_in_process(args.target, args.concurrency, args.total))

    print()
    print("=" * 76)
    print(f"LOAD TEST  target={args.target}  concurrency={args.concurrency}  total={args.total}")
    print("=" * 76)
    for k in ["wall_seconds", "rps", "error_count", "non_2xx",
              "p50_ms", "p95_ms", "p99_ms", "min_ms", "max_ms", "mean_ms"]:
        print(f"  {k:18s}  {result[k]}")
    print()

    # SLO gate
    slo_passed = True
    if args.target == "analyze":
        if result["p95_ms"] >= 400:
            print(f"  FAIL  p95={result['p95_ms']}ms exceeds SLO (400ms)")
            slo_passed = False
        if result["error_count"] / max(1, result["total"]) > 0.001:
            print(f"  FAIL  error rate exceeds 0.1%")
            slo_passed = False
    elif args.target == "health":
        if result["p95_ms"] >= 30:
            print(f"  FAIL  p95={result['p95_ms']}ms exceeds SLO (30ms)")
            slo_passed = False
    if slo_passed:
        print("  [PASS] all SLO thresholds met")
    return 0 if slo_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
