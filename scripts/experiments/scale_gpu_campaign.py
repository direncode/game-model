"""
Test 2 GPU phase — synthetic SCALE test through the production
BTUT -> TCD-JEPA endpoint. Drives the entity count up (1K -> 10K -> 25K)
to characterize how the substrate scales: does purity hold? Does the
runtime grow sub-linearly? Does BTUT actually start compressing
meaningfully at the medium/large bucket?
"""
from __future__ import annotations

import json
import random
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "experiments"))
from runpod_dispatch import submit_and_wait  # noqa: E402
from tna_gpu_campaign import (  # noqa: E402
    measure_module_archive_purity,
    measure_archive_self_basin,
)


KEYWORD_POOL = [
    "decrypt", "operation", "intercept", "directorate", "policy", "minister",
    "summary", "tactical", "diplomatic", "summit", "berlin", "moscow",
    "communications", "naval", "army", "field", "headquarters", "report",
    "agent", "source", "frequency", "wireless", "convoy", "fleet",
    "panzer", "luftwaffe", "kremlin", "comintern", "embassy", "courier",
]


def synth_corpus(n_entities: int, n_archetypes: int, seed: int = 42,
                 within_edges: int = 2, cross_edges: int = 1,
                 minimal_payload: bool = False, ultra_minimal: bool = False):
    """Build synthetic corpus. minimal_payload trims fields; ultra_minimal
    additionally cuts entities to ~30 bytes and drops edges to fit
    100K+ under the RunPod 10MB request-body cap.
    """
    rng = random.Random(seed)
    entities = []
    archetype_keywords = {
        a: rng.sample(KEYWORD_POOL, k=4) + [f"a{a}"]
        for a in range(n_archetypes)
    }
    indices_by_archetype = {a: [] for a in range(n_archetypes)}

    for i in range(n_entities):
        archetype = i % n_archetypes
        kws = archetype_keywords[archetype]
        if ultra_minimal:
            # ~30 bytes/entity: name, type, single-keyword text
            kw = kws[i % len(kws)]
            entities.append({
                "name": f"e{i}",
                "type": f"a{archetype}",
                "attributes": {"text": kw},
            })
        elif minimal_payload:
            text = " ".join(rng.choices(kws, k=6))
            entities.append({
                "name": f"e{i}",
                "type": f"a{archetype}",
                "attributes": {"text": text},
            })
        else:
            text = " ".join(rng.choices(kws, k=12)) + f" item_{i}"
            entities.append({
                "name": f"e{i}",
                "type": f"archetype_{archetype}",
                "attributes": {
                    "title": f"Document {i} archetype {archetype}"[:120],
                    "text": text[:400],
                    "archive": f"archetype_{archetype}",
                },
            })
        indices_by_archetype[archetype].append(i)

    edges = []
    archetypes = list(range(n_archetypes))
    for i in range(n_entities):
        my_arch = i % n_archetypes
        same_pool = indices_by_archetype[my_arch]
        for _ in range(within_edges):
            j = same_pool[rng.randrange(len(same_pool))]
            if j != i:
                edges.append({
                    "source": f"e{i}", "target": f"e{j}",
                    "type": "within", "weight": 1.0,
                })
        for _ in range(cross_edges):
            other_arch = archetypes[rng.randrange(n_archetypes - 1)]
            if other_arch >= my_arch:
                other_arch += 1
            other_pool = indices_by_archetype[other_arch]
            j = other_pool[rng.randrange(len(other_pool))]
            edges.append({
                "source": f"e{i}", "target": f"e{j}",
                "type": "cross", "weight": 0.1,
            })
    return entities, edges


def run_scale(n_entities: int, n_archetypes: int = 8, budget_dollars: float = 5.0,
              epochs: int = 30):
    print(f"\n=== synth_scale n={n_entities} archetypes={n_archetypes} budget=${budget_dollars} ===")
    t_build = time.time()
    ultra = n_entities >= 75000
    minimal = n_entities >= 15000 and not ultra
    within_e = 0 if ultra else 1
    cross_e = 0 if (ultra or n_entities >= 50000) else 1
    entities, edges = synth_corpus(
        n_entities, n_archetypes,
        minimal_payload=minimal, ultra_minimal=ultra,
        within_edges=within_e, cross_edges=cross_e,
    )
    print(f"[build] {len(entities)} entities, {len(edges)} edges in {time.time()-t_build:.1f}s "
          f"(ultra_minimal={ultra}, minimal_payload={minimal})")

    config = {
        "btut_enabled": True,
        "btut_budget_dollars": budget_dollars,
        "epochs": epochs,
    }
    print(f"[submit]")
    t0 = time.time()
    raw = submit_and_wait(
        entities, edges,
        config=config,
        job_id=f"scale_n{n_entities}_b{int(budget_dollars*100)}_{int(time.time())}",
        estimated_cost_dollars=max(0.20, n_entities / 5000),
    )
    wall = time.time() - t0

    if raw.get("status") != "COMPLETED":
        print(f"!! status={raw.get('status')}")
        return {"n_entities": n_entities, "error": raw.get("status"), "raw_status": raw}

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
        return {"n_entities": n_entities, "error": "no final result"}

    modules = final.get("modules", [])
    purity_rows = measure_module_archive_purity(modules)
    archive_rows = measure_archive_self_basin(modules, entities)
    mean_purity = float(np.mean([r["purity"] for r in purity_rows])) if purity_rows else 0.0
    mean_self_basin = float(np.mean([r["self_basin_share"] for r in archive_rows])) if archive_rows else 0.0

    summary = {
        "n_entities": n_entities,
        "n_archetypes": n_archetypes,
        "budget_dollars": budget_dollars,
        "epochs": epochs,
        "wall_seconds": round(wall, 2),
        "device": final.get("device", "?"),
        "final_auc": final.get("final_auc"),
        "final_knn": final.get("final_knn"),
        "final_loss": final.get("final_loss"),
        "n_modules_discovered": len(modules),
        "mean_module_purity": round(mean_purity, 4),
        "mean_archetype_self_basin": round(mean_self_basin, 4),
        "module_purity_rows": purity_rows,
        "archetype_self_basin_rows": archive_rows,
    }

    print(f"[result] modules={len(modules)}  purity={mean_purity:.4f}  "
          f"self_basin={mean_self_basin:.4f}  AUC={final.get('final_auc')}  wall={wall:.1f}s")
    return summary


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--scales", default="1000,5000,10000",
                    help="comma-separated entity counts")
    ap.add_argument("--archetypes", default="6,8,10",
                    help="comma-separated archetype counts (matches scales)")
    args = ap.parse_args()

    sizes = [int(x) for x in args.scales.split(",")]
    archs = [int(x) for x in args.archetypes.split(",")]
    if len(archs) == 1:
        archs = archs * len(sizes)
    SCALES = [{"n_entities": n, "n_archetypes": a} for n, a in zip(sizes, archs)]

    runs = []
    for s in SCALES:
        result = run_scale(**s)
        runs.append(result)

    out = {
        "campaign": "synth_scale_gpu_runpod",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "endpoint": "production runpod serverless (BTUT + TCD-JEPA on H100)",
        "scales_tested": SCALES,
        "runs": runs,
    }
    out_path = Path(f"data/validation/scale_gpu_{datetime.utcnow():%Y%m%d}.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"\nsaved: {out_path}")

    print("\n" + "=" * 80)
    print("SCALE GPU CAMPAIGN — summary")
    print("=" * 80)
    for r in runs:
        if "error" in r:
            print(f"  n={r['n_entities']:>5d}  ERROR: {r['error']}")
        else:
            print(f"  n={r['n_entities']:>5d}  arch={r['n_archetypes']}  "
                  f"modules={r['n_modules_discovered']:2d}  "
                  f"purity={r['mean_module_purity']:.4f}  "
                  f"self_basin={r['mean_archetype_self_basin']:.4f}  "
                  f"AUC={r['final_auc']}  wall={r['wall_seconds']:.1f}s")


if __name__ == "__main__":
    main()
