"""
MINE-SWEEP CAMPAIGN-INTELLIGENCE HARNESS.

Three substrate-status experiments that convert the qualitative
"substrate produces campaign-level intelligence beyond detection" claim
into measured numbers.

Requires: data/validation/mine_sweep/features.parquet with these columns
  feat_0 ... feat_{D-1}      JL-projected patch features
  label_class                 per-patch ground-truth class (background, ball, cube, ...)
  is_positive_strict          (any object present)
  image_id, anchor_x_utm, anchor_y_utm   spatial metadata per patch

TEST 1 — Module purity vs ground-truth threat class
  Train substrate unsupervised on positive patches only.
  Each emerged module assigned a dominant-class label.
  Metrics: weighted purity, NMI, ARI, coverage, comparison to chance baseline.

TEST 2 — Spatial coherence + within-class generalization
  Hold out 20% of positives stratified by class.
  Train substrate on the 80%.
  Two measurements:
    (a) Generalization: % of held-out positives that nearest-centroid-assign
        to a module whose training-set members are dominated by the same
        true class.
    (b) Spatial coherence: avg within-module pairwise distance in
        (image_id, x, y) space vs corpus-wide pairwise distance.

TEST 3 — New-class doctrinal-shift detection
  Hold out the two smallest classes (cylinder, metal_bucket).
  Train substrate on background + 8 classes.
  Score off-manifold distance on the full test set.
  Compute AUROC: held-out-class vs known-class as a binary problem.
  Compare to IsolationForest baseline.

Outputs:
  data/validation/mine_sweep/campaign_intelligence_summary.json
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]

OUT_DIR              = ROOT / "data" / "validation" / "mine_sweep"
FEATURES_PARQ        = OUT_DIR / "features.parquet"
CAMPAIGN_SUMMARY     = OUT_DIR / "campaign_intelligence_summary.json"

SUBSTRATE_SEED = 42
SUBSTRATE_CONFIG_BASE = {
    "iters":             16,
    "max_modules":       32,
    "crystallize_every": 2,
    "langevin_steps":    30,
    "energy":            "corpus_mean",   # unsupervised, no label leakage for purity test
}

# For Tests 2 & 3, switch to normal-anchored
SUBSTRATE_CONFIG_NORMAL = {
    **SUBSTRATE_CONFIG_BASE,
    "energy":            "normal_centroid",
    "normal_label":      False,
}

HELD_OUT_CLASSES_FOR_TEST3 = ["cylinder", "metal bucket"]  # smallest 2 in UATD test_1


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


def train_substrate(records: list[dict], feature_fields: list[str], config: dict) -> dict:
    """Run substrate, return centroids + module member indices + module ids."""
    sys.path.insert(0, str(ROOT))
    from scripts.operators.embed import NumericDirectEmbedder  # noqa: E402
    from scripts.operators.cluster import TCDRecursiveLoop  # noqa: E402

    hard_seed(SUBSTRATE_SEED)

    embed_op = NumericDirectEmbedder()
    embed_out = embed_op.run(
        {"records": records},
        seed=SUBSTRATE_SEED,
        config={"fields": feature_fields, "l2_normalize": False},
    )
    Z = embed_out["Z"]

    inputs = {"Z": Z, "records": records}
    if config.get("energy") == "normal_centroid":
        inputs["label_field"] = "is_positive_strict"

    cluster_op = TCDRecursiveLoop()
    cluster_out = cluster_op.run(
        inputs,
        seed=SUBSTRATE_SEED,
        config=config,
    )

    raw_modules = [m for m in cluster_out.get("modules", []) if "centroid_vec" in m]
    centroids = np.array([m["centroid_vec"] for m in raw_modules], dtype=np.float32) if raw_modules else None

    if centroids is None or centroids.shape[0] == 0:
        centroids = Z.mean(axis=0, keepdims=True)
        module_ids = ["fallback_0"]
    else:
        module_ids = [str(m["module_id"]) for m in raw_modules]

    # Assign every record to its nearest centroid
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


def score_off_manifold(records: list[dict], feature_fields: list[str],
                       centroids: np.ndarray,
                       feature_mean: np.ndarray, feature_std: np.ndarray) -> np.ndarray:
    """Score each record by min distance to any centroid."""
    X = np.array([[r[f] for f in feature_fields] for r in records], dtype=np.float32)
    Z = (X - feature_mean) / (feature_std + 1e-8)
    n = Z.shape[0]
    out = np.empty(n, dtype=np.float32)
    chunk = 4096
    for s in range(0, n, chunk):
        block = Z[s : s + chunk]
        d = np.linalg.norm(block[:, None, :] - centroids[None, :, :], axis=2)
        out[s : s + chunk] = d.min(axis=1)
    return out


# =========================================================================
# TEST 1 — Module purity vs ground-truth threat class
# =========================================================================
def weighted_purity_and_confusion(assigns: np.ndarray, labels: list[str]) -> dict:
    """Per-module dominant-class purity, weighted by module size."""
    n = len(labels)
    confusion: dict[int, Counter] = defaultdict(Counter)
    for a, lab in zip(assigns, labels):
        confusion[int(a)][lab] += 1

    per_module = []
    weighted_correct = 0
    for mod_idx, counter in confusion.items():
        total = sum(counter.values())
        dominant, dominant_count = counter.most_common(1)[0]
        purity = dominant_count / total
        weighted_correct += dominant_count
        per_module.append({
            "module": mod_idx,
            "size": total,
            "dominant_class": dominant,
            "dominant_count": dominant_count,
            "purity": float(purity),
            "class_breakdown": dict(counter),
        })

    weighted_purity = weighted_correct / n if n else 0.0

    return {
        "weighted_purity": float(weighted_purity),
        "n_records": int(n),
        "n_modules": len(confusion),
        "per_module": sorted(per_module, key=lambda d: -d["size"]),
    }


def nmi(assigns: np.ndarray, labels: list[str]) -> float:
    """Normalized mutual information between modules and classes."""
    from sklearn.metrics import normalized_mutual_info_score
    lab_idx = {lab: i for i, lab in enumerate(sorted(set(labels)))}
    y = np.array([lab_idx[l] for l in labels])
    return float(normalized_mutual_info_score(y, assigns))


def ari(assigns: np.ndarray, labels: list[str]) -> float:
    from sklearn.metrics import adjusted_rand_score
    lab_idx = {lab: i for i, lab in enumerate(sorted(set(labels)))}
    y = np.array([lab_idx[l] for l in labels])
    return float(adjusted_rand_score(y, assigns))


def test_1_module_purity(records: list[dict], feature_fields: list[str]) -> dict:
    print("\n=== TEST 1: MODULE PURITY VS GROUND-TRUTH THREAT CLASS ===")
    positive_records = [r for r in records if r["is_positive_strict"]]
    print(f"  training substrate unsupervised on {len(positive_records)} positive patches")
    print(f"  (10-class structure must emerge without label supervision)")

    trained = train_substrate(positive_records, feature_fields, SUBSTRATE_CONFIG_BASE)
    print(f"  substrate emerged {trained['n_modules']} modules")

    labels = [r["label_class"] for r in positive_records]
    class_distribution = Counter(labels)
    print(f"  ground-truth class distribution: {dict(class_distribution.most_common())}")

    purity_info = weighted_purity_and_confusion(trained["assigns"], labels)
    nmi_val = nmi(trained["assigns"], labels)
    ari_val = ari(trained["assigns"], labels)

    largest_class_frac = class_distribution.most_common(1)[0][1] / len(labels)
    chance_baseline = 1.0 / len(set(labels))

    print(f"\n  WEIGHTED PURITY: {purity_info['weighted_purity']:.4f}")
    print(f"  NMI:             {nmi_val:.4f}")
    print(f"  ARI:             {ari_val:.4f}")
    print(f"  baselines:")
    print(f"    always-predict-largest-class: {largest_class_frac:.4f}")
    print(f"    chance (1/n_classes):         {chance_baseline:.4f}")
    print()
    print(f"  per-module dominant class (top 8):")
    for m in purity_info["per_module"][:8]:
        print(f"    module {m['module']:>2}  size={m['size']:>4}  purity={m['purity']:.3f}  "
              f"dominant={m['dominant_class']!r}  {dict(list(m['class_breakdown'].items())[:5])}")

    return {
        "weighted_purity":      purity_info["weighted_purity"],
        "nmi":                  nmi_val,
        "ari":                  ari_val,
        "largest_class_baseline": float(largest_class_frac),
        "chance_baseline":      chance_baseline,
        "n_modules_emerged":    trained["n_modules"],
        "n_classes_truth":      len(set(labels)),
        "per_module":           purity_info["per_module"],
    }


# =========================================================================
# TEST 2 — Spatial coherence + within-class generalization
# =========================================================================
def test_2_distribution_completeness(records: list[dict], feature_fields: list[str]) -> dict:
    print("\n=== TEST 2: SPATIAL COHERENCE + WITHIN-CLASS GENERALIZATION ===")

    positives = [r for r in records if r["is_positive_strict"]]
    rng = random.Random(SUBSTRATE_SEED)

    # Stratified 80/20 split by label_class
    by_class: dict[str, list[dict]] = defaultdict(list)
    for r in positives:
        by_class[r["label_class"]].append(r)

    train_recs = []
    test_recs = []
    for cls, group in by_class.items():
        rng.shuffle(group)
        cutoff = int(0.8 * len(group))
        train_recs.extend(group[:cutoff])
        test_recs.extend(group[cutoff:])

    print(f"  positives: {len(positives)}, train: {len(train_recs)}, test (held-out): {len(test_recs)}")

    # Train substrate unsupervised on train positives
    trained = train_substrate(train_recs, feature_fields, SUBSTRATE_CONFIG_BASE)
    print(f"  substrate emerged {trained['n_modules']} modules from 80% positives")

    # Compute training-set module-class confusion to define dominant-class per module
    train_labels = [r["label_class"] for r in train_recs]
    train_purity = weighted_purity_and_confusion(trained["assigns"], train_labels)
    dominant_class_per_module = {
        m["module"]: m["dominant_class"] for m in train_purity["per_module"]
    }

    # Score held-out positives → nearest centroid → assigned module
    test_scores = score_off_manifold(
        test_recs, feature_fields,
        trained["centroids"], trained["feature_mean"], trained["feature_std"],
    )
    test_X = np.array([[r[f] for f in feature_fields] for r in test_recs], dtype=np.float32)
    test_Z = (test_X - trained["feature_mean"]) / (trained["feature_std"] + 1e-8)
    test_dists = np.linalg.norm(test_Z[:, None, :] - trained["centroids"][None, :, :], axis=2)
    test_assigns = test_dists.argmin(axis=1)

    # Test 2(a) — class-preserving generalization
    correct_class = 0
    per_class_breakdown: dict[str, dict] = defaultdict(lambda: {"total": 0, "correct": 0})
    for r, a in zip(test_recs, test_assigns):
        true_cls = r["label_class"]
        predicted_cls = dominant_class_per_module.get(int(a), "<unknown>")
        per_class_breakdown[true_cls]["total"] += 1
        if predicted_cls == true_cls:
            correct_class += 1
            per_class_breakdown[true_cls]["correct"] += 1
    coverage_rate = correct_class / len(test_recs) if test_recs else 0.0

    print(f"\n  (a) Class-preserving generalization:")
    print(f"      {coverage_rate:.4f} of held-out positives assigned to substrate-module dominated by their true class")
    for cls in sorted(per_class_breakdown.keys()):
        info = per_class_breakdown[cls]
        if info["total"] > 0:
            print(f"        {cls:<20}: {info['correct']}/{info['total']} = {info['correct']/info['total']:.3f}")

    # Test 2(b) — spatial coherence
    # For each module, compute avg pairwise distance among its training members in (image_id, x, y)
    train_spatial = np.array([
        [hash(r["image_id"]) % 10000, r["anchor_x_utm"], r["anchor_y_utm"]]
        for r in train_recs
    ], dtype=np.float32)
    # Within-module spatial pairwise (sampled to bound cost)
    within_mod_dists = []
    for mod_idx in set(trained["assigns"]):
        members = np.where(trained["assigns"] == mod_idx)[0]
        if len(members) < 2:
            continue
        if len(members) > 500:
            sub_idx = rng.sample(list(members), 500)
            members = np.array(sub_idx)
        pts = train_spatial[members]
        d = np.linalg.norm(pts[:, None, :] - pts[None, :, :], axis=2)
        triu = d[np.triu_indices_from(d, k=1)]
        within_mod_dists.append(triu)
    within_all = np.concatenate(within_mod_dists) if within_mod_dists else np.array([0.0])

    # Corpus-wide spatial pairwise (subsampled)
    n_corp = min(2000, train_spatial.shape[0])
    corp_idx = rng.sample(range(train_spatial.shape[0]), n_corp)
    corp_pts = train_spatial[corp_idx]
    d_corp = np.linalg.norm(corp_pts[:, None, :] - corp_pts[None, :, :], axis=2)
    corpus_all = d_corp[np.triu_indices_from(d_corp, k=1)]

    spatial_coherence_ratio = (
        float(within_all.mean() / (corpus_all.mean() + 1e-8))
        if corpus_all.size and within_all.size else 0.0
    )

    print(f"\n  (b) Spatial coherence:")
    print(f"      within-module avg pairwise spatial dist : {within_all.mean():.2f}")
    print(f"      corpus-wide  avg pairwise spatial dist : {corpus_all.mean():.2f}")
    print(f"      ratio (smaller = more spatially coherent): {spatial_coherence_ratio:.4f}")

    return {
        "n_train":              len(train_recs),
        "n_test":               len(test_recs),
        "class_preserving_generalization_rate": coverage_rate,
        "per_class_coverage": {
            cls: {"correct": info["correct"], "total": info["total"], "rate": (info["correct"]/info["total"]) if info["total"] else 0.0}
            for cls, info in per_class_breakdown.items()
        },
        "spatial_within_module_avg_dist": float(within_all.mean()),
        "spatial_corpus_avg_dist":        float(corpus_all.mean()),
        "spatial_coherence_ratio":        spatial_coherence_ratio,
    }


# =========================================================================
# TEST 3 — New-class doctrinal-shift detection
# =========================================================================
def test_3_new_class_detection(records: list[dict], feature_fields: list[str]) -> dict:
    print("\n=== TEST 3: NEW-CLASS DOCTRINAL-SHIFT DETECTION ===")
    print(f"  held-out classes (unseen during training): {HELD_OUT_CLASSES_FOR_TEST3}")

    train_recs = [r for r in records
                  if not r["is_positive_strict"] or r["label_class"] not in HELD_OUT_CLASSES_FOR_TEST3]
    print(f"  training records (bg + 8 classes): {len(train_recs)}")

    # Per project owner directive: TCD-JEPA only, energy=corpus_mean throughout
    trained = train_substrate(train_recs, feature_fields, SUBSTRATE_CONFIG_BASE)
    print(f"  substrate emerged {trained['n_modules']} modules")

    # Score the full corpus
    scores = score_off_manifold(
        records, feature_fields,
        trained["centroids"], trained["feature_mean"], trained["feature_std"],
    )

    # Binary label: 1 = held-out class, 0 = known class (background OR seen positive)
    binary = np.array([
        1 if (r["is_positive_strict"] and r["label_class"] in HELD_OUT_CLASSES_FOR_TEST3) else 0
        for r in records
    ], dtype=np.int8)

    print(f"  test labels: {int(binary.sum())} held-out-class positives, {int(len(binary) - binary.sum())} known")

    from sklearn.metrics import roc_auc_score
    substrate_auroc = float(roc_auc_score(binary, scores))

    # IF baseline trained on background + 8 known classes
    from sklearn.ensemble import IsolationForest
    X_train = np.array([[r[f] for f in feature_fields] for r in train_recs], dtype=np.float32)
    X_full  = np.array([[r[f] for f in feature_fields] for r in records],    dtype=np.float32)
    forest = IsolationForest(n_estimators=200, contamination="auto", random_state=SUBSTRATE_SEED, n_jobs=-1).fit(X_train)
    if_scores = -forest.decision_function(X_full)
    if_auroc = float(roc_auc_score(binary, if_scores))

    # Mahalanobis baseline
    mean = X_train.mean(axis=0); cov = np.cov(X_train, rowvar=False) + 1e-6 * np.eye(X_train.shape[1])
    cov_inv = np.linalg.inv(cov)
    delta = X_full - mean
    mahal_scores = np.sqrt(np.einsum("ij,jk,ik->i", delta, cov_inv, delta))
    mahal_auroc = float(roc_auc_score(binary, mahal_scores))

    # Median off-manifold distance for held-out vs known classes
    held_idx = np.where(binary == 1)[0]
    known_idx = np.where(binary == 0)[0]
    sub_median_held  = float(np.median(scores[held_idx]))
    sub_median_known = float(np.median(scores[known_idx]))
    sub_separation_ratio = sub_median_held / (sub_median_known + 1e-8)

    print(f"\n  AUROC for detecting held-out classes as off-manifold:")
    print(f"    substrate            : {substrate_auroc:.4f}")
    print(f"    isolation_forest     : {if_auroc:.4f}")
    print(f"    mahalanobis          : {mahal_auroc:.4f}")
    print(f"  substrate median off-manifold dist: held-out={sub_median_held:.4f}  known={sub_median_known:.4f}  "
          f"ratio={sub_separation_ratio:.3f}x")

    return {
        "held_out_classes": HELD_OUT_CLASSES_FOR_TEST3,
        "n_train": len(train_recs),
        "n_test_held_out": int(binary.sum()),
        "n_test_known":    int(len(binary) - binary.sum()),
        "substrate_auroc":         substrate_auroc,
        "isolation_forest_auroc":  if_auroc,
        "mahalanobis_auroc":       mahal_auroc,
        "substrate_separation_ratio_held_over_known": sub_separation_ratio,
        "substrate_median_held":  sub_median_held,
        "substrate_median_known": sub_median_known,
    }


# =========================================================================
# Main
# =========================================================================
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-test", action="append", default=[],
                        help="skip test N (e.g. --skip-test 2 --skip-test 3)")
    args = parser.parse_args()

    import pyarrow.parquet as pq
    table = pq.read_table(FEATURES_PARQ)
    records = table.to_pylist()
    if not records:
        sys.exit(f"empty parquet at {FEATURES_PARQ}")
    if "label_class" not in records[0]:
        sys.exit("features.parquet missing label_class column — re-run mine_sweep_uatd_rich_ingest.py")
    feature_fields = discover_feature_fields(records[0])
    print(f"loaded {len(records)} records, feature_dim = {len(feature_fields)}")
    print(f"  classes present: {sorted(set(r['label_class'] for r in records))}")

    out = {
        "computed_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "n_records": len(records),
        "feature_dim": len(feature_fields),
    }

    if "1" not in args.skip_test:
        out["test_1_module_purity"] = test_1_module_purity(records, feature_fields)
    if "2" not in args.skip_test:
        out["test_2_distribution_completeness"] = test_2_distribution_completeness(records, feature_fields)
    if "3" not in args.skip_test:
        out["test_3_new_class_detection"] = test_3_new_class_detection(records, feature_fields)

    CAMPAIGN_SUMMARY.write_text(
        json.dumps(out, indent=2, default=float) + "\n",
        encoding="utf-8",
    )
    print(f"\nwrote {CAMPAIGN_SUMMARY.relative_to(ROOT)}")

    print("\n=== CAMPAIGN-INTELLIGENCE SUMMARY ===")
    if "test_1_module_purity" in out:
        t1 = out["test_1_module_purity"]
        print(f"  T1 weighted_purity   : {t1['weighted_purity']:.4f}   "
              f"(largest-class baseline {t1['largest_class_baseline']:.4f}, chance {t1['chance_baseline']:.4f})")
        print(f"  T1 NMI               : {t1['nmi']:.4f}   ARI: {t1['ari']:.4f}")
    if "test_2_distribution_completeness" in out:
        t2 = out["test_2_distribution_completeness"]
        print(f"  T2 class-preserving generalization: {t2['class_preserving_generalization_rate']:.4f}")
        print(f"  T2 spatial coherence ratio: {t2['spatial_coherence_ratio']:.4f} (lower = more coherent)")
    if "test_3_new_class_detection" in out:
        t3 = out["test_3_new_class_detection"]
        print(f"  T3 substrate AUROC for new-class detection: {t3['substrate_auroc']:.4f}")
        print(f"     IF: {t3['isolation_forest_auroc']:.4f}   Mahal: {t3['mahalanobis_auroc']:.4f}")
        print(f"  T3 substrate held/known dist ratio: {t3['substrate_separation_ratio_held_over_known']:.3f}x")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
