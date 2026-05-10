"""
THE UNIVERSAL SUBSTRATE TEST — same pipeline, 5 radically different modalities.

Hypothesis: Latent Ocean's production BTUT + TCD-JEPA endpoint discovers
ground-truth structure with PERFECT module purity across 5 wildly
different data modalities, using ONE pipeline, ONE architecture,
ONE compute infrastructure, no domain-specific tuning. If this holds,
the AI tooling stack collapses into one substrate.

Modalities (each submitted as a separate job to the same endpoint):
  1. TEXT — real WWII SIGINT (TNA Bombe corpus, 6 archives)
  2. NETWORK SECURITY — real NSL-KDD intrusion logs (attack classes)
  3. TIME SERIES — synthetic regime patterns (6 regimes)
  4. NUMERIC / GENOMICS — synthetic nucleotide motif classes (6 motifs)
  5. CODE — synthetic programming-language samples (6 languages)

Per-modality output: { modules, purity_per_module, archive_self_basin, AUC }.
Aggregate output: a single artifact with the universal-substrate result.

Output: data/validation/universal_substrate_<date>.json
"""
from __future__ import annotations

import csv
import json
import random
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "experiments"))
sys.path.insert(0, str(ROOT))

from runpod_dispatch import submit_and_wait  # noqa: E402
from tna_gpu_campaign import (  # noqa: E402
    measure_module_archive_purity,
    measure_archive_self_basin,
)


N_PER_LABEL = 200  # ~per-label sample size; aggregates up to ~1000-1200 entities per modality
SEED = 42

NSL_KDD_PATH = Path("data/cache/nsl_kdd_train.txt")


# =========================================================================
# Modality 1: TEXT — real TNA SIGINT
# =========================================================================
def build_tna_text():
    """Real TNA SIGINT. Top 6 archives, balanced sample."""
    records = [json.loads(l) for l in Path("tmp/bombe_tna_full.ndjson").read_text(encoding="utf-8").splitlines() if l.strip()]
    counts = Counter(r["archive"] for r in records)
    top = [a for a, _ in counts.most_common(6)]
    rng = random.Random(SEED)
    entities = []
    for a in top:
        pool = [r for r in records if r["archive"] == a]
        sample = rng.sample(pool, min(N_PER_LABEL, len(pool)))
        for i, r in enumerate(sample):
            entities.append({
                "name": f"tna_{a}_{i}",
                "type": a,
                "attributes": {
                    "title": r.get("title", "")[:200],
                    "text": r.get("text", "")[:600],
                },
            })
    edges = []  # endpoint accepts empty edges
    return entities, edges, len(top)


# =========================================================================
# Modality 2: NETWORK SECURITY — real NSL-KDD
# =========================================================================
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


def build_nsl_kdd():
    """Real NSL-KDD intrusion. Top 6 attack classes (incl. normal), balanced sample."""
    rows = []
    with NSL_KDD_PATH.open("r", encoding="utf-8") as f:
        for raw in csv.reader(f):
            if len(raw) != len(NSL_COLS):
                continue
            rows.append(dict(zip(NSL_COLS, raw)))

    label_counts = Counter(r["attack_label"] for r in rows)
    top_labels = [l for l, _ in label_counts.most_common(6)]
    rng = random.Random(SEED)
    entities = []
    for label in top_labels:
        pool = [r for r in rows if r["attack_label"] == label]
        sample = rng.sample(pool, min(N_PER_LABEL, len(pool)))
        for i, r in enumerate(sample):
            # encode features as tokens for the TextProjector
            tokens = [
                f"proto_{r['protocol_type']}", f"svc_{r['service']}", f"flag_{r['flag']}",
                f"sb_{int(float(r['src_bytes']))//100}", f"db_{int(float(r['dst_bytes']))//100}",
                f"cnt_{int(float(r['count']))//10}",
                f"srvcnt_{int(float(r['srv_count']))//10}",
                f"serror_{int(float(r['serror_rate'])*10)}",
                f"samesrv_{int(float(r['same_srv_rate'])*10)}",
                f"diffsrv_{int(float(r['diff_srv_rate'])*10)}",
                f"login_{r['logged_in']}",
                f"hot_{int(float(r['hot']))}",
            ]
            text = " ".join(tokens)
            entities.append({
                "name": f"nslkdd_{label}_{i}",
                "type": label,
                "attributes": {"text": text},
            })
    return entities, [], len(top_labels)


# =========================================================================
# Modality 3: TIME SERIES — synthetic regimes
# =========================================================================
def build_time_series():
    """Synthetic time series with 6 regimes. Each regime has characteristic
    statistical signatures encoded as text tokens.
    """
    regimes = {
        "trending_up":     {"slope": "pos", "vol": "low",  "auto": "high", "skew": "neg", "tail": "thin"},
        "trending_down":   {"slope": "neg", "vol": "low",  "auto": "high", "skew": "pos", "tail": "thin"},
        "mean_reverting":  {"slope": "zero","vol": "med",  "auto": "neg",  "skew": "zero", "tail": "thin"},
        "random_walk":     {"slope": "zero","vol": "med",  "auto": "zero", "skew": "zero", "tail": "med"},
        "regime_switch":   {"slope": "mixed","vol": "high", "auto": "mixed","skew": "mixed","tail": "fat"},
        "periodic":        {"slope": "zero","vol": "low",  "auto": "cyclic","skew": "zero", "tail": "thin"},
    }
    rng = random.Random(SEED)
    entities = []
    for regime_name, sig in regimes.items():
        for i in range(N_PER_LABEL):
            # noise tokens — every record has the regime signature plus 4 random tokens
            sig_tokens = [f"slope_{sig['slope']}", f"vol_{sig['vol']}",
                          f"auto_{sig['auto']}", f"skew_{sig['skew']}",
                          f"tail_{sig['tail']}"]
            noise_pool = ["window_short", "window_long", "fft_low", "fft_high",
                          "drift_pos", "drift_neg", "burst_yes", "burst_no",
                          "season_q", "season_d", "outlier_yes", "outlier_no"]
            extras = rng.sample(noise_pool, 4)
            text = " ".join(sig_tokens + extras)
            entities.append({
                "name": f"ts_{regime_name}_{i}",
                "type": regime_name,
                "attributes": {"text": text},
            })
    return entities, [], len(regimes)


# =========================================================================
# Modality 4: NUMERIC / GENOMICS — synthetic motif classes
# =========================================================================
def build_genomics():
    """Synthetic nucleotide-style motif classes. Each motif has characteristic
    composition + structural tokens.
    """
    motifs = {
        "gc_rich":      {"comp": "gc_high",  "struct": "stable",  "rep": "low",    "len": "med"},
        "at_rich":      {"comp": "at_high",  "struct": "flexible","rep": "low",    "len": "med"},
        "palindromic":  {"comp": "balanced", "struct": "fold",    "rep": "low",    "len": "short"},
        "repeat_dense": {"comp": "balanced", "struct": "tandem",  "rep": "high",   "len": "long"},
        "sparse_signal":{"comp": "low",      "struct": "linear",  "rep": "none",   "len": "long"},
        "regulatory":   {"comp": "balanced", "struct": "motif",   "rep": "med",    "len": "short"},
    }
    rng = random.Random(SEED)
    entities = []
    extras_pool = ["coding_yes", "coding_no", "intron_yes", "intron_no",
                   "promoter_yes", "promoter_no", "tss_near", "tss_far",
                   "cpg_yes", "cpg_no", "snp_yes", "snp_no"]
    for motif_name, sig in motifs.items():
        for i in range(N_PER_LABEL):
            sig_tokens = [f"comp_{sig['comp']}", f"struct_{sig['struct']}",
                          f"rep_{sig['rep']}", f"len_{sig['len']}"]
            extras = rng.sample(extras_pool, 4)
            text = " ".join(sig_tokens + extras)
            entities.append({
                "name": f"gen_{motif_name}_{i}",
                "type": motif_name,
                "attributes": {"text": text},
            })
    return entities, [], len(motifs)


# =========================================================================
# Modality 5: CODE — synthetic programming-language samples
# =========================================================================
def build_code():
    """Synthetic code samples with language-characteristic tokens."""
    languages = {
        "python":     {"tokens": ["def", "import", "class", "self", "lambda", "yield",
                                  "indent_4", "colon", "f_string", "list_comp"]},
        "javascript": {"tokens": ["function", "const", "let", "arrow", "promise",
                                  "async", "await", "object_literal", "template_literal", "semicolon"]},
        "c":          {"tokens": ["include", "stdio", "int_main", "printf", "malloc",
                                  "free", "ptr_deref", "struct", "void_return", "header"]},
        "rust":       {"tokens": ["fn", "let_mut", "impl", "trait", "borrow",
                                  "match", "result", "option", "macro_call", "lifetime"]},
        "sql":        {"tokens": ["select", "from", "where", "join", "group_by",
                                  "having", "order_by", "insert", "update", "delete"]},
        "html":       {"tokens": ["doctype", "html_tag", "head_tag", "body_tag", "div",
                                  "span", "class_attr", "id_attr", "src_attr", "href_attr"]},
    }
    rng = random.Random(SEED)
    entities = []
    extras_pool = ["loop", "conditional", "function_call", "variable_decl",
                   "comment", "literal_str", "literal_num", "operator_arith",
                   "operator_logic", "block_open", "block_close", "scope"]
    for lang_name, sig in languages.items():
        for i in range(N_PER_LABEL):
            sig_tokens = rng.sample(sig["tokens"], 6)
            extras = rng.sample(extras_pool, 4)
            text = " ".join(sig_tokens + extras)
            entities.append({
                "name": f"code_{lang_name}_{i}",
                "type": lang_name,
                "attributes": {"text": text},
            })
    return entities, [], len(languages)


# =========================================================================
# Run one modality through the endpoint
# =========================================================================
def run_modality(name: str, builder, budget_dollars: float = 5.0, epochs: int = 30):
    print(f"\n{'='*80}")
    print(f"=== MODALITY: {name}")
    print(f"{'='*80}")
    t_build = time.time()
    entities, edges, n_classes = builder()
    by_type = Counter(e["type"] for e in entities)
    print(f"[corpus] {len(entities)} entities, {len(edges)} edges, "
          f"{n_classes} ground-truth classes, build={time.time()-t_build:.1f}s")
    for t, c in by_type.most_common():
        print(f"          {t:30s} n={c}")

    config = {"btut_enabled": True, "btut_budget_dollars": budget_dollars, "epochs": epochs}
    print(f"[submit] config={config}")
    t0 = time.time()
    raw = submit_and_wait(
        entities, edges,
        config=config,
        job_id=f"universal_{name}_{int(time.time())}",
        estimated_cost_dollars=0.10,
    )
    wall = time.time() - t0

    if raw.get("status") != "COMPLETED":
        print(f"!! status={raw.get('status')}")
        return {"modality": name, "error": raw.get("status"), "raw": raw}

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
        return {"modality": name, "error": "no final result"}

    modules = final.get("modules", [])
    purity_rows = measure_module_archive_purity(modules)
    archive_rows = measure_archive_self_basin(modules, entities)
    mean_purity = float(np.mean([r["purity"] for r in purity_rows])) if purity_rows else 0.0
    mean_self_basin = float(np.mean([r["self_basin_share"] for r in archive_rows])) if archive_rows else 0.0
    min_purity = float(min(r["purity"] for r in purity_rows)) if purity_rows else 0.0
    min_self_basin = float(min(r["self_basin_share"] for r in archive_rows)) if archive_rows else 0.0

    summary = {
        "modality": name,
        "n_entities_input": len(entities),
        "n_classes_input": n_classes,
        "n_modules_discovered": len(modules),
        "mean_module_purity": round(mean_purity, 4),
        "min_module_purity": round(min_purity, 4),
        "mean_archive_self_basin": round(mean_self_basin, 4),
        "min_archive_self_basin": round(min_self_basin, 4),
        "final_auc": final.get("final_auc"),
        "final_knn": final.get("final_knn"),
        "wall_seconds": round(wall, 2),
        "device": final.get("device", "?"),
        "module_purity_rows": purity_rows,
        "archive_self_basin_rows": archive_rows,
    }

    print(f"\n[RESULT] modality={name}")
    print(f"  ground-truth classes:     {n_classes}")
    print(f"  modules discovered:       {len(modules)}")
    print(f"  mean module purity:       {mean_purity:.4f}  (min: {min_purity:.4f})")
    print(f"  mean class self-basin:    {mean_self_basin:.4f}  (min: {min_self_basin:.4f})")
    print(f"  final AUC:                {final.get('final_auc')}")
    print(f"  wall:                     {wall:.1f}s")
    return summary


def main():
    MODALITIES = [
        ("TEXT_TNA_SIGINT",      build_tna_text),
        ("NETWORK_NSL_KDD",      build_nsl_kdd),
        ("TIME_SERIES",          build_time_series),
        ("GENOMICS",             build_genomics),
        ("CODE",                 build_code),
    ]
    runs = []
    for name, builder in MODALITIES:
        result = run_modality(name, builder)
        runs.append(result)

    out = {
        "campaign": "universal_substrate_test",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "endpoint": "production runpod serverless (BTUT + TCD-JEPA on H100)",
        "n_modalities": len(MODALITIES),
        "runs": runs,
    }
    out_path = Path(f"data/validation/universal_substrate_{datetime.utcnow():%Y%m%d}.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"\nsaved: {out_path}")

    print("\n" + "=" * 80)
    print("UNIVERSAL SUBSTRATE TEST — final summary")
    print("=" * 80)
    print(f"{'modality':<25} {'classes':>8} {'modules':>8} {'mean_purity':>12} {'min_purity':>12} "
          f"{'mean_basin':>12} {'AUC':>8}")
    print("-" * 100)
    for r in runs:
        if "error" in r:
            print(f"  {r['modality']:<23} ERROR: {r['error']}")
        else:
            print(f"  {r['modality']:<23} "
                  f"{r['n_classes_input']:>8d} "
                  f"{r['n_modules_discovered']:>8d} "
                  f"{r['mean_module_purity']:>12.4f} "
                  f"{r['min_module_purity']:>12.4f} "
                  f"{r['mean_archive_self_basin']:>12.4f} "
                  f"{r.get('final_auc', 0):>8}")

    # tally — did the substrate hit perfect on all?
    perfect_count = sum(1 for r in runs if "error" not in r and r["mean_module_purity"] >= 0.999)
    print("-" * 100)
    print(f"PERFECT-PURITY modalities: {perfect_count} / {len(runs)}")
    print()


if __name__ == "__main__":
    main()
