"""Competitive backtest — BTUT vs naive statistical baselines on SEC distress ground truth.

Rigorous internal benchmark. Ground truth is the set of SEC distress-form filers
(10-K/A, 10-Q/A, NT 10-K, NT 10-Q) extracted from `edgar_cache.json` — the
same labels used by `edgar_supervised_distress.py`.

We compute four rankings of companies and measure how well each surfaces
the distress filers in the top-K:

  1. BTUT composite (our engine)
  2. Random baseline (no signal)
  3. Fact-count baseline (bigger filers have more facts — a size confound)
  4. Mean-composite-score baseline (aggregate stat on score dimensions)

Metrics reported per K ∈ {10, 25, 50, 100, 250, 500}:

  - hit-rate:   fraction of top-K that are labeled distress
  - recall:     fraction of distress filers captured in top-K
  - precision:  same as hit-rate, re-labeled for clarity
  - lift:       hit-rate divided by the random-baseline expectation
  - AUC-style:  area under the hits-vs-K curve out to K=500

We DO NOT have API access to Bloomberg, AlphaSense, or RavenPack. The
methodology section at the bottom documents exactly how each vendor would
slot in — what endpoint, what universe, what outcome metric — so the
comparison can be completed by a pilot customer with credentials.

Output:
    data/validation/competitive_backtest.json
    docs/commercial/COMPETITIVE_BENCHMARK.md
"""
from __future__ import annotations

import json
import random
import statistics
import sys
import time
from collections import defaultdict
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent

DISTRESS_FORMS = {"10-K/A", "10-Q/A", "NT 10-K", "NT 10-Q"}
FACT_RE = __import__("re").compile(r"^fact_(\d+)_(.+)$")


# ---------------------------------------------------------------------------
def load_ground_truth() -> tuple[set[str], set[str], dict[str, str]]:
    cache_path = REPO_ROOT / "scripts" / "edgar_cache.json"
    cache = json.loads(cache_path.read_text(encoding="utf-8"))
    cik_forms: dict[str, set[str]] = defaultdict(set)
    cik_name: dict[str, str] = {}
    for e in cache.get("entities", []):
        if e.get("type") != "filing": continue
        a = e.get("attributes", "{}")
        if isinstance(a, str):
            try: a = json.loads(a)
            except Exception: continue
        cik = str(a.get("company_cik", ""))
        form = (a.get("form") or "").strip()
        name = a.get("company_name", "")
        if cik and form:
            cik_forms[cik].add(form)
        if cik and name:
            cik_name.setdefault(cik, name)
    positive = {c for c, fs in cik_forms.items() if fs & DISTRESS_FORMS}
    had_10k = {c for c, fs in cik_forms.items() if "10-K" in fs}
    negative = had_10k - positive
    return positive, negative, cik_name


def load_btut_facts() -> dict[str, list[dict]]:
    """Group BTUT fact-type survivors by CIK."""
    btut_path = REPO_ROOT / "scripts" / "edgar_btut_result_5000.json"
    btut = json.loads(btut_path.read_text(encoding="utf-8"))
    out: dict[str, list[dict]] = defaultdict(list)
    for s in btut.get("survivors", []):
        name = (s.get("entity") or {}).get("name", "")
        m = FACT_RE.match(name)
        if not m: continue
        cik = m.group(1)
        out[cik].append({
            "concept": m.group(2),
            "composite": float(((s.get("scores") or {}).get("composite", 0.0))),
            "anomaly": float(((s.get("scores") or {}).get("anomaly", 0.0))),
            "reconstruction": float(((s.get("scores") or {}).get("reconstruction", 0.0))),
            "diversity": float(((s.get("scores") or {}).get("diversity", 0.0))),
        })
    return out


# ---------------------------------------------------------------------------
def rank_by_btut_top_fact(cik_facts: dict[str, list[dict]]) -> list[str]:
    """BTUT ranking: each CIK scored by the composite of its single top fact."""
    scored = []
    for cik, facts in cik_facts.items():
        if not facts: continue
        top = max(facts, key=lambda f: f["composite"])
        scored.append((cik, top["composite"]))
    return [c for c, _ in sorted(scored, key=lambda x: -x[1])]


def rank_by_mean_composite(cik_facts: dict[str, list[dict]]) -> list[str]:
    """Naive stat baseline: mean-composite aggregate per CIK."""
    scored = []
    for cik, facts in cik_facts.items():
        if not facts: continue
        m = statistics.mean(f["composite"] for f in facts)
        scored.append((cik, m))
    return [c for c, _ in sorted(scored, key=lambda x: -x[1])]


def rank_by_fact_count(cik_facts: dict[str, list[dict]]) -> list[str]:
    """Size confound: rank by how many fact survivors each CIK contributes."""
    scored = [(c, len(fs)) for c, fs in cik_facts.items()]
    return [c for c, _ in sorted(scored, key=lambda x: -x[1])]


def rank_random(cik_facts: dict[str, list[dict]], seed: int) -> list[str]:
    """Null baseline: uniformly random order."""
    r = random.Random(seed)
    ciks = list(cik_facts.keys())
    r.shuffle(ciks)
    return ciks


# ---------------------------------------------------------------------------
@dataclass
class RankerResult:
    name: str
    description: str
    per_k: list[dict[str, Any]] = field(default_factory=list)
    auc_hits_k500: float = 0.0
    seconds: float = 0.0


def evaluate(
    ranker_name: str,
    ranking: list[str],
    positive: set[str],
    negative: set[str],
    ks: tuple[int, ...],
    random_base_rate: float,
) -> RankerResult:
    result = RankerResult(name=ranker_name, description="")
    labeled_universe = (positive | negative) & set(ranking)
    cumulative_hits = 0
    ranking_labeled = [c for c in ranking if c in labeled_universe]

    for k in ks:
        topk = ranking_labeled[:k]
        hits = sum(1 for c in topk if c in positive)
        precision = hits / max(1, len(topk))
        recall = hits / max(1, len(positive & labeled_universe))
        lift = precision / max(1e-9, random_base_rate)
        result.per_k.append({
            "K": k,
            "top_k_size": len(topk),
            "distress_captured": hits,
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "lift_vs_random": round(lift, 2),
        })

    # Area under hits-vs-rank curve (trapezoidal) up to K=500 or universe size.
    cap = min(500, len(ranking_labeled))
    hits_at_rank = []
    h = 0
    for i, c in enumerate(ranking_labeled[:cap], 1):
        if c in positive: h += 1
        hits_at_rank.append(h)
    result.auc_hits_k500 = sum(hits_at_rank) / cap if cap else 0.0
    return result


# ---------------------------------------------------------------------------
def main() -> int:
    t0 = time.perf_counter()
    positive, negative, _cik_name = load_ground_truth()
    cik_facts = load_btut_facts()

    covered_positive = [c for c in positive if c in cik_facts]
    covered_negative = [c for c in negative if c in cik_facts]
    labeled = set(covered_positive) | set(covered_negative)

    base_rate = len(covered_positive) / max(1, len(labeled))

    print(f"Ground truth:")
    print(f"  positive (distress) CIKs    : {len(positive)} total, {len(covered_positive)} in BTUT")
    print(f"  negative (10-K only) CIKs   : {len(negative)} total, {len(covered_negative)} in BTUT")
    print(f"  random base rate in labeled : {base_rate*100:.2f}%")

    ks = (10, 25, 50, 100, 250, 500)

    rankers = [
        ("btut_composite",
         "BTUT composite — engine's composite score on each CIK's highest-ranked fact",
         rank_by_btut_top_fact(cik_facts)),
        ("mean_composite",
         "Naive stat — mean of composite scores across each CIK's facts",
         rank_by_mean_composite(cik_facts)),
        ("fact_count",
         "Size confound — rank by how many survivor facts each CIK contributes",
         rank_by_fact_count(cik_facts)),
        ("random_seed_42",
         "Null baseline — uniformly random ordering (seed=42)",
         rank_random(cik_facts, 42)),
    ]

    results: list[RankerResult] = []
    for name, desc, ranking in rankers:
        r = evaluate(name, ranking, positive, negative, ks, base_rate)
        r.description = desc
        results.append(r)

    # Aggregate N=30 random draws for a confidence band on null.
    null_aucs = []
    for s in range(30):
        r = evaluate("random", rank_random(cik_facts, s), positive, negative, (500,), base_rate)
        null_aucs.append(r.auc_hits_k500)
    null_mean = statistics.mean(null_aucs)
    null_std = statistics.pstdev(null_aucs) if len(null_aucs) > 1 else 0.0

    wall = time.perf_counter() - t0

    # --------------------------------------------------
    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "wall_seconds": wall,
        "ground_truth": {
            "source": "SEC distress forms (10-K/A, 10-Q/A, NT 10-K, NT 10-Q) from scripts/edgar_cache.json",
            "positive_total": len(positive),
            "positive_in_btut": len(covered_positive),
            "negative_total": len(negative),
            "negative_in_btut": len(covered_negative),
            "random_base_rate": base_rate,
        },
        "K_values": list(ks),
        "rankers": [asdict(r) for r in results],
        "random_null_auc": {
            "n_draws": len(null_aucs),
            "mean": null_mean,
            "std": null_std,
        },
        "methodology_gap": {
            "bloomberg_terminal": {
                "endpoint": "BDP()/BDS() over LO_* fields we define, plus BBG Alternative Data Insight consensus outputs",
                "universe": "Same CIK set; aligned by BBG TICKER mapping",
                "outcome_metric": "days_before_10ka(filing_date) at alert time; compare BTUT pre-filing flag against BBG Consensus downgrade / Analyst Alert trigger",
                "status": "requires BBG API access + customer pilot with terminal entitlement",
            },
            "alphasense": {
                "endpoint": "AlphaSense Semantic Search API: 'restatement risk' / 'going concern' sentiment on 10-Ks",
                "universe": "Same set",
                "outcome_metric": "AlphaSense confidence score × day_of_first_hit vs BTUT's pre-filing flag date",
                "status": "requires AlphaSense API access",
            },
            "ravenpack": {
                "endpoint": "RavenPack PRISM News Analytics sentiment on ticker × event type (accounting)",
                "universe": "Same set",
                "outcome_metric": "RavenPack event-relevance × polarity on accounting-news events vs BTUT's structural flag",
                "status": "requires RavenPack subscription",
            },
            "audit_analytics": {
                "endpoint": "Audit Analytics Disclosure Research (historical restatement database)",
                "universe": "Same set",
                "outcome_metric": "Audit Analytics publishes restatements AFTER they file; BTUT flags BEFORE. The comparison is lead-time, not same-time.",
                "status": "available via subscription; methodology ready",
            },
        },
    }

    out_path = REPO_ROOT / "data" / "validation" / "competitive_backtest.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")

    print()
    print("=" * 78)
    print(f"COMPETITIVE BACKTEST — BTUT vs naive baselines on SEC distress ground truth")
    print("=" * 78)
    print(f"\nLabeled universe: {len(labeled)} CIKs  ({len(covered_positive)} distress, {len(covered_negative)} control)")
    print(f"Random base rate : {base_rate*100:.2f}%  (expected precision of a random draw)")
    print(f"Null AUC (hits-vs-K=500): mean={null_mean:.2f} ± {null_std:.2f} across 30 random draws\n")

    header = f"{'Ranker':25s}"
    for k in ks:
        header += f"  P@{k:<5d}"
    header += "  AUC"
    print(header)
    print("-" * len(header))
    for r in results:
        row = f"{r.name:25s}"
        for pk in r.per_k:
            row += f"  {pk['precision']*100:5.1f}%"
        row += f"  {r.auc_hits_k500:.2f}"
        print(row)

    # Lift row
    btut = next(r for r in results if r.name == "btut_composite")
    rand = next(r for r in results if r.name == "random_seed_42")
    print()
    print("Lift over random (precision_BTUT / precision_random):")
    for i, k in enumerate(ks):
        pb = btut.per_k[i]["precision"]
        pr = rand.per_k[i]["precision"]
        lift = (pb / pr) if pr > 0 else float("inf")
        print(f"  K={k:<5d}  BTUT {pb*100:5.1f}%  vs random {pr*100:5.1f}%   lift = {lift:.2f}x")

    print(f"\nWall: {wall:.2f}s")
    print(f"Wrote {out_path.relative_to(REPO_ROOT)} ({out_path.stat().st_size // 1024}KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
