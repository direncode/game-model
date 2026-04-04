#!/usr/bin/env python3
"""Deep EDGAR Pull — maximize real entity extraction from all 10,426 companies.

Strategy:
  - All 10,426 companies as base entities
  - Fetch submissions for ALL companies (filing metadata) — ~17 min at 10 req/sec
  - Up to 20 filings per company (not just 5) = ~200K filing entities
  - Fetch ALL XBRL concepts per company (not just 8) = ~50K+ fact entities
  - Cross-reference edges: same_sic, temporal, co-filing, shared_concept
  - Target: 50-100K+ real entities from 100% real EDGAR data

Then runs BTUT on the full dataset.

Usage:
    python -u scripts/edgar_deep_pull.py
    python -u scripts/edgar_deep_pull.py --max-companies 5000 --filings-per-company 10
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

BACKEND_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend")
sys.path.insert(0, BACKEND_PATH)

USER_AGENT = "Diren Kumaratilleke direnavk@outlook.com"
EDGAR_BASE = "https://data.sec.gov"
REQUEST_DELAY = 0.105  # Just under 10 req/sec


class EdgarThrottler:
    """Thread-safe rate limiter for EDGAR API."""

    def __init__(self, delay: float = REQUEST_DELAY):
        self._delay = delay
        self._last_request = 0.0
        import threading
        self._lock = threading.Lock()
        self._request_count = 0
        self._error_count = 0

    def get(self, url: str) -> dict | list | None:
        with self._lock:
            elapsed = time.time() - self._last_request
            if elapsed < self._delay:
                time.sleep(self._delay - elapsed)
            self._last_request = time.time()
            self._request_count += 1

        req = Request(url, headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        })
        try:
            with urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception:
            self._error_count += 1
            return None

    @property
    def stats(self) -> str:
        return f"{self._request_count} requests, {self._error_count} errors"


def fetch_all_tickers(throttler: EdgarThrottler) -> list[dict]:
    print("Fetching company tickers...")
    data = throttler.get("https://www.sec.gov/files/company_tickers.json")
    if not data:
        return []
    companies = []
    for key, entry in data.items():
        companies.append({
            "cik": str(entry.get("cik_str", "")),
            "ticker": entry.get("ticker", ""),
            "name": entry.get("title", ""),
        })
    print(f"  {len(companies)} companies found")
    return companies


def process_company(
    comp: dict,
    throttler: EdgarThrottler,
    filings_per_company: int,
    fetch_facts: bool,
) -> tuple[list[dict], list[dict], str]:
    """Fetch submissions + facts for one company. Returns (entities, edges, sic)."""
    entities = []
    edges = []
    cik = comp["cik"]
    padded = cik.zfill(10)
    company_name = f"company_{cik}"
    sic = ""

    # Fetch submissions
    submissions = throttler.get(f"{EDGAR_BASE}/submissions/CIK{padded}.json")
    if submissions:
        sic = submissions.get("sic", "")

        # Update company attributes
        comp["sic"] = sic
        comp["sic_description"] = submissions.get("sicDescription", "")
        comp["state"] = submissions.get("stateOfIncorporation", "")
        comp["fiscal_year_end"] = submissions.get("fiscalYearEnd", "")
        comp["exchanges"] = submissions.get("exchanges", [])
        comp["category"] = submissions.get("category", "")
        comp["entity_type"] = submissions.get("entityType", "")

        # Extract filings
        recent = submissions.get("filings", {}).get("recent", {})
        accessions = recent.get("accessionNumber", [])[:filings_per_company]
        forms = recent.get("form", [])[:filings_per_company]
        dates = recent.get("filingDate", [])[:filings_per_company]
        descriptions = recent.get("primaryDocDescription", [])[:filings_per_company]
        sizes = recent.get("size", [])[:filings_per_company]

        prev_filing = None
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
                    "size": sizes[j] if j < len(sizes) else 0,
                    "company_cik": cik,
                    "company_name": comp["name"],
                }),
            })

            edges.append({
                "source": filing_name,
                "target": company_name,
                "type": "filed_by",
                "weight": 1.0,
            })

            if prev_filing:
                edges.append({
                    "source": prev_filing,
                    "target": filing_name,
                    "type": "temporal_neighbor",
                    "weight": 0.8,
                })
            prev_filing = filing_name

    # Fetch XBRL facts (all concepts, not just 8)
    if fetch_facts:
        facts = throttler.get(f"{EDGAR_BASE}/api/xbrl/companyfacts/CIK{padded}.json")
        if facts:
            us_gaap = facts.get("facts", {}).get("us-gaap", {})

            for concept, concept_data in list(us_gaap.items())[:30]:  # Cap at 30 concepts
                units = concept_data.get("units", {})
                usd_values = units.get("USD", [])

                if not usd_values:
                    continue

                latest = usd_values[-1]
                val = latest.get("val")
                if val is None:
                    continue

                fact_name = f"fact_{cik}_{concept}"
                entities.append({
                    "name": fact_name,
                    "type": "financial_fact",
                    "attributes": json.dumps({
                        "concept": concept,
                        "value": val,
                        "unit": "USD",
                        "period_end": latest.get("end", ""),
                        "form": latest.get("form", ""),
                        "company_cik": cik,
                        "filed": latest.get("filed", ""),
                        "label": concept_data.get("label", concept),
                    }),
                })

                edges.append({
                    "source": company_name,
                    "target": fact_name,
                    "type": "reports_fact",
                    "weight": 0.9,
                })

    return entities, edges, sic


def print_sep(title: str = "", width: int = 65):
    if title:
        padding = (width - len(title) - 2) // 2
        print(f"\n{'-' * padding} {title} {'-' * padding}")
    else:
        print("-" * width)


async def main():
    parser = argparse.ArgumentParser(description="Deep EDGAR Pull + BTUT")
    parser.add_argument("--max-companies", type=int, default=10426, help="Max companies to process")
    parser.add_argument("--filings-per-company", type=int, default=20, help="Max filings per company")
    parser.add_argument("--skip-facts", action="store_true", help="Skip XBRL financial facts")
    parser.add_argument("--budget", type=float, default=50.0, help="BTUT budget ($)")
    parser.add_argument("--device", type=str, default="auto", help="Device")
    args = parser.parse_args()

    print_sep("Deep EDGAR Pull + BTUT Stress Test")
    print(f"Max companies: {args.max_companies:,}")
    print(f"Filings/company: {args.filings_per_company}")
    print(f"XBRL facts: {'ON' if not args.skip_facts else 'OFF'}")
    print(f"Budget: ${args.budget:.2f}")

    throttler = EdgarThrottler()

    # Phase 1: Get all tickers
    companies = fetch_all_tickers(throttler)
    if not companies:
        print("ERROR: Could not fetch tickers")
        return

    selected = companies[:args.max_companies]
    total = len(selected)

    # Phase 2: Build company entities
    print(f"\nPhase 1: {total:,} company entities (instant)")
    all_entities = []
    for comp in selected:
        all_entities.append({
            "name": f"company_{comp['cik']}",
            "type": "company",
            "attributes": json.dumps({
                "cik": comp["cik"],
                "ticker": comp["ticker"],
                "company_name": comp["name"],
            }),
        })

    # Phase 3: Sequential company processing (rate-limited)
    # We need both submissions (filings) AND facts — that's 2 requests per company
    # For facts-enabled companies: ~2 req/company = 5 companies/sec
    # For facts-disabled: ~1 req/company = 10 companies/sec
    requests_per_company = 2 if not args.skip_facts else 1
    est_time = total * requests_per_company * REQUEST_DELAY
    print(f"\nPhase 2: Fetching data for {total:,} companies")
    print(f"  Estimated time: {est_time / 60:.0f} minutes ({requests_per_company} req/company at 10 req/sec)")
    print(f"  This is real-time EDGAR API — no shortcuts.\n")

    all_edges = []
    sic_groups: dict[str, list[str]] = {}
    filing_count = 0
    fact_count = 0
    start_time = time.time()
    last_log = 0

    for i, comp in enumerate(selected):
        entities, edges, sic = process_company(
            comp, throttler, args.filings_per_company, not args.skip_facts,
        )

        all_entities.extend(entities)
        all_edges.extend(edges)

        if sic:
            sic_groups.setdefault(sic, []).append(f"company_{comp['cik']}")

        filing_count += sum(1 for e in entities if e.get("type") == "filing")
        fact_count += sum(1 for e in entities if e.get("type") == "financial_fact")

        # Progress every 100 companies or every 15 seconds
        elapsed = time.time() - start_time
        if i % 100 == 0 or elapsed - last_log > 15:
            rate = (i + 1) / max(elapsed, 0.1)
            remaining = (total - i - 1) / max(rate, 0.01)
            print(
                f"  [{i+1:>6,}/{total:,}] "
                f"{len(all_entities):>8,} entities, "
                f"{len(all_edges):>8,} edges, "
                f"{filing_count:>6,} filings, "
                f"{fact_count:>6,} facts | "
                f"{rate:.1f} co/sec | "
                f"~{remaining/60:.0f}m left | "
                f"API: {throttler.stats}"
            )
            last_log = elapsed

    fetch_time = time.time() - start_time

    # Phase 4: Industry edges
    print(f"\nPhase 3: Building industry edges from {len(sic_groups)} SIC codes...")
    industry_edges = 0
    for sic, members in sic_groups.items():
        for i in range(min(len(members), 30)):
            for j in range(i + 1, min(len(members), 30)):
                all_edges.append({
                    "source": members[i],
                    "target": members[j],
                    "type": "same_sic",
                    "weight": 0.7,
                })
                industry_edges += 1

    # Concept co-occurrence edges (companies reporting same XBRL concept)
    concept_groups: dict[str, list[str]] = {}
    for ent in all_entities:
        if ent.get("type") == "financial_fact":
            attrs = json.loads(ent.get("attributes", "{}"))
            concept = attrs.get("concept", "")
            cik = attrs.get("company_cik", "")
            if concept and cik:
                concept_groups.setdefault(concept, []).append(f"company_{cik}")

    concept_edges = 0
    for concept, members in concept_groups.items():
        unique = list(set(members))
        for i in range(min(len(unique), 20)):
            for j in range(i + 1, min(len(unique), 20)):
                all_edges.append({
                    "source": unique[i],
                    "target": unique[j],
                    "type": "shared_concept",
                    "weight": 0.5,
                })
                concept_edges += 1

    # Summary
    type_counts: dict[str, int] = {}
    for e in all_entities:
        t = e.get("type", "unknown")
        type_counts[t] = type_counts.get(t, 0) + 1
    edge_type_counts: dict[str, int] = {}
    for e in all_edges:
        t = e.get("type", "unknown")
        edge_type_counts[t] = edge_type_counts.get(t, 0) + 1

    print_sep("EDGAR Graph Complete")
    print(f"  Total entities: {len(all_entities):,}")
    for t, c in sorted(type_counts.items()):
        print(f"    {t}: {c:,}")
    print(f"  Total edges: {len(all_edges):,}")
    for t, c in sorted(edge_type_counts.items()):
        print(f"    {t}: {c:,}")
    print(f"  SIC codes: {len(sic_groups)}")
    print(f"  XBRL concepts: {len(concept_groups)}")
    print(f"  Fetch time: {fetch_time:.0f}s ({fetch_time/60:.1f} min)")
    print(f"  API stats: {throttler.stats}")

    # Phase 5: Run BTUT
    print_sep("Running BTUT on Real EDGAR Data")
    from app.services.btut import BTUTTuner, BTUTConfig

    config = BTUTConfig.auto_scale(
        entity_count=len(all_entities),
        budget_dollars=args.budget,
        edge_count=len(all_edges),
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
            print(f"  Threading: {info.get('micro_clusters', 0)} clusters "
                  f"({info.get('signal_threads', 0)} signal) "
                  f"-> {info.get('representatives', 0):,} reps")
        elif step == "btut_cascade" and info.get("level_complete") is not None:
            print(f"  Cascade L{info['level_complete']}: "
                  f"{info.get('input', 0):,} -> {info.get('output', 0):,} "
                  f"({info.get('cumulative_reduction', 0):.0f}x)")
        elif step == "btut_complete":
            print(f"  DONE: {info.get('survivors', 0):,} survivors, "
                  f"{info.get('reduction', 0):.0f}x, quality={info.get('quality', 0):.3f}")

    tuner = BTUTTuner(config)
    result = await tuner.tune(
        all_entities, all_edges, job_id="edgar_deep",
        progress_callback=progress,
    )

    # Results
    print_sep("BTUT Results")
    print(f"  Entities:  {result.original_count:>10,} -> {result.survivor_count:>10,}  ({result.total_reduction_ratio:>8.1f}x)")
    print(f"  Edges:     {result.original_edge_count:>10,} -> {result.survivor_edge_count:>10,}  ({result.edge_reduction_ratio:>8.1f}x)")

    print(f"\n  Pre-filter:")
    pf = result.prefilter_stats
    print(f"    Entropy rejected:  {pf.entropy_rejected:,}")
    print(f"    Bloom dedup:       {pf.bloom_dedup_count:,}")
    print(f"    Survivors:         {pf.survivors:,}")

    print(f"\n  Cascade:")
    for s in result.cascade_stats:
        print(f"    L{s.level} (s={s.sigma:.1f}): {s.input_count:,} -> {s.output_count:,} ({s.reduction_ratio:.0f}x) {s.elapsed_seconds:.1f}s")

    print(f"\n  Quality:")
    q = result.quality_scores
    print(f"    Signal:      {q.signal_quality:.4f}")
    print(f"    Recon error: {q.reconstruction_error:.4f}")
    print(f"    Coverage:    {q.coverage:.4f}")
    print(f"    Composite:   {result.quality_score:.4f}")

    print(f"\n  Magnitude:")
    for s in result.cluster_summaries:
        if s.get("magnitude"):
            m = s["magnitude"]
            print(f"    Classes:     {m.get('class_distribution', {})}")
            print(f"    Splits:      {m.get('n_splits', 0)}")
            print(f"    Bounds:      {m.get('n_bounds', 0)}")

    print(f"\n  Timing:")
    print(f"    EDGAR fetch: {fetch_time:.0f}s")
    print(f"    BTUT total:  {result.wall_clock_seconds:.1f}s")
    print(f"    GPU cost:    ${result.gpu_cost_dollars:.4f}")

    print(f"\n  Survivors by type:")
    surv_types: dict[str, int] = {}
    for ent in result.survivors:
        t = ent.get("type", "unknown")
        surv_types[t] = surv_types.get(t, 0) + 1
    for t, c in sorted(surv_types.items()):
        print(f"    {t}: {c}")

    print_sep("3,000 TB Extrapolation")
    cost_per = result.gpu_cost_dollars / max(result.original_count, 1)
    cost_3tb = cost_per * 3e9
    print(f"  At {result.total_reduction_ratio:.0f}x: ~{3e9/result.total_reduction_ratio:,.0f} survivors")
    print(f"  Estimated cost: ${cost_3tb:.2f}")

    # Save
    log_path = os.path.join(os.path.dirname(__file__), "edgar_deep_result.json")
    with open(log_path, "w") as f:
        json.dump({
            "graph": {"entities": len(all_entities), "edges": len(all_edges), "types": type_counts},
            "btut": result.to_training_log_entry(),
        }, f, indent=2)
    print(f"\nSaved to: {log_path}")
    print_sep()


if __name__ == "__main__":
    asyncio.run(main())
