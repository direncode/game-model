"""Re-run BTUT on the full 61k-entity EDGAR cache with tuned parameters.

The cached v2 result was tuned for diversity (499 survivors, 724 clusters
-> avg 0.7 survivors/cluster -> most clusters untestable). Re-run with
target=2000 survivors so cluster-homogeneity is statistically testable.

Writes a fresh BTUT result + re-runs the 4 ground-truth tests on it.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

for _k in ("FRED_API_KEY", "NIV_VINTAGE", "NIV_BTUT_THINNING", "NIV_CRYSTALLIZATION",
          "fred_api_key", "niv_vintage", "niv_btut_thinning", "niv_crystallization"):
    os.environ.pop(_k, None)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("edgar_rerun_btut")


def main() -> int:
    from app.services.btut.pipeline import run_btut_pipeline

    cache_path = REPO_ROOT / "scripts" / "edgar_cache.json"
    log.info("Loading raw cache (%s)...", cache_path)
    raw = json.loads(cache_path.read_text(encoding="utf-8"))
    entities = raw.get("entities") or []
    edges = raw.get("edges") or []
    log.info("Loaded %d entities, %d edges", len(entities), len(edges))

    unique_types = sorted({e.get("type") for e in entities if e.get("type")})
    log.info("Unique types: %s", unique_types)

    t0 = time.time()
    log.info("Running BTUT pipeline (target=2000, res=[8,16,32])...")
    result = run_btut_pipeline(
        entities=entities,
        edges=edges,
        unique_types=unique_types,
        target_survivors=2000,
        budget_dollars=5.0,
        resolutions=[8, 16, 32],
        n_rotations=8,
    )
    wall = time.time() - t0
    log.info("BTUT complete in %.1fs: %d survivors, %d clusters",
             wall,
             len(result.get("survivors") or []),
             (result.get("summary") or {}).get("clusters"))

    out_path = REPO_ROOT / "scripts" / "edgar_btut_result_2000.json"
    out_path.write_text(
        json.dumps(result, indent=2, sort_keys=True, default=str),
        encoding="utf-8",
    )
    log.info("Saved to %s", out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
