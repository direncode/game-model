"""Direct invocation of run_btut_pipeline on the cross-era corpus.

Bypasses the adapter system by loading entities from JSON and calling the
BTUT pipeline directly. Saves results to the btut_runs table for analysis.

Run on production:
  cd /opt/latentocean
  docker compose exec -T worker python /app/scripts/run_standalone_btut.py
"""

import asyncio
import json
import os
import time
import uuid
from datetime import datetime
from pathlib import Path


async def main():
    print("=" * 80)
    print("STANDALONE BTUT RUN — Cross-Era Physics Regime Corpus")
    print("=" * 80)

    # Load the chunked corpus
    payload_path = Path("/app/scripts/fullcorpus_btut_input.json")
    if not payload_path.exists():
        # Try alternate location
        payload_path = Path("/tmp/fullcorpus_btut_input.json")
    if not payload_path.exists():
        print(f"ERROR: corpus file not found at /app/scripts or /tmp")
        return

    with open(payload_path, "r") as f:
        data = json.load(f)

    entities = data["entities"]
    edges = data["relationships"]
    print(f"Loaded {len(entities)} entities, {len(edges)} edges")

    # Run BTUT pipeline directly
    from app.services.btut.pipeline import run_btut_pipeline

    # Get unique entity types
    unique_types = list(set(e.get("type", "patent_chunk") for e in entities))
    print(f"Unique types: {unique_types}")

    print()
    print("Running BTUT pipeline...")
    t0 = time.time()

    def progress(msg):
        print(f"  [{time.time() - t0:6.1f}s] {msg}")

    try:
        result = run_btut_pipeline(
            entities=entities,
            edges=edges,
            unique_types=unique_types,
            target_survivors=500,
            progress_callback=progress,
        )
    except Exception as e:
        print(f"BTUT pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        return

    elapsed = time.time() - t0
    print()
    print(f"BTUT pipeline complete in {elapsed:.1f}s")
    print()

    # Inspect the result structure
    if isinstance(result, dict):
        print(f"Result keys: {list(result.keys())}")
        print(f"Survivor count: {len(result.get('survivors', []))}")
        if "summary" in result:
            print(f"Summary: {result['summary']}")
    else:
        print(f"Result type: {type(result).__name__}")

    # Save the result to disk
    out_path = Path("/tmp/standalone_btut_result.json")
    with open(out_path, "w") as f:
        # Need to serialize survivors carefully
        serializable = {
            "elapsed_seconds": elapsed,
            "entity_count": len(entities),
            "edge_count": len(edges),
            "result": result if isinstance(result, dict) else str(result),
        }
        try:
            json.dump(serializable, f, indent=2, default=str)
            print(f"Saved result to {out_path} ({out_path.stat().st_size / 1024:.1f} KB)")
        except Exception as e:
            print(f"Couldn't serialize result fully: {e}")
            # Save just the summary
            summary = {
                "elapsed_seconds": elapsed,
                "entity_count": len(entities),
                "result_type": type(result).__name__,
                "result_keys": list(result.keys()) if isinstance(result, dict) else None,
            }
            with open(out_path, "w") as f:
                json.dump(summary, f, indent=2)


if __name__ == "__main__":
    asyncio.run(main())
