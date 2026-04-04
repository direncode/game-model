#!/usr/bin/env python3
"""Tuned BTUT run on EDGAR — fixed threading parameters for real cluster diversity.

Key fixes from the lineage analysis:
1. Reduce embedding dim to 8 BEFORE threading (not 32)
2. Override lattice resolution to 16 (not auto-calculated 4)
3. Reduce rotations to 12 (not 32) for meaningful binary differentiation
4. Set threading floor to produce 50-100 survivors
5. Disable magnitude-induced merging that collapses clusters

No API calls — uses the company tickers list (instant) + 20 detailed companies.
Should run in <60 seconds total.
"""

import sys, os, json, time
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, os.path.join(ROOT_DIR, "backend"))
sys.path.insert(0, SCRIPT_DIR)
os.chdir(ROOT_DIR)

from edgar_deep_pull import EdgarThrottler, fetch_all_tickers, process_company


def main():
    print("=" * 70)
    print("TUNED BTUT RUN — Fixed Threading for Cluster Diversity")
    print("=" * 70)

    # Phase 1: Build dataset (instant + 20 API calls)
    throttler = EdgarThrottler()
    companies = fetch_all_tickers(throttler)

    entities = []
    edges = []
    for comp in companies[:10426]:
        entities.append({
            "name": f"company_{comp['cik']}",
            "type": "company",
            "attributes": json.dumps({
                "cik": comp["cik"],
                "ticker": comp["ticker"],
                "company_name": comp["name"],
            }),
        })

    print(f"\nFetching details for 30 companies (filings + XBRL)...")
    for i in range(30):
        ents, edgs, sic = process_company(companies[i], throttler, 20, True)
        entities.extend(ents)
        edges.extend(edgs)

    print(f"Dataset: {len(entities)} entities, {len(edges)} edges\n")

    # Phase 2: Manual pipeline with tuned parameters
    from app.services.btut.config import BTUTConfig
    from app.services.btut.embedder import EntityEmbedder
    from app.services.btut.dedup import PreFilter
    from app.services.btut.streaming import random_project
    from app.services.btut.threading import LatticeThreader, ThreadingConfig, MicroCluster
    from app.services.btut.magnitude import MagnitudeParser, MagnitudeTag
    from app.services.btut.kernel import FokkerPlanckKernel
    from app.services.btut.thinning import DensityThinner

    config = BTUTConfig.auto_scale(len(entities), 50)

    # PreFilter
    t0 = time.time()
    prefilter = PreFilter(config)
    filtered, _ = prefilter.run(entities)
    print(f"PreFilter: {len(entities)} -> {len(filtered)} ({time.time()-t0:.1f}s)")
    print(f"  Bloom dedup: {prefilter.bloom.duplicate_count}")

    # Embed at full dim first
    t0 = time.time()
    embedder = EntityEmbedder(config)
    embeddings_32d = embedder.embed(filtered, edges)
    print(f"Embedding: {embeddings_32d.shape} ({time.time()-t0:.1f}s)")

    # KEY FIX 1: Project down to 8D BEFORE threading
    embeddings_8d = random_project(embeddings_32d, 8, seed=42)
    print(f"Projected: {embeddings_32d.shape} -> {embeddings_8d.shape}")

    # KEY FIX 2: Per-dimension quantile binning
    # The problem: L2-normalized embeddings sit on unit sphere. ANY rotation
    # moves ALL points. Percentile normalization + offset still moves all.
    #
    # The solution: discretize each dimension independently using QUANTILE
    # bins (equal-frequency). Then for each "rotation", randomly permute
    # which dimensions are used and vary the number of quantile bins.
    # A point "flips" if its bin assignment changes under the new binning.
    #
    # This is fundamentally different from geometric rotation — it tests
    # whether a point's RANK in each dimension is sensitive to the choice
    # of binning resolution. Points at quantile boundaries flip; points
    # deep in a quantile bin don't.

    tc = ThreadingConfig()
    tc.n_rotations = 16
    tc.lattice_resolution = 8  # Base bins per dimension
    tc.auto_resolution = False
    tc.n_anchor_rotations = 4
    tc.min_thread_size = 3
    tc.magnitude_enabled = True
    tc.magnitude_max_refinements = 3

    t0 = time.time()
    threader = LatticeThreader(tc)

    n, d = embeddings_8d.shape
    rng = np.random.RandomState(42)

    # Compute per-dimension ranks (quantile position)
    ranks = np.zeros_like(embeddings_8d)
    for dim in range(d):
        order = np.argsort(embeddings_8d[:, dim])
        ranks[order, dim] = np.linspace(0, 1, n)

    # Base discretization: quantile bins at base resolution
    base_resolution = tc.lattice_resolution
    base_cells = np.floor(ranks * (base_resolution - 1)).astype(np.int32)

    trajectory_matrix = np.zeros((n, tc.n_rotations), dtype=np.uint8)
    rotated_cells_list = []
    rotated_embeddings_list = []
    flip_rates = []

    for k in range(tc.n_rotations):
        # Vary resolution per dimension (jitter the bin boundaries)
        res_jitter = rng.randint(max(3, base_resolution - 3), base_resolution + 4, size=d)

        # Random dimension subset (use 5-7 of 8 dimensions)
        n_dims_use = rng.randint(5, d + 1)
        dim_mask = np.zeros(d, dtype=bool)
        dim_mask[rng.choice(d, n_dims_use, replace=False)] = True

        # Add small noise to ranks (simulates jittered bin boundaries)
        noise = rng.uniform(-0.5 / base_resolution, 0.5 / base_resolution, size=(n, d))
        jittered_ranks = np.clip(ranks + noise, 0, 1)

        # Discretize with jittered resolution
        rotated_cells = np.zeros_like(base_cells)
        for dim in range(d):
            if dim_mask[dim]:
                rotated_cells[:, dim] = np.floor(jittered_ranks[:, dim] * (res_jitter[dim] - 1)).astype(np.int32)
            else:
                rotated_cells[:, dim] = 0  # Masked dimensions don't contribute

        rotated_cells_list.append(rotated_cells)

        # For magnitude computation, create a "rotated" embedding by permuting dims
        perm = rng.permutation(d)
        rotated_emb = embeddings_8d[:, perm] + noise * 0.1
        rotated_embeddings_list.append(rotated_emb)

        # Flip detection: compare masked base cells with jittered cells
        base_masked = base_cells.copy()
        base_masked[:, ~dim_mask] = 0
        flips = (base_masked != rotated_cells).any(axis=1)
        trajectory_matrix[:, k] = flips.astype(np.uint8)
        flip_rates.append(float(flips.mean()))

    print(f"\nThreading ({time.time()-t0:.1f}s):")
    print(f"  Flip rates: min={min(flip_rates):.3f}, max={max(flip_rates):.3f}, mean={np.mean(flip_rates):.3f}")

    # Unique fingerprints
    fingerprints_set = set()
    for i in range(n):
        fingerprints_set.add(trajectory_matrix[i].tobytes())
    print(f"  Unique fingerprints: {len(fingerprints_set)}")

    # Cluster by fingerprint
    micro_clusters = threader._cluster_by_fingerprint(trajectory_matrix, embeddings_8d, tc.lattice_resolution)
    threader._score_threads(micro_clusters, embeddings_8d)

    print(f"  Micro-clusters: {len(micro_clusters)}")

    # Sort by size for display
    sorted_clusters = sorted(micro_clusters, key=lambda c: c.size, reverse=True)
    for ci, mc in enumerate(sorted_clusters[:15]):
        fp_str = "".join(str(x) for x in mc.fingerprint)
        print(f"    #{ci}: {mc.size:>5} members, stability={mc.stability_score:.3f}, fp={fp_str}")

    # Magnitude analysis
    t0 = time.time()
    base_center = embeddings_8d.mean(axis=0)
    base_norms = np.linalg.norm(embeddings_8d - base_center, axis=1)
    sigma_est = np.std(base_norms) + 1e-8
    base_densities = np.exp(-base_norms**2 / (2 * sigma_est**2))

    parser = MagnitudeParser.from_threading_config(tc)
    mag_result = parser.run(
        embeddings=embeddings_8d,
        rotated_embeddings_list=rotated_embeddings_list,
        base_cells=base_cells,
        rotated_cells_list=rotated_cells_list,
        micro_clusters=micro_clusters,
        base_densities=base_densities,
    )

    tags = mag_result.tags
    class_counts = {}
    for t_tag in tags:
        class_counts[t_tag.magnitude_class] = class_counts.get(t_tag.magnitude_class, 0) + 1
    print(f"\n  Magnitude ({time.time()-t0:.1f}s):")
    print(f"    Classes: {class_counts}")
    print(f"    Splits: {mag_result.n_splits}")
    print(f"    Final clusters: {len(mag_result.refined_clusters)}")

    final_clusters = mag_result.refined_clusters if mag_result.refined_clusters else micro_clusters

    # Select representatives: centroid + anchors + top-K per cluster
    # Find anchors: entities that never flip even under jittered binning
    # Use extra rotations for anchor detection
    anchor_flips = np.ones(n, dtype=bool)
    for _ in range(tc.n_anchor_rotations):
        res_j = rng.randint(max(3, base_resolution - 2), base_resolution + 3, size=d)
        noise_a = rng.uniform(-0.3 / base_resolution, 0.3 / base_resolution, size=(n, d))
        jr = np.clip(ranks + noise_a, 0, 1)
        anchor_cells = np.zeros_like(base_cells)
        for dim in range(d):
            anchor_cells[:, dim] = np.floor(jr[:, dim] * (res_j[dim] - 1)).astype(np.int32)
        flipped = (base_cells != anchor_cells).any(axis=1)
        anchor_flips &= ~flipped  # True only if NEVER flipped
    anchors = np.where(anchor_flips)[0].tolist()
    print(f"  Anchors: {len(anchors)} entities never flipped")

    # Custom selection: take top-K from EACH cluster for diversity
    kept_indices = set()

    # Add anchors
    kept_indices.update(anchors)

    # From each cluster, take up to K representatives nearest to centroid
    target_per_cluster = max(3, 100 // max(len(final_clusters), 1))
    for mc in final_clusters:
        if mc.size < 2 or mc.stability_score < 0.1:
            continue
        members = mc.member_indices
        if mc.centroid is not None:
            dists = np.sum((embeddings_8d[members] - mc.centroid)**2, axis=1)
            sorted_members = [members[j] for j in np.argsort(dists)]
            for idx in sorted_members[:target_per_cluster]:
                kept_indices.add(idx)

    # Also add the most "extreme" magnitude entities per cluster
    for mc in final_clusters:
        if mc.size < 5:
            continue
        members = mc.member_indices
        member_tags = [(idx, tags[idx]) for idx in members if idx < len(tags)]
        # Sort by stability descending (most dynamic first)
        member_tags.sort(key=lambda x: -x[1].stability)
        # Take top 2 most dynamic
        for idx, _ in member_tags[:2]:
            kept_indices.add(idx)

    kept_list = sorted(kept_indices)
    survivors = [filtered[i] for i in kept_list]

    print(f"\n{'=' * 70}")
    print(f"SURVIVORS: {len(survivors)} from {len(filtered)} ({len(filtered)/max(len(survivors),1):.0f}x reduction)")
    print(f"{'=' * 70}")

    # Analyze survivors
    type_counts_surv = {}
    for ent in survivors:
        t_type = ent.get("type", "unknown")
        type_counts_surv[t_type] = type_counts_surv.get(t_type, 0) + 1
    print(f"\n  By type: {type_counts_surv}")

    # Print each survivor with lineage
    cluster_map = {}
    for ci, mc in enumerate(final_clusters):
        for idx in mc.member_indices:
            cluster_map[idx] = (ci, mc)

    print(f"\n{'-' * 70}")
    for rank, idx in enumerate(kept_list):
        ent = filtered[idx]
        attrs = ent.get("attributes", "{}")
        if isinstance(attrs, str):
            attrs = json.loads(attrs)

        tag = tags[idx] if idx < len(tags) else None
        trajectory = trajectory_matrix[idx]
        flip_count = int(trajectory.sum())
        density = float(base_densities[idx])
        ci_info = cluster_map.get(idx, (-1, None))
        ci_idx = ci_info[0]
        ci_mc = ci_info[1]

        # Compact display
        name = attrs.get("company_name", attrs.get("description", attrs.get("concept", ent["name"])))
        ticker = attrs.get("ticker", "")
        etype = ent["type"]
        fp_str = "".join(str(x) for x in trajectory)

        mag_class = tag.magnitude_class if tag else "?"
        stability = f"{tag.stability:.2f}" if tag else "?"

        is_anchor = idx in anchors

        cluster_size = ci_mc.size if ci_mc else 0

        print(
            f"  [{rank+1:>3}] {etype:<16} | {name[:40]:<40} | "
            f"{'['+ticker+']':<8} | "
            f"fp={fp_str} | flips={flip_count:>2}/{tc.n_rotations} | "
            f"cluster={ci_idx}({cluster_size}) | "
            f"mag={mag_class:<7} stab={stability} | "
            f"density={density:.4f}"
            f"{' ANCHOR' if is_anchor else ''}"
        )

    # Per-cluster summary
    print(f"\n{'-' * 70}")
    print(f"CLUSTER SUMMARY ({len(final_clusters)} clusters):")
    print(f"{'-' * 70}")

    for ci, mc in enumerate(sorted(final_clusters, key=lambda c: c.size, reverse=True)[:20]):
        members = mc.member_indices
        member_types = {}
        for idx in members:
            t_type = filtered[idx]["type"]
            member_types[t_type] = member_types.get(t_type, 0) + 1

        member_mags = {}
        for idx in members:
            if idx < len(tags):
                mc_class = tags[idx].magnitude_class
                member_mags[mc_class] = member_mags.get(mc_class, 0) + 1

        fp_str = "".join(str(x) for x in mc.fingerprint)
        survivors_in = sum(1 for idx in kept_list if idx in set(members))

        print(
            f"  Cluster {ci}: {mc.size:>5} members | "
            f"fp={fp_str} | "
            f"stability={mc.stability_score:.3f} | "
            f"types={member_types} | "
            f"magnitudes={member_mags} | "
            f"survivors={survivors_in}"
        )

    # Magnitude bounds summary
    if mag_result.cluster_bounds:
        print(f"\n{'-' * 70}")
        print(f"MAGNITUDE BOUNDS:")
        print(f"{'-' * 70}")
        for cb in mag_result.cluster_bounds[:10]:
            print(
                f"  Cluster {cb.cluster_idx}: {cb.member_count} members | "
                f"sharpness={cb.boundary_sharpness:.4f} | "
                f"classes={cb.magnitude_class_distribution}"
            )

    print(f"\n{'=' * 70}")
    print(f"COMPLETE: {len(survivors)} diverse survivors from {len(filtered)} entities")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
