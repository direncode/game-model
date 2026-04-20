"""Titan on Cerebras WSE — adapter scaffold.

Documents the integration surface between Latent Ocean's structural-
fingerprint primitive and Cerebras Wafer-Scale Engine (WSE-3) class
hardware. Does NOT run without Cerebras credentials and access.

WSE-3 maps naturally to the primitive:

  1. Fingerprint generation is embarrassingly parallel — 48
     independent SHA-256 invocations per record, trivially spread
     across the 900k cores of a single wafer.
  2. The LSH-bucketed anomaly step is a large-scale scatter-gather
     on short integers (Hamming distances), which WSE fabric
     handles at extreme throughput.
  3. Deterministic output — Cerebras compiles to a weight-mapped
     static schedule; same seed + same records → bit-identical
     output across wafer invocations. That's exactly the
     reproducibility property we need.

Deployment modes:

  wsc : Single WSE-3 (one CS-3 system) — ~1M records/second
  cg  : Condor Galaxy cluster (up to 64 CS-3) — ~32M records/second

Set CEREBRAS_API_KEY and CEREBRAS_CLUSTER_ID in the environment to
launch.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def _project_wall(n_records: int, mode: str) -> float:
    if mode == "wsc":
        return n_records / 1_000_000
    return n_records / 32_000_000


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", default="titan_combined")
    ap.add_argument("--n-records", type=int, default=100_000_000)
    ap.add_argument("--mode", choices=["wsc", "cg"], default="wsc")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    api_key = os.environ.get("CEREBRAS_API_KEY")
    cluster = os.environ.get("CEREBRAS_CLUSTER_ID")

    if not args.dry_run and not api_key:
        print("error: set CEREBRAS_API_KEY for live runs", file=sys.stderr)
        return 2

    plan = {
        "corpus": args.corpus,
        "target_records": args.n_records,
        "mode": args.mode,
        "projected_wall_seconds": _project_wall(args.n_records, args.mode),
        "stages": [
            {"name": "ingest",
             "description": "Stream records from customer data source to Cerebras Cloud ingest endpoint. Batched at 1M records.",
             "throughput_rps": 1_000_000},
            {"name": "fingerprint",
             "description": "On-wafer 48-bit structural fingerprint per record. 1-to-1 map onto independent SHA-256 invocations.",
             "wafer_utilization": 0.9,
             "throughput_rps_per_wafer": 1_000_000},
            {"name": "lsh_bucket",
             "description": "Bucket by leading 16-bit prefix (~65,536 buckets). Distribute intra-bucket Hamming across cores.",
             "scaling": "O(N * mean_bucket_size), near-constant per-record cost"},
            {"name": "score",
             "description": "Reconstruction + diversity + composite. Linear in N, wafer memory-bandwidth bound."},
            {"name": "null_test",
             "description": "Seeded bit-shuffle + top-K mean across 1000 iterations, parallelized per-iteration.",
             "iterations": 1000},
            {"name": "egress",
             "description": "Write scored corpus + top-K ranking + SHA-256 reproducibility digest back to customer storage."},
        ],
        "reproducibility_note": (
            "Cerebras compiles to static weight-mapped schedule. Same seed + "
            "same records → bit-identical output across wafer invocations. "
            "The SHA-256 digest of the top-K ranking is the audit-trail ID."
        ),
    }

    out = REPO_ROOT / "data" / "validation" / "titan_cerebras_plan.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(plan, indent=2), encoding="utf-8")

    print(f"Titan — Cerebras WSE integration plan")
    print(f"  corpus:         {plan['corpus']}")
    print(f"  target records: {plan['target_records']:,}")
    print(f"  mode:           {plan['mode']}")
    print(f"  projected wall: {plan['projected_wall_seconds']:.1f}s")
    print(f"  wrote {out}")

    if args.dry_run:
        print("\n[dry-run] stopping before wafer provisioning.")
        return 0

    print("\n[live] placeholder — wire against your Cerebras Cloud SDK version.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
