"""
MINE-SWEEP CROSS-CORPUS RE-ANCHORING TEST.

Substrate-status hypothesis: the substrate's module STRUCTURE is
data-type-invariant — train on Site A's normal manifold, deploy at
Site B by RE-COMPUTING centroids on B's normal data while keeping
the module decomposition. The earlier naive transfer (UATD centroids
applied directly to SeabedObjects records) measured 0.49 AUROC on
1024-d JL features and failed. This test re-anchors instead.

Protocol:
  1. Load UATD Gabor features (training corpus, MFLS sonar)
  2. Train substrate on UATD background → learn K module centroids in 128-d Gabor space
  3. Load SeabedObjects Gabor features (deployment corpus, sidescan sonar)
  4. RE-ANCHOR: for each UATD module, find SeabedObjects records that nearest-
     assign to it, recompute centroid as mean of those records' features.
     This keeps the K-module STRUCTURE but moves CENTROIDS to SeabedObjects'
     feature distribution.
  5. Score SeabedObjects records via min-distance to re-anchored centroids
  6. AUROC for plane (positive) vs ship (negative) detection

Baselines (also trained on UATD, deployed naively to SeabedObjects):
  - Isolation Forest
  - Mahalanobis distance from UATD background mean

If substrate's re-anchored AUROC > naive substrate AUROC AND > baseline
AUROCs, the substrate's "re-anchor instead of retrain" property is
empirically demonstrated. Substrate-status implication: substrate can
be deployed at site B without retraining from scratch.

Outputs: data/validation/mine_sweep/cross_corpus_summary.json
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]

OUT_DIR              = ROOT / "data" / "validation" / "mine_sweep"
UATD_GABOR_PARQ      = OUT_DIR / "features_uatd_gabor.parquet"
SEABED_GABOR_PARQ    = OUT_DIR / "features_seabed_gabor.parquet"
CROSS_CORPUS_SUMMARY = OUT_DIR / "cross_corpus_summary.json"

SUBSTRATE_SEED = 42
SUBSTRATE_CONFIG = {
    "iters":             16,
    "max_modules":       32,
    "crystallize_every": 2,
    "langevin_steps":    30,
    "energy":            "corpus_mean",
}


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


def train_substrate_on_uatd(records: list[dict], feature_fields: list[str]):
    """Train substrate on UATD background only; return centroids + normalization stats."""
    sys.path.insert(0, str(ROOT))
    from scripts.operators.embed import NumericDirectEmbedder  # noqa: E402
    from scripts.operators.cluster import TCDRecursiveLoop  # noqa: E402

    hard_seed(SUBSTRATE_SEED)
    bg = [r for r in records if not r["is_positive_strict"]]
    print(f"  training substrate on {len(bg)} UATD background records")

    embed_op = NumericDirectEmbedder()
    embed_out = embed_op.run(
        {"records": bg},
        seed=SUBSTRATE_SEED,
        config={"fields": feature_fields, "l2_normalize": False},
    )
    Z = embed_out["Z"]
    feature_mean = np.array(embed_out["feature_mean"], dtype=np.float32)
    feature_std  = np.array(embed_out["feature_std"],  dtype=np.float32)

    cluster_op = TCDRecursiveLoop()
    cluster_out = cluster_op.run(
        {"Z": Z, "records": bg},
        seed=SUBSTRATE_SEED,
        config=SUBSTRATE_CONFIG,
    )
    raw_mods = [m for m in cluster_out.get("modules", []) if "centroid_vec" in m]
    if not raw_mods:
        centroids = Z.mean(axis=0, keepdims=True)
    else:
        centroids = np.array([m["centroid_vec"] for m in raw_mods], dtype=np.float32)
    print(f"  substrate emerged {centroids.shape[0]} modules on UATD")
    return {
        "centroids_uatd":  centroids,
        "feature_mean_uatd": feature_mean,
        "feature_std_uatd":  feature_std,
    }


def re_anchor_centroids(seabed_records: list[dict], feature_fields: list[str],
                        centroids_uatd: np.ndarray,
                        feature_mean_uatd: np.ndarray,
                        feature_std_uatd: np.ndarray) -> np.ndarray:
    """Re-anchor UATD module structure on SeabedObjects' normal (ship) records.

    For each UATD module, find SeabedObjects ship records that nearest-assign
    to it (using UATD's z-score normalization), then recompute that module's
    centroid as the MEAN of those re-assigned SeabedObjects records.
    Modules with zero re-assigned records keep the UATD centroid.
    """
    bg_seabed = [r for r in seabed_records if not r["is_positive_strict"]]
    print(f"  re-anchoring on {len(bg_seabed)} SeabedObjects ship records")
    if not bg_seabed:
        return centroids_uatd

    X_bg = np.array([[r[f] for f in feature_fields] for r in bg_seabed], dtype=np.float32)
    # Use UATD z-score normalization (the "shared coordinate frame")
    Z_bg = (X_bg - feature_mean_uatd) / (feature_std_uatd + 1e-8)

    # Assign each SeabedObjects ship to nearest UATD centroid
    dists = np.linalg.norm(Z_bg[:, None, :] - centroids_uatd[None, :, :], axis=2)
    assigns = dists.argmin(axis=1)

    K = centroids_uatd.shape[0]
    new_centroids = centroids_uatd.copy()
    assigned_counts = np.zeros(K, dtype=np.int32)
    for k in range(K):
        mask = (assigns == k)
        assigned_counts[k] = int(mask.sum())
        if mask.any():
            new_centroids[k] = Z_bg[mask].mean(axis=0)
    print(f"  re-anchored centroids: assignment counts = {assigned_counts.tolist()}")
    return new_centroids


def score_seabed_records(seabed_records: list[dict], feature_fields: list[str],
                         centroids: np.ndarray,
                         feature_mean: np.ndarray, feature_std: np.ndarray) -> np.ndarray:
    """Min-distance to any centroid score per record."""
    X = np.array([[r[f] for f in feature_fields] for r in seabed_records], dtype=np.float32)
    Z = (X - feature_mean) / (feature_std + 1e-8)
    n = Z.shape[0]
    out = np.empty(n, dtype=np.float32)
    chunk = 4096
    for s in range(0, n, chunk):
        block = Z[s:s+chunk]
        d = np.linalg.norm(block[:, None, :] - centroids[None, :, :], axis=2)
        out[s:s+chunk] = d.min(axis=1)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    args = parser.parse_args()

    import pyarrow.parquet as pq

    if not UATD_GABOR_PARQ.exists():
        sys.exit(f"missing UATD Gabor parquet at {UATD_GABOR_PARQ}")
    if not SEABED_GABOR_PARQ.exists():
        sys.exit(f"missing SeabedObjects Gabor parquet at {SEABED_GABOR_PARQ}\n"
                 f"  run: python scripts/experiments/mine_sweep_gabor_ingest.py --corpus seabed")

    uatd_recs = pq.read_table(UATD_GABOR_PARQ).to_pylist()
    seabed_recs = pq.read_table(SEABED_GABOR_PARQ).to_pylist()
    feature_fields = discover_feature_fields(uatd_recs[0])
    fields_seabed = discover_feature_fields(seabed_recs[0])
    if feature_fields != fields_seabed:
        sys.exit(f"feature columns differ between UATD and Seabed parquets")

    print(f"loaded UATD: {len(uatd_recs)} records | SeabedObjects: {len(seabed_recs)} records | feature_dim: {len(feature_fields)}")

    # 1. Train substrate on UATD background
    print("\n[1] training substrate on UATD background (Gabor features)")
    trained = train_substrate_on_uatd(uatd_recs, feature_fields)

    # 2. Score SeabedObjects naively (no re-anchor) — replicates earlier failed test
    print("\n[2] NAIVE TRANSFER: score SeabedObjects with UATD centroids directly")
    naive_scores = score_seabed_records(
        seabed_recs, feature_fields,
        trained["centroids_uatd"],
        trained["feature_mean_uatd"], trained["feature_std_uatd"],
    )
    labels = np.array([1 if r["is_positive_strict"] else 0 for r in seabed_recs], dtype=np.int8)
    n_pos = int(labels.sum())
    n_neg = int(len(labels) - n_pos)
    print(f"  SeabedObjects: {n_pos} planes (positive), {n_neg} ships (negative)")

    from sklearn.metrics import roc_auc_score
    naive_auroc = float(roc_auc_score(labels, naive_scores))
    print(f"  naive transfer AUROC: {naive_auroc:.4f}")

    # 3. Re-anchor centroids on SeabedObjects ship records
    print("\n[3] RE-ANCHORING centroids on SeabedObjects ships")
    reanchored = re_anchor_centroids(
        seabed_recs, feature_fields,
        trained["centroids_uatd"],
        trained["feature_mean_uatd"], trained["feature_std_uatd"],
    )

    # 4. Re-score SeabedObjects with re-anchored centroids
    print("\n[4] scoring SeabedObjects with re-anchored centroids")
    reanchored_scores = score_seabed_records(
        seabed_recs, feature_fields,
        reanchored,
        trained["feature_mean_uatd"], trained["feature_std_uatd"],
    )
    reanchored_auroc = float(roc_auc_score(labels, reanchored_scores))
    print(f"  RE-ANCHORED AUROC: {reanchored_auroc:.4f}")

    # 5. Baselines: IF and Mahalanobis trained on UATD background, applied naively
    print("\n[5] baselines (UATD-trained, applied naively to SeabedObjects)")
    bg_uatd = [r for r in uatd_recs if not r["is_positive_strict"]]
    X_uatd_bg = np.array([[r[f] for f in feature_fields] for r in bg_uatd], dtype=np.float32)
    X_seabed  = np.array([[r[f] for f in feature_fields] for r in seabed_recs], dtype=np.float32)

    from sklearn.ensemble import IsolationForest
    forest = IsolationForest(n_estimators=200, contamination="auto",
                             random_state=SUBSTRATE_SEED, n_jobs=-1).fit(X_uatd_bg)
    if_scores = -forest.decision_function(X_seabed)
    if_auroc = float(roc_auc_score(labels, if_scores))
    print(f"  IF AUROC: {if_auroc:.4f}")

    mean = X_uatd_bg.mean(axis=0)
    cov = np.cov(X_uatd_bg, rowvar=False) + 1e-6 * np.eye(X_uatd_bg.shape[1])
    cov_inv = np.linalg.inv(cov)
    delta = X_seabed - mean
    mahal_scores = np.sqrt(np.einsum("ij,jk,ik->i", delta, cov_inv, delta))
    mahal_auroc = float(roc_auc_score(labels, mahal_scores))
    print(f"  Mahalanobis AUROC: {mahal_auroc:.4f}")

    out = {
        "computed_at_utc":  datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "feature_extractor": "gabor_filter_bank",
        "feature_dim":      len(feature_fields),
        "n_uatd_records":   len(uatd_recs),
        "n_seabed_records": len(seabed_recs),
        "n_seabed_positive_planes": n_pos,
        "n_seabed_negative_ships":  n_neg,
        "substrate_naive_transfer_auroc":    naive_auroc,
        "substrate_re_anchored_auroc":        reanchored_auroc,
        "isolation_forest_naive_auroc":      if_auroc,
        "mahalanobis_naive_auroc":           mahal_auroc,
        "re_anchor_lift_over_naive":         reanchored_auroc - naive_auroc,
        "substrate_re_anchored_vs_if":       reanchored_auroc - if_auroc,
    }
    CROSS_CORPUS_SUMMARY.write_text(
        json.dumps(out, indent=2, default=float) + "\n", encoding="utf-8",
    )
    print(f"\nwrote {CROSS_CORPUS_SUMMARY.relative_to(ROOT)}")

    print("\n=== CROSS-CORPUS SUMMARY ===")
    print(f"  substrate naive transfer (UATD->Seabed):    {naive_auroc:.4f}")
    print(f"  substrate RE-ANCHORED on Seabed ships:       {reanchored_auroc:.4f}")
    print(f"  isolation_forest naive transfer:             {if_auroc:.4f}")
    print(f"  mahalanobis naive transfer:                  {mahal_auroc:.4f}")
    print(f"  re-anchor LIFT over naive substrate:         {reanchored_auroc - naive_auroc:+.4f}")
    print(f"  re-anchored vs best naive baseline:          {reanchored_auroc - max(if_auroc, mahal_auroc):+.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
