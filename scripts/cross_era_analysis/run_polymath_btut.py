"""Run standalone BTUT pipeline on the polymath corpus."""

import json
import time
import sys

sys.path.insert(0, "/app")

from app.services.btut.pipeline import run_btut_pipeline


def main():
    with open("/app/scripts/polymath_corpus.json", "r") as f:
        data = json.load(f)

    entities = data["entities"]
    edges = data["relationships"]
    unique_types = list(set(e.get("type", "unknown") for e in entities))
    print(f"Loaded {len(entities)} entities, {len(edges)} edges")
    print(f"Types: {unique_types}")
    print()

    t0 = time.time()

    def progress(msg):
        print(f"  [{time.time() - t0:6.1f}s] {msg}")

    print("Running BTUT pipeline on polymath corpus...")
    result = run_btut_pipeline(
        entities=entities,
        edges=edges,
        unique_types=unique_types,
        target_survivors=800,
        progress_callback=progress,
    )

    elapsed = time.time() - t0
    print()
    print(f"BTUT complete in {elapsed:.1f}s")

    survivors = result.get("survivors", [])
    summary = result.get("summary", {})
    print(f"Survivors: {len(survivors)}")
    print(f"Summary: {summary}")

    out_path = "/tmp/polymath_btut_result.json"
    with open(out_path, "w") as f:
        json.dump(result, f, default=str)
    print(f"Saved to {out_path}")


if __name__ == "__main__":
    main()
