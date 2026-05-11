"""
MINE-SWEEP STAGE 6 — orchestrator harness.

Inputs:
  data/validation/mine_sweep/features.parquet  (from mine_sweep_features.py)
  data/validation/mine_sweep/features.ndjson   (OCEAN-compatible projection)

Outputs:
  data/validation/mine_sweep/modules_seed_{42,43,44}.json
  data/validation/mine_sweep/results_seed_{42,43,44}.json
  data/validation/mine_sweep/summary.json
  pipelines/mine_sweep.ocean                   (regenerated with measured tile count)

Flow:
  1. Regenerate pipelines/mine_sweep.ocean with the actual N records.
  2. Run substrate for seeds [42, 43, 44]:
       a) embed.numeric_direct (the new operator) → Z
       b) cluster.tcd_recursive_loop → modules
       c) derive per-tile anomaly_score(tile, modules)
       d) compute enrichment@K, AUPRC vs is_positive_strict
  3. Run three baselines:
       - uniform_random (100 resamplings to characterize null)
       - z_score (sum of squared feature-z, deterministic)
       - isolation_forest (sklearn, seeds [42, 43, 44])
  4. Buffered sensitivity: re-run enrichment with 0/25/50m AWOIS buffers.
  5. Aggregate across seeds with t_2 95% CI.
  6. Call b_gate(summary) → verdict.
  7. Write summary.json.

Per spec docs/superpowers/specs/2026-05-11-mine-sweep-design.md.

Two functions in this file are LEARNING-MODE contribution points and
deliberately stubbed for the project owner to fill in:
  - anomaly_score(tile, modules, epsilon)   — design call: how to derive
                                              a scalar unusualness score
                                              from substrate module output.
  - b_gate(summary)                          — design call: the binary
                                              SHIP_A / INCONCLUSIVE /
                                              SHELVE_A verdict.

Both have proposed implementations in the spec; the stubs in this file
include the proposal as a comment but raise NotImplementedError until
the project owner commits to a concrete version.
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
OUT_DIR        = ROOT / "data" / "validation" / "mine_sweep"
FEATURES_PARQ  = OUT_DIR / "features.parquet"
FEATURES_NDJ   = OUT_DIR / "features.ndjson"
MANIFEST_PATH  = OUT_DIR / "manifest.json"
SUMMARY_PATH   = OUT_DIR / "summary.json"
PIPELINE_OCEAN = ROOT / "pipelines" / "mine_sweep.ocean"

FEATURE_FIELDS = ["residual_rms", "local_relief", "slope_std", "laplacian_std"]

# Substrate config — pre-committed in spec, do not tune.
SUBSTRATE_CONFIG = {
    "iters":             16,
    "max_modules":       256,
    "crystallize_every": 2,
    "langevin_steps":    30,
    "energy":            "corpus_mean",
}
SEEDS = [42, 43, 44]

# Enrichment K-grid (fractions of corpus, top of substrate score sort).
K_GRID = [0.001, 0.005, 0.01, 0.02, 0.05, 0.10]
HEADLINE_K = 0.01

# B-gate thresholds — pre-committed in spec.
GATE_CHANCE_MULTIPLIER   = 5.0   # substrate CI lower bound must clear this vs chance
GATE_BASELINE_MULTIPLIER = 2.0   # substrate mean must clear this vs best non-substrate baseline

# Uniform-random null-distribution sample count.
RANDOM_NULL_SAMPLES = 100

# t-distribution critical value at 2 df, 95% CI.
T_CRIT_2DF_95 = 4.302653
# -------------------------------------------------------------------------


# =========================================================================
# Substrate + baselines
# =========================================================================
def run_substrate_for_seed(records: list[dict], seed: int) -> dict:
    """Call embed.numeric_direct → cluster.tcd_recursive_loop for one seed.

    TCDRecursiveLoop emits a list of *emergent* module metadata dicts with
    `centroid_vec` and `module_id` fields, but does NOT include per-record
    assignments. We compute assignments here via nearest-centroid in Z-space
    (deterministic, seed-free), then attach `size` and `members` so the
    downstream anomaly_score / persistence code has the fields it expects.
    """
    sys.path.insert(0, str(ROOT))
    from scripts.operators.embed import NumericDirectEmbedder  # noqa: E402
    from scripts.operators.cluster import TCDRecursiveLoop  # noqa: E402

    embed_op = NumericDirectEmbedder()
    embed_out = embed_op.run(
        {"records": records},
        seed=seed,
        config={"fields": FEATURE_FIELDS, "l2_normalize": False},
    )
    Z = embed_out["Z"]

    cluster_op = TCDRecursiveLoop()
    cluster_out = cluster_op.run(
        {"Z": Z, "records": records},
        seed=seed,
        config=SUBSTRATE_CONFIG,
    )
    raw_modules = [
        m for m in cluster_out.get("modules", [])
        if "centroid_vec" in m and m["centroid_vec"]
    ]

    if not raw_modules:
        # Substrate emerged no centroid-bearing modules. Fallback: single
        # corpus-mean module so the rest of the pipeline still completes.
        modules = [{
            "module_id": "fallback_0",
            "centroid":  Z.mean(axis=0).tolist(),
            "size":      len(records),
            "members":   list(range(len(records))),
        }]
        print(f"  warning: substrate emerged no centroid-bearing modules, "
              f"falling back to single corpus-mean module")
    else:
        centroids = np.array(
            [m["centroid_vec"] for m in raw_modules],
            dtype=np.float32,
        )
        # Nearest-centroid assignment: for each record, argmin distance to a centroid.
        # Compute in chunks to keep peak memory bounded.
        n = Z.shape[0]
        assignments = np.empty(n, dtype=np.int32)
        chunk = 4096
        for s in range(0, n, chunk):
            block = Z[s : s + chunk]
            d = np.linalg.norm(block[:, None, :] - centroids[None, :, :], axis=2)
            assignments[s : s + chunk] = d.argmin(axis=1)

        modules = []
        for j, raw in enumerate(raw_modules):
            members = np.where(assignments == j)[0].tolist()
            modules.append({
                "module_id": str(raw["module_id"]),
                "centroid":  list(raw["centroid_vec"]),
                "size":      len(members),
                "members":   members,
            })

    return {
        "Z":             Z,
        "modules":       modules,
        "embed_out":     embed_out,
        "cluster_out":   cluster_out,
    }


def anomaly_score(tile_features: np.ndarray, tile_module_id: int,
                  modules: list[dict], epsilon: float = 1e-3) -> float:
    """Per-tile anomaly score: rarity (primary) + within-cluster distance (tiebreaker).

    Implementation matches the proposal in
    docs/superpowers/specs/2026-05-11-mine-sweep-design.md Section 4. The
    project owner can swap to pure-rarity, pure-outlier, or Mahalanobis
    alternatives — each is a legitimate design call. Keep the spec
    updated if you change this.
    """
    module   = modules[tile_module_id]
    rarity   = -math.log(max(1, int(module["size"])))
    centroid = np.asarray(module["centroid"], dtype=np.float32)
    distance = float(np.linalg.norm(tile_features - centroid))
    return rarity + epsilon * distance


def score_tiles_substrate(records: list[dict], substrate_result: dict) -> np.ndarray:
    """Return a 1D array of anomaly scores aligned with `records`."""
    Z = substrate_result["Z"]
    modules = substrate_result["modules"]
    # Build tile-index -> module-index from the modules list-of-members.
    tile_to_module = np.full(len(records), -1, dtype=np.int32)
    for mod_idx, mod in enumerate(modules):
        for member_idx in mod["members"]:
            tile_to_module[member_idx] = mod_idx
    # Any unassigned tile (-1) falls back to the largest module so the score
    # is well-defined; this only happens if a record didn't make it into any
    # member list, which shouldn't occur given the assignment logic above.
    if (tile_to_module == -1).any():
        largest = max(range(len(modules)), key=lambda j: modules[j]["size"])
        tile_to_module[tile_to_module == -1] = largest
    scores = np.empty(len(records), dtype=np.float32)
    for i in range(len(records)):
        scores[i] = anomaly_score(Z[i], int(tile_to_module[i]), modules)
    return scores


def score_tiles_uniform_random(n: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return rng.uniform(0, 1, size=n).astype(np.float32)


def score_tiles_zscore(records: list[dict]) -> np.ndarray:
    """Squared Euclidean distance to corpus mean in feature-z-space.

    Deterministic; no seed. Structurally equivalent to TCD-JEPA's internal
    energy with energy=corpus_mean, so this is the "minimal substrate"
    baseline.
    """
    X = np.array(
        [[r[f] for f in FEATURE_FIELDS] for r in records],
        dtype=np.float32,
    )
    mean = X.mean(axis=0)
    std  = X.std(axis=0)
    Z = (X - mean) / (std + 1e-8)
    return (Z ** 2).sum(axis=1)


def score_tiles_isolation_forest(records: list[dict], seed: int) -> np.ndarray:
    """sklearn IsolationForest on the same four features.

    Higher score = more anomalous. We negate sklearn's decision_function
    (which is higher for inliers) so the convention matches the rest.
    """
    from sklearn.ensemble import IsolationForest
    X = np.array(
        [[r[f] for f in FEATURE_FIELDS] for r in records],
        dtype=np.float32,
    )
    forest = IsolationForest(
        n_estimators=100,
        contamination="auto",
        random_state=seed,
        n_jobs=-1,
    )
    forest.fit(X)
    return -forest.decision_function(X)


# =========================================================================
# Evaluation
# =========================================================================
def enrichment_at_K(scores: np.ndarray, labels: np.ndarray, K_frac: float) -> float:
    """(positives in top K_frac) / (K_frac * total_positives).

    K_frac=0.01 with substrate top-1% = the headline metric.
    Returns NaN if total_positives is 0.
    """
    n = len(scores)
    total_positives = int(labels.sum())
    if total_positives == 0:
        return float("nan")
    k_count = max(1, int(round(n * K_frac)))
    top_idx = np.argsort(-scores)[:k_count]
    captured = int(labels[top_idx].sum())
    recall = captured / total_positives
    return recall / K_frac


def auprc(scores: np.ndarray, labels: np.ndarray) -> float:
    from sklearn.metrics import average_precision_score
    return float(average_precision_score(labels, scores))


def enrichment_curve(scores: np.ndarray, labels: np.ndarray) -> list[dict]:
    return [
        {"K_frac": k, "enrichment": enrichment_at_K(scores, labels, k)}
        for k in K_GRID
    ]


def t_dist_95_ci(values: list[float]) -> tuple[float, float, float]:
    """Mean and 95% CI half-width via t-distribution with (n-1) df.

    Returns (mean, ci_lower, ci_upper). For n=3 uses T_CRIT_2DF_95.
    """
    arr = np.asarray(values, dtype=np.float64)
    n = arr.size
    if n < 2:
        return float(arr[0]), float(arr[0]), float(arr[0])
    mean = float(arr.mean())
    std  = float(arr.std(ddof=1))
    stderr = std / math.sqrt(n)
    # Critical value: hard-coded for n=3 (2 df); generalize via scipy if n varies.
    if n == 3:
        crit = T_CRIT_2DF_95
    else:
        from scipy import stats
        crit = float(stats.t.ppf(0.975, df=n - 1))
    half = crit * stderr
    return mean, mean - half, mean + half


# =========================================================================
# B-gate
# =========================================================================
def b_gate(summary: dict) -> dict:
    """SHIP_A / INCONCLUSIVE / SHELVE_A verdict on the substrate's measurement.

    Thresholds (GATE_CHANCE_MULTIPLIER, GATE_BASELINE_MULTIPLIER) are
    pre-committed in the spec and the constants at the top of this file.
    Changing them after the run is p-hacking. Document any threshold
    change in the spec and re-run from scratch.
    """
    sub = summary["substrate"]
    substrate_ci_lower = (sub.get("enrichment_at_1pct_ci95") or [None, None])[0]
    substrate_mean     = sub.get("enrichment_at_1pct_mean")

    baseline_vals = []
    for b in summary["baselines"].values():
        if "enrichment_at_1pct_mean" in b and b["enrichment_at_1pct_mean"] is not None:
            baseline_vals.append(b["enrichment_at_1pct_mean"])
        elif "enrichment_at_1pct" in b and b["enrichment_at_1pct"] is not None:
            baseline_vals.append(b["enrichment_at_1pct"])
    best_baseline = max(baseline_vals) if baseline_vals else None

    cond_chance = (
        substrate_ci_lower is not None
        and substrate_ci_lower >= GATE_CHANCE_MULTIPLIER
    )
    cond_baseline = (
        substrate_mean is not None
        and best_baseline is not None
        and substrate_mean >= GATE_BASELINE_MULTIPLIER * best_baseline
    )

    if cond_chance and cond_baseline:
        verdict = "SHIP_A"
    elif (
        not cond_chance
        and substrate_mean is not None
        and substrate_mean >= GATE_CHANCE_MULTIPLIER
    ):
        verdict = "INCONCLUSIVE"
    else:
        verdict = "SHELVE_A"

    return {
        "verdict": verdict,
        "thresholds": {
            "chance_multiplier":   GATE_CHANCE_MULTIPLIER,
            "baseline_multiplier": GATE_BASELINE_MULTIPLIER,
        },
        "best_baseline_at_1pct":     best_baseline,
        "substrate_mean_at_1pct":    substrate_mean,
        "substrate_ci_lower_at_1pct": substrate_ci_lower,
    }


# =========================================================================
# Pipeline-file regeneration
# =========================================================================
def regenerate_pipeline_ocean(n_records: int) -> None:
    """Rewrite pipelines/mine_sweep.ocean with the actual record count.

    The .ocean file's `take N records` clause must match the corpus
    actually used so the executability check is byte-identical.
    """
    contents = PIPELINE_OCEAN.read_text(encoding="utf-8")
    # Find the line with "take N records" and replace N.
    new_lines = []
    replaced = False
    for line in contents.splitlines():
        if "take " in line and " records" in line:
            # Find the integer between "take " and " records"
            before, after = line.split("take ", 1)
            n_then, post = after.split(" records", 1)
            new_lines.append(f"{before}take {n_records} records{post}")
            replaced = True
        else:
            new_lines.append(line)
    if not replaced:
        sys.exit(
            f"could not find 'take N records' line in {PIPELINE_OCEAN.relative_to(ROOT)}; "
            "pipeline file may be malformed"
        )
    PIPELINE_OCEAN.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    print(f"regenerated {PIPELINE_OCEAN.relative_to(ROOT)} with take {n_records} records")


# =========================================================================
# Main
# =========================================================================
def load_records() -> list[dict]:
    """Load features.parquet → list of dicts."""
    import pyarrow.parquet as pq
    if not FEATURES_PARQ.exists():
        sys.exit(
            f"features missing: {FEATURES_PARQ.relative_to(ROOT)}\n"
            "Run scripts/experiments/mine_sweep_features.py first."
        )
    table = pq.read_table(FEATURES_PARQ)
    return table.to_pylist()


def evaluate_score(scores: np.ndarray, labels: np.ndarray) -> dict:
    return {
        "enrichment_at_1pct": enrichment_at_K(scores, labels, HEADLINE_K),
        "enrichment_curve":   enrichment_curve(scores, labels),
        "auprc":              auprc(scores, labels),
    }


def aggregate_seeds(per_seed: list[dict], field: str) -> dict:
    values = [s[field] for s in per_seed if not math.isnan(s[field])]
    if not values:
        return {"mean": None, "ci95": [None, None]}
    mean, lo, hi = t_dist_95_ci(values)
    return {"mean": mean, "ci95": [lo, hi]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--seed", type=int, default=None,
        help="run a single seed instead of all three (for debug)",
    )
    parser.add_argument(
        "--emit", choices=["modules_only", "all"], default="all",
        help="modules_only: write modules_seed_{N}.json and exit (used by executability check)",
    )
    parser.add_argument(
        "--skip-substrate", action="store_true",
        help="skip the GPU substrate run, compute baselines only",
    )
    args = parser.parse_args()

    records = load_records()
    n = len(records)
    print(f"loaded {n} records from {FEATURES_PARQ.relative_to(ROOT)}")

    regenerate_pipeline_ocean(n)

    labels = np.array(
        [bool(r["is_positive_strict"]) for r in records],
        dtype=np.bool_,
    )
    n_positives = int(labels.sum())
    print(f"  positives: {n_positives} ({100*n_positives/n:.4f}%)")
    print(f"  chance enrichment at top-1% would capture ~{n * 0.01 * n_positives / n:.2f} positives")

    seeds_to_run = [args.seed] if args.seed is not None else SEEDS
    per_seed_substrate = []
    if not args.skip_substrate:
        for s in seeds_to_run:
            print(f"\n--- substrate seed {s} ---")
            substrate_result = run_substrate_for_seed(records, s)
            # Persist modules artifact for executability check
            modules_path = OUT_DIR / f"modules_seed_{s}.json"
            modules_path.write_text(
                json.dumps(
                    {
                        "seed": s,
                        "config": SUBSTRATE_CONFIG,
                        "modules": [
                            {
                                "module_id": i,
                                "size": int(m["size"]),
                                "centroid": [float(x) for x in m["centroid"]],
                                "members": [int(x) for x in m["members"]],
                            }
                            for i, m in enumerate(substrate_result["modules"])
                        ],
                    },
                    indent=2,
                ) + "\n",
                encoding="utf-8",
            )
            if args.emit == "modules_only":
                continue
            scores = score_tiles_substrate(records, substrate_result)
            metrics = evaluate_score(scores, labels)
            metrics["seed"] = s
            metrics["module_count"]      = len(substrate_result["modules"])
            metrics["rarest_module_size"] = min(m["size"] for m in substrate_result["modules"])
            per_seed_substrate.append(metrics)
            results_path = OUT_DIR / f"results_seed_{s}.json"
            results_path.write_text(
                json.dumps(metrics, indent=2, default=float) + "\n",
                encoding="utf-8",
            )
            print(f"  enrichment@1pct: {metrics['enrichment_at_1pct']:.2f}, "
                  f"auprc: {metrics['auprc']:.4f}")

    if args.emit == "modules_only":
        return 0

    # --- baselines ---
    print("\n--- baselines ---")
    null_enrichments = []
    for rs in range(RANDOM_NULL_SAMPLES):
        scores = score_tiles_uniform_random(n, seed=10_000 + rs)
        null_enrichments.append(enrichment_at_K(scores, labels, HEADLINE_K))
    baselines = {
        "uniform_random": {
            "enrichment_at_1pct_mean": float(np.mean(null_enrichments)),
            "enrichment_at_1pct_std":  float(np.std(null_enrichments)),
            "n_resamplings":           RANDOM_NULL_SAMPLES,
        },
        "z_score": evaluate_score(score_tiles_zscore(records), labels),
    }
    # Isolation forest across the same seeds as substrate
    iforest_per_seed = []
    for s in SEEDS:
        scores = score_tiles_isolation_forest(records, seed=s)
        m = evaluate_score(scores, labels)
        m["seed"] = s
        iforest_per_seed.append(m)
    iforest_e1 = aggregate_seeds(iforest_per_seed, "enrichment_at_1pct")
    baselines["isolation_forest"] = {
        "enrichment_at_1pct_mean": iforest_e1["mean"],
        "enrichment_at_1pct_ci95": iforest_e1["ci95"],
        "per_seed":                iforest_per_seed,
    }

    for name, b in baselines.items():
        e = b.get("enrichment_at_1pct_mean")
        if e is None:
            e = b.get("enrichment_at_1pct")
        if e is None:
            print(f"  {name}: enrichment@1pct = <missing>")
        else:
            print(f"  {name}: enrichment@1pct = {e:.2f}")

    # --- aggregate substrate across seeds ---
    if per_seed_substrate:
        e_agg = aggregate_seeds(per_seed_substrate, "enrichment_at_1pct")
        auprc_agg = aggregate_seeds(per_seed_substrate, "auprc")
        substrate_block = {
            "config":                       SUBSTRATE_CONFIG,
            "seeds":                        SEEDS,
            "enrichment_at_1pct_mean":      e_agg["mean"],
            "enrichment_at_1pct_ci95":      e_agg["ci95"],
            "auprc_mean":                   auprc_agg["mean"],
            "auprc_ci95":                   auprc_agg["ci95"],
            "per_seed":                     per_seed_substrate,
        }
    else:
        substrate_block = {"config": SUBSTRATE_CONFIG, "seeds": SEEDS, "note": "substrate run skipped"}

    # --- B-gate ---
    summary = {
        "region":              "stellwagen_bank_sbnms",
        "n_tiles":             n,
        "n_positives_strict":  n_positives,
        "substrate":           substrate_block,
        "baselines":           baselines,
        "computed_at_utc":     datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    if per_seed_substrate:
        summary["b_gate"] = b_gate(summary)
        print(f"\nB-gate verdict: {summary['b_gate']['verdict']}")
    else:
        summary["b_gate"] = {"verdict": "PENDING_SUBSTRATE_RUN"}

    SUMMARY_PATH.write_text(
        json.dumps(summary, indent=2, default=float) + "\n",
        encoding="utf-8",
    )
    print(f"\nwrote {SUMMARY_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
