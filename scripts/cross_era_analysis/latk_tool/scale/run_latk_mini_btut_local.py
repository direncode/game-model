"""Local BTUT runner for LATK-mini scaling test (Phase 1 v2 re-run).

Runs the BTUT pipeline on the latk-mini corpus without requiring the
production Docker environment. Used to regenerate the latk-mini lattice
after pipeline.py was patched to persist embed_context + embeddings_8d
(the v2 query context required by the Phase 1 novelty query).

Writes ``output/latk_mini_btut_result_v2.json`` (not overwriting the
Phase 0 v1 file).

Usage::

    cd /path/to/lsx-latentocean
    PYTHONPATH=backend python scripts/cross_era_analysis/latk_tool/scale/run_latk_mini_btut_local.py
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

# Ensure the backend package is importable when running from repo root.
REPO_ROOT = Path(__file__).resolve().parents[4]
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.btut.pipeline import run_btut_pipeline  # noqa: E402


CORPUS_PATH = (
    REPO_ROOT / "scripts" / "cross_era_analysis" / "output" / "latk_mini_corpus.json"
)
OUTPUT_PATH = (
    REPO_ROOT / "scripts" / "cross_era_analysis" / "output" / "latk_mini_btut_result_v2.json"
)
TARGET_SURVIVORS = 1500


def main() -> None:
    if not CORPUS_PATH.exists():
        print(f"ERROR: corpus not found at {CORPUS_PATH}", file=sys.stderr)
        sys.exit(1)

    with CORPUS_PATH.open("r", encoding="utf-8") as fp:
        data = json.load(fp)

    entities = data["entities"]
    edges = data.get("relationships", data.get("edges", []))
    unique_types = sorted({e.get("type", "unknown") for e in entities})

    print(f"LATK-mini corpus loaded from {CORPUS_PATH}")
    print(f"  entities: {len(entities)}")
    print(f"  edges   : {len(edges)}")
    print(f"  types   : {unique_types}")
    print()

    t0 = time.time()

    def progress(msg: str) -> None:
        print(f"  [{time.time() - t0:6.1f}s] {msg}")

    print(f"Running BTUT pipeline (target_survivors={TARGET_SURVIVORS})...")
    result = run_btut_pipeline(
        entities=entities,
        edges=edges,
        unique_types=unique_types,
        target_survivors=TARGET_SURVIVORS,
        progress_callback=progress,
    )

    elapsed = time.time() - t0
    print()
    print(f"BTUT complete in {elapsed:.1f}s")

    summary = result.get("summary", {})
    survivors = result.get("survivors", [])
    embed_context = result.get("embed_context", {})
    embeddings_8d = result.get("embeddings_8d", [])

    print(f"  survivors       : {len(survivors)}")
    print(f"  embed_context   : {bool(embed_context)} (keys={list(embed_context.keys()) if embed_context else []})")
    print(f"  embeddings_8d   : {len(embeddings_8d)} floats ({len(embeddings_8d) // 8 if embeddings_8d else 0} survivors x 8D)")
    print(f"  summary         : {summary}")

    with OUTPUT_PATH.open("w", encoding="utf-8") as fp:
        json.dump(result, fp, default=str)
    print(f"  saved to: {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
