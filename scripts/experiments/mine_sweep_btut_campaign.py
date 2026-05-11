"""
MINE-SWEEP BTUT-THEN-SUBSTRATE CAMPAIGN-INTELLIGENCE HARNESS.

Corrects the prior `mine_sweep_campaign_intelligence.py` runs which
skipped BTUT — the validated substrate pipeline is BTUT-compress THEN
TCD-JEPA cluster, not TCD-JEPA directly on raw features.

Per project owner: BTUT is essential to the substrate pipeline.
energy = corpus_mean (not frequent-class centroid).
This is the production-validated chain that produces the substrate-status
numbers anchored in `/atlas`, `/pulse`, NSL-KDD, and TNA.

Pipeline:
  1. Load features.parquet (25K UATD patches × 1024-d)
  2. Build entities (one per patch, attributes carry the feature vector + label)
  3. Build KNN edges (k=12) on the 1024-d feature vectors
  4. Run BTUT to compress to ~25K/target_ratio survivors
  5. Run TCD-JEPA (cluster.tcd_recursive_loop, energy=corpus_mean) on survivor features
  6. Compute the three campaign-intelligence tests against the survivors:
       T1 module purity vs ground-truth class
       T2 within-class generalization (held-out survivors)
       T3 new-class detection on held-out classes

Output: data/validation/mine_sweep/btut_campaign_summary.json

Note on RunPod GPU dispatch:
  The existing RunPod serverless endpoint accepts text-entity payloads
  (title + text attributes) and runs its own embedder + BTUT + cluster
  server-side. Our UATD patches are pre-computed numeric features that
  don't naturally encode as text. Running the pipeline locally (BTUT
  on CPU per btut_compression_frontier.py, TCD-JEPA on CPU torch per
  cluster.py) is the tractable path that uses the exact same operators
  the RunPod endpoint would run server-side. Adapting the RunPod payload
  to accept pre-embedded numeric attributes is a separate change.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import random
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT))

# BTUT
from app.services.btut import BTUTTuner, BTUTConfig  # noqa: E402
from app.services.btut.config import CascadeLevel  # noqa: E402

# Substrate
from scripts.operators.embed import NumericDirectEmbedder  # noqa: E402
from scripts.operators.cluster import TCDRecursiveLoop  # noqa: E402


OUT_DIR              = ROOT / "data" / "validation" / "mine_sweep"
FEATURES_PARQ        = OUT_DIR / "features.parquet"
BTUT_SUMMARY         = OUT_DIR / "btut_campaign_summary.json"

SUBSTRATE_SEED = 42
KNN_K          = 12

# Per project owner: corpus_mean energy
SUBSTRATE_CONFIG = {
    "iters":             16,
    "max_modules":       32,
    "crystallize_every": 2,
    "langevin_steps":    30,
    "energy":            "corpus_mean",
}

# BTUT compression ratio (~25K -> ~5K survivors at 5x).
# Per btut_compression_frontier.py, ratio sweep validated at 1, 2, 5, 10, 20.
BTUT_TARGET_RATIO = 5

HELD_OUT_CLASSES_FOR_TEST3 = ["cylinder", "metal bucket"]


# =========================================================================
# Helpers
# =========================================================================
def discover_feature_fields(record: dict) -> list[str]:
    return sorted(
        (k for k in record if k.startswith("feat_")),
        key=lambda s: int(s.split("_")[1]),
    )


def hard_seed(seed: int):
    import random as _random
    import torch as _torch
    _random.seed(seed)
    np.random.seed(seed)
    _torch.manual_seed(seed)
    try:
        _torch.use_deterministic_algorithms(True, warn_only=True)
    except Exception:
        pass


def records_to_entities(records: list[dict], feature_fields: list[str]) -> list[dict]:
    """Each patch becomes an entity. type = label_class so BTUT can preserve
    class structure during compression. attributes carry the feature vector
    plus metadata so we can recover features for the post-BTUT substrate run.
    """
    entities = []
    for r in records:
        ent = {
            "name": r["tile_id"],
            "type": r["label_class"],
            "attributes": {
                "label_class":        r["label_class"],
                "is_positive_strict": bool(r["is_positive_strict"]),
                "image_id":           r.get("image_id", ""),
                "anchor_x_utm":       float(r.get("anchor_x_utm", 0.0)),
                "anchor_y_utm":       float(r.get("anchor_y_utm", 0.0)),
                # Pre-computed feature vector — passed through BTUT.
                # Stored as a list so it round-trips JSON if needed.
                "z": [float(r[f]) for f in feature_fields],
            },
        }
        entities.append(ent)
    return entities


def build_knn_edges(Z: np.ndarray, names: list[str], k: int) -> list[dict]:
    """KNN graph in feature space (cosine similarity)."""
    # Normalize for cosine
    norms = np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8
    Zn = Z / norms
    n = Zn.shape[0]
    edges = []
    chunk = 1024
    for s in range(0, n, chunk):
        block = Zn[s : s + chunk]
        sims = block @ Zn.T              # (chunk, N)
        # Exclude self by setting diagonal of block-portion to -1
        for i_local in range(block.shape[0]):
            i_global = s + i_local
            sims[i_local, i_global] = -1.0
        top_k = np.argpartition(-sims, kth=k, axis=1)[:, :k]
        for i_local in range(block.shape[0]):
            i_global = s + i_local
            for j in top_k[i_local]:
                edges.append({
                    "source": names[i_global],
                    "target": names[int(j)],
                    "type":   "knn",
                    "weight": float(sims[i_local, int(j)]),
                })
    return edges


def make_btut_config(entity_count: int, target_ratio: int) -> BTUTConfig:
    """BTUT config that targets ~target_ratio compression. Matches
    make_compression_config() in btut_compression_frontier.py."""
    cfg = BTUTConfig.auto_scale(entity_count=entity_count)
    cfg.prefilter_enabled = False
    cfg.adaptive_depth = False
    cfg.max_cascade_depth = 1
    cfg.cascade_levels = [
        CascadeLevel(
            sigma=1.5,
            thinning_ratio=target_ratio,
            max_iterations=1,
            min_iterations=1,
        ),
    ]
    cfg.bootstrap_runs = 1
    cfg.min_coverage = 0.0
    cfg.max_recon_error = 1.0
    cfg.quality_gate_between_levels = False
    cfg.min_entities_floor = max(20, int(entity_count / (target_ratio * 2)))
    return cfg


def run_btut(entities: list[dict], edges: list[dict], target_ratio: int, job_id: str) -> tuple[list[dict], dict]:
    print(f"[btut] running on {len(entities)} entities, {len(edges)} edges, target_ratio={target_ratio}x")
    t0 = time.time()
    cfg = make_btut_config(len(entities), target_ratio)
    tuner = BTUTTuner(cfg)
    result = asyncio.run(tuner.tune(entities, edges, job_id=job_id))
    dur = time.time() - t0
    survivors = result.survivors
    survivor_edges = getattr(result, "survivor_edges", None) or []
    print(f"[btut] {len(entities)} -> {len(survivors)} survivors ({dur:.1f}s, actual ratio {len(entities)/max(1,len(survivors)):.2f}x)")
    return survivors, {
        "input_count":   len(entities),
        "survivor_count": len(survivors),
        "actual_ratio":  len(entities) / max(1, len(survivors)),
        "btut_seconds":  round(dur, 2),
        "survivor_edge_count": len(survivor_edges),
    }


def survivors_to_z_and_labels(survivors: list, name_to_record: dict, feature_fields: list[str]) -> tuple[np.ndarray, list[dict]]:
    """Recover the feature matrix + records for BTUT survivors."""
    rows = []
    surv_records = []
    for s in survivors:
        # Survivors may be dicts or BTUT entity objects
        name = s.get("name") if isinstance(s, dict) else getattr(s, "name", None)
        if name is None or name not in name_to_record:
            continue
        rec = name_to_record[name]
        rows.append([rec[f] for f in feature_fields])
        surv_records.append(rec)
    if not rows:
        return np.zeros((0, len(feature_fields)), dtype=np.float32), []
    return np.array(rows, dtype=np.float32), surv_records


def cluster_substrate(records: list[dict], feature_fields: list[str], config: dict) -> dict:
    hard_seed(SUBSTRATE_SEED)

    embed_op = NumericDirectEmbedder()
    embed_out = embed_op.run(
        {"records": records},
        seed=SUBSTRATE_SEED,
        config={"fields": feature_fields, "l2_normalize": False},
    )
    Z = embed_out["Z"]

    inputs = {"Z": Z, "records": records}
    cluster_op = TCDRecursiveLoop()
    out = cluster_op.run(inputs, seed=SUBSTRATE_SEED, config=config)
    raw_mods = [m for m in out.get("modules", []) if "centroid_vec" in m]
    if not raw_mods:
        centroids = Z.mean(axis=0, keepdims=True)
        module_ids = ["fallback_0"]
    else:
        centroids = np.array([m["centroid_vec"] for m in raw_mods], dtype=np.float32)
        module_ids = [str(m["module_id"]) for m in raw_mods]

    # Assign each record to nearest centroid
    n = Z.shape[0]
    assigns = np.empty(n, dtype=np.int32)
    chunk = 4096
    for s in range(0, n, chunk):
        block = Z[s : s + chunk]
        d = np.linalg.norm(block[:, None, :] - centroids[None, :, :], axis=2)
        assigns[s : s + chunk] = d.argmin(axis=1)
    return {
        "Z":           Z,
        "centroids":   centroids,
        "module_ids":  module_ids,
        "assigns":     assigns,
        "n_modules":   centroids.shape[0],
        "feature_mean": np.array(embed_out["feature_mean"], dtype=np.float32),
        "feature_std":  np.array(embed_out["feature_std"],  dtype=np.float32),
    }


def weighted_purity(assigns: np.ndarray, labels: list[str]) -> tuple[float, list[dict]]:
    confusion: dict[int, Counter] = defaultdict(Counter)
    for a, lab in zip(assigns, labels):
        confusion[int(a)][lab] += 1
    weighted_correct = 0
    per_module = []
    for mod_idx, counter in confusion.items():
        total = sum(counter.values())
        dominant, dominant_count = counter.most_common(1)[0]
        weighted_correct += dominant_count
        per_module.append({
            "module": int(mod_idx), "size": total,
            "dominant_class": dominant, "purity": float(dominant_count / total),
            "class_breakdown": dict(counter),
        })
    return weighted_correct / len(labels), sorted(per_module, key=lambda d: -d["size"])


# =========================================================================
# Main
# =========================================================================
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target-ratio", type=int, default=BTUT_TARGET_RATIO)
    parser.add_argument("--positive-only", action="store_true",
                        help="restrict to positive patches before BTUT (matches the no-BTUT baseline)")
    parser.add_argument("--knn-k", type=int, default=KNN_K)
    args = parser.parse_args()

    import pyarrow.parquet as pq
    table = pq.read_table(FEATURES_PARQ)
    records_all = table.to_pylist()
    if not records_all or "label_class" not in records_all[0]:
        sys.exit("features.parquet missing label_class — re-run mine_sweep_uatd_rich_ingest.py")
    feature_fields = discover_feature_fields(records_all[0])
    print(f"loaded {len(records_all)} records, feature_dim={len(feature_fields)}")

    # For an apples-to-apples comparison against the no-BTUT 0.30 weighted purity,
    # run with --positive-only (same 5,791 patches the prior T1 saw)
    if args.positive_only:
        records = [r for r in records_all if r["is_positive_strict"]]
    else:
        records = records_all
    print(f"  using {len(records)} records (positive_only={args.positive_only})")
    print(f"  class distribution: {Counter(r['label_class'] for r in records).most_common()}")

    # Build entities
    print("\n[1] building entities + KNN edges")
    name_to_record = {r["tile_id"]: r for r in records}
    entities = records_to_entities(records, feature_fields)
    X = np.array([[r[f] for f in feature_fields] for r in records], dtype=np.float32)
    names = [r["tile_id"] for r in records]
    edges = build_knn_edges(X, names, args.knn_k)
    print(f"  entities={len(entities)} edges={len(edges)}")

    # Run BTUT
    print("\n[2] running BTUT compression")
    survivors, btut_meta = run_btut(
        entities, edges,
        target_ratio=args.target_ratio,
        job_id=f"mine_sweep_btut_{int(time.time())}",
    )
    if not survivors:
        sys.exit("BTUT returned no survivors — check config")

    Z_surv, surv_records = survivors_to_z_and_labels(survivors, name_to_record, feature_fields)
    print(f"  survivor feature matrix: {Z_surv.shape}")
    surv_class_dist = Counter(r["label_class"] for r in surv_records)
    print(f"  survivor class distribution: {surv_class_dist.most_common()}")

    # Run substrate on survivors
    print("\n[3] running TCD-JEPA (energy=corpus_mean) on survivors")
    trained = cluster_substrate(surv_records, feature_fields, SUBSTRATE_CONFIG)
    print(f"  substrate emerged {trained['n_modules']} modules")

    # =========================
    # TEST 1: Module purity vs label_class on survivors
    # =========================
    print("\n[T1] purity vs ground-truth on survivors")
    surv_labels = [r["label_class"] for r in surv_records]
    purity, per_module = weighted_purity(trained["assigns"], surv_labels)
    surv_class_distribution = Counter(surv_labels)
    largest_class_frac = surv_class_distribution.most_common(1)[0][1] / len(surv_labels)
    chance = 1.0 / max(1, len(set(surv_labels)))

    from sklearn.metrics import normalized_mutual_info_score, adjusted_rand_score
    lab_idx = {lab: i for i, lab in enumerate(sorted(set(surv_labels)))}
    y = np.array([lab_idx[l] for l in surv_labels])
    nmi = float(normalized_mutual_info_score(y, trained["assigns"]))
    ari = float(adjusted_rand_score(y, trained["assigns"]))
    print(f"  WEIGHTED PURITY: {purity:.4f}  (largest-class {largest_class_frac:.4f}, chance {chance:.4f})")
    print(f"  NMI:             {nmi:.4f}")
    print(f"  ARI:             {ari:.4f}")
    print(f"  per-module dominant class (top 8):")
    for m in per_module[:8]:
        print(f"    mod {m['module']:>2}  size={m['size']:>4}  purity={m['purity']:.3f}  "
              f"dominant={m['dominant_class']!r}  {dict(list(m['class_breakdown'].items())[:5])}")

    # =========================
    # TEST 2: Within-class generalization on a held-out 20% of survivors
    # =========================
    print("\n[T2] within-class generalization (held-out 20% of survivors)")
    rng = random.Random(SUBSTRATE_SEED)
    by_class: dict[str, list[int]] = defaultdict(list)
    for i, lab in enumerate(surv_labels):
        by_class[lab].append(i)
    train_idx, test_idx = [], []
    for cls, group in by_class.items():
        rng.shuffle(group)
        cutoff = int(0.8 * len(group))
        train_idx.extend(group[:cutoff])
        test_idx.extend(group[cutoff:])
    if len(train_idx) >= 50 and len(test_idx) >= 20:
        # Re-cluster on 80% slice
        sub_train_records = [surv_records[i] for i in train_idx]
        sub_train = cluster_substrate(sub_train_records, feature_fields, SUBSTRATE_CONFIG)
        purity_train, per_mod_train = weighted_purity(
            sub_train["assigns"], [surv_labels[i] for i in train_idx]
        )
        dom_class_per_module = {m["module"]: m["dominant_class"] for m in per_mod_train}

        # Score held-out 20% via nearest-centroid
        Z_test = (np.array([[surv_records[i][f] for f in feature_fields] for i in test_idx],
                            dtype=np.float32) - sub_train["feature_mean"]) / (sub_train["feature_std"] + 1e-8)
        test_dists = np.linalg.norm(Z_test[:, None, :] - sub_train["centroids"][None, :, :], axis=2)
        test_assigns = test_dists.argmin(axis=1)

        correct = 0
        per_class_breakdown = defaultdict(lambda: {"total": 0, "correct": 0})
        for i_test_idx, a in zip(test_idx, test_assigns):
            true_cls = surv_labels[i_test_idx]
            pred_cls = dom_class_per_module.get(int(a), "<unknown>")
            per_class_breakdown[true_cls]["total"] += 1
            if pred_cls == true_cls:
                correct += 1
                per_class_breakdown[true_cls]["correct"] += 1
        coverage = correct / len(test_idx) if test_idx else 0.0
        print(f"  class-preserving generalization on held-out survivors: {coverage:.4f}")
        for cls in sorted(per_class_breakdown.keys()):
            info = per_class_breakdown[cls]
            if info["total"] > 0:
                print(f"    {cls:<20}: {info['correct']}/{info['total']} = {info['correct']/info['total']:.3f}")
        t2_result = {
            "class_preserving_generalization_rate": coverage,
            "per_class": {cls: {**info, "rate": info["correct"]/info["total"] if info["total"] else 0.0}
                          for cls, info in per_class_breakdown.items()},
            "n_train_survivor_80pct": len(train_idx),
            "n_test_survivor_20pct":  len(test_idx),
        }
    else:
        print("  not enough survivors per class for 80/20 split — skipping")
        t2_result = {"skipped": "insufficient survivor count per class"}

    # =========================
    # TEST 3: New-class detection on full (non-BTUT) test set
    # Train substrate-on-survivors as the manifold, score full corpus
    # =========================
    print("\n[T3] new-class detection — score full corpus against survivor-trained centroids")
    full_X = np.array([[r[f] for f in feature_fields] for r in records_all], dtype=np.float32)
    full_Z = (full_X - trained["feature_mean"]) / (trained["feature_std"] + 1e-8)

    # Off-manifold score = min distance to any survivor-trained centroid
    n = full_Z.shape[0]
    scores = np.empty(n, dtype=np.float32)
    chunk = 4096
    for s in range(0, n, chunk):
        block = full_Z[s : s + chunk]
        d = np.linalg.norm(block[:, None, :] - trained["centroids"][None, :, :], axis=2)
        scores[s : s + chunk] = d.min(axis=1)

    binary = np.array([
        1 if (r["is_positive_strict"] and r["label_class"] in HELD_OUT_CLASSES_FOR_TEST3) else 0
        for r in records_all
    ], dtype=np.int8)

    # Note: substrate WAS trained on a corpus that included held-out class members (when --positive-only NOT set)
    # For a true open-set test we'd need to remove held-out classes from the BTUT input.
    # We report the cross-check version with full corpus (substrate sees the full distribution).
    # Open-set version requires re-running BTUT excluding held-out classes — separate script call.
    from sklearn.metrics import roc_auc_score
    sub_auroc = float(roc_auc_score(binary, scores))
    held = scores[binary == 1]
    known = scores[binary == 0]
    sep_ratio = float(np.median(held) / (np.median(known) + 1e-8)) if held.size and known.size else float("nan")
    print(f"  substrate off-manifold AUROC (full corpus, full-corpus-trained):  {sub_auroc:.4f}")
    print(f"  median dist held-out classes / known: {np.median(held):.3f} / {np.median(known):.3f} = {sep_ratio:.3f}x")

    out = {
        "computed_at_utc":  datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "harness":          "btut_then_substrate",
        "btut":             btut_meta,
        "substrate_config": SUBSTRATE_CONFIG,
        "knn_k":            args.knn_k,
        "positive_only":    args.positive_only,
        "T1_module_purity": {
            "weighted_purity":         float(purity),
            "nmi":                     nmi,
            "ari":                     ari,
            "chance_baseline":         chance,
            "largest_class_baseline":  float(largest_class_frac),
            "n_modules_emerged":       trained["n_modules"],
            "n_classes_truth":         len(set(surv_labels)),
            "per_module":              per_module,
        },
        "T2_generalization": t2_result,
        "T3_new_class_detection": {
            "substrate_auroc":              sub_auroc,
            "substrate_separation_ratio":   sep_ratio,
            "n_held_out_positives":         int(binary.sum()),
            "n_known":                      int(len(binary) - binary.sum()),
            "note": "substrate trained on BTUT survivors of the full corpus including held-out classes; "
                    "for a strict open-set test, re-run with held-out classes removed from BTUT input",
        },
    }
    BTUT_SUMMARY.write_text(
        json.dumps(out, indent=2, default=float) + "\n",
        encoding="utf-8",
    )
    print(f"\nwrote {BTUT_SUMMARY.relative_to(ROOT)}")

    print("\n=== BTUT-CAMPAIGN SUMMARY (vs no-BTUT prior runs) ===")
    print(f"  prior no-BTUT weighted_purity:  0.3010")
    print(f"  BTUT-then-substrate purity:     {purity:.4f}   (Δ vs no-BTUT: {(purity - 0.3010):+.4f})")
    print(f"  BTUT survivors:                 {btut_meta['survivor_count']}   "
          f"(ratio: {btut_meta['actual_ratio']:.2f}x from {btut_meta['input_count']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
