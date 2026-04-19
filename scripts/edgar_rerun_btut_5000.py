"""Run BTUT on full 61k-entity EDGAR with target=5000 — stability / robustness config."""
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
log = logging.getLogger("btut_5000")


def main() -> int:
    from app.services.btut.pipeline import run_btut_pipeline

    raw = json.loads((REPO_ROOT / "scripts" / "edgar_cache.json").read_text(encoding="utf-8"))
    entities = raw.get("entities") or []
    edges = raw.get("edges") or []
    types = sorted({e.get("type") for e in entities if e.get("type")})

    log.info("BTUT target=5000, res=[8,16,32,64], rotations=16 on %d entities...",
             len(entities))
    t0 = time.time()
    result = run_btut_pipeline(
        entities=entities,
        edges=edges,
        unique_types=types,
        target_survivors=5000,
        budget_dollars=10.0,
        resolutions=[8, 16, 32, 64],
        n_rotations=16,
    )
    log.info("Done in %.1fs: %d survivors, %d clusters", time.time() - t0,
             len(result.get("survivors") or []),
             (result.get("summary") or {}).get("clusters"))
    out = REPO_ROOT / "scripts" / "edgar_btut_result_5000.json"
    out.write_text(json.dumps(result, indent=2, sort_keys=True, default=str), encoding="utf-8")
    log.info("Saved %s", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
