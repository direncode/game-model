#!/usr/bin/env python
"""End-to-end cross-source demo: EDGAR + PubMed + causal linking.

Demonstrates the domain-invariance claim of the Latent Ocean Data Layer:
the *same* pipeline (ingest -> BTUT -> manifold) runs over SEC EDGAR
(finance) and PubMed (biomedical research) without per-domain tuning,
and we can then link survivors across the two latent spaces via the
four-signal causal linker.

Run from repo root:

    python scripts/demo_data_layer_cross_source.py

Writes:
    scripts/exports/cross_source/edgar_pubmed_<date>.json

Contains quality metrics (variance_ratio + coverage_at_1_0 +
reconstruction_median_nn), per-signal link counts, and the top-20
strongest links using resolved display names (not raw adapter ids).
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.services.data_layer import LatentOceanDataLayer  # noqa: E402


def _run_one(source: str, limit: int, target: int, log) -> LatentOceanDataLayer:
    layer = LatentOceanDataLayer(
        budget_dollars=5.0,
        target_survivors=target,
        compute_3d_display=False,
        log_callback=log,
    )
    layer.ingest(source, limit=limit)
    layer.apply_btut_tuner()
    layer.project_to_manifold()
    return layer


def _q_to_dict(q) -> dict:
    return {
        "n_input": q.n_input,
        "n_survivors": q.n_survivors,
        "reduction_ratio": q.reduction_ratio,
        "variance_ratio": q.variance_ratio,
        "coverage_at_1_0": q.coverage_at_1_0,
        "reconstruction_median_nn": q.reconstruction_median_nn,
        "n_clusters": q.n_clusters,
        "unique_fingerprints": q.unique_fingerprints,
        "wall_seconds": q.wall_seconds,
        "estimated_cost_usd": q.estimated_cost_usd,
        "cost_breakdown": q.cost_breakdown,
    }


def _display_map(layer: LatentOceanDataLayer) -> dict[str, str]:
    """Build name -> display_name lookup for the survivors in a layer."""
    return {
        s.entity.get("name", ""): s.display_name
        for s in layer.get_survivors()
    }


def main() -> int:
    out_dir = REPO_ROOT / "scripts" / "exports" / "cross_source"
    out_dir.mkdir(parents=True, exist_ok=True)
    date_tag = time.strftime("%Y%m%d")

    def log(msg: str) -> None:
        print(msg, flush=True)

    print("[demo] Cross-source Latent Ocean Data Layer demo")
    print("[demo] Running EDGAR + PubMed through the same spine")

    print("\n[demo] === EDGAR ===")
    layer_edgar = _run_one("edgar", limit=500, target=100, log=log)

    print("\n[demo] === PubMed ===")
    layer_pubmed = _run_one("pubmed", limit=500, target=100, log=log)

    print("\n[demo] === Causal linking ===")
    links = layer_edgar.link_causally(layer_pubmed, threshold=0.75)

    by_signal: dict[str, int] = {}
    for lk in links:
        by_signal[lk.signal] = by_signal.get(lk.signal, 0) + 1

    display_e = _display_map(layer_edgar)
    display_p = _display_map(layer_pubmed)

    top = sorted(links, key=lambda x: -x.strength)[:20]
    q_e = layer_edgar.get_quality_metrics()
    q_p = layer_pubmed.get_quality_metrics()

    payload = {
        "demo": "cross_source",
        "sources": ["edgar", "pubmed"],
        "quality_edgar": _q_to_dict(q_e),
        "quality_pubmed": _q_to_dict(q_p),
        "n_links_total": len(links),
        "links_by_signal": by_signal,
        "top_20_links": [
            {
                "source_a_id": lk.source_a,
                "source_a_display": display_e.get(lk.source_a, lk.source_a),
                "source_b_id": lk.source_b,
                "source_b_display": display_p.get(lk.source_b, lk.source_b),
                "signal": lk.signal,
                "strength": round(lk.strength, 4),
            }
            for lk in top
        ],
    }

    out_path = out_dir / f"edgar_pubmed_{date_tag}.json"
    out_path.write_text(
        json.dumps(payload, indent=2, default=str), encoding="utf-8"
    )

    print("")
    print("[demo] --- Cross-source Results ----------------------")
    print(
        f"  EDGAR : {q_e.n_input} -> {q_e.n_survivors} survivors "
        f"({q_e.reduction_ratio}x, cov@1.0={q_e.coverage_at_1_0:.3f})"
    )
    print(
        f"  PubMed: {q_p.n_input} -> {q_p.n_survivors} survivors "
        f"({q_p.reduction_ratio}x, cov@1.0={q_p.coverage_at_1_0:.3f})"
    )
    print(f"  Links total: {len(links)}")
    for sig, count in sorted(by_signal.items()):
        print(f"    {sig:<16s}: {count}")
    print("")
    print("[demo] --- Top 5 strongest links (display names) ---")
    for lk in top[:5]:
        sa = display_e.get(lk.source_a, lk.source_a)[:45]
        sb = display_p.get(lk.source_b, lk.source_b)[:45]
        print(f"  [{lk.strength:.3f}] [{lk.signal:<13s}] {sa:<45} <-> {sb}")
    print(f"\n[demo] Total cost (both sides): "
          f"${q_e.estimated_cost_usd + q_p.estimated_cost_usd:.6f}")
    print(f"[demo] Payload: {out_path}")
    print("[demo] Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
