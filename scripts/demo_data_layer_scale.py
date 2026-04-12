#!/usr/bin/env python
"""Scale test: LatentOceanDataLayer on 5000 EDGAR companies.

Demonstrates the pipeline is not a toy. Reports honest quality metrics
(variance_ratio + coverage_at_1_0 + median_nn + cost_breakdown) so you
can plug real numbers into the investor deck.

Run from repo root:

    python scripts/demo_data_layer_scale.py

Writes outputs to scripts/exports/scale_test/. Rate-limited by EDGAR
at 10 req/sec; expect ~8–12 minutes wall time depending on how many
submissions/XBRL facts EDGAR returns per company.
"""
from __future__ import annotations

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

    print("[demo] LatentOceanDataLayer scale test — EDGAR limit=5000")
    print("[demo] Target survivors: 500")

    def log(msg: str) -> None:
        print(msg, flush=True)

    layer = LatentOceanDataLayer(
        budget_dollars=5.0,
        target_survivors=500,
        compute_3d_display=True,
        log_callback=log,
    )

    t0 = time.time()
    layer.ingest("edgar", limit=5000)
    layer.apply_btut_tuner()
    layer.project_to_manifold()

    # Write all three vertical exports so we get the real output bytes
    # reflected in the cost model.
    for vertical in ("niv", "tcd_jepa", "data"):
        path = out_dir / f"{vertical}_edgar_{date_tag}.json"
        layer.export_for_vertical(vertical, write_path=path)
    total_wall = time.time() - t0

    q = layer.get_quality_metrics()
    survs = layer.get_survivors()

    print("")
    print("[demo] --- Scale Test Results -----------------------")
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
    print("")
    print("[demo] --- Cost Breakdown (real model, not made-up) ---")
    for k, v in q.cost_breakdown.items():
        print(f"  {k:<16s}: ${v:.6f}")
    print("")
    print("[demo] --- Sample survivors (display_name) ---")
    for s in sorted(survs, key=lambda x: -x.scores.get("composite", 0))[:10]:
        print(f"  [{s.scores.get('composite', 0):.3f}] {s.display_name} ({s.entity['type']})")
    print("[demo] Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
