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

This file contains both quality metrics, the count of links found by
each signal, and the top-K strongest links. It is the single artifact
needed to make the "one spine, any domain" pitch.
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
        compute_3d_display=False,  # not needed for linking
        log_callback=log,
    )
    layer.ingest(source, limit=limit)
    layer.apply_btut_tuner()
    layer.project_to_manifold()
    return layer


def main() -> int:
    out_dir = REPO_ROOT / "scripts" / "exports" / "cross_source"
    out_dir.mkdir(parents=True, exist_ok=True)
    date_tag = time.strftime("%Y%m%d")

    def log(msg: str) -> None:
        print(msg, flush=True)

    print("[demo] Cross-source Latent Ocean Data Layer demo")
    print("[demo] Running EDGAR + PubMed through the same spine")

    # EDGAR: 500 entities, 100 survivors. Fast path.
    print("\n[demo] === EDGAR ===")
    layer_edgar = _run_one("edgar", limit=500, target=100, log=log)

    # PubMed: 500 entities, 100 survivors. Rate-limited at 3 req/sec,
    # so this dominates wall time. Acceptable for a demo.
    print("\n[demo] === PubMed ===")
    layer_pubmed = _run_one("pubmed", limit=500, target=100, log=log)

    # Four-signal causal link across the two latent spaces.
    print("\n[demo] === Causal linking ===")
    links = layer_edgar.link_causally(layer_pubmed, threshold=0.75)

    by_signal: dict[str, int] = {}
    for lk in links:
        by_signal[lk.signal] = by_signal.get(lk.signal, 0) + 1

    # Top-20 strongest links for the payload.
    top = sorted(links, key=lambda x: -x.strength)[:20]

    q_e = layer_edgar.get_quality_metrics()
    q_p = layer_pubmed.get_quality_metrics()
    payload = {
        "demo": "cross_source",
        "sources": ["edgar", "pubmed"],
        "quality_edgar": {
            "n_input": q_e.n_input,
            "n_survivors": q_e.n_survivors,
            "reduction_ratio": q_e.reduction_ratio,
            "variance_preservation": q_e.variance_preservation,
            "wall_seconds": q_e.wall_seconds,
        },
        "quality_pubmed": {
            "n_input": q_p.n_input,
            "n_survivors": q_p.n_survivors,
            "reduction_ratio": q_p.reduction_ratio,
            "variance_preservation": q_p.variance_preservation,
            "wall_seconds": q_p.wall_seconds,
        },
        "n_links_total": len(links),
        "links_by_signal": by_signal,
        "top_20_links": [
            {
                "source_a": lk.source_a,
                "source_b": lk.source_b,
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
    print(f"  EDGAR : {q_e.n_input} -> {q_e.n_survivors} survivors ({q_e.reduction_ratio}x)")
    print(f"  PubMed: {q_p.n_input} -> {q_p.n_survivors} survivors ({q_p.reduction_ratio}x)")
    print(f"  Links total: {len(links)}")
    for sig, count in sorted(by_signal.items()):
        print(f"    {sig:<16s}: {count}")
    print(f"  Payload: {out_path}")
    print("[demo] Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
