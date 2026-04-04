#!/usr/bin/env python3
"""BTUT Superpower Run -- Maximum Signal Extraction from EDGAR.

Multi-Resolution Cascade Threading:
- 3 resolution passes (coarse=4, medium=8, fine=16 bins)
- 16 rotations per resolution = 48-bit concatenated fingerprint
- 3 stacked magnitude tables = 288-column multi-resolution profile
- Stratified type-balanced selection with per-cluster caps
- 3-axis scoring: diversity (0.35) + reconstruction (0.40) + anomaly (0.25)

Uses cached EDGAR data -- no API calls, runs in <2 minutes.
"""

import sys, os, json, time
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, os.path.join(ROOT_DIR, "backend"))
sys.path.insert(0, SCRIPT_DIR)
os.chdir(ROOT_DIR)

CACHE_PATH = os.path.join(SCRIPT_DIR, "edgar_cache.json")
TARGET_SURVIVORS = 300


# =====================================================================
# Multi-Resolution Quantile Threading
# =====================================================================

def quantile_thread(
    embeddings: np.ndarray,
    resolution: int,
    n_rotations: int = 16,
    seed: int = 42,
) -> tuple[np.ndarray, list[np.ndarray], list[np.ndarray]]:
    """Run quantile-based threading at a single resolution.

    Returns (trajectory_matrix, rotated_cells_list, rotated_embeddings_list).
    """
    n, d = embeddings.shape
    rng = np.random.RandomState(seed)

    # Per-dimension ranks (quantile positions)
    ranks = np.zeros_like(embeddings)
    for dim in range(d):
        order = np.argsort(embeddings[:, dim])
        ranks[order, dim] = np.linspace(0, 1, n)

    base_cells = np.floor(ranks * (resolution - 1)).astype(np.int32)

    trajectory = np.zeros((n, n_rotations), dtype=np.uint8)
    rotated_cells_list = []
    rotated_embeddings_list = []

    for k in range(n_rotations):
        # Jitter resolution per dimension
        res_jitter = rng.randint(max(2, resolution - 2), resolution + 3, size=d)

        # Mask random subset of dimensions
        n_dims = rng.randint(max(3, d - 3), d + 1)
        dim_mask = np.zeros(d, dtype=bool)
        dim_mask[rng.choice(d, n_dims, replace=False)] = True

        # Jitter rank positions (shift bin boundaries)
        noise = rng.uniform(-0.5 / resolution, 0.5 / resolution, size=(n, d))
        jittered = np.clip(ranks + noise, 0, 1)

        rotated_cells = np.zeros_like(base_cells)
        for dim in range(d):
            if dim_mask[dim]:
                rotated_cells[:, dim] = np.floor(jittered[:, dim] * (res_jitter[dim] - 1)).astype(np.int32)

        rotated_cells_list.append(rotated_cells)

        # Permuted embedding for magnitude computation
        perm = rng.permutation(d)
        rotated_emb = embeddings[:, perm] + noise * 0.1
        rotated_embeddings_list.append(rotated_emb)

        # Flip detection
        base_masked = base_cells.copy()
        base_masked[:, ~dim_mask] = 0
        flips = (base_masked != rotated_cells).any(axis=1)
        trajectory[:, k] = flips.astype(np.uint8)

    return trajectory, rotated_cells_list, rotated_embeddings_list


def compute_magnitude_columns(
    embeddings: np.ndarray,
    rotated_embeddings_list: list[np.ndarray],
    base_cells: np.ndarray,
    rotated_cells_list: list[np.ndarray],
    base_densities: np.ndarray,
    n_rotations: int,
) -> np.ndarray:
    """Compute 6 magnitude columns per rotation. Returns (N, K*6)."""
    n, d = embeddings.shape
    raw = np.zeros((n, n_rotations, 6), dtype=np.float32)
    orig_norms = np.linalg.norm(embeddings, axis=1) + 1e-10

    for k in range(n_rotations):
        rotated = rotated_embeddings_list[k]

        # Col 0: displacement
        raw[:, k, 0] = np.linalg.norm(rotated - embeddings, axis=1)

        # Col 1: cell distance
        raw[:, k, 1] = np.sum(np.abs(
            rotated_cells_list[k].astype(np.float32) - base_cells.astype(np.float32)
        ), axis=1)

        # Col 2: angular displacement
        rot_norms = np.linalg.norm(rotated, axis=1) + 1e-10
        cosine = np.sum(embeddings * rotated, axis=1) / (orig_norms * rot_norms)
        raw[:, k, 2] = np.arccos(np.clip(cosine, -1, 1))

        # Col 3: density gradient (mean-field)
        rot_mean = rotated.mean(axis=0)
        rot_var = rotated.var(axis=0) + 1e-8
        rot_dist_sq = np.sum((rotated - rot_mean)**2 / rot_var, axis=1)
        sigma = np.std(np.linalg.norm(rotated - rot_mean, axis=1)) + 1e-8
        raw[:, k, 3] = np.exp(-rot_dist_sq / (2 * sigma**2)) - base_densities

        # Col 4: centroid drift
        global_centroid = embeddings.mean(axis=0)
        raw[:, k, 4] = np.linalg.norm(rotated - global_centroid, axis=1)

        # Col 5: flip energy
        raw[:, k, 5] = raw[:, k, 0] * base_densities

    # Flatten and z-score normalize
    flat = raw.reshape(n, -1)
    means = flat.mean(axis=0)
    stds = flat.std(axis=0) + 1e-8
    return (flat - means) / stds


# =====================================================================
# Three-Axis Signal Scoring
# =====================================================================

def score_diversity(fingerprints: np.ndarray) -> np.ndarray:
    """Inverse frequency of each fingerprint. Rare = high score."""
    n = fingerprints.shape[0]
    # Hash fingerprints to count frequencies
    freq = {}
    for i in range(n):
        key = fingerprints[i].tobytes()
        freq[key] = freq.get(key, 0) + 1

    scores = np.zeros(n, dtype=np.float32)
    for i in range(n):
        key = fingerprints[i].tobytes()
        scores[i] = 1.0 / freq[key]

    # Normalize to [0, 1]
    max_s = scores.max()
    if max_s > 0:
        scores /= max_s
    return scores


def score_reconstruction(embeddings: np.ndarray, sample_size: int = 5000) -> np.ndarray:
    """Greedy facility-location score: how much NN coverage does each entity add?

    Approximate via: distance to random sample centroid × local isolation.
    True greedy is O(N*K) -- this is O(N*S) approximation.
    """
    n, d = embeddings.shape
    rng = np.random.RandomState(42)

    # Sample reference points
    sample_idx = rng.choice(n, min(sample_size, n), replace=False)
    sample = embeddings[sample_idx]

    # For each entity: mean distance to sample (proxy for coverage contribution)
    # Entities far from the sample center contribute more to reconstruction
    sample_center = sample.mean(axis=0)
    dist_to_center = np.linalg.norm(embeddings - sample_center, axis=1)

    # Local isolation: mean distance to K nearest neighbors in sample
    k_nn = 10
    isolation = np.zeros(n, dtype=np.float32)
    chunk = 2000
    for i_start in range(0, n, chunk):
        i_end = min(i_start + chunk, n)
        chunk_emb = embeddings[i_start:i_end]
        # Distance to all sample points
        dists = np.sqrt(np.sum(
            (chunk_emb[:, np.newaxis, :] - sample[np.newaxis, :, :]) ** 2, axis=2
        ))
        # Mean of K nearest
        knn_dists = np.sort(dists, axis=1)[:, :k_nn]
        isolation[i_start:i_end] = knn_dists.mean(axis=1)

    # Combine: high distance + high isolation = high reconstruction value
    scores = 0.5 * dist_to_center / (dist_to_center.max() + 1e-8) + \
             0.5 * isolation / (isolation.max() + 1e-8)
    return scores


def score_anomaly(
    magnitude_profiles: np.ndarray,
    entity_types: np.ndarray,
    unique_types: list[str],
) -> np.ndarray:
    """Distance from type-specific centroid in magnitude space."""
    n = magnitude_profiles.shape[0]
    scores = np.zeros(n, dtype=np.float32)

    for t_idx, t_name in enumerate(unique_types):
        mask = entity_types == t_idx
        if mask.sum() == 0:
            continue
        type_profiles = magnitude_profiles[mask]
        centroid = type_profiles.mean(axis=0)
        dists = np.linalg.norm(type_profiles - centroid, axis=1)
        # Normalize within type
        max_d = dists.max() + 1e-8
        scores[mask] = dists / max_d

    return scores


# =====================================================================
# Stratified Selection
# =====================================================================

def stratified_select(
    scores: np.ndarray,
    entity_type_indices: np.ndarray,
    cluster_assignments: np.ndarray,
    unique_types: list[str],
    target: int = 300,
    type_floors: dict | None = None,
) -> list[int]:
    """Select survivors with type balance and cluster diversity."""
    n = len(scores)
    n_types = len(unique_types)
    n_clusters = int(cluster_assignments.max()) + 1

    # Default type floors
    if type_floors is None:
        type_counts = np.bincount(entity_type_indices, minlength=n_types)
        type_fracs = type_counts / type_counts.sum()
        type_budgets = np.maximum(
            (type_fracs * target).astype(int),
            np.array([30, 50, 50])[:n_types],  # Minimum floors
        )
        # Normalize to target
        total = type_budgets.sum()
        if total > target:
            type_budgets = (type_budgets * target / total).astype(int)
    else:
        type_budgets = np.array([type_floors.get(t, 10) for t in unique_types])

    selected = []
    selected_set = set()

    for t_idx, t_name in enumerate(unique_types):
        budget = int(type_budgets[t_idx])
        type_mask = entity_type_indices == t_idx
        type_indices = np.where(type_mask)[0]

        if len(type_indices) == 0:
            continue

        type_scores = scores[type_indices]

        # Per-cluster cap: max 30% of budget from any single cluster
        cluster_cap = max(3, int(budget * 0.30))
        cluster_counts = {}

        # Sort by score descending
        order = np.argsort(-type_scores)

        count = 0
        for rank in order:
            if count >= budget:
                break
            idx = type_indices[rank]
            if idx in selected_set:
                continue
            cl = int(cluster_assignments[idx])
            if cluster_counts.get(cl, 0) >= cluster_cap:
                continue
            selected.append(idx)
            selected_set.add(idx)
            cluster_counts[cl] = cluster_counts.get(cl, 0) + 1
            count += 1

    return selected


# =====================================================================
# Main
# =====================================================================

def main():
    print("=" * 72)
    print("  BTUT SUPERPOWER RUN -- Maximum Signal Extraction")
    print("  Multi-Resolution Cascade Threading + 3-Axis Scoring")
    print("=" * 72)

    wall_start = time.time()

    # Load cached data
    if not os.path.exists(CACHE_PATH):
        print(f"ERROR: No cache at {CACHE_PATH}. Run edgar_max_scale.py first.")
        return

    print(f"\nLoading cached EDGAR data...")
    t0 = time.time()
    with open(CACHE_PATH) as f:
        cache = json.load(f)

    # Rebuild full entity list
    from edgar_deep_pull import fetch_all_tickers, EdgarThrottler
    throttler = EdgarThrottler()
    companies = fetch_all_tickers(throttler)

    entities = []
    for comp in companies[:10426]:
        entities.append({
            "name": f"company_{comp['cik']}",
            "type": "company",
            "attributes": json.dumps({
                "cik": comp["cik"], "ticker": comp["ticker"],
                "company_name": comp["name"],
            }),
        })
    entities.extend(cache["entities"])
    edges = cache["edges"]
    print(f"  Loaded {len(entities):,} entities, {len(edges):,} edges ({time.time()-t0:.1f}s)")

    # ── PreFilter ───────────────────────────────────────────────────
    from app.services.btut.config import BTUTConfig
    from app.services.btut.embedder import EntityEmbedder
    from app.services.btut.dedup import PreFilter
    from app.services.btut.streaming import random_project

    config = BTUTConfig.auto_scale(len(entities), 50)

    t0 = time.time()
    pf = PreFilter(config)
    filtered, _ = pf.run(entities)
    pf_time = time.time() - t0
    print(f"\nPreFilter: {len(entities):,} -> {len(filtered):,} ({pf_time:.1f}s, dedup={pf.bloom.duplicate_count:,})")

    # ── Embed + Project ─────────────────────────────────────────────
    t0 = time.time()
    embedder = EntityEmbedder(config)
    emb_32d = embedder.embed(filtered, edges)
    emb_8d = random_project(emb_32d, 8, seed=42)
    emb_time = time.time() - t0
    n = len(filtered)
    print(f"Embedding: {emb_32d.shape} -> {emb_8d.shape} ({emb_time:.1f}s)")

    # ── Entity type indexing ────────────────────────────────────────
    unique_types = ["company", "filing", "financial_fact"]
    type_map = {t: i for i, t in enumerate(unique_types)}
    entity_type_idx = np.array([type_map.get(e["type"], 0) for e in filtered], dtype=np.int32)

    type_counts = np.bincount(entity_type_idx, minlength=len(unique_types))
    for i, t in enumerate(unique_types):
        print(f"  {t}: {type_counts[i]:,}")

    # ── Base densities ──────────────────────────────────────────────
    center = emb_8d.mean(axis=0)
    norms = np.linalg.norm(emb_8d - center, axis=1)
    sigma = np.std(norms) + 1e-8
    base_densities = np.exp(-norms**2 / (2 * sigma**2))

    # ================================================================
    # MULTI-RESOLUTION CASCADE THREADING
    # ================================================================
    print(f"\n{'=' * 72}")
    print(f"  MULTI-RESOLUTION THREADING (3 passes x 16 rotations)")
    print(f"{'=' * 72}")

    resolutions = [4, 8, 16]
    n_rotations = 16
    all_trajectories = []
    all_magnitudes = []

    for res_idx, resolution in enumerate(resolutions):
        labels = ["COARSE", "MEDIUM", "FINE"]
        t0 = time.time()

        traj, rot_cells, rot_embs = quantile_thread(
            emb_8d, resolution, n_rotations,
            seed=42 + res_idx * 1000,
        )
        all_trajectories.append(traj)

        # Compute base cells for this resolution
        ranks = np.zeros_like(emb_8d)
        for dim in range(emb_8d.shape[1]):
            order = np.argsort(emb_8d[:, dim])
            ranks[order, dim] = np.linspace(0, 1, n)
        base_cells = np.floor(ranks * (resolution - 1)).astype(np.int32)

        # Magnitude table
        mag = compute_magnitude_columns(
            emb_8d, rot_embs, base_cells, rot_cells, base_densities, n_rotations,
        )
        all_magnitudes.append(mag)

        flip_rate = traj.mean()
        unique_fps = len(set(traj[i].tobytes() for i in range(n)))
        elapsed = time.time() - t0

        print(f"\n  Pass {res_idx+1} [{labels[res_idx]}] resolution={resolution} ({elapsed:.1f}s):")
        print(f"    Flip rate: {flip_rate:.3f}")
        print(f"    Unique fingerprints: {unique_fps}")
        print(f"    Magnitude shape: {mag.shape}")

    # ── Concatenate multi-resolution fingerprint ────────────────────
    concat_fingerprint = np.concatenate(all_trajectories, axis=1)  # (N, 48)
    concat_magnitude = np.concatenate(all_magnitudes, axis=1)  # (N, 288)

    total_unique = len(set(concat_fingerprint[i].tobytes() for i in range(n)))
    print(f"\n  COMBINED 48-bit fingerprint: {total_unique} unique patterns")

    # ── Cluster on concatenated fingerprint ─────────────────────────
    t0 = time.time()
    from app.services.btut.threading import LatticeThreader, ThreadingConfig
    tc = ThreadingConfig()
    tc.min_thread_size = 3
    threader = LatticeThreader(tc)
    micro_clusters = threader._cluster_by_fingerprint(concat_fingerprint, emb_8d, 8)
    threader._score_threads(micro_clusters, emb_8d)
    cluster_time = time.time() - t0

    # Cluster assignments
    cluster_assignments = np.full(n, -1, dtype=np.int32)
    for ci, mc in enumerate(micro_clusters):
        for idx in mc.member_indices:
            cluster_assignments[idx] = ci

    # Assign orphans to nearest cluster centroid
    orphans = np.where(cluster_assignments == -1)[0]
    if len(orphans) > 0:
        centroids = np.array([mc.centroid for mc in micro_clusters if mc.centroid is not None])
        if len(centroids) > 0:
            for idx in orphans:
                dists = np.sum((centroids - emb_8d[idx])**2, axis=1)
                cluster_assignments[idx] = int(np.argmin(dists))

    sorted_clusters = sorted(micro_clusters, key=lambda c: c.size, reverse=True)
    print(f"\n  Clustering ({cluster_time:.1f}s): {len(micro_clusters)} micro-clusters")
    for ci, mc in enumerate(sorted_clusters[:20]):
        fp48 = "".join(str(x) for x in mc.fingerprint[:12]) + "..." + "".join(str(x) for x in mc.fingerprint[-12:])
        types_in = {}
        for idx in mc.member_indices[:1000]:
            t = filtered[idx]["type"]
            types_in[t] = types_in.get(t, 0) + 1
        print(f"    #{ci}: {mc.size:>6} | stab={mc.stability_score:.3f} | fp={fp48} | types={types_in}")

    # ================================================================
    # THREE-AXIS SIGNAL SCORING
    # ================================================================
    print(f"\n{'=' * 72}")
    print(f"  THREE-AXIS SIGNAL SCORING")
    print(f"{'=' * 72}")

    t0 = time.time()

    # Axis 1: Diversity
    div_scores = score_diversity(concat_fingerprint)
    print(f"\n  Diversity: min={div_scores.min():.4f}, max={div_scores.max():.4f}, "
          f"mean={div_scores.mean():.4f}")

    # Axis 2: Reconstruction
    recon_scores = score_reconstruction(emb_8d, sample_size=5000)
    print(f"  Reconstruction: min={recon_scores.min():.4f}, max={recon_scores.max():.4f}, "
          f"mean={recon_scores.mean():.4f}")

    # Axis 3: Anomaly
    anom_scores = score_anomaly(concat_magnitude, entity_type_idx, unique_types)
    print(f"  Anomaly: min={anom_scores.min():.4f}, max={anom_scores.max():.4f}, "
          f"mean={anom_scores.mean():.4f}")

    # Composite
    composite = 0.35 * div_scores + 0.40 * recon_scores + 0.25 * anom_scores
    score_time = time.time() - t0
    print(f"\n  Composite ({score_time:.1f}s): min={composite.min():.4f}, max={composite.max():.4f}")

    # ================================================================
    # STRATIFIED SELECTION
    # ================================================================
    print(f"\n{'=' * 72}")
    print(f"  STRATIFIED TYPE-BALANCED SELECTION (target={TARGET_SURVIVORS})")
    print(f"{'=' * 72}")

    selected = stratified_select(
        composite, entity_type_idx, cluster_assignments,
        unique_types, target=TARGET_SURVIVORS,
    )
    survivors = [filtered[i] for i in selected]

    surv_types = {}
    for i in selected:
        t = filtered[i]["type"]
        surv_types[t] = surv_types.get(t, 0) + 1
    surv_clusters = len(set(cluster_assignments[i] for i in selected))

    print(f"\n  Selected: {len(survivors)} survivors")
    print(f"  Types: {surv_types}")
    print(f"  Clusters represented: {surv_clusters}/{len(micro_clusters)}")

    # ================================================================
    # FULL SURVIVOR REPORT
    # ================================================================
    print(f"\n{'=' * 72}")
    print(f"  SURVIVOR REPORT")
    print(f"{'=' * 72}")

    # Group by type
    for t_idx, t_name in enumerate(unique_types):
        type_survivors = [(i, idx) for i, idx in enumerate(selected) if entity_type_idx[idx] == t_idx]
        if not type_survivors:
            continue

        # Sort by composite score descending
        type_survivors.sort(key=lambda x: -composite[x[1]])

        print(f"\n  --- {t_name.upper()} ({len(type_survivors)} survivors) ---")

        for rank, (_, idx) in enumerate(type_survivors):
            ent = filtered[idx]
            attrs = json.loads(ent.get("attributes", "{}"))
            name = attrs.get("company_name", attrs.get("description", attrs.get("concept", ent["name"])))[:42]
            ticker = attrs.get("ticker", "")
            cl = int(cluster_assignments[idx])
            fp48 = concat_fingerprint[idx]
            flips = int(fp48.sum())

            div_s = div_scores[idx]
            rec_s = recon_scores[idx]
            ano_s = anom_scores[idx]
            comp_s = composite[idx]

            print(
                f"    [{rank+1:>3}] {name:<42} "
                f"{'['+ticker+']':<8} "
                f"| cluster={cl:>3} "
                f"| flips={flips:>2}/48 "
                f"| div={div_s:.3f} rec={rec_s:.3f} ano={ano_s:.3f} "
                f"| SCORE={comp_s:.4f}"
            )
            if rank >= 29:
                remaining = len(type_survivors) - 30
                if remaining > 0:
                    print(f"    ... and {remaining} more {t_name} survivors")
                break

    # ================================================================
    # ANOMALY RANKING (top 20 across all types)
    # ================================================================
    print(f"\n{'=' * 72}")
    print(f"  TOP 20 ANOMALIES (highest anomaly score)")
    print(f"{'=' * 72}")

    anom_order = np.argsort(-anom_scores[selected])
    for rank in range(min(20, len(selected))):
        idx = selected[anom_order[rank]]
        ent = filtered[idx]
        attrs = json.loads(ent.get("attributes", "{}"))
        name = attrs.get("company_name", attrs.get("description", attrs.get("concept", ent["name"])))[:42]
        ticker = attrs.get("ticker", "")

        print(
            f"  [{rank+1:>2}] {ent['type']:<16} {name:<42} "
            f"{'['+ticker+']':<8} "
            f"| anomaly={anom_scores[idx]:.4f}"
        )

    # ================================================================
    # RECONSTRUCTION QUALITY
    # ================================================================
    print(f"\n{'=' * 72}")
    print(f"  RECONSTRUCTION QUALITY")
    print(f"{'=' * 72}")

    surv_emb = emb_8d[selected]
    # For a sample of the full dataset, compute NN distance to survivors
    rng = np.random.RandomState(42)
    sample_size = min(10000, n)
    sample_idx = rng.choice(n, sample_size, replace=False)
    sample_emb = emb_8d[sample_idx]

    nn_dists = np.full(sample_size, np.inf)
    chunk = 1000
    for i in range(0, len(surv_emb), chunk):
        sc = surv_emb[i:i+chunk]
        d_chunk = np.sqrt(np.sum((sample_emb[:, np.newaxis, :] - sc[np.newaxis, :, :])**2, axis=2))
        nn_dists = np.minimum(nn_dists, d_chunk.min(axis=1))

    mean_nn = float(nn_dists.mean())
    median_nn = float(np.median(nn_dists))
    p95_nn = float(np.percentile(nn_dists, 95))
    p99_nn = float(np.percentile(nn_dists, 99))

    # Coverage: fraction of sample within threshold
    thresholds = [0.5, 1.0, 1.5, 2.0]
    coverages = {t: float((nn_dists < t).mean()) for t in thresholds}

    print(f"  NN distance to nearest survivor (10K sample):")
    print(f"    Mean:   {mean_nn:.4f}")
    print(f"    Median: {median_nn:.4f}")
    print(f"    P95:    {p95_nn:.4f}")
    print(f"    P99:    {p99_nn:.4f}")
    print(f"  Coverage:")
    for t, c in coverages.items():
        bar = "#" * int(c * 50)
        print(f"    d<{t:.1f}: {c*100:>5.1f}% {bar}")

    # Variance preservation
    orig_var = np.var(emb_8d, axis=0).sum()
    surv_var = np.var(surv_emb, axis=0).sum()
    coverage_ratio = surv_var / (orig_var + 1e-8)
    print(f"  Variance preservation: {coverage_ratio*100:.1f}%")

    # ================================================================
    # CLUSTER MAP
    # ================================================================
    print(f"\n{'=' * 72}")
    print(f"  CLUSTER MAP ({len(micro_clusters)} clusters)")
    print(f"{'=' * 72}")

    for ci, mc in enumerate(sorted_clusters[:30]):
        members = mc.member_indices
        types_in = {}
        for idx in members[:2000]:
            types_in[filtered[idx]["type"]] = types_in.get(filtered[idx]["type"], 0) + 1

        surv_in = sum(1 for idx in selected if idx in set(members))
        mean_div = float(div_scores[members].mean()) if members else 0
        mean_anom = float(anom_scores[members].mean()) if members else 0

        print(
            f"  Cluster {ci:>3}: {mc.size:>6} members | "
            f"stab={mc.stability_score:.3f} | "
            f"types={types_in} | "
            f"survivors={surv_in} | "
            f"div={mean_div:.3f} anom={mean_anom:.3f}"
        )

    # ================================================================
    # TIMING & SUMMARY
    # ================================================================
    wall_total = time.time() - wall_start
    btut_total = pf_time + emb_time + cluster_time + score_time

    print(f"\n{'=' * 72}")
    print(f"  TIMING")
    print(f"{'=' * 72}")
    print(f"  PreFilter:     {pf_time:>6.1f}s")
    print(f"  Embedding:     {emb_time:>6.1f}s")
    print(f"  Threading:     (included in passes above)")
    print(f"  Clustering:    {cluster_time:>6.1f}s")
    print(f"  Scoring:       {score_time:>6.1f}s")
    print(f"  Wall clock:    {wall_total:>6.1f}s")

    print(f"\n{'=' * 72}")
    print(f"  3,000 TB EXTRAPOLATION")
    print(f"{'=' * 72}")
    per_entity = wall_total / max(n, 1)
    cost_per = per_entity * (1.44 / 3600)
    cost_3tb = cost_per * 3e9
    reduction = n // max(len(survivors), 1)
    print(f"  Time/entity:   {per_entity*1000:.4f} ms")
    print(f"  3B entities:   {per_entity * 3e9 / 3600:.0f} hours")
    print(f"  3B cost:       ${cost_3tb:.2f}")
    print(f"  At {reduction}x:  ~{3e9 // reduction:,} survivors for TCD-JEPA")

    # Save
    output_path = os.path.join(SCRIPT_DIR, "edgar_superpower_result.json")
    survivor_data = []
    for idx in selected:
        ent = filtered[idx]
        attrs = json.loads(ent.get("attributes", "{}"))
        survivor_data.append({
            "entity": ent,
            "cluster": int(cluster_assignments[idx]),
            "fingerprint_48bit": "".join(str(x) for x in concat_fingerprint[idx]),
            "flips": int(concat_fingerprint[idx].sum()),
            "scores": {
                "diversity": round(float(div_scores[idx]), 4),
                "reconstruction": round(float(recon_scores[idx]), 4),
                "anomaly": round(float(anom_scores[idx]), 4),
                "composite": round(float(composite[idx]), 4),
            },
        })

    with open(output_path, "w") as f:
        json.dump({
            "summary": {
                "total_entities": n,
                "clusters": len(micro_clusters),
                "unique_48bit_fingerprints": total_unique,
                "survivors": len(survivors),
                "reduction": reduction,
                "survivor_types": surv_types,
                "reconstruction": {
                    "mean_nn": round(mean_nn, 4),
                    "median_nn": round(median_nn, 4),
                    "p95_nn": round(p95_nn, 4),
                    "variance_preservation": round(coverage_ratio, 4),
                    "coverages": {str(k): round(v, 4) for k, v in coverages.items()},
                },
                "wall_seconds": round(wall_total, 1),
            },
            "survivors": survivor_data,
        }, f, indent=2)
    print(f"\n  Saved to: {output_path}")

    print(f"\n{'=' * 72}")
    print(f"  SUPERPOWER RUN COMPLETE")
    print(f"{'=' * 72}")


if __name__ == "__main__":
    main()
