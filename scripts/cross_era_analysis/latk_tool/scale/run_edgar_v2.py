"""Run the v2 BTUT pipeline on the cached SEC Edgar corpus.

Reads scripts/edgar_cache.json (61,151 entities: 39,098 filings +
22,053 financial facts) and crystallizes them via the patched
run_btut_pipeline with embed_context + embeddings_8d persistence.

Does NOT include the 10,426 company entities that appeared in the
Phase 0 edgar_superpower.py run because those required a live
network fetch to the SEC EDGAR ticker API. The v2 lattice still
covers the primary signal surface (filings + facts) which is what
the actual cross-filing and cross-era intelligence lives in.

Output: scripts/cross_era_analysis/output/edgar_btut_result_v2.json
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.btut.pipeline import run_btut_pipeline  # noqa: E402

CACHE_PATH = REPO_ROOT / "scripts" / "edgar_cache.json"
OUTPUT_PATH = REPO_ROOT / "scripts" / "cross_era_analysis" / "output" / "edgar_btut_result_v2.json"
TARGET_SURVIVORS = 500


def main() -> None:
    if not CACHE_PATH.exists():
        print(f"ERROR: cache not found at {CACHE_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading edgar cache from {CACHE_PATH}...")
    with CACHE_PATH.open("r", encoding="utf-8") as fp:
        cache = json.load(fp)

    entities = cache["entities"]
    edges = cache.get("edges", [])
    unique_types = sorted({e.get("type", "unknown") for e in entities})

    print(f"  entities: {len(entities)}")
    print(f"  edges   : {len(edges)}")
    print(f"  types   : {unique_types}")
    print()

    t0 = time.time()

    def progress(msg: str) -> None:
        print(f"  [{time.time() - t0:6.1f}s] {msg}")

    print(f"Running BTUT v2 (target_survivors={TARGET_SURVIVORS})...")
    result = run_btut_pipeline(
        entities=entities,
        edges=edges,
        unique_types=unique_types,
        target_survivors=TARGET_SURVIVORS,
        progress_callback=progress,
    )

    elapsed = time.time() - t0
    print(f"\nBTUT complete in {elapsed:.1f}s")

    summary = result.get("summary", {})
    survivors = result.get("survivors", [])
    embed_ctx = result.get("embed_context", {})
    emb_8d = result.get("embeddings_8d", [])
    print(f"  survivors     : {len(survivors)}")
    print(f"  embed_context : {bool(embed_ctx)} keys={list(embed_ctx.keys()) if embed_ctx else []}")
    print(f"  embeddings_8d : {len(emb_8d)} floats ({len(emb_8d) // 8} survivors x 8D)")
    print(f"  summary       : {summary}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as fp:
        json.dump(result, fp, default=str)
    print(f"  saved to: {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
