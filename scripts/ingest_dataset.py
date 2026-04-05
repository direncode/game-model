#!/usr/bin/env python3
"""Unified BTUT ingestion — fetch any dataset and run the full pipeline.

Usage:
    python -u scripts/ingest_dataset.py --dataset pubmed --limit 5000
    python -u scripts/ingest_dataset.py --dataset patents --limit 10000
    python -u scripts/ingest_dataset.py --dataset comtrade
    python -u scripts/ingest_dataset.py --dataset climate --limit 5000
    python -u scripts/ingest_dataset.py --dataset edgar --limit 10000
"""

import argparse
import json
import os
import sys
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, os.path.join(ROOT_DIR, "backend"))
os.chdir(ROOT_DIR)

RESULTS_DIR = os.path.join(SCRIPT_DIR, "results")


def main():
    parser = argparse.ArgumentParser(description="BTUT Dataset Ingestion")
    parser.add_argument("--dataset", required=True, help="Dataset ID: edgar, pubmed, patents, comtrade, climate")
    parser.add_argument("--limit", type=int, default=10000, help="Max entities to fetch")
    parser.add_argument("--target-survivors", type=int, default=300, help="Target survivor count")
    parser.add_argument("--budget", type=float, default=50.0, help="GPU budget ($)")
    args = parser.parse_args()

    print("=" * 70)
    print(f"  BTUT INGESTION: {args.dataset.upper()}")
    print(f"  Limit: {args.limit:,} | Target: {args.target_survivors} survivors | Budget: ${args.budget}")
    print("=" * 70)

    # Load adapter
    from app.services.btut.adapters import get_adapter
    adapter = get_adapter(args.dataset)
    meta = adapter.get_meta()
    print(f"\nDataset: {meta.display_name}")
    print(f"Description: {meta.description}")
    print(f"Entity types: {[t.name for t in meta.entity_types]}")

    # Fetch entities
    print(f"\nFetching entities (limit={args.limit})...")
    t0 = time.time()
    entities = adapter.fetch_entities(limit=args.limit)
    fetch_time = time.time() - t0
    print(f"  Fetched {len(entities)} entities in {fetch_time:.1f}s")

    # Type distribution
    type_counts = {}
    for e in entities:
        t = e["type"]
        type_counts[t] = type_counts.get(t, 0) + 1
    for t, c in sorted(type_counts.items()):
        print(f"    {t}: {c:,}")

    # Fetch edges
    print(f"\nFetching edges...")
    t0 = time.time()
    edges = adapter.fetch_edges(entities)
    edge_time = time.time() - t0
    print(f"  Fetched {len(edges)} edges in {edge_time:.1f}s")

    if len(entities) < 10:
        print("ERROR: Not enough entities fetched. Check API access.")
        return

    # Run BTUT pipeline
    print(f"\n{'=' * 70}")
    print(f"  RUNNING BTUT PIPELINE")
    print(f"{'=' * 70}")

    from app.services.btut.pipeline import run_btut_pipeline

    unique_types = [t.name for t in meta.entity_types]

    result = run_btut_pipeline(
        entities=entities,
        edges=edges,
        unique_types=unique_types,
        target_survivors=args.target_survivors,
        budget_dollars=args.budget,
        progress_callback=lambda msg: print(f"  {msg}"),
    )

    # Save result
    os.makedirs(RESULTS_DIR, exist_ok=True)
    output_path = os.path.join(RESULTS_DIR, f"{args.dataset}_superpower_result.json")
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nSaved to: {output_path}")

    # Also save to the scripts/ root for backward compat with edgar
    if args.dataset == "edgar":
        compat_path = os.path.join(SCRIPT_DIR, "edgar_superpower_result.json")
        with open(compat_path, "w") as f:
            json.dump(result, f, indent=2)

    # Summary
    s = result["summary"]
    print(f"\n{'=' * 70}")
    print(f"  RESULTS: {meta.display_name}")
    print(f"{'=' * 70}")
    print(f"  Entities:     {s['total_entities']:,}")
    print(f"  Clusters:     {s['clusters']}")
    print(f"  Fingerprints: {s['unique_48bit_fingerprints']}")
    print(f"  Survivors:    {s['survivors']} ({s['reduction']}x reduction)")
    print(f"  Types:        {s['survivor_types']}")
    print(f"  Variance:     {s['reconstruction']['variance_preservation']*100:.1f}%")
    print(f"  Coverage d<1: {s['reconstruction']['coverages'].get('1.0', 0)*100:.1f}%")
    print(f"  Wall time:    {s['wall_seconds']:.1f}s")
    print(f"  Fetch time:   {fetch_time + edge_time:.1f}s")

    # Top 10 survivors
    print(f"\n  Top 10 Survivors:")
    sorted_survs = sorted(result["survivors"], key=lambda x: -x["scores"]["composite"])
    for i, sv in enumerate(sorted_survs[:10]):
        ent = sv["entity"]
        attrs = ent.get("attributes", "{}")
        if isinstance(attrs, str):
            try:
                attrs = json.loads(attrs)
            except (json.JSONDecodeError, TypeError):
                attrs = {}
        name = attrs.get(meta.entity_types[0].primary_field, "") or ent.get("name", "")
        lookup = attrs.get(meta.lookup_field, "")
        print(f"    {i+1:>2}. [{lookup or '-':<10}] {name[:40]:<40} score={sv['scores']['composite']:.4f} anom={sv['scores']['anomaly']:.3f}")

    print(f"\n{'=' * 70}")
    print(f"  DONE: {meta.display_name}")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
