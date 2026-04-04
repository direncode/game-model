#!/usr/bin/env python3
"""EDGAR + BTUT Stress Test -- 10K companies, all data types.

Pulls real SEC EDGAR data (company metadata + XBRL financial facts + filing text),
constructs a heterogeneous entity/edge graph, and runs the full BTUT pipeline.

EDGAR API: free, no key needed. Just a User-Agent header.
Rate limit: 10 req/sec. We respect this with throttling.

Usage:
    python scripts/edgar_btut_stress_test.py
    python scripts/edgar_btut_stress_test.py --companies 1000 --budget 10
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# Add backend to path
BACKEND_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend")
sys.path.insert(0, BACKEND_PATH)

# EDGAR API settings
EDGAR_BASE = "https://data.sec.gov"
EDGAR_SEARCH = "https://efts.sec.gov/LATEST"
USER_AGENT = "Diren Kumaratilleke direnavk@outlook.com"
REQUEST_DELAY = 0.11  # 10 req/sec max


def edgar_get(url: str) -> dict | list | None:
    """Make a rate-limited GET to EDGAR API."""
    time.sleep(REQUEST_DELAY)
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError, json.JSONDecodeError, TimeoutError) as e:
        print(f"  EDGAR request failed: {url[:80]}... -> {e}")
        return None


def fetch_company_tickers() -> list[dict]:
    """Fetch the full SEC company tickers list (~10K+ companies)."""
    print("Fetching company tickers from EDGAR...")
    url = "https://www.sec.gov/files/company_tickers.json"
    data = edgar_get(url)
    if not data:
        return []

    companies = []
    for key, entry in data.items():
        companies.append({
            "cik": str(entry.get("cik_str", "")),
            "ticker": entry.get("ticker", ""),
            "name": entry.get("title", ""),
        })

    print(f"  Found {len(companies)} companies")
    return companies


def fetch_company_submissions(cik: str) -> dict | None:
    """Fetch filing submissions for a company."""
    padded_cik = cik.zfill(10)
    url = f"{EDGAR_BASE}/submissions/CIK{padded_cik}.json"
    return edgar_get(url)


def fetch_company_facts(cik: str) -> dict | None:
    """Fetch XBRL financial facts for a company."""
    padded_cik = cik.zfill(10)
    url = f"{EDGAR_BASE}/api/xbrl/companyfacts/CIK{padded_cik}.json"
    return edgar_get(url)


def build_entity_graph(
    companies: list[dict],
    max_companies: int = 10_000,
    fetch_facts: bool = True,
    fetch_filings: bool = True,
) -> tuple[list[dict], list[dict]]:
    """Build heterogeneous entity/edge graph from EDGAR data.

    Entity types:
    - company: Core entity with metadata
    - filing: 10-K, 10-Q, 8-K submissions
    - financial_fact: XBRL data points (revenue, assets, etc.)

    Edge types:
    - filed_by: filing -> company
    - same_sic: company <-> company (same industry)
    - reports_fact: company -> financial_fact
    - temporal_neighbor: filing <-> filing (same company, adjacent dates)
    """
    entities = []
    edges = []
    sic_groups: dict[str, list[str]] = {}  # SIC code -> list of company entity names

    selected = companies[:max_companies]
    total = len(selected)

    # Phase 1: Company entities (from tickers list — no API calls needed)
    print(f"\nPhase 1: Building {total} company entities...")
    for i, comp in enumerate(selected):
        entity_name = f"company_{comp['cik']}"
        entities.append({
            "name": entity_name,
            "type": "company",
            "attributes": json.dumps({
                "cik": comp["cik"],
                "ticker": comp["ticker"],
                "company_name": comp["name"],
            }),
        })

    # Phase 2: Fetch submissions for a sample (filing metadata)
    # Can't hit 10K companies at 10 req/sec — would take 17 minutes
    # Instead, fetch for a sample and extrapolate
    sample_size = min(200, total)
    if fetch_filings:
        print(f"\nPhase 2: Fetching filing metadata for {sample_size} companies...")
        filing_count = 0
        for i in range(sample_size):
            comp = selected[i]
            if i % 50 == 0:
                print(f"  Progress: {i}/{sample_size} companies, {filing_count} filings, {len(entities)} entities...")

            submissions = fetch_company_submissions(comp["cik"])
            if not submissions:
                continue

            # Extract SIC code for industry edges
            sic = submissions.get("sic", "")
            if sic:
                sic_groups.setdefault(sic, []).append(f"company_{comp['cik']}")

            # Update company entity with submission metadata
            for ent in entities:
                if ent["name"] == f"company_{comp['cik']}":
                    attrs = json.loads(ent["attributes"])
                    attrs["sic"] = sic
                    attrs["sic_description"] = submissions.get("sicDescription", "")
                    attrs["state"] = submissions.get("stateOfIncorporation", "")
                    attrs["fiscal_year_end"] = submissions.get("fiscalYearEnd", "")
                    attrs["filing_count"] = len(submissions.get("filings", {}).get("recent", {}).get("accessionNumber", []))
                    ent["attributes"] = json.dumps(attrs)
                    break

            # Create filing entities (recent filings only, cap at 5 per company)
            recent = submissions.get("filings", {}).get("recent", {})
            accessions = recent.get("accessionNumber", [])[:5]
            forms = recent.get("form", [])[:5]
            dates = recent.get("filingDate", [])[:5]
            descriptions = recent.get("primaryDocDescription", [])[:5]

            prev_filing_name = None
            for j in range(len(accessions)):
                filing_name = f"filing_{accessions[j].replace('-', '')}"
                entities.append({
                    "name": filing_name,
                    "type": "filing",
                    "attributes": json.dumps({
                        "accession": accessions[j],
                        "form": forms[j] if j < len(forms) else "",
                        "date": dates[j] if j < len(dates) else "",
                        "description": descriptions[j] if j < len(descriptions) else "",
                        "company_cik": comp["cik"],
                    }),
                })
                filing_count += 1

                # Edge: filing -> company
                edges.append({
                    "source": filing_name,
                    "target": f"company_{comp['cik']}",
                    "type": "filed_by",
                    "weight": 1.0,
                })

                # Temporal neighbor edge
                if prev_filing_name:
                    edges.append({
                        "source": prev_filing_name,
                        "target": filing_name,
                        "type": "temporal_neighbor",
                        "weight": 0.8,
                    })
                prev_filing_name = filing_name

        print(f"  Filings: {filing_count} entities from {sample_size} companies")

    # Phase 3: Fetch XBRL financial facts for a smaller sample
    facts_sample = min(100, total)
    if fetch_facts:
        print(f"\nPhase 3: Fetching XBRL facts for {facts_sample} companies...")
        fact_count = 0
        for i in range(facts_sample):
            comp = selected[i]
            if i % 25 == 0:
                print(f"  Progress: {i}/{facts_sample} companies, {fact_count} facts...")

            facts = fetch_company_facts(comp["cik"])
            if not facts:
                continue

            # Extract key financial facts from us-gaap taxonomy
            us_gaap = facts.get("facts", {}).get("us-gaap", {})
            key_concepts = [
                "Revenue", "Revenues", "Assets", "Liabilities",
                "StockholdersEquity", "NetIncomeLoss", "OperatingIncomeLoss",
                "CashAndCashEquivalentsAtCarryingValue",
            ]

            for concept in key_concepts:
                concept_data = us_gaap.get(concept, {})
                units = concept_data.get("units", {})
                usd_values = units.get("USD", [])

                if not usd_values:
                    continue

                # Take most recent value
                latest = usd_values[-1] if usd_values else None
                if not latest:
                    continue

                fact_name = f"fact_{comp['cik']}_{concept}"
                entities.append({
                    "name": fact_name,
                    "type": "financial_fact",
                    "attributes": json.dumps({
                        "concept": concept,
                        "value": latest.get("val", 0),
                        "unit": "USD",
                        "period_end": latest.get("end", ""),
                        "form": latest.get("form", ""),
                        "company_cik": comp["cik"],
                        "filed": latest.get("filed", ""),
                    }),
                })
                fact_count += 1

                # Edge: company -> fact
                edges.append({
                    "source": f"company_{comp['cik']}",
                    "target": fact_name,
                    "type": "reports_fact",
                    "weight": 0.9,
                })

        print(f"  Financial facts: {fact_count} entities from {facts_sample} companies")

    # Phase 4: Industry edges (same SIC code)
    print(f"\nPhase 4: Building industry edges from {len(sic_groups)} SIC codes...")
    industry_edges = 0
    for sic, members in sic_groups.items():
        # Connect all companies in the same SIC group (cap at 20 edges per group)
        for i in range(min(len(members), 20)):
            for j in range(i + 1, min(len(members), 20)):
                edges.append({
                    "source": members[i],
                    "target": members[j],
                    "type": "same_sic",
                    "weight": 0.7,
                })
                industry_edges += 1

    print(f"  Industry edges: {industry_edges}")

    # Summary
    type_counts: dict[str, int] = {}
    for e in entities:
        t = e.get("type", "unknown")
        type_counts[t] = type_counts.get(t, 0) + 1
    edge_type_counts: dict[str, int] = {}
    for e in edges:
        t = e.get("type", "unknown")
        edge_type_counts[t] = edge_type_counts.get(t, 0) + 1

    print(f"\n=== EDGAR Graph Built ===")
    print(f"  Total entities: {len(entities)}")
    for t, c in sorted(type_counts.items()):
        print(f"    {t}: {c}")
    print(f"  Total edges: {len(edges)}")
    for t, c in sorted(edge_type_counts.items()):
        print(f"    {t}: {c}")

    return entities, edges


def print_sep(title: str = "", width: int = 60):
    if title:
        padding = (width - len(title) - 2) // 2
        print(f"\n{'-' * padding} {title} {'-' * padding}")
    else:
        print("-" * width)


async def main():
    parser = argparse.ArgumentParser(description="EDGAR + BTUT Stress Test")
    parser.add_argument("--companies", type=int, default=10_000, help="Number of companies")
    parser.add_argument("--budget", type=float, default=50.0, help="GPU budget ($)")
    parser.add_argument("--skip-facts", action="store_true", help="Skip XBRL financial facts")
    parser.add_argument("--skip-filings", action="store_true", help="Skip filing metadata")
    parser.add_argument("--device", type=str, default="auto", help="Device: auto/cuda/cpu")
    args = parser.parse_args()

    print_sep("EDGAR + BTUT Stress Test")
    print(f"Target companies: {args.companies:,}")
    print(f"Budget: ${args.budget:.2f}")
    print(f"Data types: company metadata"
          + (" + filings" if not args.skip_filings else "")
          + (" + XBRL facts" if not args.skip_facts else ""))

    # Phase 1: Fetch EDGAR data
    print_sep("Fetching EDGAR Data")
    fetch_start = time.perf_counter()

    companies = fetch_company_tickers()
    if not companies:
        print("ERROR: Could not fetch company tickers from EDGAR")
        return

    entities, edges = build_entity_graph(
        companies,
        max_companies=args.companies,
        fetch_facts=not args.skip_facts,
        fetch_filings=not args.skip_filings,
    )
    fetch_time = time.perf_counter() - fetch_start
    print(f"\nEDGAR fetch completed in {fetch_time:.1f}s")

    if len(entities) < 10:
        print("ERROR: Not enough entities to run BTUT")
        return

    # Phase 2: Run BTUT
    print_sep("Running BTUT Pipeline")
    from app.services.btut import BTUTTuner, BTUTConfig

    config = BTUTConfig.auto_scale(
        entity_count=len(entities),
        budget_dollars=args.budget,
        edge_count=len(edges),
    )
    config.device = args.device

    print(f"Auto-scaled config:")
    print(f"  Cascade levels: {len(config.cascade_levels)}")
    for i, level in enumerate(config.cascade_levels):
        print(f"    Level {i}: sigma={level.sigma}, thin={level.thinning_ratio}x, max_iter={level.max_iterations}")
    print(f"  PreFilter: {'ON' if config.prefilter_enabled else 'OFF'}")
    print(f"  Target reduction: {config.total_target_reduction():.0f}x")

    def progress(info):
        step = info.get("step", "")
        if step == "btut_prefilter_done":
            print(f"  PreFilter: {info.get('original', 0):,} -> {info.get('survivors', 0):,}")
        elif step == "btut_threading_done":
            print(f"  Threading: {info.get('micro_clusters', 0)} micro-clusters "
                  f"({info.get('signal_threads', 0)} signal, {info.get('noise_threads', 0)} noise) "
                  f"-> {info.get('representatives', 0)} representatives")
        elif step == "btut_cascade" and info.get("level_complete") is not None:
            print(f"  Cascade level {info['level_complete']}: "
                  f"{info.get('input', 0):,} -> {info.get('output', 0):,} "
                  f"({info.get('cumulative_reduction', 0):.0f}x cumulative)")
        elif step == "btut_complete":
            print(f"  COMPLETE: {info.get('survivors', 0):,} survivors, "
                  f"{info.get('reduction', 0):.0f}x reduction, quality={info.get('quality', 0):.3f}")

    tuner = BTUTTuner(config)
    result = await tuner.tune(
        entities, edges, job_id="edgar_stress_test",
        progress_callback=progress,
    )

    # Results
    print_sep("Results Summary")
    print(f"  Entity reduction:  {result.original_count:>10,} -> {result.survivor_count:>10,}  ({result.total_reduction_ratio:>8.1f}x)")
    print(f"  Edge reduction:    {result.original_edge_count:>10,} -> {result.survivor_edge_count:>10,}  ({result.edge_reduction_ratio:>8.1f}x)")

    print_sep("Pre-Filter (Tier 1)")
    pf = result.prefilter_stats
    print(f"  Entropy rejected:  {pf.entropy_rejected:,}")
    print(f"  Bloom dedup:       {pf.bloom_dedup_count:,}")
    print(f"  LSH near-dedup:    {pf.lsh_near_dedup_count:,}")
    print(f"  Survivors:         {pf.survivors:,}")

    print_sep("Cascade (Tier 2)")
    for stats in result.cascade_stats:
        status = "converged" if stats.converged else f"max_iters ({stats.iterations_run})"
        print(f"  Level {stats.level} (sigma={stats.sigma:.2f}): "
              f"{stats.input_count:,} -> {stats.output_count:,} ({stats.reduction_ratio:.1f}x) "
              f"[{status}, gap={stats.final_nash_gap:.6f}] {stats.elapsed_seconds:.2f}s")

    print_sep("Quality (Tier 8)")
    q = result.quality_scores
    print(f"  Signal quality:        {q.signal_quality:.4f}")
    print(f"  Reconstruction error:  {q.reconstruction_error:.4f}  (target: < 0.15)")
    print(f"  Coverage:              {q.coverage:.4f}  (target: > 0.85)")
    print(f"  Cluster stability:     {q.cluster_stability:.4f}")
    print(f"  Downstream compat:     {q.downstream_compatibility:.4f}")
    print(f"  COMPOSITE:             {result.quality_score:.4f}")

    print_sep("Timing")
    print(f"  EDGAR fetch:   {fetch_time:.1f}s")
    print(f"  Pre-filter:    {result.prefilter_seconds:.2f}s")
    print(f"  Embedding:     {result.embedding_seconds:.2f}s")
    print(f"  Cascade:       {result.cascade_seconds:.2f}s")
    print(f"  Quality:       {result.quality_check_seconds:.2f}s")
    print(f"  BTUT TOTAL:    {result.wall_clock_seconds:.2f}s")
    print(f"  GPU cost:      ${result.gpu_cost_dollars:.4f}")

    print_sep("Magnitude Table")
    for summary in result.cluster_summaries:
        if summary.get("magnitude"):
            mag = summary["magnitude"]
            print(f"  Refinements:   {mag.get('n_refinements', 0)}")
            print(f"  Splits:        {mag.get('n_splits', 0)}")
            print(f"  Nash gap:      {mag.get('final_nash_gap', 0):.6f}")
            print(f"  Converged:     {mag.get('flash_converged', False)}")
            print(f"  Class dist:    {mag.get('class_distribution', {})}")
            bounds = mag.get("bounds", [])
            print(f"  Cluster bounds: {len(bounds)}")
            for b in bounds[:5]:
                print(f"    Cluster {b['cluster_idx']}: {b['member_count']} members, "
                      f"sharpness={b['boundary_sharpness']:.4f}")

    print_sep("Survivor Types")
    surv_types: dict[str, int] = {}
    for ent in result.survivors:
        t = ent.get("type", "unknown")
        surv_types[t] = surv_types.get(t, 0) + 1
    for t, c in sorted(surv_types.items()):
        print(f"  {t}: {c}")

    print_sep("3,000 TB Extrapolation")
    if result.survivor_count > 0:
        cost_per_entity = result.gpu_cost_dollars / max(result.original_count, 1)
        cost_3000tb = cost_per_entity * 3e9
        ratio = result.total_reduction_ratio
        print(f"  Cost per entity:     ${cost_per_entity:.10f}")
        print(f"  3B entities cost:    ${cost_3000tb:.2f}")
        print(f"  At {ratio:.0f}x reduction:  ~{3e9 / ratio:,.0f} survivors for TCD-JEPA")
        print(f"  Quality maintained:  {result.quality_score:.3f}")

    # Save full training log
    log_path = os.path.join(os.path.dirname(__file__), "edgar_btut_result.json")
    with open(log_path, "w") as f:
        json.dump(result.to_training_log_entry(), f, indent=2)
    print(f"\nFull training log saved to: {log_path}")

    print_sep()
    print("EDGAR + BTUT stress test complete.")


if __name__ == "__main__":
    asyncio.run(main())
