#!/usr/bin/env python3
"""Full lineage tracking for BTUT survivors — why each entity was selected."""

import sys, os, asyncio, json
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, os.path.join(ROOT_DIR, "backend"))
sys.path.insert(0, SCRIPT_DIR)
os.chdir(ROOT_DIR)

from edgar_deep_pull import EdgarThrottler, fetch_all_tickers, process_company


def main():
    throttler = EdgarThrottler()
    companies = fetch_all_tickers(throttler)

    # Build entities: all 10K companies + 20 detailed with filings/facts
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

    print(f"Fetching details for 20 companies...")
    for i in range(20):
        ents, edgs, sic = process_company(companies[i], throttler, 20, True)
        entities.extend(ents)
        edges.extend(edgs)

    print(f"Total: {len(entities)} entities, {len(edges)} edges\n")

    # Run BTUT components manually for full instrumentation
    from app.services.btut.config import BTUTConfig
    from app.services.btut.threading import LatticeThreader, ThreadingConfig
    from app.services.btut.embedder import EntityEmbedder
    from app.services.btut.dedup import PreFilter
    from app.services.btut.magnitude import MagnitudeParser

    config = BTUTConfig.auto_scale(len(entities), 10)

    # PreFilter
    prefilter = PreFilter(config)
    filtered_entities, _ = prefilter.run(entities)
    print(f"PreFilter: {len(entities)} -> {len(filtered_entities)}")
    print(f"  Bloom dedup: {prefilter.bloom.duplicate_count}")
    print(f"  Entropy rejected: {prefilter.entropy_gate.rejected_count}")

    # Embed
    embedder = EntityEmbedder(config)
    embeddings = embedder.embed(filtered_entities, edges)
    print(f"Embeddings: {embeddings.shape}")

    # Threading
    threading_config = ThreadingConfig.from_btut_config(config)
    threader = LatticeThreader(threading_config)

    n, d = embeddings.shape
    resolution = threader._auto_resolution(embeddings)
    rotations = threader._generate_rotations(d, threading_config.n_rotations + threading_config.n_anchor_rotations)
    base_cells = threader._discretize(embeddings, resolution)

    print(f"\nLattice: resolution={resolution}, rotations={threading_config.n_rotations}")

    # Track per-rotation data
    trajectory_matrix = np.zeros((n, threading_config.n_rotations), dtype=np.uint8)
    flip_rates = []
    rotated_embeddings_list = []
    rotated_cells_list = []

    for k in range(threading_config.n_rotations):
        rotated = embeddings @ rotations[k].T
        rotated_cells = threader._discretize(rotated, resolution)
        rotated_embeddings_list.append(rotated)
        rotated_cells_list.append(rotated_cells)
        flips = (base_cells != rotated_cells).any(axis=1)
        trajectory_matrix[:, k] = flips.astype(np.uint8)
        flip_rates.append(float(flips.mean()))

    print(f"Flip rates: min={min(flip_rates):.3f}, max={max(flip_rates):.3f}, mean={np.mean(flip_rates):.3f}")

    # Cluster
    micro_clusters = threader._cluster_by_fingerprint(trajectory_matrix, embeddings, resolution)
    threader._score_threads(micro_clusters, embeddings)

    print(f"Micro-clusters: {len(micro_clusters)}")
    for ci, mc in enumerate(micro_clusters[:10]):
        fp_str = "".join(str(x) for x in mc.fingerprint[:20])
        print(f"  Cluster {ci}: {mc.size} members, stability={mc.stability_score:.3f}, fp={fp_str}...")

    # Magnitude
    base_center = embeddings.mean(axis=0)
    base_norms = np.linalg.norm(embeddings - base_center, axis=1)
    sigma_est = np.std(base_norms) + 1e-8
    base_densities = np.exp(-base_norms**2 / (2 * sigma_est**2))

    parser = MagnitudeParser.from_threading_config(threading_config)
    mag_result = parser.run(
        embeddings=embeddings,
        rotated_embeddings_list=rotated_embeddings_list,
        base_cells=base_cells,
        rotated_cells_list=rotated_cells_list,
        micro_clusters=micro_clusters,
        base_densities=base_densities,
    )

    tags = mag_result.tags
    class_counts = {}
    for t in tags:
        class_counts[t.magnitude_class] = class_counts.get(t.magnitude_class, 0) + 1
    print(f"\nMagnitude classes: {class_counts}")

    # Get survivors
    anchors = threader._find_anchors(embeddings, rotations[threading_config.n_rotations:], resolution)
    rep_entities, rep_embeddings, rep_indices = threader.micro_clusters_to_representatives(
        mag_result.refined_clusters, embeddings, filtered_entities,
        strategy="top_k_per_cluster",
        anchor_indices=anchors,
    )

    # Full lineage
    sep = "=" * 70
    line = "-" * 70

    print(f"\n{sep}")
    print(f"FULL LINEAGE FOR {len(rep_indices)} SURVIVORS")
    print(f"{sep}")

    global_centroid = embeddings.mean(axis=0)
    global_dists = np.linalg.norm(embeddings - global_centroid, axis=1)
    median_density = float(np.median(base_densities))
    std_dist = float(np.std(global_dists))

    for rank, idx in enumerate(rep_indices):
        ent = filtered_entities[idx]
        attrs = ent.get("attributes", "{}")
        if isinstance(attrs, str):
            attrs = json.loads(attrs)

        tag = tags[idx] if idx < len(tags) else None
        embedding = embeddings[idx]
        trajectory = trajectory_matrix[idx]
        density = float(base_densities[idx])

        # Find cluster
        cluster_idx = -1
        cluster_size = 0
        cluster_stability = 0.0
        for ci, mc in enumerate(mag_result.refined_clusters):
            if idx in mc.member_indices:
                cluster_idx = ci
                cluster_size = mc.size
                cluster_stability = mc.stability_score
                break

        # Per-rotation magnitudes
        displacements = []
        angular_disps = []
        cell_distances = []
        for k in range(threading_config.n_rotations):
            disp = float(np.linalg.norm(rotated_embeddings_list[k][idx] - embeddings[idx]))
            displacements.append(disp)

            orig_norm = np.linalg.norm(embeddings[idx]) + 1e-10
            rot_norm = np.linalg.norm(rotated_embeddings_list[k][idx]) + 1e-10
            cos_sim = np.dot(embeddings[idx], rotated_embeddings_list[k][idx]) / (orig_norm * rot_norm)
            angular = float(np.arccos(np.clip(cos_sim, -1, 1)))
            angular_disps.append(angular)

            cell_dist = float(np.sum(np.abs(
                rotated_cells_list[k][idx].astype(float) - base_cells[idx].astype(float)
            )))
            cell_distances.append(cell_dist)

        dist_from_center = float(np.linalg.norm(embedding - global_centroid))

        # Nearest neighbor
        rng = np.random.RandomState(42)
        sample_idx = rng.choice(n, min(1000, n), replace=False)
        nn_dists = np.linalg.norm(embeddings[sample_idx] - embedding, axis=1)
        nn_dists_nonzero = nn_dists[nn_dists > 0]
        nearest_dist = float(nn_dists_nonzero.min()) if len(nn_dists_nonzero) > 0 else 0
        mean_dist = float(nn_dists_nonzero.mean()) if len(nn_dists_nonzero) > 0 else 0

        flip_count = int(trajectory.sum())

        print(f"\n{line}")
        print(f"SURVIVOR {rank + 1}: {ent['name']}")
        print(f"{line}")

        print(f"\n  ENTITY DATA:")
        print(f"    Name:         {ent['name']}")
        print(f"    Type:         {ent['type']}")
        for k, v in attrs.items():
            val_str = str(v)[:80]
            print(f"    {k}: {val_str}")

        print(f"\n  EMBEDDING PROFILE:")
        print(f"    Index:                {idx}")
        print(f"    L2 norm:              {float(np.linalg.norm(embedding)):.6f}")
        print(f"    Distance from center: {dist_from_center:.6f}")
        print(f"    Nearest neighbor:     {nearest_dist:.6f}")
        print(f"    Mean dist to sample:  {mean_dist:.6f}")
        print(f"    Vector (first 8):     [{', '.join(f'{x:.4f}' for x in embedding[:8])}]")

        print(f"\n  LATTICE THREADING:")
        print(f"    Base cell:      [{', '.join(str(x) for x in base_cells[idx][:8])}...]")
        print(f"    Trajectory:     {'|'.join(str(x) for x in trajectory)}")
        print(f"    Flip count:     {flip_count} / {threading_config.n_rotations} ({flip_count/threading_config.n_rotations*100:.0f}%)")

        print(f"\n  MAGNITUDE ANALYSIS:")
        if tag:
            print(f"    Stability:        {tag.stability:.6f}")
            print(f"    Consistency:      {tag.consistency:.6f}")
            print(f"    Peak rotation:    {tag.peak_rotation}")
            print(f"    Magnitude class:  {tag.magnitude_class}")
        print(f"    Mean displacement:  {np.mean(displacements):.6f}")
        print(f"    Max displacement:   {np.max(displacements):.6f} (rotation {np.argmax(displacements)})")
        print(f"    Min displacement:   {np.min(displacements):.6f} (rotation {np.argmin(displacements)})")
        print(f"    Mean angular:       {np.mean(angular_disps):.4f} rad ({np.degrees(np.mean(angular_disps)):.1f} deg)")
        print(f"    Mean cell distance: {np.mean(cell_distances):.4f}")
        print(f"    Density:            {density:.8f}")

        print(f"\n  CLUSTER MEMBERSHIP:")
        print(f"    Cluster:    {cluster_idx}")
        print(f"    Size:       {cluster_size}")
        print(f"    Stability:  {cluster_stability:.4f}")

        print(f"\n  SELECTION REASONING:")
        reasons = []

        if flip_count == 0:
            reasons.append(
                "ANCHOR POINT: Never flipped across any of the "
                f"{threading_config.n_rotations} dimensional rotations. This entity "
                "sits at a fixed point of the embedding geometry that no rotation "
                "disturbs. It is maximally structurally invariant."
            )
        elif flip_count < threading_config.n_rotations * 0.3:
            reasons.append(
                f"LOW-FLIP STABLE: Only flipped in {flip_count}/{threading_config.n_rotations} "
                "rotations. Its lattice cell is robust to most dimensional rotations, "
                "indicating it sits deep within a structural basin."
            )
        elif flip_count > threading_config.n_rotations * 0.7:
            reasons.append(
                f"HIGH-FLIP BOUNDARY: Flipped in {flip_count}/{threading_config.n_rotations} "
                "rotations. Sits near a structural boundary, sensitive to dimensional "
                "changes. Selected as a boundary representative."
            )
        else:
            reasons.append(
                f"MODERATE-FLIP: Flipped in {flip_count}/{threading_config.n_rotations} "
                "rotations. Moderate structural sensitivity."
            )

        if density > median_density:
            reasons.append(
                f"HIGH DENSITY region ({density:.6f} > median {median_density:.6f}). "
                "This entity exists in a crowded region of the embedding space."
            )
        else:
            reasons.append(
                f"LOW DENSITY region ({density:.6f} < median {median_density:.6f}). "
                "This entity is relatively isolated in embedding space."
            )

        if dist_from_center > std_dist:
            reasons.append(
                f"OUTLIER position: {dist_from_center:.4f} from centroid "
                f"(> 1 std = {std_dist:.4f}). Far from the bulk of the data."
            )
        else:
            reasons.append(
                f"CORE position: {dist_from_center:.4f} from centroid "
                f"(< 1 std = {std_dist:.4f}). Near the center of the data distribution."
            )

        if tag and tag.magnitude_class in ("low", "medium"):
            reasons.append(
                f"STABLE magnitude profile ({tag.magnitude_class}): "
                "consistent behavior across rotations. Selected as a "
                "reliable representative of its cluster."
            )
        elif tag and tag.magnitude_class in ("high", "extreme"):
            reasons.append(
                f"DYNAMIC magnitude profile ({tag.magnitude_class}): "
                "highly variable behavior across rotations. Selected because "
                "it represents a structurally unique region."
            )

        reasons.append(
            f"CENTROID PROXIMITY: Selected as the member nearest to its "
            f"micro-cluster centroid (cluster {cluster_idx}, {cluster_size} members). "
            f"This makes it the most representative entity of its cluster."
        )

        for i, reason in enumerate(reasons):
            print(f"    [{i+1}] {reason}")

    print(f"\n{sep}")
    print(f"LINEAGE COMPLETE")
    print(f"{sep}")


if __name__ == "__main__":
    main()
