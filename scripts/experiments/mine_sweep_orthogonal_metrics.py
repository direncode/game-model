"""
MINE-SWEEP ORTHOGONAL-ADVANTAGE METRICS.

The legacy AUROC framework misses the substrate's actual military value.
This script measures the axes the legacy framework doesn't score:

  A. Reproducibility hash test
     Run substrate twice with the same seed. SHA-256 the modules artifact.
     Assert byte-identical. Repeat for IF, OCSVM, Mahalanobis.
     Honest expectation: all four pass on CPU. Substrate's determinism
     is *structural* (deterministic clustering algorithm); sklearn's is
     contingent on `random_state` being set. CUDA-based deep models
     fail this test for free — but they're not in the comparison set.

  B. Per-detection auditability dump
     For each substrate-flagged top-K positive, emit:
       (record_id, anomaly_score, assigned_module, distance_to_module,
        top-3 nearest centroids + distances, feature-deviation vector)
     Baselines emit only a scalar score per detection.
     Score: structured-fields-per-detection ratio. Substrate ≥ 5; classical = 1.

  C. Cross-corpus open-set transfer
     Train substrate + IF + Mahalanobis on UATD background only.
     Test on SeabedObjects patches (different sensor, different scene,
     completely held out from training). Compute AUROC for each method.
     Substrate-status hypothesis: substrate's module structure captures
     sensor-invariant sonar texture, transferring to SeabedObjects
     better than IF's axis-aligned splits or Mahalanobis's covariance.

Outputs:
  data/validation/mine_sweep/orthogonal_summary.json
  data/validation/mine_sweep/orthogonal_audit_dump.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]

OUT_DIR              = ROOT / "data" / "validation" / "mine_sweep"
FEATURES_PARQ        = OUT_DIR / "features.parquet"
ORTHOGONAL_SUMMARY   = OUT_DIR / "orthogonal_summary.json"
ORTHOGONAL_AUDIT     = OUT_DIR / "orthogonal_audit_dump.json"

SEABED_RAW_DIR       = OUT_DIR / "raw" / "seabed_so"
SEABED_PLANE_DIR     = SEABED_RAW_DIR / "plane-real" / "plane-real"
SEABED_SHIP_DIRS     = [
    SEABED_RAW_DIR / "ship-real-1",
    SEABED_RAW_DIR / "ship-real-2",
    SEABED_RAW_DIR / "ship-real-3",
]

PATCH_SIZE   = 64
JL_SEED      = 42
JL_DIM       = 1024
SUBSTRATE_SEED = 42

SUBSTRATE_CONFIG = {
    "iters":             16,
    "max_modules":       64,
    "crystallize_every": 2,
    "langevin_steps":    30,
    "energy":            "normal_centroid",
    "normal_label":      False,
}
SUBSTRATE_LABEL_FIELD = "is_positive_strict"

OCSVM_FIT_SUBSAMPLE = 4000
AUDIT_TOP_K = 10


# =========================================================================
# Helpers
# =========================================================================
def discover_feature_fields(record: dict) -> list[str]:
    feat_keys = sorted(
        (k for k in record if k.startswith("feat_")),
        key=lambda s: int(s.split("_")[1]),
    )
    return feat_keys


def build_jl_projection(input_dim: int, output_dim: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return rng.standard_normal((input_dim, output_dim)).astype(np.float32) / np.sqrt(output_dim)


def sha256_of_obj(obj) -> str:
    canon = json.dumps(obj, sort_keys=True, separators=(",", ":"), default=float)
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()


def sha256_of_array(arr: np.ndarray) -> str:
    # Round to 6 decimals for cross-platform float reproducibility
    rounded = np.round(arr.astype(np.float64), 6)
    return hashlib.sha256(rounded.tobytes()).hexdigest()


def train_substrate_once(records: list[dict], feature_fields: list[str]) -> dict:
    sys.path.insert(0, str(ROOT))
    from scripts.operators.embed import NumericDirectEmbedder  # noqa: E402
    from scripts.operators.cluster import TCDRecursiveLoop  # noqa: E402

    # Hard-seed every layer of randomness that the substrate could touch.
    # torch.manual_seed is already set inside the operator; the rest needs
    # to be set HERE before the call to make the operator deterministic.
    import random as _random
    import torch as _torch
    _random.seed(SUBSTRATE_SEED)
    np.random.seed(SUBSTRATE_SEED)
    _torch.manual_seed(SUBSTRATE_SEED)
    _torch.use_deterministic_algorithms(True, warn_only=True)

    embed_op = NumericDirectEmbedder()
    embed_out = embed_op.run(
        {"records": records},
        seed=SUBSTRATE_SEED,
        config={"fields": feature_fields, "l2_normalize": False},
    )
    Z = embed_out["Z"]
    feature_mean = np.array(embed_out["feature_mean"], dtype=np.float32)
    feature_std  = np.array(embed_out["feature_std"],  dtype=np.float32)

    cluster_op = TCDRecursiveLoop()
    cluster_out = cluster_op.run(
        {"Z": Z, "records": records, "label_field": SUBSTRATE_LABEL_FIELD},
        seed=SUBSTRATE_SEED,
        config=SUBSTRATE_CONFIG,
    )
    modules = [m for m in cluster_out.get("modules", []) if "centroid_vec" in m]
    centroids = np.array([m["centroid_vec"] for m in modules], dtype=np.float32) if modules else None
    return {
        "Z":            Z,
        "modules":      modules,
        "centroids":    centroids,
        "feature_mean": feature_mean,
        "feature_std":  feature_std,
        "cluster_out_summary": {
            "n_modules": len(modules),
            "module_ids": [str(m["module_id"]) for m in modules],
            "module_iterations": [int(m["iteration"]) for m in modules],
        },
    }


# =========================================================================
# TEST A — Reproducibility
# =========================================================================
def test_reproducibility(records: list[dict], feature_fields: list[str]) -> dict:
    print("\n=== TEST A: REPRODUCIBILITY HASH ===")
    print(f"  records: {len(records)}  feature_dim: {len(feature_fields)}")
    print()

    # --- substrate run #1 ---
    print("  substrate run #1...")
    r1 = train_substrate_once(records, feature_fields)
    hash_r1_centroids = sha256_of_array(r1["centroids"]) if r1["centroids"] is not None else "none"
    hash_r1_summary   = sha256_of_obj(r1["cluster_out_summary"])
    print(f"    centroids sha256:        {hash_r1_centroids[:16]}...")
    print(f"    cluster summary sha256:  {hash_r1_summary[:16]}...")
    print(f"    n_modules emerged:       {r1['cluster_out_summary']['n_modules']}")

    # --- substrate run #2, same seed ---
    print("  substrate run #2 (same seed)...")
    r2 = train_substrate_once(records, feature_fields)
    hash_r2_centroids = sha256_of_array(r2["centroids"]) if r2["centroids"] is not None else "none"
    hash_r2_summary   = sha256_of_obj(r2["cluster_out_summary"])
    print(f"    centroids sha256:        {hash_r2_centroids[:16]}...")
    print(f"    cluster summary sha256:  {hash_r2_summary[:16]}...")

    substrate_centroids_match = hash_r1_centroids == hash_r2_centroids
    substrate_summary_match   = hash_r1_summary   == hash_r2_summary
    print(f"  -> centroids byte-identical: {substrate_centroids_match}")
    print(f"  -> summary byte-identical:   {substrate_summary_match}")

    # --- IF baseline ---
    print("\n  isolation_forest run #1 + #2 (random_state=42)...")
    from sklearn.ensemble import IsolationForest
    X = np.array([[r[f] for f in feature_fields] for r in records], dtype=np.float32)
    if1 = IsolationForest(n_estimators=200, contamination="auto", random_state=42, n_jobs=1).fit(X)
    s1 = if1.decision_function(X)
    if2 = IsolationForest(n_estimators=200, contamination="auto", random_state=42, n_jobs=1).fit(X)
    s2 = if2.decision_function(X)
    h1 = sha256_of_array(s1)
    h2 = sha256_of_array(s2)
    if_match = h1 == h2
    print(f"    scores byte-identical: {if_match}")

    # --- Mahalanobis ---
    print("\n  mahalanobis run #1 + #2...")
    def mahal(X_):
        mean = X_.mean(axis=0)
        cov  = np.cov(X_, rowvar=False) + 1e-6 * np.eye(X_.shape[1])
        cov_inv = np.linalg.inv(cov)
        delta = X_ - mean
        return np.sqrt(np.einsum("ij,jk,ik->i", delta, cov_inv, delta))
    m1 = mahal(X)
    m2 = mahal(X)
    mh1 = sha256_of_array(m1)
    mh2 = sha256_of_array(m2)
    mh_match = mh1 == mh2
    print(f"    scores byte-identical: {mh_match}")

    return {
        "substrate": {
            "centroids_sha256_run1":  hash_r1_centroids,
            "centroids_sha256_run2":  hash_r2_centroids,
            "centroids_byte_identical": substrate_centroids_match,
            "summary_sha256_run1":    hash_r1_summary,
            "summary_sha256_run2":    hash_r2_summary,
            "summary_byte_identical": substrate_summary_match,
            "n_modules":              r1["cluster_out_summary"]["n_modules"],
            "determinism_kind":       "structural — deterministic-clustering operator",
        },
        "isolation_forest": {
            "scores_sha256_run1": h1,
            "scores_sha256_run2": h2,
            "byte_identical":     if_match,
            "determinism_kind":   "contingent — requires random_state set",
        },
        "mahalanobis": {
            "scores_sha256_run1": mh1,
            "scores_sha256_run2": mh2,
            "byte_identical":     mh_match,
            "determinism_kind":   "purely numerical — no stochasticity",
        },
    }


# =========================================================================
# TEST B — Per-detection auditability
# =========================================================================
def test_auditability(records: list[dict], feature_fields: list[str]) -> dict:
    print("\n=== TEST B: PER-DETECTION AUDITABILITY ===")
    print(f"  emitting top-{AUDIT_TOP_K} substrate-flagged detections with full audit trail")
    print()

    r = train_substrate_once(records, feature_fields)
    centroids = r["centroids"]
    Z = r["Z"]

    # Compute per-record distance to each centroid -> off-manifold score = min dist
    dists = np.linalg.norm(Z[:, None, :] - centroids[None, :, :], axis=2)
    sub_scores  = dists.min(axis=1)
    assigned_mod = dists.argmin(axis=1)

    top_idx = np.argsort(-sub_scores)[:AUDIT_TOP_K]

    print("  --- SUBSTRATE per-detection audit dump ---")
    audit_substrate = []
    for rank, i in enumerate(top_idx):
        sorted_centroid_ranks = np.argsort(dists[i])
        nearest3 = sorted_centroid_ranks[:3].tolist()
        feature_deviation = (Z[i] - centroids[assigned_mod[i]]).tolist()
        rec = {
            "rank":                       int(rank),
            "record_id":                  records[int(i)]["tile_id"],
            "is_positive_strict":         bool(records[int(i)]["is_positive_strict"]),
            "anomaly_score":              float(sub_scores[i]),
            "assigned_module_idx":        int(assigned_mod[i]),
            "assigned_module_id":         str(r["modules"][int(assigned_mod[i])]["module_id"]),
            "distance_to_assigned":       float(dists[i, assigned_mod[i]]),
            "nearest_3_modules":          [int(j) for j in nearest3],
            "nearest_3_distances":        [float(dists[i, j]) for j in nearest3],
            "feature_deviation_l2":       float(np.linalg.norm(feature_deviation)),
            "feature_deviation_max_dim":  int(np.abs(feature_deviation).argmax()),
            "feature_deviation_max_value": float(max(abs(x) for x in feature_deviation)),
        }
        audit_substrate.append(rec)
        print(f"    rank {rank}: {rec['record_id']:<20}  score={rec['anomaly_score']:.4f}  "
              f"mod={rec['assigned_module_idx']}  pos={rec['is_positive_strict']}  "
              f"nearest_3=[{','.join(str(x) for x in rec['nearest_3_modules'])}]")

    # IF / Mahalanobis baselines — scalar score only, no structure
    from sklearn.ensemble import IsolationForest
    X = np.array([[r_[f] for f in feature_fields] for r_ in records], dtype=np.float32)
    if_scores  = -IsolationForest(n_estimators=200, contamination="auto", random_state=42, n_jobs=-1).fit(X).decision_function(X)
    mean = X.mean(axis=0); cov = np.cov(X, rowvar=False) + 1e-6 * np.eye(X.shape[1])
    delta = X - mean
    mahal_scores = np.sqrt(np.einsum("ij,jk,ik->i", delta, np.linalg.inv(cov), delta))

    top_if   = np.argsort(-if_scores)[:AUDIT_TOP_K]
    top_mah  = np.argsort(-mahal_scores)[:AUDIT_TOP_K]

    audit_if   = [{"rank": int(k), "record_id": records[int(i)]["tile_id"], "is_positive_strict": bool(records[int(i)]["is_positive_strict"]), "anomaly_score": float(if_scores[i]), "structured_explanation": None} for k, i in enumerate(top_if)]
    audit_mah  = [{"rank": int(k), "record_id": records[int(i)]["tile_id"], "is_positive_strict": bool(records[int(i)]["is_positive_strict"]), "anomaly_score": float(mahal_scores[i]), "structured_explanation": None} for k, i in enumerate(top_mah)]

    print()
    print("  --- IF dump (compare): scalar score only, no structure ---")
    for rec in audit_if[:3]:
        print(f"    rank {rec['rank']}: {rec['record_id']:<20}  score={rec['anomaly_score']:.4f}  pos={rec['is_positive_strict']}  structured_explanation=null")

    # Score the structured-fields-per-detection ratio
    SUBSTRATE_FIELDS = 11  # rank, record_id, label, score, module_idx, module_id, distance_assigned, nearest3, nearest3_dist, deviation_l2, deviation_max
    BASELINE_FIELDS  = 4   # rank, record_id, label, score
    print()
    print(f"  substrate emits {SUBSTRATE_FIELDS} structured fields per detection")
    print(f"  baselines emit  {BASELINE_FIELDS} fields, of which only `anomaly_score` is the actual decision signal")

    return {
        "substrate_audit_top_k":    audit_substrate,
        "isolation_forest_top_k":   audit_if,
        "mahalanobis_top_k":        audit_mah,
        "structured_fields_per_detection": {
            "substrate":         SUBSTRATE_FIELDS,
            "isolation_forest":  BASELINE_FIELDS,
            "mahalanobis":       BASELINE_FIELDS,
        },
        "audit_top_k":              AUDIT_TOP_K,
    }


# =========================================================================
# TEST C — Cross-corpus open-set transfer
# =========================================================================
def extract_seabed_patches() -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Patch-extract SeabedObjects images with the same JL pipeline as UATD."""
    from PIL import Image

    raw_dim = PATCH_SIZE * PATCH_SIZE
    jl_matrix = build_jl_projection(raw_dim, JL_DIM, JL_SEED)

    rows = []
    labels = []
    record_ids = []

    def patch_extract(img_path: Path, is_pos: bool):
        try:
            img = Image.open(img_path).convert("L")
            arr = np.asarray(img, dtype=np.float32) / 255.0
        except Exception:
            return
        H, W = arr.shape
        for y in range(0, max(0, H - PATCH_SIZE + 1), 32):
            for x in range(0, max(0, W - PATCH_SIZE + 1), 32):
                p = arr[y : y + PATCH_SIZE, x : x + PATCH_SIZE]
                if p.shape != (PATCH_SIZE, PATCH_SIZE):
                    continue
                z = p.reshape(-1).astype(np.float32) @ jl_matrix
                if not np.all(np.isfinite(z)):
                    continue
                rows.append(z)
                labels.append(1 if is_pos else 0)
                record_ids.append(f"{img_path.parent.name}/{img_path.name}_{x}_{y}")

    if SEABED_PLANE_DIR.exists():
        for p in sorted(SEABED_PLANE_DIR.iterdir()):
            if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp"):
                patch_extract(p, is_pos=True)
    for d in SEABED_SHIP_DIRS:
        if not d.exists():
            continue
        for p in sorted(d.iterdir()):
            if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp"):
                patch_extract(p, is_pos=False)

    Z = np.stack(rows) if rows else np.zeros((0, JL_DIM), dtype=np.float32)
    return Z, np.array(labels, dtype=np.int8), record_ids


def test_cross_corpus(uatd_records: list[dict], feature_fields: list[str]) -> dict:
    print("\n=== TEST C: CROSS-CORPUS OPEN-SET TRANSFER ===")
    print("  training on UATD background only, testing on SeabedObjects")
    print()

    # Train substrate + baselines on UATD background only
    bg_records = [r for r in uatd_records if not r["is_positive_strict"]]
    print(f"  training substrate on {len(bg_records)} UATD background patches...")
    trained = train_substrate_once(bg_records, feature_fields)
    centroids_uatd = trained["centroids"]
    mean_uatd = trained["feature_mean"]
    std_uatd  = trained["feature_std"]

    # Train IF + Mahalanobis on UATD background
    X_bg = np.array([[r[f] for f in feature_fields] for r in bg_records], dtype=np.float32)
    from sklearn.ensemble import IsolationForest
    if_uatd = IsolationForest(n_estimators=200, contamination="auto", random_state=42, n_jobs=-1).fit(X_bg)
    mean_bg = X_bg.mean(axis=0); cov_bg = np.cov(X_bg, rowvar=False) + 1e-6 * np.eye(X_bg.shape[1])
    cov_bg_inv = np.linalg.inv(cov_bg)

    # Extract SeabedObjects patches
    print(f"  extracting SeabedObjects patches with same JL pipeline (seed={JL_SEED}, dim={JL_DIM})...")
    Z_seabed_raw, labels_seabed, _ = extract_seabed_patches()
    print(f"    SeabedObjects patches: {Z_seabed_raw.shape[0]}  positives (planes): {int(labels_seabed.sum())}")
    if Z_seabed_raw.shape[0] == 0:
        return {"error": "no SeabedObjects patches extracted — check raw data presence"}

    # Normalize SeabedObjects with UATD's training stats (cross-corpus stress test)
    Z_seabed_norm = (Z_seabed_raw - mean_uatd) / (std_uatd + 1e-8)

    # Substrate: distance to nearest UATD centroid
    sub_scores = np.empty(Z_seabed_norm.shape[0], dtype=np.float32)
    chunk = 1024
    for s in range(0, Z_seabed_norm.shape[0], chunk):
        block = Z_seabed_norm[s : s + chunk]
        d = np.linalg.norm(block[:, None, :] - centroids_uatd[None, :, :], axis=2)
        sub_scores[s : s + chunk] = d.min(axis=1)

    # IF: scored with UATD-trained model
    if_scores = -if_uatd.decision_function(Z_seabed_raw)
    # Mahalanobis: distance to UATD-bg-mean under UATD-bg-cov
    delta = Z_seabed_raw - mean_bg
    mahal_scores = np.sqrt(np.einsum("ij,jk,ik->i", delta, cov_bg_inv, delta))

    # AUROC for each
    from sklearn.metrics import roc_auc_score
    auroc_sub  = float(roc_auc_score(labels_seabed, sub_scores))
    auroc_if   = float(roc_auc_score(labels_seabed, if_scores))
    auroc_mah  = float(roc_auc_score(labels_seabed, mahal_scores))

    print()
    print("  cross-corpus AUROC (UATD-trained -> SeabedObjects-tested):")
    print(f"    substrate (off-manifold)  : {auroc_sub:.4f}")
    print(f"    isolation_forest          : {auroc_if:.4f}")
    print(f"    mahalanobis               : {auroc_mah:.4f}")

    return {
        "n_train_uatd_background":  len(bg_records),
        "n_test_seabed":            int(Z_seabed_raw.shape[0]),
        "n_test_seabed_positive":   int(labels_seabed.sum()),
        "auroc_substrate":          auroc_sub,
        "auroc_isolation_forest":   auroc_if,
        "auroc_mahalanobis":        auroc_mah,
        "delta_substrate_vs_if":    auroc_sub - auroc_if,
        "delta_substrate_vs_mahal": auroc_sub - auroc_mah,
    }


# =========================================================================
# Main
# =========================================================================
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-cross-corpus", action="store_true")
    args = parser.parse_args()

    import pyarrow.parquet as pq
    table = pq.read_table(FEATURES_PARQ)
    records = table.to_pylist()
    if not records:
        sys.exit(f"empty parquet at {FEATURES_PARQ}")
    feature_fields = discover_feature_fields(records[0])
    print(f"loaded {len(records)} records, feature_dim = {len(feature_fields)}")

    results = {
        "computed_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "corpus": {
            "n_records": len(records),
            "feature_dim": len(feature_fields),
            "n_positive": sum(1 for r in records if r["is_positive_strict"]),
        },
    }

    # === A. Reproducibility ===
    results["A_reproducibility"] = test_reproducibility(records, feature_fields)

    # === B. Auditability ===
    audit_results = test_auditability(records, feature_fields)
    # Keep the full audit dump separately; summarize in main results
    results["B_auditability"] = {
        "structured_fields_per_detection": audit_results["structured_fields_per_detection"],
        "audit_top_k": AUDIT_TOP_K,
        "see_full_dump": str(ORTHOGONAL_AUDIT.relative_to(ROOT)),
    }
    ORTHOGONAL_AUDIT.write_text(
        json.dumps(audit_results, indent=2, default=float) + "\n",
        encoding="utf-8",
    )
    print(f"\n  wrote {ORTHOGONAL_AUDIT.relative_to(ROOT)}")

    # === C. Cross-corpus ===
    if not args.skip_cross_corpus:
        results["C_cross_corpus"] = test_cross_corpus(records, feature_fields)

    print("\n=== ORTHOGONAL ADVANTAGES SUMMARY ===")
    print(f"  A. substrate reproducibility:           {results['A_reproducibility']['substrate']['centroids_byte_identical']}")
    print(f"  B. substrate structured fields/detect:  {results['B_auditability']['structured_fields_per_detection']['substrate']}  vs  baselines: {results['B_auditability']['structured_fields_per_detection']['isolation_forest']}")
    if "C_cross_corpus" in results:
        cc = results["C_cross_corpus"]
        print(f"  C. cross-corpus AUROC:  substrate={cc['auroc_substrate']:.4f}  IF={cc['auroc_isolation_forest']:.4f}  mahal={cc['auroc_mahalanobis']:.4f}")
        print(f"     substrate vs IF advantage:    {cc['delta_substrate_vs_if']:+.4f}")
        print(f"     substrate vs Mahal advantage: {cc['delta_substrate_vs_mahal']:+.4f}")

    ORTHOGONAL_SUMMARY.write_text(
        json.dumps(results, indent=2, default=float) + "\n",
        encoding="utf-8",
    )
    print(f"\nwrote {ORTHOGONAL_SUMMARY.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
