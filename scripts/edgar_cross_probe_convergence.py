"""Cross-probe convergence: which companies appear in multiple categorical probes?

A company flagged by ONE probe is a category-specific signal. A company
flagged across MULTIPLE probes is a multi-dimensional structural outlier —
the strongest convergent signal in the system.
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SIGNALS = REPO_ROOT / "data" / "validation" / "edgar_categorical_signals.json"


def main() -> int:
    data = json.loads(SIGNALS.read_text(encoding="utf-8"))
    # Per-company: set of probes it appears in, list of (probe, concept, score)
    company_probes: dict[str, set[str]] = defaultdict(set)
    company_hits: dict[str, list[dict]] = defaultdict(list)

    for probe_name, result in data.items():
        for hit in result.get("top_k", []):
            company = hit.get("company") or f"CIK {hit.get('cik', '?')}"
            company_probes[company].add(probe_name)
            company_hits[company].append({
                "probe": probe_name,
                "concept": hit.get("concept"),
                "score": hit.get("weighted_score"),
                "anomaly": hit.get("anomaly"),
                "industry": hit.get("industry"),
            })

    ranked = sorted(
        company_probes.items(), key=lambda kv: (-len(kv[1]), kv[0]),
    )
    multi_probe = [(c, probes) for c, probes in ranked if len(probes) >= 2]

    out_path = REPO_ROOT / "data" / "validation" / "edgar_cross_probe_convergence.json"
    out_path.write_text(
        json.dumps({
            "companies_in_multiple_probes": [
                {
                    "company": c,
                    "probe_count": len(probes),
                    "probes": sorted(probes),
                    "hits": company_hits[c],
                }
                for c, probes in multi_probe
            ],
            "total_companies_flagged": len(company_probes),
            "multi_probe_company_count": len(multi_probe),
        }, indent=2, sort_keys=True, default=str),
        encoding="utf-8",
    )

    print("=" * 78)
    print("CROSS-PROBE CONVERGENCE — companies flagged by multiple probes")
    print("=" * 78)
    print(f"\nTotal unique companies in any probe's top-10: {len(company_probes)}")
    print(f"Companies flagged by >=2 probes: {len(multi_probe)}")
    print()
    for company, probes in multi_probe[:20]:
        industry = next(
            (h.get("industry") for h in company_hits[company] if h.get("industry")),
            "",
        )
        print(f"  [{len(probes)}]  {company[:38]:<38s}  {industry[:26]:<26s}  {sorted(probes)}")
    print(f"\nReport: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
