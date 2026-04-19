"""Convert BTUT statistical anomalies into named signal intelligence.

Takes the 90% stable top-100 reconstruction anomalies (the ones that
survive at both BTUT target=2000 and target=5000 configurations) and
resolves them into human-readable entities with:

- Company name (CIK -> sic_groups lookup)
- SIC industry code + name
- XBRL concept (for facts)
- Filing form type + date (for filings)
- Score breakdown across all 4 dimensions

Aggregations:
- Top-anomaly companies (which CIKs appear most)
- Top-anomaly concepts (which XBRL concepts recur)
- Industry distribution of anomalies
- Temporal distribution
- Named-entity narratives (auto-generated per anomaly)

Output: data/validation/edgar_signal_extraction.json +
        data/validation/edgar_signal_extraction.md (human report)
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

RAW_CACHE = REPO_ROOT / "scripts" / "edgar_cache.json"
BTUT_2000 = REPO_ROOT / "scripts" / "edgar_btut_result_2000.json"
BTUT_5000 = REPO_ROOT / "scripts" / "edgar_btut_result_5000.json"

# Standard Industrial Classification decoded for top SIC codes in our data.
SIC_LABELS = {
    "1311": "Crude Petroleum & Natural Gas",
    "1381": "Oil & Gas Field Services",
    "2834": "Pharmaceutical Preparations",
    "2836": "Biological Products (no diagnostics)",
    "2911": "Petroleum Refining",
    "3440": "Fabricated Metal Products",
    "3559": "Special Industry Machinery",
    "3669": "Communications Equipment",
    "3674": "Semiconductors & Related Devices",
    "3711": "Motor Vehicles & Passenger Car Bodies",
    "3841": "Surgical & Medical Instruments",
    "3845": "Electromedical & Electrotherapeutic Apparatus",
    "4813": "Telephone Communications (no radiotelephone)",
    "4911": "Electric Services",
    "4931": "Electric & Other Services Combined",
    "5141": "Groceries - General Line",
    "5411": "Grocery Stores",
    "5812": "Eating Places",
    "6020": "State Commercial Banks",
    "6022": "State Commercial Banks (national)",
    "6199": "Finance Services",
    "6311": "Life Insurance",
    "6321": "Accident & Health Insurance",
    "6770": "Blank Checks (Holding Company)",
    "6798": "Real Estate Investment Trusts",
    "7370": "Services-Computer Services",
    "7372": "Prepackaged Software",
    "7389": "Services-Business Services NEC",
    "7812": "Services-Motion Picture & Video Tape Production",
    "8731": "Commercial Physical & Biological Research",
}


def _name(s: dict) -> str:
    return ((s.get("entity") or {}).get("name")) or ""


def _score(s: dict, dim: str) -> float:
    return float((s.get("scores") or {}).get(dim, 0.0))


def _load_raw_cache_maps():
    raw = json.loads(RAW_CACHE.read_text(encoding="utf-8"))
    # CIK -> SIC
    cik_to_sic: dict[str, str] = {}
    for sic, companies in (raw.get("sic_groups") or {}).items():
        for c in companies:
            # company names look like "company_<CIK>"
            if c.startswith("company_"):
                cik_to_sic[c.split("_", 1)[1]] = str(sic)

    # CIK -> company name (from filing attributes)
    cik_to_name: dict[str, str] = {}
    # Filing name -> full attributes
    filing_attrs: dict[str, dict] = {}
    for e in raw.get("entities", []):
        t = e.get("type")
        if t == "filing":
            attrs = e.get("attributes", "{}")
            if isinstance(attrs, str):
                try:
                    attrs = json.loads(attrs)
                except Exception:
                    attrs = {}
            filing_attrs[e["name"]] = attrs
            cik = str(attrs.get("company_cik", ""))
            name = attrs.get("company_name", "")
            if cik and name and cik not in cik_to_name:
                cik_to_name[cik] = name
    return cik_to_sic, cik_to_name, filing_attrs


_FACT_RE = re.compile(r"^fact_(\d+)_(.+)$")
_FILING_RE = re.compile(r"^filing_(.+)$")


def _resolve_entity(name: str, filing_attrs: dict, cik_to_sic: dict, cik_to_name: dict) -> dict:
    """Enrich an entity name with readable attributes."""
    info: dict[str, str | None] = {"name": name, "kind": "unknown"}

    m = _FACT_RE.match(name)
    if m:
        cik = m.group(1)
        concept = m.group(2)
        info.update({
            "kind": "fact",
            "cik": cik,
            "concept": concept,
            "company_name": cik_to_name.get(cik),
            "sic": cik_to_sic.get(cik),
            "industry": SIC_LABELS.get(cik_to_sic.get(cik, ""), "") or None,
        })
        return info

    if name.startswith("filing_"):
        attrs = filing_attrs.get(name) or {}
        cik = str(attrs.get("company_cik", "") or "")
        info.update({
            "kind": "filing",
            "cik": cik,
            "form": attrs.get("form"),
            "date": attrs.get("date"),
            "description": attrs.get("description"),
            "company_name": attrs.get("company_name") or cik_to_name.get(cik),
            "sic": cik_to_sic.get(cik) if cik else None,
            "industry": SIC_LABELS.get(cik_to_sic.get(cik, ""), "") if cik else None,
        })
        return info

    if name.startswith("company_"):
        cik = name.split("_", 1)[1]
        info.update({
            "kind": "company",
            "cik": cik,
            "company_name": cik_to_name.get(cik),
            "sic": cik_to_sic.get(cik),
            "industry": SIC_LABELS.get(cik_to_sic.get(cik, ""), "") or None,
        })
        return info

    return info


def main() -> int:
    cik_to_sic, cik_to_name, filing_attrs = _load_raw_cache_maps()

    btut_2000 = json.loads(BTUT_2000.read_text(encoding="utf-8"))
    btut_5000 = json.loads(BTUT_5000.read_text(encoding="utf-8"))

    # Stable reconstruction top-K (the 90% overlap set)
    def _top_by_dim(btut: dict, dim: str, K: int) -> list[dict]:
        survs = btut.get("survivors") or []
        return sorted(survs, key=lambda s: _score(s, dim), reverse=True)[:K]

    K = 100
    top_2k_recon = _top_by_dim(btut_2000, "reconstruction", K)
    top_5k_recon = _top_by_dim(btut_5000, "reconstruction", K)
    stable_names = {_name(s) for s in top_2k_recon} & {_name(s) for s in top_5k_recon}
    # Preserve ordering by score from the 5k run
    stable_5k = [s for s in top_5k_recon if _name(s) in stable_names]

    # Also compute a bigger "enriched" set: top-100 by composite from 5k
    top_5k_composite = _top_by_dim(btut_5000, "composite", K)
    top_5k_anomaly = _top_by_dim(btut_5000, "anomaly", 25)  # pure anomaly flagship

    # Resolve each into a named entity
    def _enrich(survs: list[dict]) -> list[dict]:
        out = []
        for s in survs:
            info = _resolve_entity(_name(s), filing_attrs, cik_to_sic, cik_to_name)
            info.update({
                "cluster": s.get("cluster"),
                "scores": s.get("scores") or {},
            })
            out.append(info)
        return out

    stable_enriched = _enrich(stable_5k)
    composite_enriched = _enrich(top_5k_composite)
    anomaly_enriched = _enrich(top_5k_anomaly)

    # ─── Aggregations ─────────────────────────────────────────────
    # For the STABLE set (signal we trust most):
    concept_counts: Counter = Counter()
    company_counts: Counter = Counter()
    industry_counts: Counter = Counter()
    for e in stable_enriched:
        if e.get("concept"):
            concept_counts[e["concept"]] += 1
        if e.get("cik"):
            label = e.get("company_name") or f"CIK {e['cik']}"
            company_counts[label] += 1
        if e.get("industry"):
            industry_counts[e["industry"]] += 1

    # Cross-config stability
    config_stability = {
        "K": K,
        "stable_count": len(stable_names),
        "stable_fraction": round(len(stable_names) / K, 3),
    }

    # Flagship: top 10 composite anomalies across both runs
    flagship = composite_enriched[:10]

    # ─── Output files ─────────────────────────────────────────────
    out_dir = REPO_ROOT / "data" / "validation"
    out_dir.mkdir(parents=True, exist_ok=True)
    report = {
        "corpus": "EDGAR 61,041 entities",
        "btut_runs_compared": ["target=2000 (v2 1,999 survivors)", "target=5000 (4,999 survivors)"],
        "config_stability": config_stability,
        "stable_reconstruction_anomalies": stable_enriched,
        "flagship_composite_top10": flagship,
        "pure_anomaly_top25": anomaly_enriched,
        "aggregations": {
            "top_concepts_in_stable_set": concept_counts.most_common(15),
            "top_companies_in_stable_set": company_counts.most_common(15),
            "top_industries_in_stable_set": industry_counts.most_common(10),
        },
    }
    (out_dir / "edgar_signal_extraction.json").write_text(
        json.dumps(report, indent=2, sort_keys=True, default=str), encoding="utf-8",
    )

    # ─── Markdown report for humans ───────────────────────────────
    md: list[str] = []
    md.append("# EDGAR Signal Extraction — What the Anomalies Actually Say\n")
    md.append(f"Corpus: **61,041 EDGAR entities** (filings + XBRL facts).  ")
    md.append(f"BTUT runs compared: target=2,000 and target=5,000 survivors.  ")
    md.append(f"**Stable set: {config_stability['stable_count']} of top {K} reconstruction anomalies "
              f"appear in BOTH runs ({config_stability['stable_fraction']*100:.0f}% reproducibility).**\n")
    md.append("These are the entities whose BTUT anomaly flag survives independent pipeline "
              "configurations — the structural signals most defensible against "
              "tuning artifacts.\n")

    md.append("\n## Top anomalous companies (stable set)\n")
    md.append("| Company (CIK) | Count of anomalous line-items | Industry |")
    md.append("|---|---|---|")
    for company, n in company_counts.most_common(12):
        # Find the industry from the stable set
        ind = next((e.get("industry") for e in stable_enriched if
                    (e.get("company_name") == company or
                     f"CIK {e.get('cik')}" == company)), None)
        md.append(f"| {company} | {n} | {ind or ''} |")

    md.append("\n## Top anomalous XBRL concepts (stable set)\n")
    md.append("What accounting line items BTUT repeatedly flags as structurally unusual.\n")
    md.append("| XBRL concept | Count in stable top-100 |")
    md.append("|---|---|")
    for concept, n in concept_counts.most_common(15):
        md.append(f"| `{concept}` | {n} |")

    md.append("\n## Top flagged industries (stable set)\n")
    md.append("| Industry | Count |")
    md.append("|---|---|")
    for ind, n in industry_counts.most_common(8):
        md.append(f"| {ind} | {n} |")

    md.append("\n## Flagship top-10 composite anomalies\n")
    md.append("The BTUT pipeline's highest-composite survivors, enriched.\n")
    md.append("| # | Entity | Kind | CIK | Company | Concept / Form | Industry | composite | anomaly |")
    md.append("|---|---|---|---|---|---|---|---|---|")
    for i, e in enumerate(flagship, 1):
        scores = e.get("scores") or {}
        concept_or_form = e.get("concept") or e.get("form") or ""
        md.append(
            f"| {i} | `{e.get('name', '')}` | {e.get('kind', '')} | {e.get('cik', '')} "
            f"| {e.get('company_name') or ''} | {concept_or_form} | "
            f"{e.get('industry') or ''} | {scores.get('composite', 0):.3f} | "
            f"{scores.get('anomaly', 0):.3f} |"
        )

    md.append("\n## Pure anomaly-score top-25 (stratified-by-type deviation)\n")
    md.append("Entities furthest from their type-centroid in BTUT magnitude space.\n")
    md.append("| # | Entity | Kind | CIK | Company | Concept | Industry | anomaly |")
    md.append("|---|---|---|---|---|---|---|---|")
    for i, e in enumerate(anomaly_enriched[:25], 1):
        scores = e.get("scores") or {}
        md.append(
            f"| {i} | `{e.get('name', '')}` | {e.get('kind', '')} | {e.get('cik', '')} "
            f"| {e.get('company_name') or ''} | {e.get('concept') or ''} | "
            f"{e.get('industry') or ''} | {scores.get('anomaly', 0):.3f} |"
        )

    md_path = out_dir / "edgar_signal_extraction.md"
    md_path.write_text("\n".join(md), encoding="utf-8")

    # Console summary
    print()
    print("=" * 78)
    print("EDGAR SIGNAL EXTRACTION")
    print("=" * 78)
    print(f"Stable reconstruction top-{K}: {config_stability['stable_count']}/{K} "
          f"({config_stability['stable_fraction']*100:.0f}% reproducible across BTUT configs)")
    print(f"\nTop 10 companies in the stable set:")
    for company, n in company_counts.most_common(10):
        print(f"  {n:3d}x  {company}")
    print(f"\nTop 10 XBRL concepts flagged as anomalous:")
    for concept, n in concept_counts.most_common(10):
        print(f"  {n:3d}x  {concept}")
    print(f"\nTop industries by anomaly count:")
    for ind, n in industry_counts.most_common(8):
        print(f"  {n:3d}x  {ind}")
    print(f"\nFlagship top-10 (composite score):")
    for i, e in enumerate(flagship, 1):
        company = e.get("company_name") or f"CIK {e.get('cik', '?')}"
        concept_or_form = e.get("concept") or e.get("form") or ""
        print(f"  #{i:2d}  {company[:30]:<30s}  {concept_or_form[:30]:<30s}  "
              f"comp={(e.get('scores') or {}).get('composite', 0):.3f}")
    print(f"\nReports:")
    print(f"  {out_dir / 'edgar_signal_extraction.json'}")
    print(f"  {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
