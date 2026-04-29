"""Real defense-data validation harness.

Replaces (or augments) the synthetic-corpus megatest with public datasets
of unambiguous defense origin and provenance:

1. **KDDCUP99 / NSL-KDD network intrusion** — DARPA Intrusion Detection
   Evaluation, MIT Lincoln Laboratory, simulating U.S. Air Force LAN
   traffic. Standard benchmark for cyber-defense intrusion detection
   research since 1999. Labels: attack vs normal, plus 22 attack subtypes.
   Ground truth: DARPA-injected attacks.

2. **OpenSky ADS-B (optional, fetched live)** — real-world aircraft
   transponder data, used for air domain awareness in defense and ATC
   contexts. Ground truth: derived heuristics on track behavior (no
   officially-labeled "anomaly" set in raw ADS-B).

The KDDCUP99 path is the load-bearing claim — it has labels, published
baselines, and is recognized as defense data by every reviewer.

Single command:
    python -m scripts.defense_megatest.real_data
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.defense_megatest.metrics import (
    auroc,
    lift_in_set,
    lift_vs_random,
    precision_recall_f1,
    recall_in_set,
)
from scripts.defense_megatest.runner import run_baselines, run_btut


def _decode(v):
    """Decode bytes to str if needed, return as-is otherwise."""
    if isinstance(v, bytes):
        try:
            return v.decode("utf-8")
        except UnicodeDecodeError:
            return v.decode("latin-1")
    return v


def kddcup99_to_btut_entities(
    n_samples: int = 6000,
    attack_fraction_target: float = 0.10,
    seed: int = 42,
) -> tuple[list[dict], set[str], dict[str, Any]]:
    """Load KDDCUP99 SA subset and convert to BTUT entity format.

    Returns (entities, attack_names, metadata).

    KDDCUP99 SA = "Server Attack" subset, 41 features, mixed numeric +
    categorical. Each record is a network connection. The label is the
    attack subtype string ('normal.', 'smurf.', 'neptune.', etc.).

    For BTUT input, each entity becomes:
        {name: f"flow_{i}", type: protocol_type,
         attributes: {feat_name: value for all 41 features}}

    The flag, service, and protocol_type fields are categorical; the
    rest are numeric.
    """
    from sklearn.datasets import fetch_kddcup99

    rng = np.random.default_rng(seed)

    print("[real_data] Fetching KDDCUP99 SA subset (DARPA / MIT Lincoln Lab) ...")
    raw = fetch_kddcup99(subset="SA", percent10=True, random_state=seed)
    X = raw.data
    y = raw.target
    feat_names = list(raw.feature_names) if hasattr(raw, "feature_names") else [
        f"f{i}" for i in range(X.shape[1])
    ]

    # Attack vs normal label
    is_attack = np.array(
        [not _decode(v).startswith("normal") for v in y], dtype=bool
    )
    attack_subtypes = [_decode(v) for v in y]

    # Down-sample to n_samples while preserving ~attack_fraction_target attack rate
    all_normal_idx = np.where(~is_attack)[0]
    all_attack_idx = np.where(is_attack)[0]

    n_attack = min(len(all_attack_idx), int(n_samples * attack_fraction_target))
    n_normal = n_samples - n_attack

    sel_attack_idx = rng.choice(all_attack_idx, size=n_attack, replace=False)
    sel_normal_idx = rng.choice(all_normal_idx, size=min(n_normal, len(all_normal_idx)), replace=False)
    sel_idx = np.concatenate([sel_normal_idx, sel_attack_idx])
    rng.shuffle(sel_idx)

    entities: list[dict] = []
    attack_names: set[str] = set()

    for i, raw_idx in enumerate(sel_idx):
        row = X[raw_idx]
        attrs: dict[str, Any] = {}
        for j, fname in enumerate(feat_names):
            v = row[j]
            v = _decode(v)
            # Convert bytes/strings; numbers pass through
            if isinstance(v, str):
                attrs[fname] = v
            elif isinstance(v, (int, np.integer)):
                attrs[fname] = int(v)
            else:
                attrs[fname] = float(v)

        proto = attrs.get("protocol_type", "unknown")
        if not isinstance(proto, str):
            proto = str(proto)

        name = f"flow_{i:06d}"
        entities.append({
            "name": name,
            "type": proto,
            "attributes": attrs,
        })
        if is_attack[raw_idx]:
            attack_names.add(name)

    meta = {
        "source": "KDDCUP99 SA subset (DARPA / MIT Lincoln Laboratory)",
        "provenance": "DARPA Intrusion Detection Evaluation, U.S. Air Force LAN simulation, 1998-1999",
        "fetched_via": "sklearn.datasets.fetch_kddcup99(subset='SA', percent10=True)",
        "n_samples_total_available": int(len(y)),
        "n_samples_used": int(n_samples),
        "n_attacks_in_sample": int(n_attack),
        "attack_fraction_in_sample": round(n_attack / max(1, n_samples), 4),
        "n_features": int(X.shape[1]),
        "attack_subtypes_in_full_dataset": sorted(set(attack_subtypes)),
        "feature_names": feat_names,
        "seed": seed,
    }
    return entities, attack_names, meta


def evaluate_kddcup99(
    n_samples: int = 6000,
    attack_fraction_target: float = 0.10,
    target_survivors: int = 1500,
    seed: int = 42,
) -> dict[str, Any]:
    """Run BTUT + Isolation Forest + LOF on real KDDCUP99 data."""
    entities, attack_names, meta = kddcup99_to_btut_entities(
        n_samples=n_samples,
        attack_fraction_target=attack_fraction_target,
        seed=seed,
    )
    n_total = len(entities)
    n_attacks = len(attack_names)

    print(f"[real_data] Corpus: {n_total} entities, {n_attacks} attacks "
          f"({100 * n_attacks / n_total:.1f}% attack rate)")
    print(f"[real_data] Target survivors: {target_survivors}")
    print(f"[real_data] Running BTUT pipeline on raw inputs ...")
    btut = run_btut(
        entities=entities,
        edges=[],
        target_survivors=target_survivors,
        budget_dollars=50.0,
    )
    print(f"      BTUT: {btut['n_survivors']} survivors in {btut['wall_seconds']}s "
          f"({btut['entities_per_second']} entities/sec)")

    btut_in_set = recall_in_set(btut["survivor_set"], attack_names)
    btut_in_set["lift"] = lift_in_set(n_attacks, n_total, btut_in_set["in_set_count"], len(btut["survivor_set"]))

    # Top-k analysis
    btut_topk = precision_recall_f1(btut["ranked_names"], attack_names, k=n_attacks)
    btut_topk["lift"] = lift_vs_random(n_attacks, n_total, btut_topk["true_positives"], k=n_attacks)

    # AUC for BTUT: treat survivors with composite as scores, non-survivors at the bottom
    # We use rank-as-score: rank 0 = highest, scaled to [1.0, 0.0]
    name_to_rank = {n: 1.0 - i / max(1, len(btut["ranked_names"]) - 1) for i, n in enumerate(btut["ranked_names"])}
    scores = [name_to_rank.get(e["name"], 0.0) for e in entities]
    labels = [1 if e["name"] in attack_names else 0 for e in entities]
    btut_auc = auroc(scores, labels)

    # Baselines on identical entity set
    print(f"[real_data] Running baselines (Isolation Forest + LOF) ...")
    baseline_raw = run_baselines(entities, seed=seed)
    baseline_metrics: dict[str, Any] = {}
    for bn, b in baseline_raw.items():
        if not b.get("available", False):
            baseline_metrics[bn] = {"available": False, "error": b.get("error", "n/a")}
            continue
        baseline_set = set(b["ranked_names"][:btut["n_survivors"]])
        in_set_b = recall_in_set(baseline_set, attack_names)
        in_set_b["lift"] = lift_in_set(n_attacks, n_total, in_set_b["in_set_count"], len(baseline_set))

        m = precision_recall_f1(b["ranked_names"], attack_names, k=n_attacks)
        m["lift"] = lift_vs_random(n_attacks, n_total, m["true_positives"], k=n_attacks)

        # AUC for baseline
        bn_to_rank = {n: 1.0 - i / max(1, len(b["ranked_names"]) - 1) for i, n in enumerate(b["ranked_names"])}
        bn_scores = [bn_to_rank.get(e["name"], 0.0) for e in entities]
        bn_auc = auroc(bn_scores, labels)

        baseline_metrics[bn] = {
            "available": True,
            "recall_in_set": in_set_b["recall_in_set"],
            "lift_in_set": in_set_b["lift"],
            "in_set_count": in_set_b["in_set_count"],
            "topk_precision": m["precision"],
            "topk_recall": m["recall"],
            "topk_f1": m["f1"],
            "topk_lift": m["lift"],
            "auc": bn_auc,
            "wall_seconds": b.get("wall_seconds", 0.0),
            "entities_per_second": b.get("entities_per_second", 0),
        }

    return {
        "vertical": "network_cyber_real_data",
        "label": "Network and cyber forensics (KDDCUP99 / DARPA real data)",
        "dataset_meta": meta,
        "corpus_size": n_total,
        "n_anomalies_ground_truth": n_attacks,
        "btut": {
            "primary_metric": btut_in_set,
            "topk_metric": btut_topk,
            "auc": btut_auc,
            "wall_seconds": btut["wall_seconds"],
            "entities_per_second": btut["entities_per_second"],
            "n_survivors": btut["n_survivors"],
            "n_clusters": btut["n_clusters"],
        },
        "baselines": baseline_metrics,
    }


def reconcile_with_existing_edgar() -> dict[str, Any]:
    """Reconcile real-data results with the existing EDGAR validation artifacts.

    The existing project has performed real-data BTUT validation against SEC
    distress filings (10-K/A, 10-Q/A, NT 10-K, NT 10-Q). The honest result
    is that BTUT performs near-random on this *predictive* task, because
    BTUT measures *structural* anomaly while distress filings are caused
    by factors BTUT does not see (fraud, late audit, etc.). This function
    surfaces the existing numbers for the megatest report.
    """
    out: dict[str, Any] = {
        "task": "Predict which CIKs will file SEC distress forms (10-K/A, 10-Q/A, NT 10-K, NT 10-Q)",
        "task_match_to_btut_design": "WEAK: distress filings are predictive, BTUT measures structural anomaly. Low correlation expected.",
    }

    cb_path = REPO_ROOT / "data" / "validation" / "competitive_backtest.json"
    if cb_path.exists():
        cb = json.loads(cb_path.read_text(encoding="utf-8"))
        out["competitive_backtest"] = {
            "ground_truth_source": cb.get("ground_truth", {}).get("source"),
            "positive_total": cb.get("ground_truth", {}).get("positive_total"),
            "positive_in_btut_survivor_set": cb.get("ground_truth", {}).get("positive_in_btut"),
            "rankers": [
                {
                    "name": r.get("name"),
                    "auc_hits_k500": r.get("auc_hits_k500"),
                    "recall_at_k100": next(
                        (pk.get("recall") for pk in r.get("per_k", []) if pk.get("K") == 100),
                        None,
                    ),
                }
                for r in cb.get("rankers", [])
            ],
            "random_null_auc_mean": cb.get("random_null_auc", {}).get("mean"),
            "vendor_comparison_methodology": list((cb.get("methodology_gap") or {}).keys()),
        }

    sd_path = REPO_ROOT / "data" / "validation" / "edgar_supervised_distress.json"
    if sd_path.exists():
        sd = json.loads(sd_path.read_text(encoding="utf-8"))
        out["supervised_distress"] = {
            "cv_mean_auc": sd.get("cv_mean_auc"),
            "cv_std_auc": sd.get("cv_std_auc"),
            "null_auc_mean": sd.get("null_auc_mean"),
            "cv_prec_at_10": sd.get("cv_prec_at_10"),
            "cv_rec_at_10": sd.get("cv_rec_at_10"),
            "ground_truth_source": sd.get("ground_truth_source"),
        }

    return out


def main() -> int:
    t0 = time.perf_counter()

    print("=" * 78)
    print("DEFENSE REAL-DATA VALIDATION (KDDCUP99 / DARPA / MIT Lincoln Lab)")
    print("=" * 78)
    print()

    kdd_result = evaluate_kddcup99(
        n_samples=6000,
        attack_fraction_target=0.10,
        target_survivors=1500,
        seed=42,
    )

    print()
    print("=" * 78)
    print("RECONCILIATION WITH EXISTING REAL-DATA WORK (EDGAR distress)")
    print("=" * 78)
    edgar = reconcile_with_existing_edgar()
    print(f"Task: {edgar['task']}")
    print(f"Task-match: {edgar['task_match_to_btut_design']}")
    if "competitive_backtest" in edgar:
        cb = edgar["competitive_backtest"]
        print(f"Ground truth: {cb.get('ground_truth_source')}")
        print(f"Positive total: {cb.get('positive_total')}, in BTUT survivors: {cb.get('positive_in_btut_survivor_set')}")
        print("Ranker AUC-hits at K=500 (higher = better):")
        for r in cb.get("rankers", []):
            print(f"  {r['name']:24s}  auc_hits_k500={r['auc_hits_k500']:.3f}  recall@k100={r['recall_at_k100']}")
        print(f"  random null mean: {cb.get('random_null_auc_mean')}")

    wall_total = round(time.perf_counter() - t0, 2)

    out = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "wall_seconds": wall_total,
        "seed": 42,
        "kddcup99_real_data": kdd_result,
        "edgar_reconciliation": edgar,
    }

    out_path = REPO_ROOT / "data" / "validation" / "defense_megatest_real_data.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")

    print()
    print(f"[real_data] Artifact: {out_path}")

    # Headline
    print()
    print("=" * 78)
    print("HEADLINE — KDDCUP99 (real DARPA defense data)")
    print("=" * 78)
    pm = kdd_result["btut"]["primary_metric"]
    print(f"  BTUT:               recall_in_survivors={pm['recall_in_set']:.3f}  "
          f"lift={pm['lift']:.2f}x  AUC={kdd_result['btut']['auc']:.3f}  "
          f"throughput={kdd_result['btut']['entities_per_second']} entities/sec")
    for bn, bm in kdd_result["baselines"].items():
        if bm.get("available"):
            print(f"  {bn:18s}  recall_in_survivors={bm['recall_in_set']:.3f}  "
                  f"lift={bm['lift_in_set']:.2f}x  AUC={bm['auc']:.3f}  "
                  f"throughput={bm['entities_per_second']} entities/sec")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
