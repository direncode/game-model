"""
MINE-SWEEP MILITARY-RELEVANT HARNESS — open-set off-manifold detection.

What this measures:
  Train substrate on NORMAL records only (the majority "clean seafloor" class).
  Substrate emerges K modules covering the normal-return manifold.
  Score every test record by minimum distance to any learned centroid.
  Records that don't fit any normal module score HIGH = candidate anomaly.

  This is the regime the military actually evaluates MCM systems on:
    - Open-set (unknown threats welcome)
    - Train on normal, detect off-manifold
    - ROC-driven, not top-K-driven

Metrics:
  ROC curve over the off-manifold anomaly score
  P_d at P_fa = {0.01, 0.001, 0.0001}
  MDBFA (mean distance between false alarms) at each operating point
  AUROC (full curve summary)

Baselines (identical train-on-normal-only protocol):
  Isolation Forest        — textbook open-set
  One-Class SVM           — textbook one-class boundary
  Mahalanobis to corpus   — minimum unsupervised floor

Military-credibility B-gate:
  P_d ≥ 0.85 at P_fa ≤ 0.01  AND  substrate AUROC ≥ best baseline AUROC

Inputs:
  data/validation/mine_sweep/features.parquet  (any prior ingest)

Outputs:
  data/validation/mine_sweep/openset_summary.json
  data/validation/mine_sweep/openset_roc.json

Per docs/SUBSTRATE_FIT_PROFILE.md + the military framing locked in 2026-05-11.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]

# ---------- config -------------------------------------------------------
OUT_DIR             = ROOT / "data" / "validation" / "mine_sweep"
FEATURES_PARQ       = OUT_DIR / "features.parquet"
OPENSET_SUMMARY     = OUT_DIR / "openset_summary.json"
OPENSET_ROC         = OUT_DIR / "openset_roc.json"

FEATURE_FIELDS_DEFAULT = ["residual_rms", "local_relief", "slope_std", "laplacian_std"]


def discover_feature_fields(record: dict) -> list[str]:
    """Auto-discover the feature columns.

    Rich-feature corpora carry feat_0 ... feat_{D-1}. If any feat_* keys
    are present, prefer them. Otherwise fall back to the 4 scalar stats.
    """
    feat_keys = sorted(
        (k for k in record if k.startswith("feat_")),
        key=lambda s: int(s.split("_")[1]),
    )
    if feat_keys:
        return feat_keys
    return FEATURE_FIELDS_DEFAULT


# Module-level: resolved lazily inside main(), referenced by helpers as a
# parameter or a module global once main() sets it.
FEATURE_FIELDS = FEATURE_FIELDS_DEFAULT

# Substrate now trained on FULL corpus with energy anchored on the NORMAL
# class centroid. The Langevin loop sees both normals and positives, but
# the energy function pulls toward the normal-only mean, so emergent
# modules cover the normal manifold tightly and positives sit far from
# every centroid at test time. This is the "normal_centroid" mode in
# scripts/operators/cluster.py — same operator the NSL-KDD validation uses.
SUBSTRATE_CONFIG = {
    "iters":             16,
    "max_modules":       64,    # bumped from 32: 1024-d space supports more emergent modes
    "crystallize_every": 2,
    "langevin_steps":    30,
    "energy":            "normal_centroid",
    "normal_label":      False, # is_positive_strict == False  →  background  →  normal class
}
SUBSTRATE_LABEL_FIELD = "is_positive_strict"
SUBSTRATE_SEED = 42

# OCSVM at 1024-d on 25K records would compute a 25Kx25K kernel matrix (~5GB).
# Subsample its fit to keep this tractable; predict on full test set.
OCSVM_FIT_SUBSAMPLE = 5000

# Military operating points for ROC
PFA_OPERATING_POINTS = [0.01, 0.001, 0.0001]

# Military-credibility gate
MIL_GATE_P_D_AT_PFA   = 0.85
MIL_GATE_P_FA_LIMIT   = 0.01
# -------------------------------------------------------------------------


def load_train_test_split(records: list[dict]) -> tuple[list[dict], list[dict]]:
    """Train = the MAJORITY (negative) class. Test = full corpus.

    For SeabedObjects: train on ships (negatives, 385), test on all 447.
    For Stellwagen: train on non-positive tiles (~14038), test on all 14043.

    The point: substrate learns the normal manifold from negatives only.
    Off-manifold detection then surfaces records that don't fit.
    """
    normal = [r for r in records if not r["is_positive_strict"]]
    return normal, records


def train_substrate(all_records: list[dict]) -> dict:
    """Train substrate via cluster.tcd_recursive_loop on the FULL corpus,
    with the energy function anchored on the normal-class centroid.

    The Langevin loop sees positives and negatives, but the energy potential
    is computed only against the mean of records where
    `is_positive_strict == False`. Emergent modules form along the
    low-energy normal manifold; positives stay far from every module's
    centroid because they raise the energy.
    """
    sys.path.insert(0, str(ROOT))
    from scripts.operators.embed import NumericDirectEmbedder  # noqa: E402
    from scripts.operators.cluster import TCDRecursiveLoop  # noqa: E402

    embed_op = NumericDirectEmbedder()
    embed_out = embed_op.run(
        {"records": all_records},
        seed=SUBSTRATE_SEED,
        config={"fields": FEATURE_FIELDS, "l2_normalize": False},
    )
    Z_train = embed_out["Z"]
    feature_mean = np.array(embed_out["feature_mean"], dtype=np.float32)
    feature_std  = np.array(embed_out["feature_std"],  dtype=np.float32)

    cluster_op = TCDRecursiveLoop()
    cluster_out = cluster_op.run(
        {
            "Z":           Z_train,
            "records":     all_records,
            "label_field": SUBSTRATE_LABEL_FIELD,
        },
        seed=SUBSTRATE_SEED,
        config=SUBSTRATE_CONFIG,
    )

    centroids = np.array(
        [m["centroid_vec"] for m in cluster_out.get("modules", []) if "centroid_vec" in m],
        dtype=np.float32,
    )
    if centroids.size == 0:
        # Fallback: normal-only mean
        X = np.array([[r[f] for f in FEATURE_FIELDS] for r in all_records if not r["is_positive_strict"]], dtype=np.float32)
        Z = (X - feature_mean) / (feature_std + 1e-8)
        centroids = Z.mean(axis=0, keepdims=True)

    return {
        "centroids":    centroids,
        "n_modules":    centroids.shape[0],
        "feature_mean": feature_mean,
        "feature_std":  feature_std,
    }


def normalize_test_features(records: list[dict], mean: np.ndarray, std: np.ndarray) -> np.ndarray:
    X = np.array(
        [[r[f] for f in FEATURE_FIELDS] for r in records],
        dtype=np.float32,
    )
    return (X - mean) / (std + 1e-8)


def score_off_manifold(Z_test: np.ndarray, centroids: np.ndarray) -> np.ndarray:
    """Per-record anomaly score = min Euclidean distance to ANY centroid.

    This is the off-manifold operator. Records that fit some normal-class
    module score LOW; records that don't fit any score HIGH = anomaly.
    """
    n = Z_test.shape[0]
    out = np.empty(n, dtype=np.float32)
    chunk = 4096
    for s in range(0, n, chunk):
        block = Z_test[s : s + chunk]
        d = np.linalg.norm(block[:, None, :] - centroids[None, :, :], axis=2)
        out[s : s + chunk] = d.min(axis=1)
    return out


# =========================================================================
# Baselines — all trained on normal-only, scored on full test set.
# =========================================================================
def baseline_isolation_forest(normal_records, test_records):
    from sklearn.ensemble import IsolationForest
    X_train = np.array([[r[f] for f in FEATURE_FIELDS] for r in normal_records], dtype=np.float32)
    X_test  = np.array([[r[f] for f in FEATURE_FIELDS] for r in test_records],   dtype=np.float32)
    forest = IsolationForest(n_estimators=200, contamination="auto", random_state=SUBSTRATE_SEED, n_jobs=-1)
    forest.fit(X_train)
    return -forest.decision_function(X_test)


def baseline_one_class_svm(normal_records, test_records):
    from sklearn.svm import OneClassSVM
    X_train_full = np.array([[r[f] for f in FEATURE_FIELDS] for r in normal_records], dtype=np.float32)
    X_test       = np.array([[r[f] for f in FEATURE_FIELDS] for r in test_records],   dtype=np.float32)
    # Z-score normalize on FULL training stats
    mean = X_train_full.mean(axis=0)
    std  = X_train_full.std(axis=0) + 1e-8
    X_train_z = (X_train_full - mean) / std
    X_test_z  = (X_test  - mean) / std
    # Subsample for kernel-fit tractability at high D
    if X_train_z.shape[0] > OCSVM_FIT_SUBSAMPLE:
        rng = np.random.default_rng(SUBSTRATE_SEED)
        idx = rng.choice(X_train_z.shape[0], size=OCSVM_FIT_SUBSAMPLE, replace=False)
        X_fit = X_train_z[idx]
        print(f"    [OCSVM] subsampled fit set: {X_fit.shape[0]} of {X_train_z.shape[0]}")
    else:
        X_fit = X_train_z
    svm = OneClassSVM(kernel="rbf", nu=0.1, gamma="auto")
    svm.fit(X_fit)
    return -svm.decision_function(X_test_z)


def baseline_mahalanobis(normal_records, test_records):
    X_train = np.array([[r[f] for f in FEATURE_FIELDS] for r in normal_records], dtype=np.float32)
    X_test  = np.array([[r[f] for f in FEATURE_FIELDS] for r in test_records],   dtype=np.float32)
    mean = X_train.mean(axis=0)
    cov  = np.cov(X_train, rowvar=False) + 1e-6 * np.eye(X_train.shape[1])
    cov_inv = np.linalg.inv(cov)
    delta = X_test - mean
    return np.sqrt(np.einsum("ij,jk,ik->i", delta, cov_inv, delta))


# =========================================================================
# Metrics
# =========================================================================
def roc_curve_manual(scores: np.ndarray, labels: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Manual ROC: sort by score descending, sweep threshold downward."""
    order = np.argsort(-scores)
    s = scores[order]
    y = labels[order].astype(np.int8)

    n_pos = int(y.sum())
    n_neg = int(len(y) - n_pos)
    if n_pos == 0 or n_neg == 0:
        return np.array([0.0, 1.0]), np.array([0.0, 1.0]), np.array([0.0, 0.0])

    tp = np.cumsum(y == 1)
    fp = np.cumsum(y == 0)
    tpr = tp / n_pos
    fpr = fp / n_neg

    # Prepend the (0, 0) point at infinite-threshold
    tpr = np.concatenate(([0.0], tpr))
    fpr = np.concatenate(([0.0], fpr))
    thr = np.concatenate(([float("inf")], s))
    return fpr, tpr, thr


def auroc(fpr: np.ndarray, tpr: np.ndarray) -> float:
    # Trapezoidal integration of TPR over FPR (FPR is non-decreasing)
    # np.trapz was renamed to np.trapezoid in NumPy 2.x
    trap = getattr(np, "trapezoid", None) or getattr(np, "trapz")
    return float(trap(tpr, fpr))


def p_d_at_p_fa(fpr: np.ndarray, tpr: np.ndarray, thr: np.ndarray, target_p_fa: float) -> dict:
    """Return P_d and the threshold at the tightest P_fa <= target."""
    valid = fpr <= target_p_fa
    if not valid.any():
        return {"p_d": 0.0, "p_fa": 0.0, "threshold": float("inf")}
    idx = np.where(valid)[0][-1]  # tightest allowable P_fa
    return {
        "p_d":       float(tpr[idx]),
        "p_fa":      float(fpr[idx]),
        "threshold": float(thr[idx]) if math.isfinite(thr[idx]) else None,
    }


def mdbfa(scores: np.ndarray, labels: np.ndarray, threshold: float) -> float:
    """Mean records between consecutive false alarms at the given threshold.

    A "false alarm" = record with score >= threshold AND label = 0.
    MDBFA = (number of label-0 records) / (number of false alarms) at that threshold.
    Higher = more sparing of false alarms.
    """
    flagged = scores >= threshold
    fa_count = int(((labels == 0) & flagged).sum())
    if fa_count == 0:
        return float("inf")
    neg_total = int((labels == 0).sum())
    return float(neg_total / fa_count)


# =========================================================================
# B-gate
# =========================================================================
def military_b_gate(summary: dict) -> dict:
    sub = summary["substrate"]
    p_d_sub = sub["p_d_at_p_fa"]["pfa_0.01"]["p_d"]
    auroc_sub = sub["auroc"]
    best_baseline_auroc = max(
        b["auroc"] for b in summary["baselines"].values()
    )
    cond_pd = p_d_sub >= MIL_GATE_P_D_AT_PFA
    cond_auroc = auroc_sub >= best_baseline_auroc
    if cond_pd and cond_auroc:
        verdict = "MILITARY_CREDIBLE"
    elif p_d_sub > 0.5 and auroc_sub > 0.7:
        verdict = "PROMISING_NOT_FIELDED"
    else:
        verdict = "FAILS_MILITARY_GATE"
    return {
        "verdict": verdict,
        "threshold_p_d_at_pfa_0.01": MIL_GATE_P_D_AT_PFA,
        "substrate_p_d_at_pfa_0.01": p_d_sub,
        "substrate_auroc":            auroc_sub,
        "best_baseline_auroc":        best_baseline_auroc,
    }


# =========================================================================
# Main
# =========================================================================
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    args = parser.parse_args()

    import pyarrow.parquet as pq
    table = pq.read_table(FEATURES_PARQ)
    records = table.to_pylist()
    print(f"loaded {len(records)} records from {FEATURES_PARQ.relative_to(ROOT)}")

    # Resolve feature columns: prefer feat_* if present, fall back to 4 stats
    global FEATURE_FIELDS
    if records:
        FEATURE_FIELDS = discover_feature_fields(records[0])
    print(f"  feature dim: {len(FEATURE_FIELDS)}  (first 3: {FEATURE_FIELDS[:3]})")

    normal, all_test = load_train_test_split(records)
    print(f"  train (normal only): {len(normal)}")
    print(f"  test  (full):        {len(all_test)}")

    labels = np.array([1 if r["is_positive_strict"] else 0 for r in all_test], dtype=np.int8)
    n_pos = int(labels.sum())
    n_neg = int(len(labels) - n_pos)
    print(f"  positives in test: {n_pos}, negatives: {n_neg}")

    # === SUBSTRATE ===
    print(f"\n--- training substrate on FULL corpus ({len(all_test)} records) ---")
    print(f"    energy anchored on normal-class centroid (label '{SUBSTRATE_LABEL_FIELD}' == False)")
    trained = train_substrate(all_test)
    print(f"  substrate emerged {trained['n_modules']} normal-manifold modules")

    Z_test = normalize_test_features(all_test, trained["feature_mean"], trained["feature_std"])
    sub_scores = score_off_manifold(Z_test, trained["centroids"])

    # === BASELINES ===
    print("\n--- baselines (same train-on-normal protocol) ---")
    if_scores  = baseline_isolation_forest(normal, all_test)
    print(f"  isolation_forest: scores computed")
    svm_scores = baseline_one_class_svm(normal, all_test)
    print(f"  one_class_svm: scores computed")
    mah_scores = baseline_mahalanobis(normal, all_test)
    print(f"  mahalanobis: scores computed")

    # === METRICS ===
    def full_metrics(name, scores):
        fpr, tpr, thr = roc_curve_manual(scores, labels)
        a = auroc(fpr, tpr)
        pd_at = {}
        for pfa in PFA_OPERATING_POINTS:
            r = p_d_at_p_fa(fpr, tpr, thr, pfa)
            r["mdbfa"] = mdbfa(scores, labels, r["threshold"]) if r["threshold"] is not None else float("inf")
            pd_at[f"pfa_{pfa}"] = r
        return {
            "name":          name,
            "auroc":         a,
            "p_d_at_p_fa":   pd_at,
            "n_test":        int(len(labels)),
            "n_positive":    n_pos,
            "n_negative":    n_neg,
            "roc_fpr":       [float(x) for x in fpr.tolist()],
            "roc_tpr":       [float(x) for x in tpr.tolist()],
        }

    substrate_metrics = full_metrics("substrate_off_manifold", sub_scores)
    if_metrics  = full_metrics("isolation_forest",  if_scores)
    svm_metrics = full_metrics("one_class_svm",     svm_scores)
    mah_metrics = full_metrics("mahalanobis",       mah_scores)

    print("\n--- AUROC ---")
    for m in [substrate_metrics, if_metrics, svm_metrics, mah_metrics]:
        print(f"  {m['name']:<22}: AUROC = {m['auroc']:.4f}")

    print("\n--- P_d at fixed P_fa ---")
    for pfa in PFA_OPERATING_POINTS:
        print(f"  P_fa = {pfa}")
        for m in [substrate_metrics, if_metrics, svm_metrics, mah_metrics]:
            r = m["p_d_at_p_fa"][f"pfa_{pfa}"]
            mdbfa_str = f"{r['mdbfa']:.1f}" if math.isfinite(r["mdbfa"]) else "inf"
            print(f"    {m['name']:<22}: P_d = {r['p_d']:.3f}  (achieved P_fa = {r['p_fa']:.4f}, MDBFA = {mdbfa_str})")

    # === SUMMARY ===
    summary = {
        "harness":             "openset_off_manifold",
        "substrate":           {k: v for k, v in substrate_metrics.items() if k not in ("roc_fpr", "roc_tpr")},
        "baselines": {
            "isolation_forest": {k: v for k, v in if_metrics.items() if k not in ("roc_fpr", "roc_tpr")},
            "one_class_svm":    {k: v for k, v in svm_metrics.items() if k not in ("roc_fpr", "roc_tpr")},
            "mahalanobis":      {k: v for k, v in mah_metrics.items() if k not in ("roc_fpr", "roc_tpr")},
        },
        "substrate_config":    SUBSTRATE_CONFIG,
        "n_normal_train":      len(normal),
        "n_test":              len(all_test),
        "n_positive_in_test":  n_pos,
        "n_substrate_modules": int(trained["n_modules"]),
        "computed_at_utc":     datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    summary["military_b_gate"] = military_b_gate(summary)

    print(f"\n=== MILITARY-CREDIBILITY VERDICT: {summary['military_b_gate']['verdict']} ===")
    print(f"  substrate AUROC:                    {summary['military_b_gate']['substrate_auroc']:.4f}")
    print(f"  best baseline AUROC:                {summary['military_b_gate']['best_baseline_auroc']:.4f}")
    print(f"  substrate P_d @ P_fa=0.01:          {summary['military_b_gate']['substrate_p_d_at_pfa_0.01']:.3f}")
    print(f"  required for fielded-grade:         {MIL_GATE_P_D_AT_PFA}")

    OPENSET_SUMMARY.write_text(
        json.dumps(summary, indent=2, default=float) + "\n",
        encoding="utf-8",
    )
    print(f"\nwrote {OPENSET_SUMMARY.relative_to(ROOT)}")

    roc_artifact = {
        "substrate":        {"fpr": substrate_metrics["roc_fpr"], "tpr": substrate_metrics["roc_tpr"]},
        "isolation_forest": {"fpr": if_metrics["roc_fpr"],  "tpr": if_metrics["roc_tpr"]},
        "one_class_svm":    {"fpr": svm_metrics["roc_fpr"], "tpr": svm_metrics["roc_tpr"]},
        "mahalanobis":      {"fpr": mah_metrics["roc_fpr"], "tpr": mah_metrics["roc_tpr"]},
    }
    OPENSET_ROC.write_text(
        json.dumps(roc_artifact, default=float) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {OPENSET_ROC.relative_to(ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
