"""Production load test — real HTTP against https://latentocean.com.

No k6 required. Pure asyncio + httpx. Ramps concurrency in stages and
reports real p50/p95/p99/max latency + success rate per endpoint.

Usage:
    python tests/load/prod_load_test.py
    python tests/load/prod_load_test.py --host https://latentocean.com --rounds 5000
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import time
from dataclasses import dataclass, asdict
from pathlib import Path

import httpx


REPO_ROOT = Path(__file__).resolve().parents[2]


DEFAULT_ENDPOINTS = [
    "/",
    "/universal",
    "/validation",
    "/watchlist",
    "/live",
    "/api/universal",
    "/api/validation",
    "/api/watchlist?k=10",
    "/api/live/quakes",
    "/api/live/crypto",
]


@dataclass
class Measurement:
    endpoint: str
    concurrency: int
    total_requests: int
    wall_seconds: float
    throughput_rps: float
    success_rate: float
    p50_ms: float
    p90_ms: float
    p95_ms: float
    p99_ms: float
    max_ms: float
    error_counts: dict


async def hammer(
    url: str, total: int, concurrency: int, timeout: float = 20.0,
) -> Measurement:
    latencies_ms: list[float] = []
    errors: dict[str, int] = {}
    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(timeout, connect=5.0),
        http2=False,
        limits=httpx.Limits(max_keepalive_connections=concurrency * 2,
                             max_connections=concurrency * 4),
    ) as client:
        async def one():
            async with sem:
                t0 = time.perf_counter()
                try:
                    r = await client.get(url)
                    dt = (time.perf_counter() - t0) * 1000
                    latencies_ms.append(dt)
                    if r.status_code >= 400:
                        errors[f"{r.status_code}"] = errors.get(f"{r.status_code}", 0) + 1
                except Exception as e:
                    errors[type(e).__name__] = errors.get(type(e).__name__, 0) + 1

        wall_start = time.perf_counter()
        await asyncio.gather(*[asyncio.create_task(one()) for _ in range(total)])
        wall = time.perf_counter() - wall_start

    def pct(data, p):
        if not data:
            return 0.0
        s = sorted(data)
        k = max(0, min(len(s) - 1, int(round(p * (len(s) - 1)))))
        return s[k]

    successes = total - sum(errors.values())
    return Measurement(
        endpoint=url,
        concurrency=concurrency,
        total_requests=total,
        wall_seconds=round(wall, 3),
        throughput_rps=round(total / max(1e-9, wall), 1),
        success_rate=round(successes / max(1, total), 4),
        p50_ms=round(pct(latencies_ms, 0.50), 1),
        p90_ms=round(pct(latencies_ms, 0.90), 1),
        p95_ms=round(pct(latencies_ms, 0.95), 1),
        p99_ms=round(pct(latencies_ms, 0.99), 1),
        max_ms=round(max(latencies_ms) if latencies_ms else 0, 1),
        error_counts=errors,
    )


async def main_async(host: str, endpoints: list[str], rounds: int, concurrencies: list[int]) -> dict:
    out = {"host": host, "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "rounds": rounds, "concurrency_levels": concurrencies, "measurements": []}
    for ep in endpoints:
        url = host.rstrip("/") + ep
        print(f"\n=== {url} ===")
        print(f"{'VUs':>5s}  {'tot':>5s}  {'wall(s)':>7s}  {'rps':>7s}  {'succ':>5s}  "
              f"{'p50':>5s}  {'p90':>5s}  {'p95':>5s}  {'p99':>5s}  {'max':>6s}  errors")
        for c in concurrencies:
            m = await hammer(url, total=rounds, concurrency=c)
            out["measurements"].append(asdict(m))
            print(
                f"{c:>5d}  {m.total_requests:>5d}  {m.wall_seconds:>7.2f}  {m.throughput_rps:>7.1f}  "
                f"{m.success_rate*100:>4.1f}%  {m.p50_ms:>5.0f}  {m.p90_ms:>5.0f}  "
                f"{m.p95_ms:>5.0f}  {m.p99_ms:>5.0f}  {m.max_ms:>6.0f}  {m.error_counts or ''}"
            )
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="https://latentocean.com")
    ap.add_argument("--rounds", type=int, default=500,
                    help="Requests per endpoint per concurrency level")
    ap.add_argument("--levels", default="10,50,200",
                    help="Concurrency levels (VUs) comma-separated")
    ap.add_argument("--endpoints", default=None,
                    help="Override endpoints (comma-separated)")
    ap.add_argument("--output", default=str(
        REPO_ROOT / "data" / "validation" / "prod_load_test.json"))
    args = ap.parse_args()

    endpoints = args.endpoints.split(",") if args.endpoints else DEFAULT_ENDPOINTS
    levels = [int(x) for x in args.levels.split(",")]

    out = asyncio.run(main_async(args.host, endpoints, args.rounds, levels))
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"\nWrote {path} ({path.stat().st_size // 1024}KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
