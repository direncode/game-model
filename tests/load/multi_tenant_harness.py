"""Multi-tenant concurrent workload harness.

Simulates N concurrent tenants each running an independent `lo analyze`
against their own corpus, proving the platform's fork-template isolation
pattern does not cross-contaminate at the API layer.

Output: per-tenant latency + error rates + a pass/fail on tenant
isolation invariants.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import statistics
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend"))

# Tolerate extra env keys for harness isolation
for _k in ("FRED_API_KEY", "NIV_VINTAGE", "NIV_BTUT_THINNING", "NIV_CRYSTALLIZATION",
          "fred_api_key", "niv_vintage", "niv_btut_thinning", "niv_crystallization"):
    os.environ.pop(_k, None)


def _tenant_survivors(tenant_id: str, n: int = 50) -> list[dict]:
    """Each tenant gets a deterministic-but-tenant-specific corpus."""
    salt = abs(hash(tenant_id)) % 10_000
    return [
        {
            "entity": {"name": f"tenant_{tenant_id}__event__sample_{i}", "type": "event"},
            "cluster": (salt + i) % 8,
            "fingerprint_48bit": f"{((salt * 1009 + i * 37) & ((1 << 48) - 1)):048b}",
            "flips": i % 12,
            "scores": {
                "anomaly": ((salt * 41 + i * 37) % 100) / 100.0,
                "composite": ((salt * 17 + i * 29) % 100) / 100.0,
                "diversity": 0.5,
                "reconstruction": 0.9,
            },
        }
        for i in range(n)
    ]


async def _tenant_workload(client, tenant_id: str, n_ops: int) -> dict:
    latencies: list[float] = []
    errors = 0
    corpus_ids_seen: set[str] = set()

    for op_i in range(n_ops):
        payload = {
            "corpus_id": f"{tenant_id}_run_{op_i}",
            "survivors": _tenant_survivors(tenant_id, 50),
        }
        t0 = time.time()
        r = await client.post("/api/v1/lo/analyze", json=payload)
        elapsed_ms = (time.time() - t0) * 1000.0
        latencies.append(elapsed_ms)
        if r.status_code != 200:
            errors += 1
            continue
        body = r.json()
        corpus_ids_seen.add(body.get("corpus_id", ""))

        # Cross-tenant invariant: the corpus_id in the response must equal
        # what we sent (no response-mixing between tenants).
        assert body.get("corpus_id") == payload["corpus_id"], (
            f"TENANT LEAK: sent {payload['corpus_id']}, got {body.get('corpus_id')}"
        )

    def p(k):
        if not latencies:
            return 0.0
        s = sorted(latencies)
        idx = int(k / 100.0 * (len(s) - 1))
        return s[idx]

    return {
        "tenant_id": tenant_id,
        "n_ops": n_ops,
        "errors": errors,
        "corpus_ids_distinct": len(corpus_ids_seen),
        "p50_ms": round(p(50), 2),
        "p95_ms": round(p(95), 2),
        "p99_ms": round(p(99), 2),
        "mean_ms": round(statistics.mean(latencies), 2) if latencies else 0,
    }


async def run_harness(n_tenants: int, n_ops_each: int) -> dict:
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        tenants = [f"tenant_{i:03d}" for i in range(n_tenants)]
        t0 = time.time()
        results = await asyncio.gather(
            *[_tenant_workload(client, tid, n_ops_each) for tid in tenants]
        )
        wall = time.time() - t0

    total_ops = sum(r["n_ops"] for r in results)
    total_errors = sum(r["errors"] for r in results)

    return {
        "n_tenants": n_tenants,
        "n_ops_per_tenant": n_ops_each,
        "total_ops": total_ops,
        "total_errors": total_errors,
        "wall_seconds": round(wall, 3),
        "aggregate_rps": round(total_ops / wall, 2) if wall > 0 else 0,
        "per_tenant_p95_ms_mean": round(
            statistics.mean(r["p95_ms"] for r in results), 2),
        "per_tenant_p95_ms_max": max(r["p95_ms"] for r in results),
        "per_tenant_p95_ms_min": min(r["p95_ms"] for r in results),
        "results": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tenants", type=int, default=10)
    parser.add_argument("--ops", type=int, default=20, help="ops per tenant")
    args = parser.parse_args()

    out = asyncio.run(run_harness(args.tenants, args.ops))

    print()
    print("=" * 78)
    print(f"MULTI-TENANT HARNESS  tenants={out['n_tenants']}  ops/tenant={out['n_ops_per_tenant']}")
    print("=" * 78)
    print(f"  total_ops              {out['total_ops']}")
    print(f"  total_errors           {out['total_errors']}")
    print(f"  wall_seconds           {out['wall_seconds']}")
    print(f"  aggregate_rps          {out['aggregate_rps']}")
    print(f"  per_tenant_p95_ms mean/max/min = "
          f"{out['per_tenant_p95_ms_mean']} / {out['per_tenant_p95_ms_max']} / {out['per_tenant_p95_ms_min']}")
    print()
    if out["total_errors"] == 0:
        print("  [PASS] tenant isolation invariant held; zero errors")
        return 0
    print(f"  [FAIL] {out['total_errors']} errors; check per-tenant leaks")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
