"""Zero-hand-tuning category signal using SEC-NATIVE taxonomies.

The previous zero-tuning attempt used TF-IDF + k-means, which fragmented
concepts into narrow buckets that failed the within-bucket null test.

This script uses taxonomies the operator did not create:

  1. **2-digit SIC major divisions** (e.g. 28=Chemicals, 35=Industrial
     Machinery, 73=Services). Classification assigned by SEC, not me.
  2. **XBRL US-GAAP concepts** (e.g. AccountsPayableCurrent) — each
     `concept_group` in the raw cache is an SEC-recognized concept with
     its list of reporting companies.
  3. **Cross-taxonomy: (2-digit SIC x concept-family)** — the family is
     derived deterministically from the first CamelCase head token of
     the concept name (e.g. `AssetRetirementObligation` -> head=`Asset`).
     No operator choice of mapping.

For each category in each taxonomy:
  - Collect matching fact survivors
  - Rank by BTUT composite (pipeline-native, not operator-weighted)
  - N=500 null permutation vs random same-size sample from all fact
    survivors

Output: which taxonomically-defined categories show significant
within-category anomaly ranking.
"""
from __future__ import annotations

import json
import random
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_CACHE = REPO_ROOT / "scripts" / "edgar_cache.json"
BTUT_5000 = REPO_ROOT / "scripts" / "edgar_btut_result_5000.json"

N_NULL = 500
TOP_K = 10
MIN_MEMBERS = 10

SIC_MAJOR_DIVISIONS = {
    # From SEC's own SIC Division mapping. Public policy data, not operator choice.
    "01": "Agriculture, Forestry, Fishing", "02": "Agriculture", "07": "Agricultural Services",
    "08": "Forestry", "09": "Fishing",
    "10": "Metal Mining", "12": "Coal Mining", "13": "Oil and Gas Extraction",
    "14": "Mining and Quarrying of Nonmetallic Minerals",
    "15": "Construction (General)", "16": "Heavy Construction", "17": "Construction (Special Trade)",
    "20": "Food and Kindred Products", "21": "Tobacco Products", "22": "Textile Mill Products",
    "23": "Apparel", "24": "Lumber and Wood", "25": "Furniture and Fixtures",
    "26": "Paper and Allied Products", "27": "Printing, Publishing",
    "28": "Chemicals and Allied Products", "29": "Petroleum Refining",
    "30": "Rubber and Miscellaneous Plastics", "31": "Leather",
    "32": "Stone, Clay, Glass, Concrete", "33": "Primary Metal Industries",
    "34": "Fabricated Metal Products", "35": "Industrial and Commercial Machinery",
    "36": "Electronic and Electrical Equipment", "37": "Transportation Equipment",
    "38": "Measuring/Analyzing/Controlling Instruments", "39": "Miscellaneous Manufacturing",
    "40": "Railroad Transportation", "41": "Local Passenger Transit",
    "42": "Motor Freight Transportation", "44": "Water Transportation",
    "45": "Transportation by Air", "46": "Pipelines (except Natural Gas)",
    "47": "Transportation Services", "48": "Communications", "49": "Electric, Gas, Sanitary",
    "50": "Wholesale Trade - Durable Goods", "51": "Wholesale Trade - Nondurable",
    "52": "Building Materials Retail", "53": "General Merchandise Stores", "54": "Food Stores",
    "55": "Automotive Dealers and Gasoline", "56": "Apparel and Accessory Stores",
    "57": "Home Furniture/Furnishings", "58": "Eating and Drinking Places",
    "59": "Miscellaneous Retail",
    "60": "Depository Institutions", "61": "Nondepository Credit",
    "62": "Security and Commodity Brokers", "63": "Insurance Carriers",
    "64": "Insurance Agents", "65": "Real Estate", "67": "Holding and Investment Offices",
    "70": "Hotels, Rooming Houses", "72": "Personal Services", "73": "Business Services",
    "75": "Automotive Repair/Rental", "76": "Miscellaneous Repair",
    "78": "Motion Pictures", "79": "Amusement and Recreation Services",
    "80": "Health Services", "81": "Legal Services", "82": "Educational Services",
    "83": "Social Services", "84": "Museums, Galleries", "86": "Membership Organizations",
    "87": "Engineering, Accounting, Research",
    "88": "Private Households", "89": "Services NEC",
    "91": "Executive, Legislative, Judicial", "92": "Justice/Public Order/Safety",
    "93": "Public Finance", "94": "Public Admin of Human Resource Programs",
    "95": "Public Admin of Environmental Quality", "96": "Public Admin of Economic Programs",
    "97": "National Security", "99": "Nonclassifiable",
}

_FACT_RE = re.compile(r"^fact_(\d+)_(.+)$")
_CAMEL_RE = re.compile(r"[A-Z][a-z]+|[A-Z]+(?=[A-Z]|$)|[0-9]+")


def _name(s):
    return ((s.get("entity") or {}).get("name")) or ""


def _concept_of(n):
    m = _FACT_RE.match(n)
    return m.group(2) if m else None


def _cik_of(n):
    m = _FACT_RE.match(n)
    return m.group(1) if m else None


def _head_token(concept_name):
    toks = _CAMEL_RE.findall(concept_name or "")
    return toks[0] if toks else ""


def _composite(s):
    return float((s.get("scores") or {}).get("composite", 0.0))


def _percentile(vals, p):
    import math
    if not vals:
        return 0.0
    s = sorted(vals)
    k = (p / 100.0) * (len(s) - 1)
    lo = int(math.floor(k))
    hi = int(math.ceil(k))
    if lo == hi:
        return s[lo]
    return s[lo] * (1 - (k - lo)) + s[hi] * (k - lo)


def _load_maps():
    raw = json.loads(RAW_CACHE.read_text(encoding="utf-8"))
    cik_to_sic: dict[str, str] = {}
    for sic, companies in (raw.get("sic_groups") or {}).items():
        for c in companies:
            if c.startswith("company_"):
                cik_to_sic[c.split("_", 1)[1]] = str(sic)
    cik_to_name: dict[str, str] = {}
    for e in raw.get("entities", []):
        if e.get("type") != "filing":
            continue
        attrs = e.get("attributes", "{}")
        if isinstance(attrs, str):
            try:
                attrs = json.loads(attrs)
            except Exception:
                attrs = {}
        cik = str(attrs.get("company_cik", "") or "")
        name = attrs.get("company_name") or ""
        if cik and name and cik not in cik_to_name:
            cik_to_name[cik] = name
    return cik_to_sic, cik_to_name


def null_test(members, fact_survivors, rng, n_null=N_NULL, top_k=TOP_K):
    if len(members) < top_k:
        return None
    members_sorted = sorted(members, key=_composite, reverse=True)
    top_mean = statistics.mean(_composite(s) for s in members_sorted[:top_k])
    null_means = []
    for _ in range(n_null):
        sample = rng.sample(fact_survivors, len(members))
        sample_sorted = sorted(sample, key=_composite, reverse=True)
        null_means.append(statistics.mean(_composite(s) for s in sample_sorted[:top_k]))
    null_mean = statistics.mean(null_means)
    null_p95 = _percentile(null_means, 95)
    null_p99 = _percentile(null_means, 99)
    null_p999 = _percentile(null_means, 99.9)
    return {
        "n_members": len(members),
        "top_k_mean_composite": round(top_mean, 4),
        "null_mean": round(null_mean, 4),
        "null_p95": round(null_p95, 4),
        "null_p99": round(null_p99, 4),
        "null_p999": round(null_p999, 4),
        "significant_0_05": top_mean > null_p95,
        "significant_0_01": top_mean > null_p99,
        "significant_0_001": top_mean > null_p999,
    }


def main() -> int:
    btut = json.loads(BTUT_5000.read_text(encoding="utf-8"))
    survivors = btut.get("survivors") or []
    cik_to_sic, cik_to_name = _load_maps()

    fact_survs = [s for s in survivors if _concept_of(_name(s))]
    print(f"Fact survivors: {len(fact_survs)}")

    rng = random.Random(42)

    # ─── Taxonomy 1: 2-digit SIC major division ──────────────────────────
    print("\n[1/3] 2-digit SIC major division null tests...")
    sic2_members: dict[str, list[dict]] = defaultdict(list)
    for s in fact_survs:
        cik = _cik_of(_name(s))
        sic = cik_to_sic.get(cik or "", "")
        if sic and len(sic) >= 2:
            sic2_members[sic[:2]].append(s)

    sic2_reports = []
    for sic2, members in sic2_members.items():
        test = null_test(members, fact_survs, rng)
        if not test:
            continue
        members_sorted = sorted(members, key=_composite, reverse=True)
        top_resolved = [
            {
                "company": cik_to_name.get(_cik_of(_name(s)) or "", f"CIK {_cik_of(_name(s))}"),
                "concept": _concept_of(_name(s)),
                "composite": round(_composite(s), 4),
            }
            for s in members_sorted[:TOP_K]
        ]
        sic2_reports.append({
            "taxonomy": "SIC_2_digit",
            "code": sic2,
            "label": SIC_MAJOR_DIVISIONS.get(sic2, f"SIC {sic2} (unmapped)"),
            **test,
            "top_k": top_resolved,
        })
    sic2_reports.sort(key=lambda r: (-int(r["significant_0_001"]), -int(r["significant_0_01"]),
                                      -int(r["significant_0_05"]), -r["n_members"]))

    # ─── Taxonomy 2: XBRL concept (from concept_groups) ──────────────────
    print("[2/3] XBRL concept-level null tests...")
    raw_concept_groups = json.loads(RAW_CACHE.read_text(encoding="utf-8")).get("concept_groups", {})
    concept_reports = []
    for concept_name, members_list in raw_concept_groups.items():
        # Convert company_XXX list -> set of CIKs
        ciks_in_group = {m.split("_", 1)[1] for m in members_list if m.startswith("company_")}
        matching = [
            s for s in fact_survs
            if _concept_of(_name(s)) == concept_name and (_cik_of(_name(s)) or "") in ciks_in_group
        ]
        test = null_test(matching, fact_survs, rng)
        if not test:
            continue
        members_sorted = sorted(matching, key=_composite, reverse=True)
        top_resolved = [
            {
                "company": cik_to_name.get(_cik_of(_name(s)) or "", f"CIK {_cik_of(_name(s))}"),
                "composite": round(_composite(s), 4),
            }
            for s in members_sorted[:TOP_K]
        ]
        concept_reports.append({
            "taxonomy": "XBRL_concept",
            "concept": concept_name,
            **test,
            "top_k": top_resolved,
        })
    concept_reports.sort(key=lambda r: (-int(r["significant_0_001"]), -int(r["significant_0_01"]),
                                         -int(r["significant_0_05"]), -r["n_members"]))

    # ─── Taxonomy 3: (SIC2 x concept-head-token) joint ───────────────────
    print("[3/3] (SIC2, concept-head) joint null tests...")
    joint_members: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for s in fact_survs:
        cik = _cik_of(_name(s))
        sic = cik_to_sic.get(cik or "", "")
        head = _head_token(_concept_of(_name(s)) or "")
        if sic and len(sic) >= 2 and head:
            joint_members[(sic[:2], head)].append(s)

    joint_reports = []
    for (sic2, head), members in joint_members.items():
        test = null_test(members, fact_survs, rng)
        if not test:
            continue
        members_sorted = sorted(members, key=_composite, reverse=True)
        top_resolved = [
            {
                "company": cik_to_name.get(_cik_of(_name(s)) or "", f"CIK {_cik_of(_name(s))}"),
                "concept": _concept_of(_name(s)),
                "composite": round(_composite(s), 4),
            }
            for s in members_sorted[:TOP_K]
        ]
        joint_reports.append({
            "taxonomy": "SIC2_x_concept_head",
            "sic2": sic2,
            "industry": SIC_MAJOR_DIVISIONS.get(sic2, f"SIC {sic2}"),
            "concept_head": head,
            **test,
            "top_k": top_resolved,
        })
    joint_reports.sort(key=lambda r: (-int(r["significant_0_001"]), -int(r["significant_0_01"]),
                                       -int(r["significant_0_05"]), -r["n_members"]))

    # ─── Save + print ────────────────────────────────────────────────────
    out_dir = REPO_ROOT / "data" / "validation"
    out = {
        "method": "SEC-native taxonomy categorical discovery",
        "null_iterations": N_NULL,
        "min_members_per_category": MIN_MEMBERS,
        "n_fact_survivors": len(fact_survs),
        "taxonomies": {
            "sic_2_digit": sic2_reports,
            "xbrl_concept": concept_reports,
            "sic2_x_concept_head": joint_reports,
        },
    }
    (out_dir / "edgar_sec_native_categories.json").write_text(
        json.dumps(out, indent=2, sort_keys=True, default=str), encoding="utf-8",
    )

    def _summarize(reports, name):
        n = len(reports)
        sig05 = sum(1 for r in reports if r["significant_0_05"])
        sig01 = sum(1 for r in reports if r["significant_0_01"])
        sig001 = sum(1 for r in reports if r["significant_0_001"])
        print(f"\n[{name}]  tested={n}  sig@0.05={sig05}  sig@0.01={sig01}  sig@0.001={sig001}")
        for r in reports[:10]:
            if name.startswith("SIC_2"):
                label = r["label"][:40]
            elif name.startswith("XBRL"):
                label = r["concept"][:40]
            else:
                label = f"{r['sic2']} x {r['concept_head']}"[:40]
            badge = ("*** p<0.001" if r["significant_0_001"]
                     else "** p<0.01" if r["significant_0_01"]
                     else "* p<0.05" if r["significant_0_05"]
                     else "")
            print(f"  {label:<42s}  n={r['n_members']:>4d}  top={r['top_k_mean_composite']:.3f}  "
                  f"p95={r['null_p95']:.3f}  p999={r['null_p999']:.3f}  {badge}")

    print("\n" + "=" * 90)
    print("SEC-NATIVE CATEGORICAL VALIDATION")
    print("=" * 90)
    _summarize(sic2_reports, "SIC_2_digit major division")
    _summarize(concept_reports, "XBRL concept")
    _summarize(joint_reports, "SIC2 x concept_head")
    print(f"\nJSON: {out_dir / 'edgar_sec_native_categories.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
