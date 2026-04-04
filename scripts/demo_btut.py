#!/usr/bin/env python3
"""BTUT Extreme Data Reduction Engine — Standalone Demo.

Generates synthetic data with 3 Gaussian clusters + noise, runs the full
8-tier BTUT pipeline, and prints comprehensive before/after statistics.

Usage:
    python scripts/demo_btut.py                    # Default: 10K entities
    python scripts/demo_btut.py --entities 100000  # 100K entities
    python scripts/demo_btut.py --entities 1000000 --budget 10  # 1M at $10
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time

import numpy as np

# Add backend to Python path
BACKEND_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend")
sys.path.insert(0, BACKEND_PATH)


def generate_synthetic_data(
    n_entities: int = 10_000,
    n_clusters: int = 3,
    noise_fraction: float = 0.15,
    seed: int = 42,
) -> tuple[list[dict], list[dict]]:
    """Generate synthetic entities with Gaussian cluster structure + noise.

    Returns (entities, edges) in Latent Ocean format.
    """
    rng = np.random.RandomState(seed)

    # Cluster centers in 5D attribute space
    centers = rng.randn(n_clusters, 5) * 3
    cluster_sizes = np.random.multinomial(
        int(n_entities * (1 - noise_fraction)),
        [1 / n_clusters] * n_clusters,
    )
    n_noise = n_entities - sum(cluster_sizes)

    entity_types = ["alpha", "beta", "gamma", "delta"]
    entities = []
    cluster_assignments = []

    # Generate cluster entities
    for cluster_idx, (center, size) in enumerate(zip(centers, cluster_sizes)):
        points = center + rng.randn(size, 5) * 0.5
        etype = entity_types[cluster_idx % len(entity_types)]

        for j in range(size):
            entities.append({
                "name": f"entity_c{cluster_idx}_{j}",
                "type": etype,
                "attributes": json.dumps({
                    "x1": round(float(points[j, 0]), 4),
                    "x2": round(float(points[j, 1]), 4),
                    "x3": round(float(points[j, 2]), 4),
                    "x4": round(float(points[j, 3]), 4),
                    "x5": round(float(points[j, 4]), 4),
                    "cluster": f"cluster_{cluster_idx}",
                    "signal_strength": round(float(rng.uniform(0.6, 1.0)), 3),
                }),
            })
            cluster_assignments.append(cluster_idx)

    # Generate noise entities (uniform random)
    for j in range(n_noise):
        point = rng.uniform(-10, 10, 5)
        entities.append({
            "name": f"entity_noise_{j}",
            "type": rng.choice(entity_types),
            "attributes": json.dumps({
                "x1": round(float(point[0]), 4),
                "x2": round(float(point[1]), 4),
                "x3": round(float(point[2]), 4),
                "x4": round(float(point[3]), 4),
                "x5": round(float(point[4]), 4),
                "cluster": "noise",
                "signal_strength": round(float(rng.uniform(0.0, 0.3)), 3),
            }),
        })
        cluster_assignments.append(-1)  # Noise

    # Generate edges (within-cluster edges are dense, cross-cluster are sparse)
    edges = []
    n = len(entities)
    # Within-cluster edges (high density)
    for i in range(min(n, 50_000)):
        for _ in range(rng.randint(1, 4)):
            j = rng.randint(0, n)
            if i != j and cluster_assignments[i] == cluster_assignments[j] and cluster_assignments[i] >= 0:
                edges.append({
                    "source": entities[i]["name"],
                    "target": entities[j]["name"],
                    "type": "correlates",
                    "weight": round(float(rng.uniform(0.5, 1.0)), 3),
                })

    # Add some cross-cluster edges (sparse)
    for _ in range(min(n // 20, 5000)):
        i, j = rng.randint(0, n, 2)
        if i != j:
            edges.append({
                "source": entities[i]["name"],
                "target": entities[j]["name"],
                "type": "weak_link",
                "weight": round(float(rng.uniform(0.1, 0.3)), 3),
            })

    return entities, edges


def print_separator(title: str = "", char: str = "-", width: int = 60):
    if title:
        padding = (width - len(title) - 2) // 2
        print(f"\n{char * padding} {title} {char * padding}")
    else:
        print(char * width)


async def main():
    parser = argparse.ArgumentParser(description="BTUT Demo")
    parser.add_argument("--entities", type=int, default=10_000, help="Number of entities")
    parser.add_argument("--clusters", type=int, default=3, help="Number of clusters")
    parser.add_argument("--noise", type=float, default=0.15, help="Noise fraction")
    parser.add_argument("--budget", type=float, default=50.0, help="GPU budget ($)")
    parser.add_argument("--device", type=str, default="auto", help="Device: auto/cuda/cpu")
    args = parser.parse_args()

    print_separator("BTUT Extreme Data Reduction Engine - Demo")
    print(f"Entities: {args.entities:,}")
    print(f"Clusters: {args.clusters}")
    print(f"Noise fraction: {args.noise:.0%}")
    print(f"Budget: ${args.budget:.2f}")

    # Generate data
    print_separator("Generating Synthetic Data")
    gen_start = time.perf_counter()
    entities, edges = generate_synthetic_data(
        n_entities=args.entities,
        n_clusters=args.clusters,
        noise_fraction=args.noise,
    )
    gen_time = time.perf_counter() - gen_start
    print(f"Generated {len(entities):,} entities, {len(edges):,} edges in {gen_time:.1f}s")

    # Count actual cluster distribution
    cluster_counts: dict[str, int] = {}
    for ent in entities:
        attrs = json.loads(ent.get("attributes", "{}"))
        c = attrs.get("cluster", "unknown")
        cluster_counts[c] = cluster_counts.get(c, 0) + 1
    print("Cluster distribution:")
    for c, count in sorted(cluster_counts.items()):
        print(f"  {c}: {count:,} ({count / len(entities) * 100:.1f}%)")

    # Run BTUT
    print_separator("Running BTUT Pipeline")
    from app.services.btut import BTUTTuner, BTUTConfig

    config = BTUTConfig.auto_scale(
        entity_count=len(entities),
        budget_dollars=args.budget,
        edge_count=len(edges),
    )
    config.device = args.device

    print(f"Auto-scaled config:")
    print(f"  Cascade levels: {len(config.cascade_levels)}")
    for i, level in enumerate(config.cascade_levels):
        print(f"    Level {i}: sigma={level.sigma}, thin={level.thinning_ratio}x, max_iter={level.max_iterations}")
    print(f"  Embedding dim: {config.embedding_dim}")
    print(f"  Dim schedule: {config.dim_schedule}")
    print(f"  PreFilter: {'ON' if config.prefilter_enabled else 'OFF'}")
    print(f"  Target reduction: {config.total_target_reduction():.0f}x")

    def progress(info):
        step = info.get("step", "")
        if step == "btut_prefilter_done":
            print(f"  PreFilter: {info.get('original', 0):,} -> {info.get('survivors', 0):,}")
        elif step == "btut_cascade" and info.get("level_complete") is not None:
            level = info["level_complete"]
            print(f"  Cascade level {level}: {info.get('input', 0):,} -> {info.get('output', 0):,} ({info.get('cumulative_reduction', 0):.0f}x cumulative)")
        elif step == "btut_complete":
            print(f"  DONE: {info.get('survivors', 0):,} survivors, {info.get('reduction', 0):.0f}x reduction, quality={info.get('quality', 0):.3f}")

    tuner = BTUTTuner(config)
    result = await tuner.tune(
        entities, edges, job_id="demo",
        progress_callback=progress,
    )

    # Print results
    print_separator("Results Summary")

    print(f"\n  Entity reduction:  {result.original_count:>10,} -> {result.survivor_count:>10,}  ({result.total_reduction_ratio:>8.1f}x)")
    print(f"  Edge reduction:    {result.original_edge_count:>10,} -> {result.survivor_edge_count:>10,}  ({result.edge_reduction_ratio:>8.1f}x)")

    print_separator("Pre-Filter (Tier 1)")
    pf = result.prefilter_stats
    print(f"  Entropy rejected:  {pf.entropy_rejected:,}")
    print(f"  Bloom dedup:       {pf.bloom_dedup_count:,}")
    print(f"  LSH near-dedup:    {pf.lsh_near_dedup_count:,}")
    print(f"  Survivors:         {pf.survivors:,} ({pf.reduction_ratio:.1f}x)")
    print(f"  Time:              {pf.elapsed_seconds:.2f}s")

    print_separator("Cascade (Tier 2)")
    for stats in result.cascade_stats:
        status = "converged" if stats.converged else f"max_iters ({stats.iterations_run})"
        print(f"  Level {stats.level} (sigma={stats.sigma:.2f}): {stats.input_count:,} -> {stats.output_count:,} ({stats.reduction_ratio:.1f}x) [{status}, gap={stats.final_nash_gap:.6f}] {stats.elapsed_seconds:.2f}s")

    print_separator("Quality (Tier 8)")
    q = result.quality_scores
    print(f"  Signal quality:        {q.signal_quality:.4f}")
    print(f"  Reconstruction error:  {q.reconstruction_error:.4f}  (target: < 0.15)")
    print(f"  Coverage:              {q.coverage:.4f}  (target: > 0.85)")
    print(f"  Cluster stability:     {q.cluster_stability:.4f}")
    print(f"  Downstream compat:     {q.downstream_compatibility:.4f}")
    print(f"  COMPOSITE:             {result.quality_score:.4f}")

    print_separator("Budget")
    print(f"  GPU seconds:   {result.gpu_seconds_used:.1f}s")
    print(f"  GPU cost:      ${result.gpu_cost_dollars:.4f}")
    print(f"  Budget left:   ${result.budget_remaining_dollars:.2f}")

    print_separator("Timing")
    print(f"  Pre-filter:    {result.prefilter_seconds:.2f}s")
    print(f"  Embedding:     {result.embedding_seconds:.2f}s")
    print(f"  Cascade:       {result.cascade_seconds:.2f}s")
    print(f"  Quality check: {result.quality_check_seconds:.2f}s")
    print(f"  TOTAL:         {result.wall_clock_seconds:.2f}s")

    print_separator("Survivor Cluster Distribution")
    surv_clusters: dict[str, int] = {}
    for ent in result.survivors:
        attrs = ent.get("attributes", "{}")
        if isinstance(attrs, str):
            attrs = json.loads(attrs)
        c = attrs.get("cluster", "unknown")
        surv_clusters[c] = surv_clusters.get(c, 0) + 1
    for c, count in sorted(surv_clusters.items()):
        original = cluster_counts.get(c, 0)
        retention = (count / original * 100) if original > 0 else 0
        print(f"  {c}: {count:,} / {original:,} ({retention:.1f}% retained)")

    noise_survivors = surv_clusters.get("noise", 0)
    noise_original = cluster_counts.get("noise", 0)
    signal_survivors = result.survivor_count - noise_survivors
    signal_original = result.original_count - noise_original
    print(f"\n  Signal retained:  {signal_survivors:,} / {signal_original:,} ({signal_survivors / max(signal_original, 1) * 100:.1f}%)")
    print(f"  Noise retained:   {noise_survivors:,} / {noise_original:,} ({noise_survivors / max(noise_original, 1) * 100:.1f}%)")

    print_separator("Training Log Entry (for CrystallizationJob)")
    log_entry = result.to_training_log_entry()
    print(json.dumps(log_entry, indent=2)[:2000])

    print_separator()
    print("BTUT demo complete.")

    # At 3,000 TB scale extrapolation
    if args.entities >= 1000:
        ratio = result.total_reduction_ratio
        quality = result.quality_score
        cost_per_entity = result.gpu_cost_dollars / max(result.original_count, 1)
        cost_3000tb = cost_per_entity * 3e9  # ~3B entities at ~1KB each
        print(f"\n  3,000 TB extrapolation:")
        print(f"    ~3B entities × ${cost_per_entity:.8f}/entity = ${cost_3000tb:.2f} estimated")
        print(f"    At {ratio:.0f}x reduction -> ~{3e9 / ratio:,.0f} survivors for TCD-JEPA")
        print(f"    Quality score maintained: {quality:.3f}")


if __name__ == "__main__":
    asyncio.run(main())
