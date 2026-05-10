"""
TEST 2 — BTUT compression frontier on the OCEAN substrate.

Hypothesis: as BTUT compresses the corpus more aggressively (1x -> 2x ->
5x -> 10x -> 20x), at what compression ratio does downstream OCEAN
signal (mean self_basin_share via MiniLM + kmeans) degrade by 5%? 50%?

This is the "training-data substrate" claim turned into a curve. SemDeDup
and MinHash measure dedup quality; nobody has measured the
compression-vs-downstream-clustering-fidelity frontier on a fixed
substrate.

Pipeline per compression ratio:
    embed (MiniLM, ONE TIME, cached)
    build kNN edges
    BTUT reduce at target ratio
    re-cluster survivors
    measure dispersion
    compare to uncompressed control

Output: data/validation/btut_compression_frontier_local_<date>.json
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import numpy as np

# Ensure backend is on path for BTUT imports
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

# Reuse Test 1 pieces
sys.path.insert(0, str(ROOT / "scripts" / "experiments"))
from embedder_amplification_campaign import (  # noqa: E402
    embed_bert_handrolled,
    ensure_local_weights,
    EMBEDDERS,
    kmeans_cosine,
    measure_dispersion,
)

# BTUT
from app.services.btut import BTUTTuner, BTUTConfig  # noqa: E402
from app.services.btut.config import CascadeLevel  # noqa: E402


# ---------- config --------------------------------------------------------
CORPUS_PATH = Path("tmp/bombe_tna_full.ndjson")  # 2169 records, more room for BTUT
EMBED_CACHE = Path("tmp/tna_minilm_embeddings.npz")
TOP_N_ARCHIVES = 6
N_PER_ARCHIVE = 320  # ~1900 records — BTUT designed for scale, give it room
KNN_K = 12
K_CLUSTERS = 12
KMEANS_ITERS = 32
SEEDS = [42, 43, 44]

# Compression ratios to test (cascade thinning_ratio).
# 1 = control (no BTUT). Others go through cascade.
COMPRESSION_RATIOS = [1, 2, 5, 10, 20]
# --------------------------------------------------------------------------


def load_balanced(path, top_n_archives, n_per_archive, seed):
    records = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    counts = Counter(r["archive"] for r in records)
    top = [a for a, _ in counts.most_common(top_n_archives)]
    rng = np.random.default_rng(seed)
    out = []
    for a in top:
        pool = [r for r in records if r["archive"] == a]
        idx = rng.permutation(len(pool))[:n_per_archive]
        out.extend([pool[i] for i in idx])
    rng.shuffle(out)
    return out


def get_or_build_embeddings(records, embedder_spec, model_dir):
    """Embed once, cache to disk keyed by record names."""
    names = [r.get("paper_id") or r.get("doc_id") or f"rec_{i}"
             for i, r in enumerate(records)]
    if EMBED_CACHE.exists():
        cached = np.load(EMBED_CACHE, allow_pickle=True)
        cached_names = list(cached["names"])
        if cached_names == names:
            print(f"[embed] cached MiniLM embeddings: {EMBED_CACHE}")
            return cached["embeddings"], names

    print("[embed] computing MiniLM embeddings (one-time)")
    texts = [(r.get("title", "") + ". " + r.get("text", "")).strip() for r in records]
    Z = embed_bert_handrolled(texts, model_dir, pool=embedder_spec.get("pool", "mean"))
    EMBED_CACHE.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(EMBED_CACHE, embeddings=Z, names=np.array(names, dtype=object))
    return Z, names


def build_knn_edges(Z, names, k):
    """Each record connects to its k nearest neighbors (excluding self) via cosine sim."""
    n = Z.shape[0]
    sims = Z @ Z.T
    np.fill_diagonal(sims, -1.0)
    top_k = np.argpartition(-sims, kth=k, axis=1)[:, :k]
    edges = []
    for i in range(n):
        for j in top_k[i]:
            edges.append({
                "source": names[i],
                "target": names[int(j)],
                "type": "knn",
                "weight": float(sims[i, int(j)]),
            })
    return edges


def records_to_entities(records, names):
    return [
        {
            "name": names[i],
            "type": r["archive"],
            "attributes": {
                "title": r.get("title", ""),
                "text": r.get("text", "")[:1000],  # truncate long
                "archive": r["archive"],
            },
        }
        for i, r in enumerate(records)
    ]


def make_compression_config(target_ratio: int) -> BTUTConfig:
    """Build a BTUTConfig that targets approximately `target_ratio` compression.

    Disables adaptive_depth and locks max_cascade_depth=1 so the actual
    compression ratio stays close to the requested target instead of
    overshooting via cascade auto-extension.
    """
    if target_ratio <= 1:
        cfg = BTUTConfig.auto_scale(entity_count=1000)
        cfg.prefilter_enabled = False
        cfg.adaptive_depth = False
        cfg.max_cascade_depth = 1
        cfg.cascade_levels = [
            CascadeLevel(sigma=2.0, thinning_ratio=1, max_iterations=2, min_iterations=1),
        ]
        cfg.bootstrap_runs = 1
        cfg.min_coverage = 0.0
        cfg.max_recon_error = 1.0
        cfg.quality_gate_between_levels = False
        return cfg

    cfg = BTUTConfig.auto_scale(entity_count=1000)
    cfg.prefilter_enabled = False
    cfg.adaptive_depth = False
    cfg.max_cascade_depth = 1
    cfg.cascade_levels = [
        CascadeLevel(
            sigma=1.5,
            thinning_ratio=target_ratio,
            max_iterations=1,  # single FP solver step so thinning_ratio acts once
            min_iterations=1,
        ),
    ]
    cfg.bootstrap_runs = 1
    cfg.min_coverage = 0.0
    cfg.max_recon_error = 1.0
    cfg.quality_gate_between_levels = False
    cfg.min_entities_floor = max(20, int(1000 / (target_ratio * 2)))
    return cfg


def run_btut_compression(entities, edges, target_ratio, job_id):
    cfg = make_compression_config(target_ratio)
    tuner = BTUTTuner(cfg)
    t0 = time.time()
    result = asyncio.run(tuner.tune(entities, edges, job_id=job_id))
    dur = time.time() - t0
    return result, dur


def measure_post_compression(survivors, all_records, all_names, all_Z, seed):
    """Re-cluster survivors using their cached MiniLM embeddings, measure dispersion."""
    name_to_idx = {n: i for i, n in enumerate(all_names)}
    survivor_indices = []
    survivor_records = []
    for s in survivors:
        nm = s.get("name") if isinstance(s, dict) else getattr(s, "name", None)
        if nm in name_to_idx:
            survivor_indices.append(name_to_idx[nm])
            survivor_records.append(all_records[name_to_idx[nm]])
    if not survivor_indices:
        return None, 0
    Z_sub = all_Z[survivor_indices]
    Z_sub = Z_sub / (np.linalg.norm(Z_sub, axis=1, keepdims=True) + 1e-8)
    k = min(K_CLUSTERS, len(survivor_indices))
    assign, _ = kmeans_cosine(Z_sub, k, KMEANS_ITERS, seed)
    disp = measure_dispersion(survivor_records, assign)
    return disp, len(survivor_indices)


def main():
    print("== TEST 2: BTUT Compression Frontier on OCEAN substrate ==")
    print(f"   corpus: {CORPUS_PATH}")
    print(f"   embedder: MiniLM-L6-v2 (held constant)")
    print(f"   compression ratios: {COMPRESSION_RATIOS}x")
    print(f"   seeds: {SEEDS}")
    print()

    spec = EMBEDDERS["minilm_l6"]
    model_dir = ensure_local_weights(spec)

    runs = []

    for seed in SEEDS:
        print(f"=== SEED {seed} ===")
        records = load_balanced(CORPUS_PATH, TOP_N_ARCHIVES, N_PER_ARCHIVE, seed)
        # cache key includes seed
        global EMBED_CACHE
        EMBED_CACHE = Path(f"tmp/tna_minilm_seed{seed}.npz")
        Z, names = get_or_build_embeddings(records, spec, model_dir)
        Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8)

        # Control: cluster on full corpus (no BTUT)
        print(f"[ratio=1x control] kmeans on raw {len(records)} records")
        assign_full, _ = kmeans_cosine(Z, K_CLUSTERS, KMEANS_ITERS, seed)
        disp_full = measure_dispersion(records, assign_full)
        rows = disp_full["dispersion_per_archive"]
        mean_full = float(np.mean([r["self_basin_share"] for r in rows]))
        print(f"  -> mean_self_basin={mean_full:.4f}  on n={len(records)}")
        runs.append({
            "seed": seed,
            "compression_ratio_target": 1,
            "compression_ratio_actual": 1.0,
            "n_input": len(records),
            "n_survivors": len(records),
            "btut_seconds": 0.0,
            "mean_self_basin_share": round(mean_full, 4),
            "min_self_basin_share": round(min(r["self_basin_share"] for r in rows), 4),
            "dispersion_per_archive": rows,
            "btut_metrics": None,
            "is_control": True,
        })

        # Compression sweeps
        entities = records_to_entities(records, names)
        edges = build_knn_edges(Z, names, KNN_K)
        for ratio in COMPRESSION_RATIOS[1:]:
            print(f"[ratio={ratio}x] BTUT reducing {len(entities)} -> ~{len(entities)//ratio}")
            try:
                btut_res, dur = run_btut_compression(
                    entities, edges, ratio, job_id=f"test2_seed{seed}_ratio{ratio}"
                )
                survivors = btut_res.survivors
                actual_ratio = len(records) / max(1, len(survivors))
                disp, n_sub = measure_post_compression(
                    survivors, records, names, Z, seed
                )
                if disp is None:
                    print(f"  -> survivors empty after BTUT, skipping")
                    continue
                rows = disp["dispersion_per_archive"]
                mean_sub = float(np.mean([r["self_basin_share"] for r in rows]))
                print(f"  -> n_survivors={n_sub}  actual_ratio={actual_ratio:.1f}x  "
                      f"mean_self_basin={mean_sub:.4f}  btut={dur:.1f}s")
                runs.append({
                    "seed": seed,
                    "compression_ratio_target": ratio,
                    "compression_ratio_actual": round(actual_ratio, 2),
                    "n_input": len(records),
                    "n_survivors": n_sub,
                    "btut_seconds": round(dur, 2),
                    "mean_self_basin_share": round(mean_sub, 4),
                    "min_self_basin_share": round(min(r["self_basin_share"] for r in rows), 4),
                    "dispersion_per_archive": rows,
                    "is_control": False,
                })
            except Exception as e:
                print(f"  !! BTUT run failed at ratio={ratio}x: {e}")
                import traceback
                traceback.print_exc()
                runs.append({
                    "seed": seed,
                    "compression_ratio_target": ratio,
                    "error": str(e),
                    "is_control": False,
                })

        print()

    # aggregate
    by_ratio = defaultdict(list)
    for r in runs:
        if "error" in r:
            continue
        by_ratio[r["compression_ratio_target"]].append(r)

    summary = []
    for ratio, group in sorted(by_ratio.items()):
        means = [g["mean_self_basin_share"] for g in group]
        actuals = [g["compression_ratio_actual"] for g in group]
        survivors = [g["n_survivors"] for g in group]
        summary.append({
            "compression_ratio_target": ratio,
            "compression_ratio_actual_mean": round(float(np.mean(actuals)), 2),
            "n_survivors_mean": int(np.mean(survivors)),
            "n_seeds": len(group),
            "mean_self_basin_mean": round(float(np.mean(means)), 4),
            "mean_self_basin_std": round(float(np.std(means)), 4),
        })

    print("=" * 80)
    print("BTUT COMPRESSION FRONTIER — substrate signal vs compression ratio")
    print("=" * 80)
    print(f"{'target':>8} {'actual':>8} {'survivors':>10} {'mean':>10}±{'std':<6}")
    for s in summary:
        print(f"{s['compression_ratio_target']:>8d} "
              f"{s['compression_ratio_actual_mean']:>8.2f} "
              f"{s['n_survivors_mean']:>10d} "
              f"{s['mean_self_basin_mean']:>10.4f}±{s['mean_self_basin_std']:<6.4f}")
    print("=" * 80)

    out = {
        "campaign": "btut_compression_frontier_local",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "config": {
            "corpus_path": str(CORPUS_PATH),
            "n_per_archive": N_PER_ARCHIVE,
            "top_n_archives": TOP_N_ARCHIVES,
            "k_clusters": K_CLUSTERS,
            "kmeans_iters": KMEANS_ITERS,
            "seeds": SEEDS,
            "compression_ratios": COMPRESSION_RATIOS,
            "embedder": "sentence-transformers/all-MiniLM-L6-v2",
            "knn_k": KNN_K,
        },
        "runs": runs,
        "summary_by_ratio": summary,
    }
    out_path = Path(f"data/validation/btut_compression_frontier_local_{datetime.utcnow():%Y%m%d}.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"saved: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
