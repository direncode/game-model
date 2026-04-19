"""EDGAR categorical signal probes.

Takes the 4,999-survivor BTUT EDGAR run and queries it with 10 domain-
specific lenses. Each probe is a named business question:

  1. Accounting Discrepancies        — soft estimate accounts
  2. Emerging Liabilities            — contingent, legal, environmental
  3. Strong Revenue Signal           — revenue/sales line items
  4. Resilient Balance Sheet         — equity / retained-earnings stability
  5. Debt Stress Signals             — leverage, debt-service risk
  6. Cash Quality                    — cash reserves + equivalents
  7. M&A Activity                    — goodwill, acquisitions, intangibles
  8. Distress / Going-Concern        — impairment, restructuring, discontinued
  9. Tax Complexity / Uncertainty    — deferred tax, uncertain positions
 10. Dilution / Stock Comp           — share-based comp, APIC, dilutive shares

Each probe:
- Filters survivors whose XBRL concept matches the category patterns
- Ranks by a category-specific score weighting
- Resolves to named company + industry
- Emits the top-10 + aggregate summary

Output: data/validation/edgar_categorical_signals.json + .md
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Callable

REPO_ROOT = Path(__file__).resolve().parent.parent

RAW_CACHE = REPO_ROOT / "scripts" / "edgar_cache.json"
BTUT_5000 = REPO_ROOT / "scripts" / "edgar_btut_result_5000.json"


# ─── SIC label lookup (reused) ────────────────────────────────────────────────
SIC_LABELS = {
    "1311": "Crude Petroleum & Natural Gas", "1381": "Oil & Gas Field Services",
    "2834": "Pharmaceutical Preparations", "2836": "Biological Products",
    "2911": "Petroleum Refining", "3440": "Fabricated Metal", "3559": "Special Industry Machinery",
    "3669": "Communications Equipment", "3674": "Semiconductors",
    "3711": "Motor Vehicles", "3841": "Surgical & Medical Instruments",
    "3845": "Electromedical Apparatus", "4813": "Telephone Communications",
    "4911": "Electric Services", "4931": "Electric & Other Services",
    "5141": "Groceries Wholesale", "5411": "Grocery Stores", "5812": "Eating Places",
    "6020": "State Commercial Banks", "6022": "State Commercial Banks (National)",
    "6199": "Finance Services", "6311": "Life Insurance",
    "6321": "Accident & Health Insurance", "6770": "Blank Checks / Holdings",
    "6798": "REITs", "7370": "Computer Services", "7372": "Prepackaged Software",
    "7389": "Business Services NEC", "7812": "Motion Picture Production",
    "8731": "Commercial Physical & Biological Research",
}


# ─── Categorical probes ──────────────────────────────────────────────────────
# Each probe: patterns for concept match, score weighting, direction.
#
# direction="high" => we want TOP (most anomalous / diverse / isolated)
# direction="low"  => we want BOTTOM (most structurally stable) — used for
#                     "resilient balance sheet" type signals.


Probe = dict[str, object]

PROBES: dict[str, Probe] = {
    "accounting_discrepancies": {
        "description": "Soft-estimate accounts prone to management discretion: ARO, goodwill, impairment, valuation allowance, intangibles amortization.",
        "concept_patterns": [
            r"^AssetRetirement",
            r"^Goodwill$",
            r"GoodwillImpair",
            r"^Impairment",
            r"^ValuationAllowance",
            r"AmortizationOfIntangibleAssets",
            r"IntangibleAsset",
            r"^DeferredRevenue",
            r"AccumulatedImpairmentLoss",
            r"IntangibleAssetsNetExcludingGoodwill",
        ],
        "weights": {"anomaly": 0.5, "reconstruction": 0.3, "diversity": 0.2},
        "direction": "high",
    },
    "emerging_liabilities": {
        "description": "Contingent, legal, environmental, restructuring, and warranty obligations — liabilities growing outside the normal operating cycle.",
        "concept_patterns": [
            r"LossContingenc",
            r"^Contingen",
            r"LegalReserve",
            r"^EnvironmentalReme",
            r"EnvironmentalLiab",
            r"Restructuring",
            r"Warranty",
            r"^Commitment",
            r"Litigation",
            r"Indemnification",
        ],
        "weights": {"anomaly": 0.45, "diversity": 0.35, "reconstruction": 0.20},
        "direction": "high",
    },
    "strong_revenue_signal": {
        "description": "Revenue and sales line items with unusually high structural uniqueness — candidates for breakout revenue growth or unique business-model revenue patterns.",
        "concept_patterns": [
            r"^Revenue",
            r"^Sales",
            r"SalesRevenueNet",
            r"^ContractWithCustomer",
            r"NetSales",
            r"OperatingRevenue",
            r"ServiceRevenue",
            r"ProductRevenue",
        ],
        "weights": {"reconstruction": 0.5, "diversity": 0.3, "anomaly": 0.2},
        "direction": "high",
    },
    "resilient_balance_sheet": {
        "description": "Equity-side accounts that are structurally coherent with peers — strong retained earnings + stable equity = balance-sheet resilience.",
        "concept_patterns": [
            r"^RetainedEarnings",
            r"^StockholdersEquity",
            r"^CommonStockValue",
            r"^TreasuryStock",
            r"AccumulatedOtherComprehensive",
        ],
        # Invert: want LOW anomaly + HIGH reconstruction = stable-but-meaningful
        "weights": {"reconstruction": 0.6, "anomaly": -0.4, "diversity": 0.2},
        "direction": "high",
    },
    "debt_stress": {
        "description": "Leverage and debt-service line items showing structural deviation — candidates for elevated refinancing risk or covenant pressure.",
        "concept_patterns": [
            r"^LongTermDebt",
            r"^ShortTermBorrowings",
            r"^LineOfCredit",
            r"^DebtCurrent",
            r"^LongTermLineOfCredit",
            r"InterestExpense",
            r"InterestPaid",
            r"DebtInstrument",
            r"ConvertibleDebt",
            r"NotesPayable",
        ],
        "weights": {"anomaly": 0.5, "reconstruction": 0.3, "diversity": 0.2},
        "direction": "high",
    },
    "cash_quality": {
        "description": "Cash, equivalents, and short-term-investment accounts with unusual structure — could indicate treasury-strategy outliers or unusual reserve composition.",
        "concept_patterns": [
            r"^CashAndCashEquivalents",
            r"^CashCashEquivalentsRestricted",
            r"RestrictedCash",
            r"^ShortTermInvestment",
            r"^MarketableSecurities",
            r"^Investment",
        ],
        "weights": {"diversity": 0.4, "reconstruction": 0.4, "anomaly": 0.2},
        "direction": "high",
    },
    "ma_activity": {
        "description": "Business-combination, goodwill, and intangible-asset anomalies — companies with recent or complex M&A activity.",
        "concept_patterns": [
            r"^BusinessCombination",
            r"^BusinessAcquisition",
            r"^Goodwill",
            r"^IntangibleAsset",
            r"AcquiredInProcess",
            r"AmortizationOfAcquired",
            r"PurchasedIntangible",
            r"^Earnout",
            r"Divestiture",
            r"AssetsHeldForSale",
        ],
        "weights": {"anomaly": 0.4, "reconstruction": 0.35, "diversity": 0.25},
        "direction": "high",
    },
    "distress_going_concern": {
        "description": "Going-concern, discontinued operations, restructuring, and impairment concentrations — distress candidates.",
        "concept_patterns": [
            r"GoingConcern",
            r"Discontinued",
            r"Restructuring",
            r"ImpairmentLoss",
            r"AssetsOfDisposalGroup",
            r"^DisposalGroup",
            r"AssetImpairment",
            r"CeasingOperations",
            r"WindDown",
        ],
        "weights": {"anomaly": 0.55, "diversity": 0.25, "reconstruction": 0.20},
        "direction": "high",
    },
    "tax_complexity": {
        "description": "Deferred-tax, uncertain-tax-position, and tax-benefit items showing structural complexity — candidates for tax-audit exposure.",
        "concept_patterns": [
            r"^DeferredTax",
            r"^IncomeTax",
            r"UnrecognizedTaxBenefit",
            r"UncertainTaxPosition",
            r"TaxReceivable",
            r"TaxPayable",
            r"TaxBenefit",
            r"AccruedIncomeTaxes",
            r"EffectiveIncomeTaxRate",
        ],
        "weights": {"anomaly": 0.4, "reconstruction": 0.35, "diversity": 0.25},
        "direction": "high",
    },
    "dilution_stock_comp": {
        "description": "Share-based-compensation, APIC, and dilutive-security accounts — dilution-risk signal for existing shareholders.",
        "concept_patterns": [
            r"^ShareBasedCompensation",
            r"^StockBasedCompensation",
            r"^AdditionalPaidInCapital",
            r"^WeightedAverageShares",
            r"^DilutedShares",
            r"IncrementalCommonShares",
            r"Convertible.*Shares",
            r"StockOption",
            r"RestrictedStockUnit",
        ],
        "weights": {"anomaly": 0.35, "reconstruction": 0.40, "diversity": 0.25},
        "direction": "high",
    },
}


# ─── Raw-cache resolution helpers ────────────────────────────────────────────


_FACT_RE = re.compile(r"^fact_(\d+)_(.+)$")


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


def _name(s: dict) -> str:
    return ((s.get("entity") or {}).get("name")) or ""


def _concept_of(name: str) -> str | None:
    m = _FACT_RE.match(name)
    return m.group(2) if m else None


def _cik_of(name: str) -> str | None:
    m = _FACT_RE.match(name)
    return m.group(1) if m else None


def _score_weighted(s: dict, weights: dict[str, float]) -> float:
    scores = s.get("scores") or {}
    return sum(float(weights.get(k, 0)) * float(scores.get(k, 0))
               for k in ("anomaly", "reconstruction", "diversity", "composite"))


def run_probe(name: str, probe: Probe, survivors: list[dict],
              cik_to_sic: dict, cik_to_name: dict, top_k: int = 10) -> dict:
    patterns = [re.compile(p) for p in probe["concept_patterns"]]
    weights = probe["weights"]
    direction = probe.get("direction", "high")

    # Filter: only fact survivors whose concept matches any pattern
    hits: list[tuple[float, dict, str, str]] = []
    for s in survivors:
        ename = _name(s)
        concept = _concept_of(ename)
        if not concept:
            continue
        if not any(p.search(concept) for p in patterns):
            continue
        cik = _cik_of(ename) or ""
        score = _score_weighted(s, weights)
        company = cik_to_name.get(cik) or f"CIK {cik}"
        hits.append((score, s, concept, company))

    hits.sort(key=lambda x: x[0], reverse=(direction == "high"))
    top = hits[:top_k]

    # Aggregates
    industry_counter: Counter = Counter()
    concept_counter: Counter = Counter()
    company_counter: Counter = Counter()
    for score, s, concept, company in hits:
        cik = _cik_of(_name(s))
        sic = cik_to_sic.get(cik) if cik else None
        if sic:
            industry_counter[SIC_LABELS.get(sic, sic)] += 1
        concept_counter[concept] += 1
        company_counter[company] += 1

    return {
        "probe": name,
        "description": probe["description"],
        "total_hits": len(hits),
        "direction": direction,
        "top_k": [
            {
                "company": company,
                "cik": _cik_of(_name(s)),
                "concept": concept,
                "weighted_score": round(score, 4),
                "anomaly": (s.get("scores") or {}).get("anomaly"),
                "composite": (s.get("scores") or {}).get("composite"),
                "diversity": (s.get("scores") or {}).get("diversity"),
                "reconstruction": (s.get("scores") or {}).get("reconstruction"),
                "sic": cik_to_sic.get(_cik_of(_name(s)) or ""),
                "industry": SIC_LABELS.get(cik_to_sic.get(_cik_of(_name(s)) or "", ""), None),
            }
            for score, s, concept, company in top
        ],
        "top_industries": industry_counter.most_common(5),
        "top_concepts": concept_counter.most_common(8),
        "top_companies": company_counter.most_common(8),
    }


def main() -> int:
    cik_to_sic, cik_to_name = _load_maps()
    btut = json.loads(BTUT_5000.read_text(encoding="utf-8"))
    survivors = btut.get("survivors") or []

    results: dict[str, dict] = {}
    for pname, probe in PROBES.items():
        results[pname] = run_probe(pname, probe, survivors, cik_to_sic, cik_to_name)

    # Save JSON
    out_dir = REPO_ROOT / "data" / "validation"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "edgar_categorical_signals.json").write_text(
        json.dumps(results, indent=2, sort_keys=True, default=str), encoding="utf-8",
    )

    # Markdown report
    md: list[str] = []
    md.append("# EDGAR Categorical Signal Probes")
    md.append("")
    md.append(f"Source: **BTUT 4,999-survivor run** on full 61,041 EDGAR entities.  ")
    md.append(f"Probes: **{len(PROBES)}** categorical lenses. Each probe filters survivors "
              "whose XBRL concept matches the category, then ranks by a category-specific "
              "weighting of the 4 BTUT score dimensions.")
    md.append("")
    for pname, r in results.items():
        md.append(f"## {pname.replace('_', ' ').title()}")
        md.append("")
        md.append(f"**{r['description']}**  ")
        md.append(f"Hits matching category: **{r['total_hits']}**.  Direction: `{r['direction']}`.")
        md.append("")
        md.append("### Top-10 named signals")
        md.append("")
        md.append("| # | Company | Concept | Score | anom | recon | div | Industry |")
        md.append("|---|---|---|---|---|---|---|---|")
        for i, h in enumerate(r["top_k"], 1):
            md.append(
                f"| {i} | {h.get('company') or ''} | `{h.get('concept') or ''}` "
                f"| {h.get('weighted_score')} "
                f"| {h.get('anomaly')} | {h.get('reconstruction')} | {h.get('diversity')} "
                f"| {h.get('industry') or ''} |"
            )
        md.append("")
        if r["top_industries"]:
            md.append("**Industry concentration:** "
                      + ", ".join(f"{ind} ({n})" for ind, n in r["top_industries"]))
            md.append("")
        if r["top_concepts"]:
            md.append("**Concept breakdown:** "
                      + ", ".join(f"`{c}` ({n})" for c, n in r["top_concepts"]))
            md.append("")
    md_path = out_dir / "edgar_categorical_signals.md"
    md_path.write_text("\n".join(md), encoding="utf-8")

    # Console summary
    print()
    print("=" * 78)
    print("EDGAR CATEGORICAL SIGNAL PROBES")
    print("=" * 78)
    for pname, r in results.items():
        print(f"\n{pname.upper()}  ({r['total_hits']} hits)")
        for i, h in enumerate(r["top_k"][:5], 1):
            company = (h.get("company") or "")[:34]
            concept = (h.get("concept") or "")[:36]
            print(f"  #{i}  {company:<34s}  {concept:<36s}  "
                  f"score={h.get('weighted_score', 0):.3f} "
                  f"anom={h.get('anomaly', 0):.2f}")
    print(f"\nFull report: {md_path}")
    print(f"JSON: {out_dir / 'edgar_categorical_signals.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
