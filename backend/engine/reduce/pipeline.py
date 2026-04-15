"""Reusable BTUT pipeline — extracted from edgar_superpower.py.

Runs the full 8-tier reduction on any entity/edge set:
  PreFilter → Embed → Project to 8D → Multi-Resolution Threading →
  3-Axis Scoring → Stratified Selection → Result JSON

Usage:
    from app.services.btut.pipeline import run_btut_pipeline
    result = run_btut_pipeline(entities, edges, unique_types=["paper", "author", "gene"])
"""

from __future__ import annotations

import json
import logging
import time

import numpy as np

from .config import BTUTConfig
from .dedup import PreFilter
from .embedder import EntityEmbedder
from .streaming import random_project
from .threading import LatticeThreader, ThreadingConfig

logger = logging.getLogger(__name__)


def _quantile_thread(embeddings, resolution, n_rotations=16, seed=42):
    """Quantile-based threading at a single resolution."""
    n, d = embeddings.shape
    rng = np.random.RandomState(seed)

    ranks = np.zeros_like(embeddings)
    for dim in range(d):
        order = np.argsort(embeddings[:, dim])
        ranks[order, dim] = np.linspace(0, 1, n)

    base_cells = np.floor(ranks * (resolution - 1)).astype(np.int32)
    trajectory = np.zeros((n, n_rotations), dtype=np.uint8)
    rotated_cells_list = []
    rotated_embeddings_list = []

    for k in range(n_rotations):
        res_jitter = rng.randint(max(2, resolution - 2), resolution + 3, size=d)
        n_dims = rng.randint(max(3, d - 3), d + 1)
        dim_mask = np.zeros(d, dtype=bool)
        dim_mask[rng.choice(d, n_dims, replace=False)] = True

        noise = rng.uniform(-0.5 / resolution, 0.5 / resolution, size=(n, d))
        jittered = np.clip(ranks + noise, 0, 1)

        rotated_cells = np.zeros_like(base_cells)
        for dim in range(d):
            if dim_mask[dim]:
                rotated_cells[:, dim] = np.floor(jittered[:, dim] * (res_jitter[dim] - 1)).astype(np.int32)

        rotated_cells_list.append(rotated_cells)
        perm = rng.permutation(d)
        rotated_embeddings_list.append(embeddings[:, perm] + noise * 0.1)

        base_masked = base_cells.copy()
        base_masked[:, ~dim_mask] = 0
        flips = (base_masked != rotated_cells).any(axis=1)
        trajectory[:, k] = flips.astype(np.uint8)

    return trajectory, rotated_cells_list, rotated_embeddings_list


def _score_diversity(fingerprints):
    n = fingerprints.shape[0]
    freq = {}
    for i in range(n):
        key = fingerprints[i].tobytes()
        freq[key] = freq.get(key, 0) + 1
    scores = np.array([1.0 / freq[fingerprints[i].tobytes()] for i in range(n)], dtype=np.float32)
    mx = scores.max()
    return scores / mx if mx > 0 else scores


def _score_reconstruction(embeddings, sample_size=5000):
    n, d = embeddings.shape
    rng = np.random.RandomState(42)
    sample_idx = rng.choice(n, min(sample_size, n), replace=False)
    sample = embeddings[sample_idx]
    sample_center = sample.mean(axis=0)
    dist_to_center = np.linalg.norm(embeddings - sample_center, axis=1)

    k_nn = 10
    isolation = np.zeros(n, dtype=np.float32)
    chunk = 2000
    for i_start in range(0, n, chunk):
        i_end = min(i_start + chunk, n)
        dists = np.sqrt(np.sum((embeddings[i_start:i_end, np.newaxis, :] - sample[np.newaxis, :, :]) ** 2, axis=2))
        isolation[i_start:i_end] = np.sort(dists, axis=1)[:, :k_nn].mean(axis=1)

    return (0.5 * dist_to_center / (dist_to_center.max() + 1e-8) +
            0.5 * isolation / (isolation.max() + 1e-8))


def _score_anomaly(magnitude_profiles, entity_type_idx, unique_types):
    n = magnitude_profiles.shape[0]
    scores = np.zeros(n, dtype=np.float32)
    for t_idx in range(len(unique_types)):
        mask = entity_type_idx == t_idx
        if mask.sum() == 0:
            continue
        profiles = magnitude_profiles[mask]
        centroid = profiles.mean(axis=0)
        dists = np.linalg.norm(profiles - centroid, axis=1)
        mx = dists.max() + 1e-8
        scores[mask] = dists / mx
    return scores


def _stratified_select(scores, entity_type_idx, cluster_assignments, unique_types, target=300):
    n_types = len(unique_types)
    n = len(scores)
    type_counts = np.bincount(entity_type_idx, minlength=n_types)
    type_fracs = type_counts / type_counts.sum()
    type_budgets = np.maximum((type_fracs * target).astype(int), 10)
    total = type_budgets.sum()
    if total > target:
        type_budgets = (type_budgets * target / total).astype(int)

    selected = []
    selected_set = set()

    for t_idx in range(n_types):
        budget = int(type_budgets[t_idx])
        type_mask = entity_type_idx == t_idx
        type_indices = np.where(type_mask)[0]
        if len(type_indices) == 0:
            continue

        type_scores = scores[type_indices]
        cluster_cap = max(3, int(budget * 0.30))
        cluster_counts = {}
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


def _compute_magnitudes(embeddings, rotated_embeddings_list, base_cells, rotated_cells_list, base_densities, n_rotations):
    n, d = embeddings.shape
    raw = np.zeros((n, n_rotations, 6), dtype=np.float32)
    orig_norms = np.linalg.norm(embeddings, axis=1) + 1e-10

    for k in range(n_rotations):
        rotated = rotated_embeddings_list[k]
        raw[:, k, 0] = np.linalg.norm(rotated - embeddings, axis=1)
        raw[:, k, 1] = np.sum(np.abs(rotated_cells_list[k].astype(np.float32) - base_cells.astype(np.float32)), axis=1)
        rot_norms = np.linalg.norm(rotated, axis=1) + 1e-10
        cosine = np.sum(embeddings * rotated, axis=1) / (orig_norms * rot_norms)
        raw[:, k, 2] = np.arccos(np.clip(cosine, -1, 1))
        rot_mean = rotated.mean(axis=0)
        rot_var = rotated.var(axis=0) + 1e-8
        sigma = np.std(np.linalg.norm(rotated - rot_mean, axis=1)) + 1e-8
        raw[:, k, 3] = np.exp(-np.sum((rotated - rot_mean)**2 / rot_var, axis=1) / (2 * sigma**2)) - base_densities
        raw[:, k, 4] = np.linalg.norm(rotated - embeddings.mean(axis=0), axis=1)
        raw[:, k, 5] = raw[:, k, 0] * base_densities

    flat = raw.reshape(n, -1)
    means = flat.mean(axis=0)
    stds = flat.std(axis=0) + 1e-8
    return (flat - means) / stds


def run_btut_pipeline(
    entities: list[dict],
    edges: list[dict],
    unique_types: list[str] | None = None,
    target_survivors: int = 300,
    budget_dollars: float = 50.0,
    resolutions: list[int] | None = None,
    n_rotations: int = 16,
    progress_callback=None,
) -> dict:
    """Run the full BTUT superpower pipeline on any dataset.

    Args:
        entities: List of {name, type, attributes} dicts
        edges: List of {source, target, type, weight} dicts
        unique_types: Entity type names for stratified selection
        target_survivors: Number of survivors to select
        budget_dollars: GPU budget for auto-scaling
        resolutions: Multi-resolution bins, default [4, 8, 16]
        n_rotations: Rotations per resolution pass
        progress_callback: Optional fn(message: str)

    Returns:
        Dict with 'summary' and 'survivors' keys, ready to write as JSON.
    """
    if resolutions is None:
        resolutions = [4, 8, 16]

    wall_start = time.time()

    def _log(msg):
        logger.info(msg)
        if progress_callback:
            progress_callback(msg)

    # Detect types if not provided
    if unique_types is None:
        type_set = set()
        for e in entities:
            type_set.add(e.get("type", "unknown"))
        unique_types = sorted(type_set)

    _log(f"Pipeline starting: {len(entities)} entities, {len(edges)} edges, types={unique_types}")

    # ── PreFilter ────────────────────────────────────────────────
    config = BTUTConfig.auto_scale(len(entities), budget_dollars)
    pf = PreFilter(config)
    filtered, _ = pf.run(entities)
    _log(f"PreFilter: {len(entities)} -> {len(filtered)} (dedup={pf.bloom.duplicate_count})")

    # ── Embed + Project ──────────────────────────────────────────
    embedder = EntityEmbedder(config)
    emb_32d = embedder.embed(filtered, edges)
    emb_8d = random_project(emb_32d, 8, seed=42)
    n = len(filtered)
    _log(f"Embedding: {emb_32d.shape} -> {emb_8d.shape}")

    # Capture LATK embed context: the minimal persisted state required to
    # embed a new query text into this lattice's 8D space afterwards.
    # See scripts/cross_era_analysis/latk_tool/fingerprint_core.py for the
    # consumer side of this contract.
    _latk_embed_context = {
        "type_vocab": dict(getattr(embedder, "_type_vocab", {})),
        "numeric_means": (
            embedder.numeric_proj._means.tolist()
            if embedder.numeric_proj is not None and embedder.numeric_proj._means is not None
            else None
        ),
        "numeric_stds": (
            embedder.numeric_proj._stds.tolist()
            if embedder.numeric_proj is not None and embedder.numeric_proj._stds is not None
            else None
        ),
        "numeric_keys": [],  # populated inside EntityEmbedder.embed; not exposed, left empty
        "embedding_dim": int(config.embedding_dim),
        "projection_seed": 42,
        "embedder_seed": 42,
    }

    # Type indexing
    type_map = {t: i for i, t in enumerate(unique_types)}
    entity_type_idx = np.array([type_map.get(e["type"], 0) for e in filtered], dtype=np.int32)

    # Base densities
    center = emb_8d.mean(axis=0)
    norms = np.linalg.norm(emb_8d - center, axis=1)
    sigma = np.std(norms) + 1e-8
    base_densities = np.exp(-norms**2 / (2 * sigma**2))

    # ── Multi-Resolution Threading ───────────────────────────────
    all_trajectories = []
    all_magnitudes = []

    for res_idx, resolution in enumerate(resolutions):
        traj, rot_cells, rot_embs = _quantile_thread(emb_8d, resolution, n_rotations, seed=42 + res_idx * 1000)
        all_trajectories.append(traj)

        # Base cells for magnitude
        ranks = np.zeros_like(emb_8d)
        for dim in range(emb_8d.shape[1]):
            order = np.argsort(emb_8d[:, dim])
            ranks[order, dim] = np.linspace(0, 1, n)
        base_cells = np.floor(ranks * (resolution - 1)).astype(np.int32)

        mag = _compute_magnitudes(emb_8d, rot_embs, base_cells, rot_cells, base_densities, n_rotations)
        all_magnitudes.append(mag)

        _log(f"Resolution {resolution}: flip_rate={traj.mean():.3f}, unique_fp={len(set(traj[i].tobytes() for i in range(n)))}")

    concat_fp = np.concatenate(all_trajectories, axis=1)
    concat_mag = np.concatenate(all_magnitudes, axis=1)
    total_unique = len(set(concat_fp[i].tobytes() for i in range(n)))
    _log(f"Combined: {concat_fp.shape[1]}-bit fingerprint, {total_unique} unique patterns")

    # ── Cluster ──────────────────────────────────────────────────
    tc = ThreadingConfig()
    tc.min_thread_size = 3
    threader = LatticeThreader(tc)
    micro_clusters = threader._cluster_by_fingerprint(concat_fp, emb_8d, 8)
    threader._score_threads(micro_clusters, emb_8d)

    cluster_assignments = np.full(n, 0, dtype=np.int32)
    for ci, mc in enumerate(micro_clusters):
        for idx in mc.member_indices:
            cluster_assignments[idx] = ci

    _log(f"Clusters: {len(micro_clusters)}")

    # ── 3-Axis Scoring ───────────────────────────────────────────
    div_scores = _score_diversity(concat_fp)
    recon_scores = _score_reconstruction(emb_8d)
    anom_scores = _score_anomaly(concat_mag, entity_type_idx, unique_types)
    composite = 0.35 * div_scores + 0.40 * recon_scores + 0.25 * anom_scores

    # ── Stratified Selection ─────────────────────────────────────
    selected = _stratified_select(composite, entity_type_idx, cluster_assignments, unique_types, target=target_survivors)
    _log(f"Selected: {len(selected)} survivors from {n} entities ({n // max(len(selected), 1)}x reduction)")

    # ── Build result ─────────────────────────────────────────────
    wall_total = time.time() - wall_start

    surv_types = {}
    for idx in selected:
        t = filtered[idx]["type"]
        surv_types[t] = surv_types.get(t, 0) + 1

    # Reconstruction quality
    surv_emb = emb_8d[selected]
    rng = np.random.RandomState(42)
    sample_idx = rng.choice(n, min(10000, n), replace=False)
    sample_emb = emb_8d[sample_idx]
    nn_dists = np.full(len(sample_idx), np.inf)
    for i in range(0, len(surv_emb), 1000):
        sc = surv_emb[i:i+1000]
        d = np.sqrt(np.sum((sample_emb[:, np.newaxis, :] - sc[np.newaxis, :, :])**2, axis=2))
        nn_dists = np.minimum(nn_dists, d.min(axis=1))

    orig_var = np.var(emb_8d, axis=0).sum()
    surv_var = np.var(surv_emb, axis=0).sum()

    summary = {
        "total_entities": n,
        "clusters": len(micro_clusters),
        "unique_48bit_fingerprints": total_unique,
        "survivors": len(selected),
        "reduction": n // max(len(selected), 1),
        "survivor_types": surv_types,
        "reconstruction": {
            "mean_nn": round(float(nn_dists.mean()), 4),
            "median_nn": round(float(np.median(nn_dists)), 4),
            "p95_nn": round(float(np.percentile(nn_dists, 95)), 4),
            "variance_preservation": round(float(surv_var / (orig_var + 1e-8)), 4),
            "coverages": {str(t): round(float((nn_dists < t).mean()), 4) for t in [0.5, 1.0, 1.5, 2.0]},
        },
        "wall_seconds": round(wall_total, 1),
    }

    survivors = []
    for idx in selected:
        ent = filtered[idx]
        survivors.append({
            "entity": ent,
            "cluster": int(cluster_assignments[idx]),
            "fingerprint_48bit": "".join(str(x) for x in concat_fp[idx]),
            "flips": int(concat_fp[idx].sum()),
            "scores": {
                "diversity": round(float(div_scores[idx]), 4),
                "reconstruction": round(float(recon_scores[idx]), 4),
                "anomaly": round(float(anom_scores[idx]), 4),
                "composite": round(float(composite[idx]), 4),
            },
        })

    # LATK v2: persist per-survivor 8D embeddings + embed context so the
    # query tools can project new text into this lattice's geometric space.
    # Cost: ~48 KB per 1500-survivor lattice. Negligible vs the survivor
    # payload itself. Skipped silently if the corpus was too small to
    # produce meaningful coordinates.
    try:
        surv_emb_8d = emb_8d[selected].astype(np.float32)
        embeddings_8d_flat = surv_emb_8d.flatten().tolist()
    except Exception:
        embeddings_8d_flat = []

    _log(f"Pipeline complete: {len(selected)} survivors, {wall_total:.1f}s")

    return {
        "summary": summary,
        "survivors": survivors,
        "embed_context": _latk_embed_context,
        "embeddings_8d": embeddings_8d_flat,
    }
