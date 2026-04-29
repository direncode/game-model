"""Run BTUT pre-reduction on NSL-KDD locally on CPU.

BTUT is the project's deterministic structural-anomaly pre-reduction step.
It's not computationally expensive: 8-tier pipeline runs in seconds on
CPU, no GPU required. The earlier "BTUT silent-failed on the serverless
worker" finding was specifically about the integrated handler trying to
import app.services.btut from a worker image that didn't have the backend
package installed. BTUT itself works fine when invoked directly on a host
that has the project source.

This script:
  1. Loads 9000 NSL-KDD records (matching the GPU run's sample)
  2. Builds BTUT entity dicts ({name, type, attributes})
  3. Calls run_btut_pipeline directly on CPU
  4. Reports survivor count, reduction ratio, wall-clock, and the
     attack-subtype breakdown of survivors vs original
  5. Saves the BTUT result to data/validation/btut_nslkdd_survivors.json

Usage:
    python -m scripts.defense_megatest.run_btut_nslkdd
"""
from __future__ import annotations

import json
import sys
import time
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.engine.reduce.pipeline import run_btut_pipeline  # noqa: E402

from scripts.defense_megatest.runpod_submit import (  # noqa: E402
    fetch_nsl_kdd,
    load_entities,
)


def main() -> int:
    cache = REPO_ROOT / "data" / "cache" / "nsl_kdd_train.txt"
    fetch_nsl_kdd(cache)

    print("[btut] Loading 9000 NSL-KDD records (same sample as GPU run, seed=42) ...")
    entities, label_meta = load_entities(cache, n_records=9000, seed=42)
    print(f"[btut]   {label_meta['n_records']} flows, "
          f"{label_meta['n_attacks']} attacks "
          f"({100 * label_meta['attack_rate']:.1f}% rate), "
          f"{len(label_meta['attack_subtypes_in_sample'])} subtypes")

    # BTUT expects edges; for tabular flow data, no inter-flow edges
    edges: list[dict] = []
    unique_types = sorted({e["type"] for e in entities})
    print(f"[btut]   unique entity types: {unique_types}")

    print("[btut] Running 8-tier BTUT pipeline on CPU ...")
    t0 = time.perf_counter()
    result = run_btut_pipeline(
        entities=entities,
        edges=edges,
        unique_types=unique_types,
        target_survivors=300,
        budget_dollars=25.0,
    )
    wall = time.perf_counter() - t0
    print(f"[btut] BTUT wall-clock: {wall:.2f}s")

    summary = result["summary"]
    survivors = result["survivors"]
    print(f"[btut]   total_entities (post-prefilter): {summary['total_entities']}")
    print(f"[btut]   clusters: {summary['clusters']}")
    print(f"[btut]   unique 48-bit fingerprints: {summary['unique_48bit_fingerprints']}")
    print(f"[btut]   survivors selected: {summary['survivors']}")
    print(f"[btut]   reduction ratio: {summary['reduction']}x")
    print(f"[btut]   survivor types: {summary['survivor_types']}")

    # Compute attack-subtype distribution among survivors vs original
    survivor_names = {s["entity"]["name"] for s in survivors}
    labels = label_meta["labels"]
    survivor_subtypes = Counter()
    survivor_attacks = 0
    for name in survivor_names:
        lab = labels.get(name)
        if not lab:
            continue
        if lab.get("is_attack"):
            survivor_attacks += 1
        survivor_subtypes[lab.get("attack_label", "?")] += 1

    print()
    print("[btut] === Attack-subtype concentration in BTUT survivors ===")
    print(f"  survivors total: {len(survivor_names)}")
    print(f"  survivor attack share: {survivor_attacks}/{len(survivor_names)} = "
          f"{100 * survivor_attacks / max(1, len(survivor_names)):.1f}%")
    print(f"  original attack share: {label_meta['n_attacks']}/{label_meta['n_records']} = "
          f"{100 * label_meta['attack_rate']:.1f}%")
    print()
    print("  Top subtypes among survivors (concentration of structural anomalies):")
    orig_dist = label_meta["attack_subtypes_in_sample"]
    for subtype, count in survivor_subtypes.most_common(10):
        orig_count = orig_dist.get(subtype, 0)
        survivor_share = count / max(1, len(survivor_names))
        original_share = orig_count / max(1, label_meta["n_records"])
        lift = (survivor_share / original_share) if original_share > 0 else float("inf")
        print(f"    {subtype:24s}  survivors: {count:3d} ({100*survivor_share:5.1f}%)  "
              f"original: {orig_count:4d} ({100*original_share:5.1f}%)  lift: {lift:.2f}x")

    out: dict = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "input": {
            "dataset": "NSL-KDD train+ (9000 records, seed=42)",
            "n_input_records": label_meta["n_records"],
            "input_attack_rate": label_meta["attack_rate"],
            "input_subtypes": label_meta["attack_subtypes_in_sample"],
        },
        "btut_summary": summary,
        "btut_wall_seconds": round(wall, 3),
        "device": "cpu",
        "survivor_attack_share": round(survivor_attacks / max(1, len(survivor_names)), 4),
        "survivor_subtype_concentration": [
            {
                "subtype": s,
                "survivor_count": c,
                "survivor_share": round(c / max(1, len(survivor_names)), 4),
                "original_count": orig_dist.get(s, 0),
                "original_share": round(orig_dist.get(s, 0) / max(1, label_meta["n_records"]), 4),
                "lift": round(
                    (c / max(1, len(survivor_names))) /
                    max(1e-9, orig_dist.get(s, 0) / max(1, label_meta["n_records"])),
                    3,
                ) if orig_dist.get(s, 0) > 0 else None,
            }
            for s, c in survivor_subtypes.most_common(20)
        ],
    }

    out_path = REPO_ROOT / "data" / "validation" / "btut_nslkdd_survivors.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
    print()
    print(f"[btut] Artifact: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
