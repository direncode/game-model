"""
OVERNIGHT SUBSTRATE PHASE DIAGRAM CAMPAIGN.

Goal: produce a substrate phase diagram — find where the production
BTUT + TCD-JEPA endpoint works at perfect purity, where it degrades
gracefully, where it breaks. ~155 tests across 6 phases. Self-imposed
campaign budget: $5 (further-bounded by the dispatcher's $30 cap).

Phases:
  1. SCALE x CLASS_COUNT     (42)  — main grid
  2. CLASS x NOISE           (25)  — robustness to signature noise
  3. CLASS x IMBALANCE       (30)  — rare-class recovery
  4. CLASS x OVERLAP         (24)  — overlapping class signatures
  5. REAL DATA SUITE         (~14) — TNA + NSL-KDD at multiple sample sizes
  6. THROUGHPUT BURST        (20)  — sustained throughput on warm workers

Per-test result saved to data/validation/overnight/<phase>_<test_id>.json.
Campaign-level summary saved to data/validation/overnight_summary_<date>.json.

Resilience: errors on individual tests are logged but do not abort the
campaign. Budget is checked before each submission. Per-job timeout is
enforced via the dispatcher (10 min default).
"""
from __future__ import annotations

import csv
import json
import random
import sys
import time
import traceback
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "experiments"))

from runpod_dispatch import submit_and_wait, load_spend  # noqa: E402
from tna_gpu_campaign import (  # noqa: E402
    measure_module_archive_purity,
    measure_archive_self_basin,
)


# ---------- guards --------------------------------------------------------
CAMPAIGN_BUDGET_CAP = 5.0  # campaign-level soft cap; dispatcher has $30 hard cap
PER_TEST_TIMEOUT = 240
COOLDOWN = 1.0
RESULTS_DIR = Path("data/validation/overnight")
SUMMARY_PATH = Path(f"data/validation/overnight_summary_{datetime.utcnow():%Y%m%d}.json")
# --------------------------------------------------------------------------


KEYWORD_POOL = [
    "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta",
    "iota", "kappa", "lambda", "mu", "nu", "xi", "omicron", "pi",
    "rho", "sigma", "tau", "upsilon", "phi", "chi", "psi", "omega",
    "north", "south", "east", "west", "up", "down", "left", "right",
    "red", "blue", "green", "yellow", "black", "white", "purple", "orange",
]


# =========================================================================
# Synthetic builders with axes for noise, imbalance, overlap
# =========================================================================
def build_synth(n_entities: int, n_classes: int, seed: int = 42,
                noise_level: float = 0.0, imbalance_ratio: float = 1.0,
                overlap_frac: float = 0.0):
    """Build synthetic corpus with controllable noise, imbalance, overlap.

    noise_level:    [0,1] fraction of signature tokens replaced with random pool tokens
    imbalance_ratio: [1,inf) ratio of largest class to smallest class
    overlap_frac:    [0,1) fraction of signature tokens shared with neighbor classes
    """
    rng = random.Random(seed)
    sig_size = 5
    pool = list(KEYWORD_POOL)
    rng.shuffle(pool)

    # Class signatures with controllable overlap
    n_overlap = int(sig_size * overlap_frac)
    n_unique = sig_size - n_overlap
    shared_block = pool[:max(n_overlap, 1)] if n_overlap else []
    unique_chunks = []
    for c in range(n_classes):
        start = max(n_overlap, 1) + c * n_unique
        chunk = pool[start:start + n_unique]
        if not chunk:
            chunk = [f"u_{c}"]
        unique_chunks.append(chunk)
    class_sigs = {c: shared_block + unique_chunks[c] + [f"c{c}"] for c in range(n_classes)}

    # Class sizes with controllable imbalance
    if imbalance_ratio <= 1.0:
        sizes = [n_entities // n_classes] * n_classes
        remainder = n_entities - sum(sizes)
        for i in range(remainder):
            sizes[i] += 1
    else:
        # geometric imbalance: class i has ratio^(i/(n_classes-1)) relative weight
        import math
        weights = [math.pow(imbalance_ratio, i / max(1, n_classes - 1)) for i in range(n_classes)]
        total_w = sum(weights)
        sizes = [max(1, int(n_entities * w / total_w)) for w in weights]
        # adjust to hit exact n_entities
        diff = n_entities - sum(sizes)
        sizes[0] += diff

    entities = []
    eid = 0
    for c, n in enumerate(sizes):
        sig = class_sigs[c]
        for _ in range(n):
            # base signature tokens
            tokens = list(sig)
            # apply noise: replace each token with a random pool token with prob = noise_level
            if noise_level > 0:
                tokens = [
                    t if rng.random() > noise_level else rng.choice(pool)
                    for t in tokens
                ]
            text = " ".join(tokens)
            entities.append({
                "name": f"e{eid}",
                "type": f"c{c}",
                "attributes": {"text": text},
            })
            eid += 1
    rng.shuffle(entities)
    return entities, sizes


# =========================================================================
# Real builders (reuse from prior scripts)
# =========================================================================
def build_tna_real(n_per_archive: int = 100):
    records = [json.loads(l) for l in Path("tmp/bombe_tna_full.ndjson").read_text(encoding="utf-8").splitlines() if l.strip()]
    counts = Counter(r["archive"] for r in records)
    top = [a for a, _ in counts.most_common(6)]
    rng = random.Random(42)
    entities = []
    for a in top:
        pool = [r for r in records if r["archive"] == a]
        sample = rng.sample(pool, min(n_per_archive, len(pool)))
        for i, r in enumerate(sample):
            entities.append({
                "name": f"tna_{a}_{i}",
                "type": a,
                "attributes": {
                    "title": r.get("title", "")[:200],
                    "text": r.get("text", "")[:600],
                },
            })
    return entities, len(top)


NSL_PATH = Path("data/cache/nsl_kdd_train.txt")
NSL_COLS = [
    "duration","protocol_type","service","flag","src_bytes","dst_bytes","land","wrong_fragment",
    "urgent","hot","num_failed_logins","logged_in","num_compromised","root_shell","su_attempted",
    "num_root","num_file_creations","num_shells","num_access_files","num_outbound_cmds",
    "is_host_login","is_guest_login","count","srv_count","serror_rate","srv_serror_rate",
    "rerror_rate","srv_rerror_rate","same_srv_rate","diff_srv_rate","srv_diff_host_rate",
    "dst_host_count","dst_host_srv_count","dst_host_same_srv_rate","dst_host_diff_srv_rate",
    "dst_host_same_src_port_rate","dst_host_srv_diff_host_rate","dst_host_serror_rate",
    "dst_host_srv_serror_rate","dst_host_rerror_rate","dst_host_srv_rerror_rate",
    "attack_label","difficulty_level",
]
LABEL_CODE = {"normal":"n","neptune":"p","satan":"s","ipsweep":"i","portsweep":"o",
              "smurf":"u","warezclient":"w","back":"b","teardrop":"t","pod":"d",
              "nmap":"m","guess_passwd":"g"}


def build_nsl_real(n_per_class: int = 200, top_n_classes: int = 6):
    rows = []
    with NSL_PATH.open("r", encoding="utf-8") as f:
        for raw in csv.reader(f):
            if len(raw) == len(NSL_COLS):
                rows.append(dict(zip(NSL_COLS, raw)))
    counts = Counter(r["attack_label"] for r in rows)
    top = [l for l, _ in counts.most_common(top_n_classes)]
    rng = random.Random(42)
    entities = []
    for label in top:
        pool = [r for r in rows if r["attack_label"] == label]
        sample = rng.sample(pool, min(n_per_class, len(pool)))
        for i, r in enumerate(sample):
            sb = min(int(float(r["src_bytes"])) // 100, 999)
            db = min(int(float(r["dst_bytes"])) // 100, 999)
            cnt = min(int(float(r["count"])) // 10, 99)
            text = (f"p{r['protocol_type'][0]} f{r['flag'][:2]} sb{sb} db{db} "
                    f"c{cnt} se{int(float(r['serror_rate'])*10)}")
            entities.append({
                "name": f"k_{label}_{i}",
                "type": LABEL_CODE.get(label, label[:3]),
                "attributes": {"text": text},
            })
    return entities, len(top)


# =========================================================================
# Test execution helpers
# =========================================================================
def parse_final(raw):
    output = raw.get("output")
    if isinstance(output, list):
        for item in reversed(output):
            if isinstance(item, dict) and "modules" in item:
                return item
    elif isinstance(output, dict):
        return output
    return None


def run_one_test(test_id: str, phase: str, params: dict, entities: list, n_classes_input: int,
                 budget_dollars: float = 5.0, epochs: int = 30):
    if not entities:
        return {"test_id": test_id, "phase": phase, "params": params, "error": "no entities"}

    # estimate payload + skip if too big
    payload_bytes = len(json.dumps({"input": {"entities": entities, "edges": [],
                                              "config": {"btut_enabled": True,
                                                         "btut_budget_dollars": budget_dollars,
                                                         "epochs": epochs},
                                              "dataset_id": test_id, "job_id": test_id}}).encode())
    if payload_bytes > 9.5 * 1024 * 1024:
        return {"test_id": test_id, "phase": phase, "params": params,
                "error": f"payload {payload_bytes/1024/1024:.2f}MB exceeds cap"}

    t0 = time.time()
    try:
        raw = submit_and_wait(
            entities, [],
            config={"btut_enabled": True, "btut_budget_dollars": budget_dollars, "epochs": epochs},
            job_id=test_id, estimated_cost_dollars=0.05,
        )
    except Exception as e:
        return {"test_id": test_id, "phase": phase, "params": params,
                "error": f"submit failed: {type(e).__name__}: {e}"}
    wall = time.time() - t0

    if raw.get("status") != "COMPLETED":
        return {"test_id": test_id, "phase": phase, "params": params,
                "error": f"status={raw.get('status')}", "wall_seconds": round(wall, 2)}

    final = parse_final(raw)
    if not final:
        return {"test_id": test_id, "phase": phase, "params": params, "error": "no final result"}

    modules = final.get("modules", [])
    purity_rows = measure_module_archive_purity(modules)
    archive_rows = measure_archive_self_basin(modules, entities)
    mean_purity = float(np.mean([r["purity"] for r in purity_rows])) if purity_rows else 0.0
    min_purity = float(min(r["purity"] for r in purity_rows)) if purity_rows else 0.0
    mean_self_basin = float(np.mean([r["self_basin_share"] for r in archive_rows])) if archive_rows else 0.0
    min_self_basin = float(min(r["self_basin_share"] for r in archive_rows)) if archive_rows else 0.0

    exec_ms = raw.get("executionTime", 0)
    if not exec_ms or exec_ms < 100:
        exec_ms = int((wall - raw.get("delayTime", 0) / 1000) * 1000)
    cost_dollars = (exec_ms / 1000) * (0.04 / 60)

    return {
        "test_id": test_id, "phase": phase, "params": params,
        "n_entities": len(entities),
        "n_classes_input": n_classes_input,
        "n_modules_discovered": len(modules),
        "mean_module_purity": round(mean_purity, 4),
        "min_module_purity": round(min_purity, 4),
        "mean_class_self_basin": round(mean_self_basin, 4),
        "min_class_self_basin": round(min_self_basin, 4),
        "final_auc": final.get("final_auc"),
        "wall_seconds": round(wall, 2),
        "gpu_exec_ms": exec_ms,
        "cost_dollars": round(cost_dollars, 5),
        "device": final.get("device"),
        "payload_mb": round(payload_bytes/1024/1024, 2),
    }


def save_test_result(result: dict):
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    p = RESULTS_DIR / f"{result['phase']}_{result['test_id']}.json"
    p.write_text(json.dumps(result, indent=2), encoding="utf-8")


def budget_left() -> float:
    return CAMPAIGN_BUDGET_CAP - load_spend()


# =========================================================================
# Phase definitions
# =========================================================================
def phase_1_scale_x_class():
    """Phase 1: scale × class_count grid (42 tests)."""
    SCALES = [1000, 2000, 5000, 10000, 20000, 50000, 100000]
    CLASSES = [2, 4, 8, 16, 32, 64]
    tests = []
    for n in SCALES:
        for c in CLASSES:
            tests.append({"phase": "p1_scale_class", "test_id": f"n{n}_c{c}",
                          "params": {"n_entities": n, "n_classes": c},
                          "builder": lambda nn=n, cc=c: build_synth(nn, cc)})
    return tests


def phase_2_class_x_noise():
    """Phase 2: class_count × noise level (25 tests)."""
    CLASSES = [4, 8, 16, 24, 32]
    NOISE = [0.0, 0.1, 0.3, 0.5, 0.7]
    tests = []
    for c in CLASSES:
        for noise in NOISE:
            n = 5000 if c <= 16 else 8000
            tests.append({"phase": "p2_class_noise", "test_id": f"c{c}_n{int(noise*100)}",
                          "params": {"n_entities": n, "n_classes": c, "noise_level": noise},
                          "builder": lambda nn=n, cc=c, nl=noise: build_synth(nn, cc, noise_level=nl)})
    return tests


def phase_3_class_x_imbalance():
    """Phase 3: class_count × imbalance ratio (30 tests)."""
    CLASSES = [4, 6, 8, 12, 16, 24]
    IMBAL = [1.0, 10.0, 100.0, 1000.0, 10000.0]
    tests = []
    for c in CLASSES:
        for ratio in IMBAL:
            n = 5000 if c <= 16 else 8000
            tests.append({"phase": "p3_class_imbalance",
                          "test_id": f"c{c}_imb{int(ratio)}",
                          "params": {"n_entities": n, "n_classes": c, "imbalance_ratio": ratio},
                          "builder": lambda nn=n, cc=c, ir=ratio: build_synth(nn, cc, imbalance_ratio=ir)})
    return tests


def phase_4_class_x_overlap():
    """Phase 4: class_count × signature overlap (24 tests)."""
    CLASSES = [4, 6, 8, 12, 16, 24]
    OVERLAP = [0.0, 0.25, 0.5, 0.75]
    tests = []
    for c in CLASSES:
        for ov in OVERLAP:
            n = 5000
            tests.append({"phase": "p4_class_overlap",
                          "test_id": f"c{c}_ov{int(ov*100)}",
                          "params": {"n_entities": n, "n_classes": c, "overlap_frac": ov},
                          "builder": lambda nn=n, cc=c, of=ov: build_synth(nn, cc, overlap_frac=of)})
    return tests


def phase_5_real_data():
    """Phase 5: real data suite (14 tests)."""
    tests = []
    # TNA at multiple per-archive sample sizes
    for npa in [50, 100, 150, 200, 300]:
        tests.append({"phase": "p5_real_tna", "test_id": f"tna_npa{npa}",
                      "params": {"n_per_archive": npa},
                      "builder": lambda x=npa: build_tna_real(n_per_archive=x)})
    # NSL-KDD at multiple sample sizes and class counts
    for npc in [100, 250, 500, 1000]:
        for tc in [4, 6, 8]:
            tests.append({"phase": "p5_real_nslkdd",
                          "test_id": f"nsl_npc{npc}_tc{tc}",
                          "params": {"n_per_class": npc, "top_classes": tc},
                          "builder": lambda x=npc, y=tc: build_nsl_real(n_per_class=x, top_n_classes=y)})
    return tests


def phase_6_throughput_burst():
    """Phase 6: 20 rapid-fire tests at fixed scale to measure warm-worker throughput."""
    tests = []
    for i in range(20):
        n = 5000
        c = 8
        tests.append({"phase": "p6_throughput_burst",
                      "test_id": f"burst_{i:02d}",
                      "params": {"n_entities": n, "n_classes": c, "burst_index": i},
                      "builder": lambda nn=n, cc=c, ii=i: build_synth(nn, cc, seed=42+ii)})
    return tests


# =========================================================================
# Main runner
# =========================================================================
def run_phase(phase_tests: list, phase_name: str, results: list):
    print(f"\n{'='*80}")
    print(f"PHASE: {phase_name}  —  {len(phase_tests)} tests")
    print(f"{'='*80}")

    for i, test in enumerate(phase_tests):
        bl = budget_left()
        if bl <= 0:
            print(f"[budget guard] campaign cap reached, stopping phase. left=${bl:.4f}")
            return False
        try:
            built = test["builder"]()
            if isinstance(built, tuple) and len(built) == 2:
                # synth returns (entities, sizes); real returns (entities, n_classes)
                if isinstance(built[1], list):
                    entities, sizes = built
                    n_classes_input = len(sizes)
                else:
                    entities, n_classes_input = built
            else:
                continue
        except Exception as e:
            print(f"[{test['test_id']}] BUILD FAILED: {e}")
            continue

        params = test["params"].copy()
        result = run_one_test(
            test["test_id"], test["phase"], params,
            entities, n_classes_input,
        )
        save_test_result(result)
        results.append(result)

        # one-line progress
        if "error" in result:
            print(f"[{i+1}/{len(phase_tests)}] {test['test_id']:30s} ERROR: {result['error'][:60]}")
        else:
            print(f"[{i+1}/{len(phase_tests)}] {test['test_id']:30s} "
                  f"n={result['n_entities']:>6d} cls={result['n_classes_input']:>3d}->{result['n_modules_discovered']:>3d} "
                  f"pur={result['mean_module_purity']:.4f} "
                  f"basin={result['mean_class_self_basin']:.4f} "
                  f"AUC={str(result.get('final_auc') or 'n/a')[:6]} "
                  f"ms={result['gpu_exec_ms']:>6d}")
        time.sleep(COOLDOWN)

    return True


def main():
    print("OVERNIGHT SUBSTRATE CAMPAIGN — start", datetime.utcnow().isoformat())
    print(f"campaign budget cap: ${CAMPAIGN_BUDGET_CAP}")
    print(f"current spend:        ${load_spend():.4f}")
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    PHASES = [
        ("phase_1_scale_x_class", phase_1_scale_x_class),
        ("phase_2_class_x_noise", phase_2_class_x_noise),
        ("phase_3_class_x_imbalance", phase_3_class_x_imbalance),
        ("phase_4_class_x_overlap", phase_4_class_x_overlap),
        ("phase_5_real_data", phase_5_real_data),
        ("phase_6_throughput_burst", phase_6_throughput_burst),
    ]

    t_campaign_start = time.time()
    for phase_name, phase_fn in PHASES:
        try:
            phase_tests = phase_fn()
        except Exception as e:
            print(f"phase_def_error {phase_name}: {e}")
            traceback.print_exc()
            continue
        ok = run_phase(phase_tests, phase_name, results)
        # snapshot summary after each phase
        write_summary(results, partial=True)
        if not ok:
            break

    write_summary(results, partial=False)
    print()
    print(f"CAMPAIGN COMPLETE.  {len(results)} tests run.")
    print(f"  total wall:    {(time.time() - t_campaign_start)/60:.1f} min")
    print(f"  total spend:   ${load_spend():.4f}")
    print(f"  summary:       {SUMMARY_PATH}")


def write_summary(results, partial=False):
    by_phase = defaultdict(list)
    for r in results:
        by_phase[r["phase"]].append(r)
    summary = {
        "campaign": "overnight_substrate_phase_diagram",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "partial": partial,
        "total_tests_run": len(results),
        "total_spend_dollars": load_spend(),
        "per_phase_count": {p: len(g) for p, g in by_phase.items()},
        "results": results,
    }
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main() or 0)
