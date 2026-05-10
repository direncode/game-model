"""
Test 2 GPU phase — REAL TNA corpus through the production BTUT -> TCD-JEPA
serverless endpoint at varying budgets. Measures whether the prod pipeline
cleanly separates the 6+ TNA archives at H100 scale (vs. the local kmeans
that hit per-archive amplification of +48 percentage points).

Per-job output from the endpoint:
    final_auc, final_knn, final_loss
    modules: list of {dominant_type (= archive), entities, ...}

We compute archive-purity per module and aggregate against the local Test 1
findings.
"""
from __future__ import annotations

import json
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "experiments"))
from runpod_dispatch import submit_and_wait  # noqa: E402


CORPUS_PATH = Path("tmp/bombe_tna_full.ndjson")
TOP_N_ARCHIVES = 6
KNN_K = 6


def load_records():
    return [json.loads(l) for l in CORPUS_PATH.read_text(encoding="utf-8").splitlines() if l.strip()]


def build_entities_and_edges(records, top_n_archives, knn_k):
    """Build entities (type=archive) and trivial knn edges by archive-membership."""
    counts = Counter(r["archive"] for r in records)
    top = {a for a, _ in counts.most_common(top_n_archives)}
    filtered = [r for r in records if r["archive"] in top]
    print(f"[corpus] kept {len(filtered)} records across {len(top)} archives")
    for a, c in Counter(r["archive"] for r in filtered).most_common():
        print(f"          {a:30s} n={c}")

    rng = np.random.default_rng(42)
    entities = []
    name_by_archive = defaultdict(list)
    for i, r in enumerate(filtered):
        name = r.get("paper_id") or r.get("doc_id") or f"rec_{i}"
        entities.append({
            "name": name,
            "type": r["archive"],
            "attributes": {
                "title": r.get("title", "")[:300],
                "text": r.get("text", "")[:1500],
                "archive": r["archive"],
            },
        })
        name_by_archive[r["archive"]].append(name)

    # Edges: kNN within-archive + a few cross-archive for graph connectivity.
    edges = []
    for r_i, r in enumerate(filtered):
        name = entities[r_i]["name"]
        same = [n for n in name_by_archive[r["archive"]] if n != name]
        within = rng.choice(same, size=min(knn_k - 1, len(same)), replace=False)
        for tgt in within:
            edges.append({"source": name, "target": str(tgt), "type": "within_archive", "weight": 1.0})
        # one cross-archive link for graph connectivity
        other_archives = [a for a in name_by_archive if a != r["archive"]]
        if other_archives:
            tgt_arch = rng.choice(other_archives)
            tgt = rng.choice(name_by_archive[tgt_arch])
            edges.append({"source": name, "target": str(tgt), "type": "cross_archive", "weight": 0.1})
    print(f"[edges] built {len(edges)} edges (within + cross archive)")
    return entities, edges


def measure_module_archive_purity(modules):
    """For each module, what fraction of its entities come from its dominant archive?"""
    rows = []
    for m in modules:
        ents = m.get("entities", [])
        if not ents:
            continue
        archives = Counter(e.get("type") for e in ents)
        top_arch, top_count = archives.most_common(1)[0]
        rows.append({
            "module_name": m.get("name", m.get("dominant_type", "?")),
            "dominant_type": m.get("dominant_type"),
            "n_entities": len(ents),
            "top_archive": top_arch,
            "top_archive_count": top_count,
            "purity": round(top_count / len(ents), 4),
            "archive_distribution": dict(archives),
        })
    return rows


def measure_archive_self_basin(modules, entities):
    """For each archive, what fraction of its entities land in modules dominated by that archive?"""
    # build entity -> module mapping
    ent_to_module_arch = {}
    for m in modules:
        for e in m.get("entities", []):
            ent_to_module_arch[e.get("name")] = m.get("dominant_type")

    by_archive = defaultdict(list)
    for ent in entities:
        archive = ent["type"]
        landed_in = ent_to_module_arch.get(ent["name"])
        if landed_in is not None:
            by_archive[archive].append(1 if landed_in == archive else 0)

    rows = []
    for archive, lands in sorted(by_archive.items()):
        if not lands:
            continue
        rows.append({
            "archive": archive,
            "n_records_in_modules": len(lands),
            "self_basin_share": round(sum(lands) / len(lands), 4),
        })
    return rows


def run_single(budget_dollars: float, epochs: int = 50):
    records = load_records()
    entities, edges = build_entities_and_edges(records, TOP_N_ARCHIVES, KNN_K)

    config = {
        "btut_enabled": True,
        "btut_budget_dollars": budget_dollars,
        "epochs": epochs,
    }
    print(f"\n=== submitting (budget=${budget_dollars}, epochs={epochs}) ===")
    t0 = time.time()
    raw = submit_and_wait(
        entities, edges,
        config=config,
        job_id=f"tna_full_b{int(budget_dollars*100)}_{int(time.time())}",
        estimated_cost_dollars=0.50,
    )
    wall = time.time() - t0

    if raw.get("status") != "COMPLETED":
        print(f"!! job did not complete: status={raw.get('status')}")
        return {"budget_dollars": budget_dollars, "error": raw}

    output = raw.get("output")
    final = None
    if isinstance(output, list):
        for item in reversed(output):
            if isinstance(item, dict) and "modules" in item:
                final = item
                break
    elif isinstance(output, dict):
        final = output
    if final is None:
        return {"budget_dollars": budget_dollars, "error": "no final result with modules", "raw": raw}

    modules = final.get("modules", [])
    purity_rows = measure_module_archive_purity(modules)
    archive_rows = measure_archive_self_basin(modules, entities)

    mean_purity = float(np.mean([r["purity"] for r in purity_rows])) if purity_rows else 0.0
    mean_self_basin = float(np.mean([r["self_basin_share"] for r in archive_rows])) if archive_rows else 0.0

    summary = {
        "budget_dollars": budget_dollars,
        "epochs": epochs,
        "wall_seconds": round(wall, 2),
        "exec_ms": final.get("training_time_seconds", 0) * 1000,
        "device": final.get("device", "?"),
        "final_auc": final.get("final_auc"),
        "final_knn": final.get("final_knn"),
        "final_loss": final.get("final_loss"),
        "n_entities_input": len(entities),
        "n_modules_discovered": len(modules),
        "mean_module_purity": round(mean_purity, 4),
        "mean_archive_self_basin": round(mean_self_basin, 4),
        "module_purity_rows": purity_rows,
        "archive_self_basin_rows": archive_rows,
    }

    print(f"\n[result @ ${budget_dollars}]  modules={len(modules)}  "
          f"purity={mean_purity:.4f}  archive_self_basin={mean_self_basin:.4f}  "
          f"AUC={final.get('final_auc')}")
    for row in archive_rows:
        print(f"    {row['archive']:30s}  n={row['n_records_in_modules']:4d}  "
              f"self_basin={row['self_basin_share']:.4f}")

    return summary


def main():
    BUDGETS = [0.5, 5.0, 50.0]
    runs = []
    for budget in BUDGETS:
        result = run_single(budget)
        runs.append(result)

    out = {
        "campaign": "tna_full_gpu_runpod",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "endpoint": "production runpod serverless (BTUT + TCD-JEPA on H100)",
        "config": {
            "corpus_path": str(CORPUS_PATH),
            "top_n_archives": TOP_N_ARCHIVES,
            "knn_k": KNN_K,
            "budgets_dollars": BUDGETS,
        },
        "runs": runs,
    }
    out_path = Path(f"data/validation/tna_full_gpu_{datetime.utcnow():%Y%m%d}.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"\nsaved: {out_path}")

    print("\n" + "=" * 80)
    print("TNA GPU CAMPAIGN — summary")
    print("=" * 80)
    for r in runs:
        if "error" in r:
            print(f"  budget=${r['budget_dollars']:.1f}  ERROR")
        else:
            print(f"  budget=${r['budget_dollars']:.1f}  modules={r['n_modules_discovered']:2d}  "
                  f"purity={r['mean_module_purity']:.4f}  archive_self_basin={r['mean_archive_self_basin']:.4f}  "
                  f"AUC={r['final_auc']}  wall={r['wall_seconds']:.1f}s")


if __name__ == "__main__":
    main()
