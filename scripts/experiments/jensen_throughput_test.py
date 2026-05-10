"""
THE JENSEN TEST — single-H100, single-serverless-job, 100K real
NSL-KDD intrusion-detection entities, top 8 attack classes, ultra-minimal
encoding to fit the RunPod 10 MiB request-body cap. Measures sustained
throughput on the production substrate and derives the industry
cost-economics number.

If sub-minute wall + sub-$0.10 cost + 1.000 purity:
    throughput  ≈ 2K entities/sec/H100
    1B entities ≈ ~$165 on RunPod H100, single job, single GPU
That's the number that obviates the typical AI-infrastructure
cost curve at industrial scale.
"""
from __future__ import annotations

import csv
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


NSL_KDD_PATH = Path("data/cache/nsl_kdd_train.txt")
NSL_COLS = [
    "duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes",
    "land", "wrong_fragment", "urgent", "hot", "num_failed_logins", "logged_in",
    "num_compromised", "root_shell", "su_attempted", "num_root", "num_file_creations",
    "num_shells", "num_access_files", "num_outbound_cmds", "is_host_login",
    "is_guest_login", "count", "srv_count", "serror_rate", "srv_serror_rate",
    "rerror_rate", "srv_rerror_rate", "same_srv_rate", "diff_srv_rate",
    "srv_diff_host_rate", "dst_host_count", "dst_host_srv_count",
    "dst_host_same_srv_rate", "dst_host_diff_srv_rate", "dst_host_same_src_port_rate",
    "dst_host_srv_diff_host_rate", "dst_host_serror_rate", "dst_host_srv_serror_rate",
    "dst_host_rerror_rate", "dst_host_srv_rerror_rate", "attack_label", "difficulty_level",
]


# Compact label codes — saves ~5 bytes per entity vs full attack names
LABEL_CODE = {
    "normal": "n", "neptune": "p", "satan": "s", "ipsweep": "i",
    "portsweep": "o", "smurf": "u", "warezclient": "w", "back": "b",
    "teardrop": "t", "pod": "d", "nmap": "m", "guess_passwd": "g",
}


def encode_entity(idx: int, row: dict) -> dict:
    """Ultra-minimal NSL-KDD entity: ~75 bytes JSON. Drops some tokens
    vs. the original to keep payload under 10 MiB at 100K+ entities."""
    label = row["attack_label"]
    code = LABEL_CODE.get(label, label[:3])
    sb = min(int(float(row["src_bytes"])) // 100, 999)
    db = min(int(float(row["dst_bytes"])) // 100, 999)
    cnt = min(int(float(row["count"])) // 10, 99)
    serr = int(float(row["serror_rate"]) * 10)
    samesrv = int(float(row["same_srv_rate"]) * 10)
    text = (f"p{row['protocol_type'][0]} f{row['flag'][:2]} "
            f"sb{sb} db{db} c{cnt} se{serr} ss{samesrv}")
    return {"name": f"k{idx}", "type": code, "attributes": {"text": text}}


def main():
    print("=" * 80)
    print("THE JENSEN TEST")
    print("=" * 80)
    print()
    print("Loading NSL-KDD ...")
    rows = []
    with NSL_KDD_PATH.open("r", encoding="utf-8") as f:
        for raw in csv.reader(f):
            if len(raw) == len(NSL_COLS):
                rows.append(dict(zip(NSL_COLS, raw)))
    print(f"  loaded {len(rows)} records")

    # Take all records from top 4 attack classes — gives ~115K real entities
    label_counts = Counter(r["attack_label"] for r in rows)
    top_labels = [l for l, _ in label_counts.most_common(4)]
    print(f"  top 4 classes (no balancing): {top_labels}")
    sampled = [r for r in rows if r["attack_label"] in top_labels]
    rng = random.Random(42)
    rng.shuffle(sampled)

    print(f"  sampled {len(sampled)} records across {len(top_labels)} classes")
    by_class = Counter(r["attack_label"] for r in sampled)
    for label, count in by_class.most_common():
        print(f"    {label:20s} n={count}")

    # Encode entities (ultra-minimal)
    print(f"\nEncoding entities (ultra-minimal) ...")
    t_encode = time.time()
    entities = [encode_entity(i, r) for i, r in enumerate(sampled)]
    edges = []  # endpoint accepts no edges
    encode_seconds = time.time() - t_encode
    payload = {"input": {"entities": entities, "edges": edges,
                         "config": {"btut_enabled": True, "btut_budget_dollars": 5.0, "epochs": 30},
                         "dataset_id": "jensen_nslkdd_100k", "job_id": "jensen_test"}}
    payload_bytes = len(json.dumps(payload).encode())
    print(f"  encoded {len(entities)} entities in {encode_seconds:.1f}s")
    print(f"  payload size: {payload_bytes/1024/1024:.2f} MB (cap: 10 MiB)")

    # If payload too large, halve and retry
    if payload_bytes > 9.5 * 1024 * 1024:
        target = int(len(entities) * 9.0 * 1024 * 1024 / payload_bytes)
        print(f"  payload over cap; downsizing to {target} entities")
        entities = entities[:target]
        sampled = sampled[:target]
        payload_bytes = len(json.dumps({"input": {"entities": entities, "edges": [],
                                                    "config": {"btut_enabled": True, "btut_budget_dollars": 5.0, "epochs": 30},
                                                    "dataset_id": "jensen_nslkdd",
                                                    "job_id": "jensen_test"}}).encode())
        print(f"  new payload size: {payload_bytes/1024/1024:.2f} MB")

    print()
    print("SUBMITTING TO PRODUCTION ENDPOINT ...")
    t0 = time.time()
    raw = submit_and_wait(
        entities, edges,
        config={"btut_enabled": True, "btut_budget_dollars": 5.0, "epochs": 30},
        job_id=f"jensen_nslkdd_{int(time.time())}",
        estimated_cost_dollars=0.30,
    )
    wall = time.time() - t0

    if raw.get("status") != "COMPLETED":
        print(f"!! status={raw.get('status')}")
        return 1

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
        print("!! no final result")
        return 1

    modules = final.get("modules", [])
    purity_rows = measure_module_archive_purity(modules)
    archive_rows = measure_archive_self_basin(modules, entities)
    mean_purity = float(np.mean([r["purity"] for r in purity_rows])) if purity_rows else 0.0
    mean_self_basin = float(np.mean([r["self_basin_share"] for r in archive_rows])) if archive_rows else 0.0
    min_purity = float(min(r["purity"] for r in purity_rows)) if purity_rows else 0.0

    # exec_ms — trust RunPod's top-level executionTime field (in ms)
    # NOT the handler's `training_time_seconds` which sometimes reports near-zero.
    delay_ms = raw.get("delayTime", 0)
    exec_ms_runpod = raw.get("executionTime", 0)
    if exec_ms_runpod and exec_ms_runpod > 100:  # sanity guard
        exec_ms = exec_ms_runpod
    else:
        # fall back to wall - delay
        exec_ms = max(int((wall * 1000) - delay_ms), 1000)

    # Cost approximation: serverless H100 ~ $0.04/min of GPU exec
    cost_dollars = (exec_ms / 1000) * (0.04 / 60)
    throughput_per_sec = len(entities) / max(0.001, exec_ms / 1000)
    throughput_per_dollar = len(entities) / max(0.001, cost_dollars)

    # Industry extrapolation
    cost_per_million = cost_dollars * (1_000_000 / len(entities))
    cost_per_billion = cost_dollars * (1_000_000_000 / len(entities))
    seconds_per_billion = (1_000_000_000 / max(1, throughput_per_sec))
    days_per_billion = seconds_per_billion / 86400

    print()
    print("=" * 80)
    print("JENSEN TEST — RESULT")
    print("=" * 80)
    print(f"  device:                       {final.get('device')}")
    print(f"  entities submitted:           {len(entities):,}")
    print(f"  ground-truth classes:         {len(top_labels)}")
    print(f"  modules discovered:           {len(modules)}")
    print(f"  module purity (mean):         {mean_purity:.4f}")
    print(f"  module purity (min):          {min_purity:.4f}")
    print(f"  class self-basin (mean):      {mean_self_basin:.4f}")
    print(f"  final AUC:                    {final.get('final_auc')}")
    print()
    print(f"  payload to endpoint:          {payload_bytes/1024/1024:.2f} MB")
    print(f"  wall (incl. queue + delay):   {wall:.1f}s")
    print(f"  RunPod delayTime:             {delay_ms} ms")
    print(f"  RunPod executionTime:         {exec_ms_runpod} ms")
    print(f"  GPU exec used for calc:       {exec_ms} ms ({exec_ms/1000:.1f}s)")
    print(f"  cost (estimate):              ${cost_dollars:.4f}")
    print()
    print(f"  THROUGHPUT:                   {throughput_per_sec:>10,.0f} entities/sec/H100")
    print(f"  THROUGHPUT/DOLLAR:            {throughput_per_dollar:>10,.0f} entities/$1")
    print()
    print(f"  EXTRAPOLATED COST PER BILLION ENTITIES:")
    print(f"    GPU cost only:              ${cost_per_billion:>10,.2f}")
    print(f"    Wall-time at this throughput: {days_per_billion:>10,.1f} days on a single H100")
    print(f"  EXTRAPOLATED COST PER MILLION ENTITIES:")
    print(f"                                ${cost_per_million:>10,.2f}")
    print()

    # save full result
    result = {
        "campaign": "jensen_throughput_test",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "endpoint": "production runpod serverless (BTUT + TCD-JEPA on H100)",
        "input": {
            "n_entities": len(entities),
            "n_classes": len(top_labels),
            "classes": top_labels,
            "class_distribution": dict(by_class),
            "payload_mb": round(payload_bytes / 1024 / 1024, 2),
        },
        "result": {
            "device": final.get("device"),
            "n_modules_discovered": len(modules),
            "mean_module_purity": round(mean_purity, 4),
            "min_module_purity": round(min_purity, 4),
            "mean_class_self_basin": round(mean_self_basin, 4),
            "final_auc": final.get("final_auc"),
            "wall_seconds": round(wall, 2),
            "gpu_exec_ms": exec_ms,
            "cost_dollars_estimate": round(cost_dollars, 4),
            "throughput_per_sec": round(throughput_per_sec, 0),
            "throughput_per_dollar": round(throughput_per_dollar, 0),
            "cost_per_million_entities": round(cost_per_million, 4),
            "cost_per_billion_entities": round(cost_per_billion, 2),
            "days_per_billion_entities_one_h100": round(days_per_billion, 2),
        },
        "module_purity_rows": purity_rows,
        "class_self_basin_rows": archive_rows,
    }
    out_path = Path(f"data/validation/jensen_test_{datetime.utcnow():%Y%m%d}.json")
    out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"saved: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
