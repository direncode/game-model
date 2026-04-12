#!/usr/bin/env python
"""End-to-end demo: LatentOceanDataLayer on real SEC EDGAR data.

Exercises the full facade — ingest → BTUT → manifold → export to all
three verticals — on live EDGAR. Uses a small ``limit`` so it finishes
in a few minutes and stays polite to EDGAR's 10 req/sec rate limit.

Run from repo root:

    python scripts/demo_data_layer_edgar.py

Writes JSON payloads to ``scripts/exports/{niv,tcd_jepa,data}/edgar_*.json``.
These are aspirational outputs for downstream verticals — ``data`` is
the full audit payload, ``niv`` is the finance-vertical handoff, and
``tcd_jepa`` is the AI-vertical handoff.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

# Allow running from repo root: add backend/ to sys.path so
# ``app.services.data_layer`` resolves without an editable install.
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.services.data_layer import LatentOceanDataLayer  # noqa: E402


def main() -> int:
    out_root = REPO_ROOT / "scripts" / "exports"
    out_root.mkdir(parents=True, exist_ok=True)
    date_tag = time.strftime("%Y%m%d")

    print("[demo] LatentOceanDataLayer EDGAR demo")
    print(f"[demo] Output root: {out_root}")

    def _log(msg: str) -> None:
        print(msg, flush=True)

    layer = LatentOceanDataLayer(
        budget_dollars=5.0,
        target_survivors=100,
        compute_3d_display=True,
        log_callback=_log,
    )

    # Small limit keeps the demo fast and polite to EDGAR.
    layer.ingest("edgar", limit=500)
    layer.apply_btut_tuner()
    layer.project_to_manifold()

    for vertical in ("niv", "tcd_jepa", "data"):
        path = out_root / vertical / f"edgar_{date_tag}.json"
        layer.export_for_vertical(vertical, write_path=path)

    q = layer.get_quality_metrics()
    # Plain ASCII only — Windows cp1252 consoles choke on box-drawing chars.
    print("")
    print("[demo] --- Quality Metrics (honest) ------------------")
    print(f"  n_input                   : {q.n_input}")
    print(f"  n_survivors               : {q.n_survivors}")
    print(f"  reduction_ratio           : {q.reduction_ratio}x")
    print(f"  variance_ratio            : {q.variance_ratio:.3f}")
    print(f"  coverage_at_1_0           : {q.coverage_at_1_0:.3f}")
    print(f"  reconstruction_median_nn  : {q.reconstruction_median_nn:.3f}")
    print(f"  n_clusters                : {q.n_clusters}")
    print(f"  unique_fingerprints       : {q.unique_fingerprints}")
    print(f"  wall_seconds              : {q.wall_seconds:.1f}")
    print("")
    print("[demo] --- Cost Breakdown (real model) ---------------")
    for k, v in q.cost_breakdown.items():
        print(f"  {k:<26s}: ${v:.6f}")
    print("")
    print("[demo] --- Top 5 survivors by composite score --------")
    top = sorted(layer.get_survivors(), key=lambda s: -s.scores.get("composite", 0))[:5]
    for s in top:
        print(f"  [{s.scores.get('composite', 0):.3f}] {s.display_name} ({s.entity['type']})")
    print("[demo] Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
