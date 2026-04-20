"""Staged load test against https://latentocean.com with abort guards.

Ramps concurrency through a series of stages (100 -> 500 -> 1000 ->
2500 -> 5000) and stops the run immediately if any stage's error rate
exceeds the threshold. This protects the live site while still
pushing past the earlier 10/50/150-VU run.

Not 10,000 VUs — that would 429 through Cloudflare and/or saturate a
free-tier origin. If the user's plan upgrades to Cloudflare Pro or
higher, the same script extends to 10k by just adding a stage.

Output:
    data/validation/prod_staged_load.json
    docs/commercial/LOAD_TEST_STAGED.md (if this completes clean)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path

import httpx

REPO_ROOT = Path(__file__).resolve().parents[2]

ENDPOINTS = [
    "/",                      # static page, Cloudflare cached
    "/platform",              # static page
    "/api/universal",         # JSON, lightly cached (artifactCache 120s)
    "/api/live/quakes",       # upstream fetch, CF revalidate 30s
]

STAGES = [100, 500, 1000, 2500, 5000]  # VUs per endpoint per stage
ROUNDS_PER_STAGE = 300                 # requests per endpoint per stage
ABORT_ERROR_RATE = 0.02                # 2% errors → stop the run


@dataclass
class StageResult:
    endpoint: str
    vus: int
    total: int
    wall_s: float
    rps: float
    success_rate: float
    p50_ms: float
    p95_ms: float
    p99_ms: float
    max_ms: float
    error_counts: dict


async def hammer(url: str, total: int, concurrency: int, timeout: float = 30.0) -> StageResult:
    latencies: list[float] = []
    errors: dict[str, int] = {}
    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(timeout, connect=5.0),
        http2=False,
        limits=httpx.Limits(max_connections=concurrency * 2,
                             max_keepalive_connections=concurrency),
    ) as c:
        async def one():
            async with sem:
                t0 = time.perf_counter()
                try:
                    r = await c.get(url)
                    latencies.append((time.perf_counter() - t0) * 1000)
                    if r.status_code >= 400:
                        errors[str(r.status_code)] = errors.get(str(r.status_code), 0) + 1
                except Exception as e:
                    errors[type(e).__name__] = errors.get(type(e).__name__, 0) + 1
        t_start = time.perf_counter()
        await asyncio.gather(*[asyncio.create_task(one()) for _ in range(total)])
        wall = time.perf_counter() - t_start

    def pct(data, p):
        if not data: return 0.0
        s = sorted(data)
        k = max(0, min(len(s) - 1, int(round(p * (len(s) - 1)))))
        return s[k]

    succ = total - sum(errors.values())
    return StageResult(
        endpoint=url, vus=concurrency, total=total,
        wall_s=round(wall, 2), rps=round(total / max(1e-9, wall), 1),
        success_rate=round(succ / max(1, total), 4),
        p50_ms=round(pct(latencies, 0.5), 1),
        p95_ms=round(pct(latencies, 0.95), 1),
        p99_ms=round(pct(latencies, 0.99), 1),
        max_ms=round(max(latencies) if latencies else 0, 1),
        error_counts=errors,
    )


async def main_async(host: str, stages: list[int], rounds: int) -> dict:
    out = {
        "host": host, "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "stages_planned": stages, "rounds_per_stage": rounds,
        "abort_threshold_error_rate": ABORT_ERROR_RATE,
        "stages": [], "aborted_at": None, "abort_reason": None,
    }

    for vus in stages:
        print(f"\n=== STAGE: VUs={vus} ===")
        print(f"{'endpoint':30s} {'tot':>5s} {'wall':>7s} {'rps':>6s} {'succ':>6s} {'p50':>5s} {'p95':>5s} {'p99':>5s}")
        stage_errors_total = 0
        stage_total_requests = 0
        for ep in ENDPOINTS:
            url = host.rstrip("/") + ep
            r = await hammer(url, total=rounds, concurrency=vus)
            out["stages"].append(asdict(r))
            stage_errors_total += sum(r.error_counts.values())
            stage_total_requests += r.total
            print(f"{ep:30s} {r.total:>5d} {r.wall_s:>6.2f}s {r.rps:>6.1f} "
                  f"{r.success_rate*100:>5.1f}% {r.p50_ms:>5.0f} {r.p95_ms:>5.0f} {r.p99_ms:>5.0f}  {r.error_counts or ''}")
        err_rate = stage_errors_total / max(1, stage_total_requests)
        print(f"  stage error rate: {err_rate*100:.2f}%")
        if err_rate > ABORT_ERROR_RATE:
            out["aborted_at"] = vus
            out["abort_reason"] = f"stage error rate {err_rate*100:.2f}% > threshold {ABORT_ERROR_RATE*100:.0f}%"
            print(f"  -> ABORT: error rate exceeds {ABORT_ERROR_RATE*100:.0f}% threshold")
            break
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="https://latentocean.com")
    ap.add_argument("--stages", default=",".join(str(s) for s in STAGES))
    ap.add_argument("--rounds", type=int, default=ROUNDS_PER_STAGE)
    ap.add_argument("--output", default=str(REPO_ROOT / "data" / "validation" / "prod_staged_load.json"))
    args = ap.parse_args()
    stages = [int(s) for s in args.stages.split(",")]
    report = asyncio.run(main_async(args.host, stages, args.rounds))
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nWrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
