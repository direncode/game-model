"""Run BTUT on the LATK-mini scaling test corpus.

Phase 0 scaling test: verifies that the Tesla medium-resolution
fingerprint signature replicates at 6000+ entity scale with multi-
domain heterogeneity (linguistics + polymath + wireless merged).

If the signature holds (medium-resolution unique fingerprint count <
coarse AND < fine), the architecture is proven to scale past the
single-domain regime, which is the precondition for Phase 1.

Run this script on the production server where the BTUT package
is available:

    scp scripts/cross_era_analysis/output/latk_mini_corpus.json <prod>:/tmp/
    scp scripts/cross_era_analysis/latk_tool/scale/run_latk_mini_btut.py <prod>:/tmp/
    ssh <prod> 'docker compose -f /app/docker-compose.yml exec -T backend \\
        bash -c "PYTHONPATH=/app python /tmp/run_latk_mini_btut.py"'
    scp <prod>:/tmp/latk_mini_btut_result.json scripts/cross_era_analysis/output/
"""

import json
import sys
import time

sys.path.insert(0, "/app")

from app.services.btut.pipeline import run_btut_pipeline


CORPUS_PATH = "/tmp/latk_mini_corpus.json"
OUTPUT_PATH = "/tmp/latk_mini_btut_result.json"
TARGET_SURVIVORS = 1500


def main() -> None:
    with open(CORPUS_PATH, "r", encoding="utf-8") as fp:
        data = json.load(fp)

    entities = data["entities"]
    edges = data.get("relationships", data.get("edges", []))
    unique_types = sorted({e.get("type", "unknown") for e in entities})

    print(f"LATK-mini corpus loaded:")
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
    print(f"  summary: {summary}")
    print(f"  n survivors: {len(survivors)}")

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fp:
        json.dump(result, fp, default=str)
    print(f"  saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
