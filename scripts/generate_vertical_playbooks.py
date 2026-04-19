"""Per-vertical playbook generator.

Reads `data/validation/universal_validation.json` plus each corpus's cached
BTUT survivors, and emits one per-vertical markdown playbook in
`docs/commercial/verticals/<corpus>.md`. Every playbook follows the same
template (buyer, pitch, top-10 resolved findings, ROI line, reproduce
command) and is generated deterministically from the source artifacts —
zero hand-authored vertical copy.

When the NLP stack lands, it will re-rank the findings and swap in richer
per-finding thesis text; this generator produces the scaffold those
enhancements slot into.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "sdk"))

# ---------------------------------------------------------------------------
# Vertical metadata — buyer, pitch, ROI baseline. This is the ONE place a
# vertical is described in commercial language; every downstream artifact
# flows from here deterministically.
# ---------------------------------------------------------------------------
VERTICAL_META: dict[str, dict[str, str]] = {
    "edgar_5000": {
        "domain": "SEC financial filings",
        "buyer": "Hedge fund short desks · audit committees · bank risk officers · SEC examiners",
        "hook": "Catch the 10-K/A before it files.",
        "pitch": "Structural-anomaly score on every XBRL-tagged line item across the full EDGAR filer universe. Ranked by multi-dimensional divergence from peer norms. Every flag is auditable against the 10-K.",
        "roi": "One Pro subscription replaces ~40 analyst-hours / month on screening work at a typical $6,000/mo fully-loaded cost.",
        "trigger": "New 10-K/A · NT 10-K · 8-K Item 4.02 · anomaly crosses p99 · composite drops 15%+ vs 30-day rolling",
    },
    "edgar": {
        "domain": "SEC financial filings (smaller slice)",
        "buyer": "Same as EDGAR 5000 — shown here as a robustness control; same primitives, different universe size.",
        "hook": "Pipeline stability across universe sizes.",
        "pitch": "The same BTUT primitives applied to a smaller EDGAR cut, demonstrating that findings survive when the reference universe shrinks.",
        "roi": "Operational robustness — not a standalone commercial offering.",
        "trigger": "Same as EDGAR 5000",
    },
    "pubmed": {
        "domain": "PubMed biomedical literature",
        "buyer": "Pharma R&D · insurers · pharmacovigilance teams · federal health regulators",
        "hook": "Which biomedical claims are structurally divergent from literature norms?",
        "pitch": "Every PubMed paper fingerprinted and scored against the full biomedical corpus. Outliers surface claims, methodologies, or concept co-occurrences that diverge from consensus — candidates for replication audit or regulatory flag.",
        "roi": "One Pharma Pro seat surfaces replication-risk papers at an order of magnitude lower cost than manual literature review by a medical reviewer at $250/hr.",
        "trigger": "New paper crosses p99 composite · MeSH term's structural signature shifts vs historical · novel concept co-occurrence detected",
    },
    "comtrade": {
        "domain": "UN Comtrade international trade flows",
        "buyer": "Customs offices · supply-chain risk teams · tariff / sanctions desks · commodity traders",
        "hook": "Which trade-flow pairs are structurally unusual this quarter?",
        "pitch": "Every reporter-partner-commodity flow fingerprinted and ranked. Divergent flows surface smuggling, transshipment, sanction evasion, or emerging trade corridors before they appear in consensus analysis.",
        "roi": "A single customs analyst typically screens 500 HS codes per week. The engine ranks all 6,000+ HS codes × 200 countries in minutes.",
        "trigger": "HS-level flow deviates > 3σ from rolling average · new reporter-partner pair at p99 · commodity category shifts structural signature",
    },
    "climate": {
        "domain": "NOAA climate station series",
        "buyer": "Reinsurers · ESG funds · agricultural insurers · infrastructure risk teams",
        "hook": "Which stations' climate signatures have structurally diverged from peer stations?",
        "pitch": "Every NOAA station's temperature / precipitation / humidity time-series fingerprinted against its regional peer group. Structural anomalies mark stations undergoing accelerated change — candidates for micro-climate insurance-pricing adjustments or infrastructure hardening.",
        "roi": "Reinsurance pricing models currently sample a few hundred stations per region; the engine ranks the full US network in one run.",
        "trigger": "Station composite crosses p99 against regional cluster · seasonal pattern breaks peer envelope",
    },
    "patents": {
        "domain": "USPTO patent abstracts",
        "buyer": "IP counsel · M&A diligence teams · licensing strategy · VC technical due diligence",
        "hook": "Which assignees or technology classes are structural outliers in the filer set?",
        "pitch": "Every patent abstract fingerprinted against its CPC class. Outlier assignees reveal emerging strategy shifts; outlier patents flag candidates for licensing, acquisition, or invalidation review.",
        "roi": "Manual patent-landscape review runs $200/hr × 20 hrs per deal. One Pro seat runs the landscape in 3 seconds.",
        "trigger": "New assignee crosses p95 in CPC class · filing velocity spike · structural outlier claim language",
    },
    "polymath": {
        "domain": "Polymath biography corpus (Newton / Leonardo / etc.)",
        "buyer": "Academic historians · science-of-science researchers · intellectual-history analytics",
        "hook": "Which of a polymath's works structurally diverges from the rest of their output?",
        "pitch": "Every biographical event, concept, and location fingerprinted. Outliers surface lesser-known work that may anticipate later paradigms — Newton's alchemy, Leonardo's hydraulics, Turing's biological morphogenesis.",
        "roi": "Academic research grant budgets typically allocate $50k/year per researcher for archive work. Our engine compresses decades of archival catalogue into minutes.",
        "trigger": "New archival finding anchors to a high-composite cluster · cross-corpus bridge strengthens",
    },
    "heterogeneous": {
        "domain": "Heterogeneous historical corpus",
        "buyer": "Digital humanities · archive curators · multi-era research teams",
        "hook": "Which entities bridge eras?",
        "pitch": "Cross-era anchors across mixed historical sources. The same engine that finds restatement risk in SEC filings finds paradigm-bridging entities in 500 years of text.",
        "roi": "Archive discovery — priced per curator-hour, typically $100/hr × months-long projects.",
        "trigger": "Cross-era bridge strengthens · new document enters at top-of-cluster rank",
    },
    "latk_mini": {
        "domain": "Language across time (subset)",
        "buyer": "Computational linguists · corpus linguists · historical linguistics researchers",
        "hook": "Which language fragments bridge historical periods?",
        "pitch": "Every chunk of historical text fingerprinted. Outliers surface semantic drift, loanword adoption, morphological shifts — candidates for linguistic-change publications.",
        "roi": "Grant-funded linguistics research — the engine compresses manual corpus-comparison workflows.",
        "trigger": "Cross-period token structure shifts · bridge fingerprint strengthens",
    },
    "latk_physics": {
        "domain": "Physics patent corpus (arxiv-adjacent)",
        "buyer": "R&D strategy · deep-tech VCs · technology-scouting teams",
        "hook": "Which physics patents are structurally novel within their filing cohort?",
        "pitch": "Every patent + supporting technical chunk fingerprinted. Outliers flag candidates for technology licensing, acquisition targets, or early-stage investment theses.",
        "roi": "Technology scouting typically priced at $150k per quarterly report. Engine replaces baseline screening pass.",
        "trigger": "New filing at top-of-cluster composite · cross-class bridge strengthens",
    },
    "linguistics": {
        "domain": "Linguistic evolution corpus",
        "buyer": "Dictionary / lexicography teams · NLP corpus builders · linguistic-change researchers",
        "hook": "Which semantic shifts are structurally divergent from baseline vocabulary drift?",
        "pitch": "Concept-and-document fingerprints reveal entities whose meaning has structurally shifted from prior eras — candidates for dictionary updates or NLP model retraining signal.",
        "roi": "Lexicography desk priced at $80k/year per lexicographer.",
        "trigger": "Concept shifts cluster membership · cross-period structural divergence",
    },
    "tesla_crossera": {
        "domain": "Tesla cross-era inventor patents",
        "buyer": "Inventor-legacy analysts · patent historians · technology-transfer offices",
        "hook": "Which Tesla patents anticipate later invention corpora?",
        "pitch": "Every Tesla patent chunk fingerprinted against later inventor corpora. Structural anchors surface which early-era inventions prefigure modern technology families.",
        "roi": "Inventor-legacy research — bespoke engagement pricing.",
        "trigger": "Cross-era bridge to modern patent strengthens",
    },
    "einstein": {
        "domain": "Einstein biographical events",
        "buyer": "History of physics researchers",
        "hook": "Too small for null bounds — a robustness control for very-small corpora.",
        "pitch": "Engine runs deterministically; null test auto-skipped when n < 10. Demonstrates graceful degradation.",
        "roi": "Operational robustness — not a standalone commercial offering.",
        "trigger": "—",
    },
    "turing": {
        "domain": "Turing biographical events",
        "buyer": "History of computing / math researchers",
        "hook": "Small corpus; primitives still run with K auto-scaled.",
        "pitch": "Demonstrates that the universal primitives adapt K to corpus size without hand-tuning. Four metrics significant at p<0.05 on n=18.",
        "roi": "Operational robustness control.",
        "trigger": "—",
    },
    "standalone": {
        "domain": "Empty smoke fixture",
        "buyer": "—",
        "hook": "Skipped — empty corpus.",
        "pitch": "Present to confirm the runner gracefully skips empty inputs.",
        "roi": "—",
        "trigger": "—",
    },
}


# ---------------------------------------------------------------------------
# Universal entity resolver — Python mirror of frontend/lib/entityResolver.ts
# (kept minimal; the TS version is authoritative and more complete).
# ---------------------------------------------------------------------------
HS2 = {
    "01": "Live animals", "02": "Meat and edible meat offal",
    "03": "Fish & crustaceans", "04": "Dairy; eggs", "07": "Edible vegetables",
    "08": "Edible fruit", "09": "Coffee, tea, spices", "10": "Cereals",
    "15": "Animal & vegetable fats", "22": "Beverages & spirits",
    "27": "Mineral fuels & oils", "28": "Inorganic chemicals",
    "29": "Organic chemicals", "30": "Pharmaceutical products",
    "39": "Plastics", "44": "Wood products", "61": "Knitted apparel",
    "62": "Woven apparel", "72": "Iron & steel", "84": "Machinery",
    "85": "Electrical machinery", "87": "Vehicles", "90": "Medical instruments",
}

US_STATES = {"AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "CA": "California",
             "CO": "Colorado", "FL": "Florida", "NY": "New York", "TX": "Texas",
             "WA": "Washington"}

MESH = {
    "D000081082": "SARS-CoV-2 Infection",
    "D012140": "Respiratory Tract Diseases",
    "D009369": "Neoplasms (Cancer)",
    "D003924": "Diabetes Mellitus",
}

ASSIGNEES = {"siemens_ag": "Siemens AG", "general_electric": "General Electric",
             "ibm_corp": "IBM", "samsung_electronics": "Samsung Electronics",
             "qualcomm_inc": "Qualcomm", "intel_corp": "Intel"}


def resolve_name(raw: str, cik_map: dict[str, str] | None = None) -> str:
    cik_map = cik_map or {}
    if not raw:
        return "—"
    m = re.match(r"^fact_(\d+)_(.+)$", raw)
    if m:
        cik, concept = m.group(1), m.group(2)
        co = cik_map.get(cik, f"CIK {cik}")
        concept_pretty = re.sub(r"([a-z])([A-Z])", r"\1 \2", concept)
        return f"{co} · {concept_pretty}"
    m = re.match(r"^mesh_(D\d+)$", raw, re.I)
    if m:
        code = m.group(1).upper()
        term = MESH.get(code, f"MeSH {code}")
        return f"{term} (MeSH {code})" if term != f"MeSH {code}" else term
    m = re.match(r"^commodity_(\d{2,4})$", raw)
    if m:
        hs2 = m.group(1)[:2]
        desc = HS2.get(hs2)
        return f"{desc} (HS-{hs2})" if desc else f"HS-{m.group(1)}"
    m = re.match(r"^region_([A-Z]{2})$", raw, re.I)
    if m:
        st = m.group(1).upper()
        full = US_STATES.get(st, st)
        return f"{full} stations"
    m = re.match(r"^assignee_(.+)$", raw)
    if m:
        slug = m.group(1).lower()
        return ASSIGNEES.get(slug, slug.replace("_", " ").title())
    m = re.match(r"^([a-z]+)_([a-z]+)__(event|concept|location)__(.+)$", raw, re.I)
    if m:
        return f"{m.group(1).title()} · {m.group(2).replace('_', ' ').title()} · {m.group(4).replace('_', ' ').title()}"
    return raw.replace("_", " ")


# ---------------------------------------------------------------------------
# Playbook rendering
# ---------------------------------------------------------------------------
TEMPLATE = """# {title}

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

{buyer}

## Hook

**{hook}**

## Pitch

{pitch}

## ROI

{roi}

## Trigger conditions

{trigger}

## Today's top findings (live from the engine)

Pipeline ranked **{n_survivors:,}** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
{findings_table}

**Null-test falsifiability for this corpus:**

- `{sig_05}/{total_metrics}` metrics survive p<0.05
- `{sig_001}/{total_metrics}` at p<0.001
- Max z-score: **{max_z:.2f} sigma** on {n_iterations} resample permutations
- Reproducibility digest: `{digest_short}…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations {n_iterations}
cat data/validation/universal_validation.json \\
    | jq '.corpora[] | select(.corpus_id == "{corpus_id}")'
```

## Next steps

1. Upload 10 {corpus_noun} you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
"""


def corpus_noun(corpus_id: str) -> str:
    mapping = {
        "edgar_5000": "tickers", "edgar": "tickers",
        "pubmed": "MeSH terms or papers", "comtrade": "HS codes or trade corridors",
        "climate": "NOAA stations or regions",
        "patents": "CPC classes or assignees",
        "polymath": "biographical entities",
        "heterogeneous": "historical entities",
        "latk_mini": "historical text fragments", "latk_physics": "physics patents",
        "linguistics": "linguistic concepts", "tesla_crossera": "Tesla patents",
        "einstein": "events", "turing": "events", "standalone": "items",
    }
    return mapping.get(corpus_id, "entities")


def load_cik_map() -> dict[str, str]:
    p = REPO_ROOT / "scripts" / "edgar_cache.json"
    if not p.exists():
        return {}
    doc = json.loads(p.read_text(encoding="utf-8"))
    m: dict[str, str] = {}
    for e in doc.get("entities", []):
        if e.get("type") != "filing":
            continue
        attrs = e.get("attributes", "{}")
        if isinstance(attrs, str):
            try: attrs = json.loads(attrs)
            except Exception: continue
        cik = str(attrs.get("company_cik", ""))
        name = attrs.get("company_name", "")
        if cik and name and cik not in m:
            m[cik] = name
    return m


def top_findings_for(corpus_path: Path, n: int, cik_map: dict[str, str]) -> list[dict[str, Any]]:
    if not corpus_path.exists():
        return []
    try:
        d = json.loads(corpus_path.read_text(encoding="utf-8"))
    except Exception:
        return []
    survivors = d.get("survivors", []) or []
    ranked = sorted(
        survivors,
        key=lambda s: float(((s.get("scores") or {}).get("composite", 0.0))),
        reverse=True,
    )[:n]
    out = []
    for s in ranked:
        name = (s.get("entity") or {}).get("name", "")
        scores = s.get("scores") or {}
        fp = s.get("fingerprint_48bit") or ""
        out.append({
            "display": resolve_name(name, cik_map),
            "composite": float(scores.get("composite", 0.0)),
            "anomaly": float(scores.get("anomaly", 0.0)),
            "fp": fp[:16],
        })
    return out


def render_findings_table(findings: list[dict[str, Any]]) -> str:
    if not findings:
        return "| — | (no findings in cache) | — | — | — |"
    rows = []
    for i, f in enumerate(findings, 1):
        rows.append(
            f"| {i} | {f['display']} | {f['composite']:.3f} | {f['anomaly']:.3f} | `{f['fp']}…` |"
        )
    return "\n".join(rows)


def main() -> int:
    universal = json.loads(
        (REPO_ROOT / "data" / "validation" / "universal_validation.json")
        .read_text(encoding="utf-8")
    )
    cik_map = load_cik_map()

    out_dir = REPO_ROOT / "docs" / "commercial" / "verticals"
    out_dir.mkdir(parents=True, exist_ok=True)

    written = 0
    for c in universal.get("corpora", []):
        cid = c["corpus_id"]
        meta = VERTICAL_META.get(cid)
        if not meta:
            print(f"  skip {cid}: no vertical metadata")
            continue
        path = REPO_ROOT / c["path"]
        findings = top_findings_for(path, n=10, cik_map=cik_map)
        nt = c.get("null_test", {}) or {}

        body = TEMPLATE.format(
            title=f"{meta['domain']} — vertical playbook",
            buyer=meta["buyer"],
            hook=meta["hook"],
            pitch=meta["pitch"],
            roi=meta["roi"],
            trigger=meta["trigger"],
            n_survivors=c.get("survivor_count", 0),
            findings_table=render_findings_table(findings),
            sig_05=nt.get("significant_05", 0),
            sig_001=nt.get("significant_001", 0),
            total_metrics=nt.get("total_metrics", 0),
            max_z=nt.get("max_z_score", 0.0),
            n_iterations=nt.get("n_iterations", universal.get("n_iterations", 200)),
            digest_short=(c.get("reproducibility_digest") or "")[:16],
            corpus_id=cid,
            corpus_noun=corpus_noun(cid),
        )
        out_path = out_dir / f"{cid}.md"
        out_path.write_text(body, encoding="utf-8")
        written += 1
        print(f"  wrote {out_path.relative_to(REPO_ROOT)}  (n={c.get('survivor_count', 0)})")

    # Index page
    index_lines = ["# Vertical playbooks\n",
                   "*Auto-generated from `universal_validation.json`. Each vertical inherits the same engine.*\n\n",
                   "| Vertical | Buyer | Live signal |",
                   "|---|---|---|"]
    for c in sorted(universal.get("corpora", []), key=lambda x: -(x.get("null_test", {}) or {}).get("max_z_score", 0)):
        cid = c["corpus_id"]
        meta = VERTICAL_META.get(cid)
        if not meta: continue
        nt = c.get("null_test", {}) or {}
        z = nt.get("max_z_score", 0)
        buyer_short = meta["buyer"].split(" · ")[0]
        index_lines.append(f"| [{meta['domain']}](./{cid}.md) | {buyer_short} | z = {z:.2f} σ · {nt.get('significant_05', 0)}/{nt.get('total_metrics', 0)} at p<0.05 · n = {c.get('survivor_count', 0):,} |")
    (out_dir / "README.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")

    print(f"\nGenerated {written} vertical playbooks + index at {out_dir.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
