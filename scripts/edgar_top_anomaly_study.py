"""Test the RIGHT hypothesis: BTUT top-K anomalies are non-random.

The Wardenclyffe / 25/25 canonical-marker wins were about top-K anomaly
ranking — which specific entities rise to the top? Not about whether
the clusters themselves were internally homogeneous on external labels.

This script measures whether the top-K BTUT anomalies in the 1,999-survivor
EDGAR re-run are structurally distinguished from the survivor pool at
large, across four properties:

1. Form-type concentration — do top anomalies skew toward specific SEC forms?
2. Company concentration — are top anomalies from a narrow set of CIKs?
3. Temporal concentration — do they cluster around specific dates?
4. Within-cluster ranking — are they rank-#1 in their clusters?

Each property tested against a random-subset baseline with the same K.
"""
from __future__ import annotations

import json
import logging
import os
import random
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

for _k in ("FRED_API_KEY", "NIV_VINTAGE", "NIV_BTUT_THINNING", "NIV_CRYSTALLIZATION",
          "fred_api_key", "niv_vintage", "niv_btut_thinning", "niv_crystallization"):
    os.environ.pop(_k, None)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("edgar_top_anomaly_study")

RAW_CACHE = REPO_ROOT / "scripts" / "edgar_cache.json"
EDGAR_BTUT = REPO_ROOT / "scripts" / "edgar_btut_result_2000.json"


def _percentile(values, p):
    import math
    if not values:
        return 0.0
    s = sorted(values)
    k = (p / 100.0) * (len(s) - 1)
    lo = int(math.floor(k))
    hi = int(math.ceil(k))
    if lo == hi:
        return s[lo]
    return s[lo] * (1 - (k - lo)) + s[hi] * (k - lo)


def main() -> int:
    raw = json.loads(RAW_CACHE.read_text(encoding="utf-8"))
    btut = json.loads(EDGAR_BTUT.read_text(encoding="utf-8"))
    survivors = btut.get("survivors") or []

    # Build filing attributes lookup
    filing_attrs: dict[str, dict] = {}
    for e in raw.get("entities", []):
        if e.get("type") != "filing":
            continue
        attrs_raw = e.get("attributes", "{}")
        attrs = json.loads(attrs_raw) if isinstance(attrs_raw, str) else (attrs_raw or {})
        filing_attrs[e["name"]] = attrs

    # Extract CIK from fact names
    fact_re = re.compile(r"^fact_(\d+)_(.+)$")

    def _cik(name: str) -> str | None:
        if name.startswith("filing_"):
            return str((filing_attrs.get(name) or {}).get("company_cik", "")) or None
        m = fact_re.match(name)
        if m:
            return m.group(1)
        return None

    def _form(name: str) -> str | None:
        if name.startswith("filing_"):
            f = (filing_attrs.get(name) or {}).get("form", "")
            return (f or "").strip().upper() or None
        return None

    def _date_year(name: str) -> int | None:
        if name.startswith("filing_"):
            d = (filing_attrs.get(name) or {}).get("date", "")
            if d and len(d) >= 4:
                try:
                    return int(d[:4])
                except ValueError:
                    return None
        return None

    # Rank survivors by composite score (or anomaly)
    def _score(s):
        sc = s.get("scores") or {}
        return float(sc.get("composite") or sc.get("anomaly") or 0.0)

    survivors_sorted = sorted(survivors, key=_score, reverse=True)
    K = 25
    top_k = survivors_sorted[:K]
    rest = survivors_sorted[K:]

    log.info("Top-%d anomalies (of %d survivors); composite range %.3f to %.3f",
             K, len(survivors), _score(top_k[0]), _score(top_k[-1]))

    # Show what the top-K ARE
    print()
    print("=" * 78)
    print(f"TOP-{K} BTUT ANOMALIES in 1,999-survivor EDGAR re-run")
    print("=" * 78)
    for i, s in enumerate(top_k, 1):
        name = ((s.get("entity") or {}).get("name")) or "?"
        scores = s.get("scores") or {}
        comp = float(scores.get("composite", 0.0))
        anom = float(scores.get("anomaly", 0.0))
        cluster = s.get("cluster")
        form = _form(name) or ""
        cik = _cik(name) or ""
        year = _date_year(name)
        yr = f"{year}" if year else ""
        attrs = filing_attrs.get(name, {})
        company = attrs.get("company_name", "")[:28]
        print(f"  #{i:2d}  c={cluster:3d}  comp={comp:.3f} anom={anom:.3f}  "
              f"{name[:48]:<48s} [{form:14s}] {company:<28s} {yr}")

    # ─── Property 1: Form-type concentration ─────────────────────────────
    top_forms = [f for f in (_form(((s.get("entity") or {}).get("name")) or "") for s in top_k) if f]
    rest_forms = [f for f in (_form(((s.get("entity") or {}).get("name")) or "") for s in rest) if f]

    def _concentration(labels: list[str]) -> float:
        if not labels:
            return 0.0
        c = Counter(labels)
        # Top-form share
        return c.most_common(1)[0][1] / len(labels)

    top_form_conc = _concentration(top_forms)
    rest_form_conc = _concentration(rest_forms)

    # Null: sample K at random, measure concentration, repeat
    rng = random.Random(42)
    all_forms = [f for f in (_form(((s.get("entity") or {}).get("name")) or "") for s in survivors) if f]
    null_form_concs = []
    for _ in range(1000):
        sample = rng.sample(all_forms, min(len(top_forms), len(all_forms))) if all_forms and len(top_forms) > 0 else []
        if sample:
            null_form_concs.append(_concentration(sample))
    null_form_p95 = _percentile(null_form_concs, 95)

    # ─── Property 2: Company (CIK) concentration ─────────────────────────
    top_ciks = [c for c in (_cik(((s.get("entity") or {}).get("name")) or "") for s in top_k) if c]
    all_ciks = [c for c in (_cik(((s.get("entity") or {}).get("name")) or "") for s in survivors) if c]

    # Unique CIKs in top-K vs expected under random
    top_unique_ciks = len(set(top_ciks))
    null_unique_ciks = []
    for _ in range(1000):
        sample = rng.sample(all_ciks, min(len(top_ciks), len(all_ciks))) if all_ciks and len(top_ciks) > 0 else []
        if sample:
            null_unique_ciks.append(len(set(sample)))
    null_unique_mean = statistics.mean(null_unique_ciks) if null_unique_ciks else 0.0
    null_unique_p05 = _percentile(null_unique_ciks, 5) if null_unique_ciks else 0.0
    null_unique_p95 = _percentile(null_unique_ciks, 95) if null_unique_ciks else 0.0

    # ─── Property 3: Temporal concentration ──────────────────────────────
    top_years = [y for y in (_date_year(((s.get("entity") or {}).get("name")) or "") for s in top_k) if y]
    all_years = [y for y in (_date_year(((s.get("entity") or {}).get("name")) or "") for s in survivors) if y]

    def _year_spread(years: list[int]) -> float:
        return statistics.pstdev(years) if len(years) >= 2 else 0.0

    top_year_spread = _year_spread(top_years)
    null_year_spreads = []
    for _ in range(1000):
        if all_years and len(top_years) >= 2:
            sample = rng.sample(all_years, min(len(top_years), len(all_years)))
            null_year_spreads.append(_year_spread(sample))
    null_year_p05 = _percentile(null_year_spreads, 5) if null_year_spreads else 0.0

    # ─── Property 4: Within-cluster rank ─────────────────────────────────
    # Group all survivors by cluster
    cluster_members = defaultdict(list)
    for s in survivors:
        cluster_members[int(s.get("cluster", -1))].append(s)
    # For each top-K anomaly, compute its rank within its cluster (by composite score)
    top_ranks = []
    for s in top_k:
        c = int(s.get("cluster", -1))
        members = sorted(cluster_members.get(c, []), key=_score, reverse=True)
        rank = None
        for i, m in enumerate(members, 1):
            if m is s or ((m.get("entity") or {}).get("name") == (s.get("entity") or {}).get("name")):
                rank = i
                break
        if rank:
            top_ranks.append(rank)
    rank_1_fraction = sum(1 for r in top_ranks if r == 1) / max(1, len(top_ranks))

    # Null: if we sampled K survivors at random, what fraction would be rank-1 in their cluster?
    null_rank1 = []
    for _ in range(1000):
        sample = rng.sample(survivors, min(K, len(survivors)))
        count_r1 = 0
        for s in sample:
            c = int(s.get("cluster", -1))
            members = sorted(cluster_members.get(c, []), key=_score, reverse=True)
            if members and ((members[0].get("entity") or {}).get("name") ==
                             (s.get("entity") or {}).get("name")):
                count_r1 += 1
        null_rank1.append(count_r1 / max(1, len(sample)))
    null_rank1_p95 = _percentile(null_rank1, 95)

    # ─── Summary ─────────────────────────────────────────────────────────
    def _badge(sig: bool) -> str:
        return "[PASS] SIGNIFICANT" if sig else "       not signif"

    print()
    print("=" * 78)
    print(f"TOP-{K} NON-RANDOMNESS TESTS")
    print("=" * 78)

    form_sig = top_form_conc > null_form_p95
    print(f"  Form-type concentration : top={top_form_conc:.3f}  null_p95={null_form_p95:.3f}  {_badge(form_sig)}")

    # Fewer unique CIKs than null → concentrated
    cik_low_sig = top_unique_ciks < null_unique_p05
    cik_high_sig = top_unique_ciks > null_unique_p95
    cik_direction = "concentrated" if cik_low_sig else "dispersed" if cik_high_sig else "like-random"
    print(f"  Unique CIKs in top-K    : top={top_unique_ciks}  null_mean={null_unique_mean:.1f}  null_p05={null_unique_p05:.1f}  {cik_direction}  {_badge(cik_low_sig or cik_high_sig)}")

    year_sig = top_year_spread < null_year_p05
    print(f"  Temporal spread (years) : top={top_year_spread:.2f}  null_p05={null_year_p05:.2f}  {_badge(year_sig)}")

    rank_sig = rank_1_fraction > null_rank1_p95
    print(f"  Rank-1-in-cluster frac  : top={rank_1_fraction:.3f}  null_p95={null_rank1_p95:.3f}  {_badge(rank_sig)}")

    sig_count = sum([form_sig, cik_low_sig or cik_high_sig, year_sig, rank_sig])
    print(f"\n  {sig_count} of 4 non-randomness properties pass at alpha=0.05")

    # Save report
    out = {
        "generated_at": "2026-04-19",
        "btut_source": str(EDGAR_BTUT),
        "n_survivors": len(survivors),
        "K": K,
        "top_k_preview": [
            {
                "rank": i + 1,
                "name": ((s.get("entity") or {}).get("name")),
                "composite": _score(s),
                "cluster": s.get("cluster"),
                "form": _form(((s.get("entity") or {}).get("name")) or ""),
                "cik": _cik(((s.get("entity") or {}).get("name")) or ""),
                "year": _date_year(((s.get("entity") or {}).get("name")) or ""),
                "company_name": (filing_attrs.get(((s.get("entity") or {}).get("name")) or "", {})).get("company_name"),
            }
            for i, s in enumerate(top_k)
        ],
        "form_concentration": {"top": top_form_conc, "null_p95": null_form_p95, "significant": form_sig},
        "unique_ciks": {"top": top_unique_ciks, "null_mean": null_unique_mean,
                        "null_p05": null_unique_p05, "null_p95": null_unique_p95,
                        "direction": cik_direction,
                        "significant": cik_low_sig or cik_high_sig},
        "temporal_spread_years": {"top": top_year_spread, "null_p05": null_year_p05, "significant": year_sig},
        "rank_1_fraction": {"top": rank_1_fraction, "null_p95": null_rank1_p95, "significant": rank_sig},
        "significant_property_count": sig_count,
    }
    out_path = REPO_ROOT / "data" / "validation" / "edgar_top_anomaly_study.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2, sort_keys=True, default=str), encoding="utf-8")
    log.info("Saved report: %s", out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
