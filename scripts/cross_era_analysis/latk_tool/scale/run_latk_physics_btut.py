"""Run the patched BTUT pipeline on the LATK physics corpus.

Produces ``latk_physics_btut_result_v2.json`` with embed_context +
embeddings_8d so the query server can immediately serve novelty queries
against the physics lattice.

Usage::

    PYTHONPATH=backend python \\
        scripts/cross_era_analysis/latk_tool/scale/run_latk_physics_btut.py \\
        --input scripts/cross_era_analysis/output/latk_physics_corpus.json \\
        --output scripts/cross_era_analysis/output/latk_physics_btut_result_v2.json \\
        --target-survivors 5000
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
BACKEND_DIR = REPO_ROOT / "backend"
CEA_DIR = REPO_ROOT / "scripts" / "cross_era_analysis"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.btut.pipeline import run_btut_pipeline  # noqa: E402


def run_physics_btut(
    input_path: Path,
    output_path: Path,
    target_survivors: int,
) -> dict:
    if not input_path.exists():
        raise FileNotFoundError(f"physics corpus not found: {input_path}")

    with input_path.open("r", encoding="utf-8") as fp:
        data = json.load(fp)

    entities = data["entities"]
    edges = data.get("relationships", data.get("edges", []))
    unique_types = sorted({e.get("type", "unknown") for e in entities})

    print(f"Physics corpus loaded: {input_path}")
    print(f"  entities: {len(entities)}")
    print(f"  edges   : {len(edges)}")
    print(f"  types   : {unique_types}")
    print()

    t0 = time.time()

    def progress(msg: str) -> None:
        print(f"  [{time.time() - t0:7.1f}s] {msg}")

    print(f"Running BTUT (target_survivors={target_survivors})...")
    result = run_btut_pipeline(
        entities=entities,
        edges=edges,
        unique_types=unique_types,
        target_survivors=target_survivors,
        progress_callback=progress,
    )

    elapsed = time.time() - t0
    print(f"\nBTUT complete in {elapsed:.1f}s")

    summary = result.get("summary", {})
    survivors = result.get("survivors", [])
    embed_context = result.get("embed_context", {})
    embeddings_8d = result.get("embeddings_8d", [])
    print(f"  survivors     : {len(survivors)}")
    print(f"  embed_context : {bool(embed_context)}")
    print(f"  embeddings_8d : {len(embeddings_8d)} floats ({len(embeddings_8d) // 8} survivors x 8D)")
    print(f"  summary       : {summary}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fp:
        json.dump(result, fp, default=str)
    print(f"  saved to      : {output_path} ({output_path.stat().st_size // 1024} KB)")

    return result


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--input",
        type=Path,
        default=CEA_DIR / "output" / "latk_physics_corpus.json",
    )
    p.add_argument(
        "--output",
        type=Path,
        default=CEA_DIR / "output" / "latk_physics_btut_result_v2.json",
    )
    p.add_argument("--target-survivors", type=int, default=5000)
    args = p.parse_args()
    run_physics_btut(
        input_path=args.input,
        output_path=args.output,
        target_survivors=args.target_survivors,
    )


if __name__ == "__main__":
    main()
