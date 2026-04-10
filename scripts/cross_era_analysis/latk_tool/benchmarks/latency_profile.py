"""Latency profile for the live LATK query API.

Measures three things:

1. **Cold-start latency** per lattice — first query after process start
   has to load the lattice file into memory.
2. **Warm query latency** — p50/p95/p99 over 30 warm queries per lattice.
3. **Concurrent stress** — 50 parallel queries, observe error rate and
   p95 under load.

Run against a live base URL::

    python scripts/cross_era_analysis/latk_tool/benchmarks/latency_profile.py \\
        --base-url http://32.192.140.145

Writes ``scripts/cross_era_analysis/output/latency_profile_report.json``.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Tuple

import urllib.request
import urllib.error


REPO_ROOT = Path(__file__).resolve().parents[4]
CEA_DIR = REPO_ROOT / "scripts" / "cross_era_analysis"


PROBES: Dict[str, List[str]] = {
    "linguistics": [
        "In language there are only differences and no positive terms.",
        "Recursive generative grammar with phrase-structure rules.",
        "Distributional hypothesis word meaning context co-occurrence.",
    ],
    "polymath": [
        "Newton's theory of colors and prismatic decomposition of white light.",
        "Leonardo anatomical drawings of the circulatory system.",
        "Von Neumann cellular automata self-reproducing machines.",
    ],
    "heterogeneous": [
        "Zenneck surface wave theory applied to wireless power transmission.",
        "Shannon channel capacity and noisy channel coding theorem.",
        "Tesla wireless energy transfer through the earth via resonance.",
    ],
    "tesla_crossera": [
        "Wireless transmission of electrical energy over long distances.",
        "Resonant transformer oscillator for high frequency alternating currents.",
        "Elevated terminal capacitance for atmospheric electrical discharge.",
    ],
    "latk_mini": [
        "Saussure structural linguistics differential value arbitrary sign.",
        "Newton's calculus of fluxions and infinite series.",
        "Zenneck surface wave wireless power Tesla lineage.",
    ],
    "physics": [
        "Heisenberg uncertainty principle position momentum quantum mechanics.",
        "Einstein general relativity spacetime curvature metric tensor.",
        "Dirac relativistic wave equation fermions spinor antiparticles.",
    ],
}


def post_json(url: str, body: Dict[str, Any], timeout: float = 30.0) -> Tuple[int, float, Dict[str, Any]]:
    """POST JSON, return (status, elapsed_seconds, body_dict_or_empty)."""
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = resp.read()
            elapsed = time.monotonic() - t0
            try:
                body_out = json.loads(payload.decode("utf-8"))
            except json.JSONDecodeError:
                body_out = {}
            return resp.status, elapsed, body_out
    except urllib.error.HTTPError as e:
        return e.code, time.monotonic() - t0, {}
    except Exception as e:
        return -1, time.monotonic() - t0, {"error": str(e)}


def cold_and_warm(base_url: str, lattice_id: str, probes: List[str], top_k: int = 20) -> Dict[str, Any]:
    """Hit /novelty once (cold), then n-1 more times (warm), report stats."""
    url = f"{base_url}/api/v1/latk/novelty"
    # Rotate through the probe set so warm queries are not identical
    # (forces a real cache-miss on each query even though the lattice is loaded)
    n_warm = 30
    results: List[Tuple[int, float]] = []
    for i in range(n_warm + 1):
        probe = probes[i % len(probes)]
        status, elapsed, _ = post_json(
            url,
            {"query": probe, "lattice_id": lattice_id, "top_k": top_k, "method": "combined"},
            timeout=60,
        )
        results.append((status, elapsed))

    cold = results[0]
    warm = results[1:]
    warm_times = [e for (s, e) in warm if s == 200]
    warm_errors = sum(1 for (s, _) in warm if s != 200)
    cold_status, cold_time = cold

    def pct(vals: List[float], p: float) -> float:
        if not vals:
            return float("nan")
        sv = sorted(vals)
        idx = min(len(sv) - 1, int(p / 100.0 * len(sv)))
        return sv[idx]

    return {
        "lattice_id": lattice_id,
        "cold_status": cold_status,
        "cold_seconds": round(cold_time, 4),
        "warm_requests": len(warm),
        "warm_200_count": len(warm_times),
        "warm_errors": warm_errors,
        "warm_mean_seconds": round(statistics.mean(warm_times), 4) if warm_times else None,
        "warm_p50_seconds": round(pct(warm_times, 50), 4) if warm_times else None,
        "warm_p95_seconds": round(pct(warm_times, 95), 4) if warm_times else None,
        "warm_p99_seconds": round(pct(warm_times, 99), 4) if warm_times else None,
        "warm_min_seconds": round(min(warm_times), 4) if warm_times else None,
        "warm_max_seconds": round(max(warm_times), 4) if warm_times else None,
    }


def stress_concurrent(base_url: str, lattice_id: str, probes: List[str], n_parallel: int = 50) -> Dict[str, Any]:
    """Fire n_parallel /novelty requests simultaneously and report stats."""
    url = f"{base_url}/api/v1/latk/novelty"

    def fire(i: int) -> Tuple[int, float]:
        probe = probes[i % len(probes)]
        return post_json(
            url,
            {"query": probe, "lattice_id": lattice_id, "top_k": 10, "method": "combined"},
            timeout=60,
        )[:2]

    t_start = time.monotonic()
    results: List[Tuple[int, float]] = []
    with ThreadPoolExecutor(max_workers=n_parallel) as ex:
        futures = [ex.submit(fire, i) for i in range(n_parallel)]
        for f in as_completed(futures):
            results.append(f.result())
    total_wall = time.monotonic() - t_start

    successes = [e for (s, e) in results if s == 200]
    errors = sum(1 for (s, _) in results if s != 200)

    def pct(vals: List[float], p: float) -> float:
        if not vals:
            return float("nan")
        sv = sorted(vals)
        idx = min(len(sv) - 1, int(p / 100.0 * len(sv)))
        return sv[idx]

    return {
        "lattice_id": lattice_id,
        "n_parallel": n_parallel,
        "wall_clock_seconds": round(total_wall, 3),
        "throughput_req_per_sec": round(n_parallel / max(total_wall, 1e-3), 2),
        "success_count": len(successes),
        "error_count": errors,
        "mean_seconds": round(statistics.mean(successes), 4) if successes else None,
        "p50_seconds": round(pct(successes, 50), 4) if successes else None,
        "p95_seconds": round(pct(successes, 95), 4) if successes else None,
        "p99_seconds": round(pct(successes, 99), 4) if successes else None,
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--base-url", default="http://32.192.140.145")
    p.add_argument("--output", type=Path, default=CEA_DIR / "output" / "latency_profile_report.json")
    p.add_argument("--skip-stress", action="store_true")
    args = p.parse_args()

    print("=" * 72)
    print(f"LATK API latency profile vs {args.base_url}")
    print("=" * 72)

    # Health probe
    hurl = f"{args.base_url}/api/v1/latk/health"
    try:
        req = urllib.request.Request(hurl)
        with urllib.request.urlopen(req, timeout=10) as r:
            hbody = json.loads(r.read().decode("utf-8"))
            print(f"  /health status: {r.status} lattices={hbody.get('known_lattices')}")
    except Exception as e:
        print(f"  /health FAILED: {e}", file=sys.stderr)
        sys.exit(1)
    print()

    report: Dict[str, Any] = {
        "base_url": args.base_url,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "cold_warm": [],
        "stress": [],
    }

    # 1. Cold + warm per lattice
    print("=== cold + warm per lattice (1 cold + 30 warm each, sequential) ===")
    for lid, probes in PROBES.items():
        row = cold_and_warm(args.base_url, lid, probes)
        report["cold_warm"].append(row)
        print(
            f"  {row['lattice_id']:<16} "
            f"cold={row['cold_seconds']:6.3f}s  "
            f"warm p50={row['warm_p50_seconds']:6.4f}  "
            f"p95={row['warm_p95_seconds']:6.4f}  "
            f"p99={row['warm_p99_seconds']:6.4f}  "
            f"errors={row['warm_errors']}"
        )

    # 2. Concurrent stress — physics (largest) + latk_mini (merged)
    if not args.skip_stress:
        print("\n=== concurrent stress: 50 parallel requests per lattice ===")
        for lid in ["physics", "latk_mini", "heterogeneous"]:
            row = stress_concurrent(args.base_url, lid, PROBES[lid], n_parallel=50)
            report["stress"].append(row)
            print(
                f"  {row['lattice_id']:<16} "
                f"wall={row['wall_clock_seconds']:6.2f}s  "
                f"throughput={row['throughput_req_per_sec']:6.2f}rps  "
                f"p95={row['p95_seconds']:6.4f}  "
                f"errors={row['error_count']}/{row['n_parallel']}"
            )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as fp:
        json.dump(report, fp, indent=2)
    print(f"\nReport saved: {args.output}")


if __name__ == "__main__":
    main()
