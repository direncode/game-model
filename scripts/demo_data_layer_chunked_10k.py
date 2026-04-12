#!/usr/bin/env python
"""Scale test: 10,000 EDGAR entities via two-pass chunked cascade.

Demonstrates run_chunked() at a scale where the single-pass pipeline
starts to strain memory. Uses chunk_size=2500 so memory footprint in
the embedding phase is O(2500) rather than O(10000).

Run from repo root:

    python scripts/demo_data_layer_chunked_10k.py

Expect ~20-30s total wall time (most of it in the BTUT cascade).
Writes outputs to scripts/exports/scale_test/.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.services.data_layer import LatentOceanDataLayer  # noqa: E402


def main() -> int:
    out_dir = REPO_ROOT / "scripts" / "exports" / "scale_test"
    out_dir.mkdir(parents=True, exist_ok=True)
    date_tag = time.strftime("%Y%m%d")

    print("[demo] 10k Chunked Scale Test --- EDGAR limit=10000, chunk_size=2500")

    def log(msg: str) -> None:
        print(msg, flush=True)

    layer = LatentOceanDataLayer(
        budget_dollars=5.0,
        target_survivors=500,
        compute_3d_display=True,
        log_callback=log,
    )

    t0 = time.time()
    result = layer.run_chunked(
        source="edgar",
        limit=10_000,
        chunk_size=2500,
        vertical="data",
        write_path=out_dir / f"chunked_10k_edgar_{date_tag}.json",
    )
    total_wall = time.time() - t0

    q = layer.get_quality_metrics()
    survs = layer.get_survivors()

    print("")
    print("[demo] --- 10k Chunked Results ----------------------")
    print(f"  Total wall time       : {total_wall:.1f}s")
    print(f"  Input entities        : {q.n_input}")
    print(f"  Survivors             : {q.n_survivors}")
    print(f"  Reduction ratio       : {q.reduction_ratio}x")
    print(f"  Variance ratio        : {q.variance_ratio:.3f}")
    print(f"  Coverage @ d<=1.0     : {q.coverage_at_1_0:.3f}")
    print(f"  Reconstruction med nn : {q.reconstruction_median_nn:.3f}")
    print(f"  Clusters              : {q.n_clusters}")
    print(f"  Unique fingerprints   : {q.unique_fingerprints}")
    print(f"  BTUT wall time        : {q.wall_seconds:.1f}s")
    if "n_chunks" in result:
        print(f"  Chunks                : {result['n_chunks']} x {result['chunk_size']}")
    print("")
    print("[demo] --- Cost Breakdown --------------------------")
    for k, v in q.cost_breakdown.items():
        print(f"  {k:<26s}: ${v:.6f}")
    print("")
    print("[demo] --- Top 10 survivors by composite score ------")
    for s in sorted(survs, key=lambda x: -x.scores.get("composite", 0))[:10]:
        print(f"  [{s.scores.get('composite', 0):.3f}] {s.display_name} ({s.entity['type']})")
    print("[demo] Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
