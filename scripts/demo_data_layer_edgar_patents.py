#!/usr/bin/env python
"""Cross-source demo: EDGAR (finance) x Patents (IP).

This demo exercises the *non-cosine* linker signals on real data.
EDGAR companies have company_name attributes; Patents have assignee_name.
Both are in SEMANTIC_FIELDS, so link_by_semantic_field should fire
whenever an EDGAR company name matches a patent assignee name (case-
insensitive). This proves the linker actually works across domains.

Note: Patents adapter needs PATENTSVIEW_API_KEY env var for full pulls.
Without it, the API may return limited data or empty. The demo is
designed to handle that gracefully.

Run from repo root:

    python scripts/demo_data_layer_edgar_patents.py

Writes:
    scripts/exports/cross_source/edgar_patents_<date>.json
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


def main() -> int:
    out_dir = REPO_ROOT / "scripts" / "exports" / "cross_source"
    out_dir.mkdir(parents=True, exist_ok=True)
    date_tag = time.strftime("%Y%m%d")

    def log(msg: str) -> None:
        print(msg, flush=True)

    print("[demo] EDGAR x Patents cross-source demo")

    print("\n[demo] === EDGAR ===")
    layer_edgar = _run_one("edgar", limit=500, target=100, log=log)

    print("\n[demo] === Patents ===")
    try:
        layer_patents = _run_one("patents", limit=500, target=100, log=log)
    except Exception as e:
        print(f"[demo] Patents adapter failed: {e}")
        print("[demo] This is expected if PATENTSVIEW_API_KEY is not set.")
        print("[demo] Falling back to EDGAR-only demo (no cross-source links).")
        return 1

    print("\n[demo] === Causal linking ===")
    links = layer_edgar.link_causally(layer_patents, threshold=0.70)

    by_signal: dict[str, int] = {}
    for lk in links:
        by_signal[lk.signal] = by_signal.get(lk.signal, 0) + 1

    def _display(layer):
        return {s.entity.get("name", ""): s.display_name for s in layer.get_survivors()}

    display_e = _display(layer_edgar)
    display_p = _display(layer_patents)

    top = sorted(links, key=lambda x: -x.strength)[:20]

    payload = {
        "demo": "edgar_x_patents",
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

    out_path = out_dir / f"edgar_patents_{date_tag}.json"
    out_path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")

    print("")
    print("[demo] --- Results ----------------------")
    print(f"  Links total: {len(links)}")
    for sig, count in sorted(by_signal.items()):
        print(f"    {sig:<16s}: {count}")
    print("")
    print("[demo] --- Top 5 links (display names) ---")
    for lk in top[:5]:
        sa = display_e.get(lk.source_a, lk.source_a)[:40]
        sb = display_p.get(lk.source_b, lk.source_b)[:40]
        print(f"  [{lk.strength:.3f}] [{lk.signal:<14s}] {sa:<40} <-> {sb}")
    print(f"\n[demo] Payload: {out_path}")
    print("[demo] Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
