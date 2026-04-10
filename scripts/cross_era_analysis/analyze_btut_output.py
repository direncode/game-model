"""Analyze the BTUT convergent metadata output from the cross-era corpus run.

After the production BTUT job completes, export the convergent metadata
(via the /datasets/{id}/export endpoint or direct DB query) and run this
script to check whether BTUT's multi-resolution lattice threading produces
the same physics regime separation as the keyword-based discriminator.

Specifically we check:
  1. Do surviving entities preferentially come from the surface-wave patents?
     (Tesla + Corum chunks should score high)
  2. Do the top-scoring entities cluster by physics regime?
  3. Is the cross-resolution variance pattern that flagged US1119732
     originally detectable in the individual chunks from the Tesla/Corum patents?
  4. Do WiTricity chunks show a DIFFERENT anomaly pattern than surface-wave chunks?
"""

from __future__ import annotations

import json
import statistics
from collections import Counter, defaultdict
from pathlib import Path
import sys


def analyze(convergent_path: str) -> None:
    with open(convergent_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    items = data.get("convergent_metadata", [])
    print(f"Loaded {len(items)} survivor entities from BTUT output")
    print()

    # Group survivors by physics regime (from their parent patent)
    by_regime: dict[str, list[dict]] = defaultdict(list)
    by_patent: dict[str, list[dict]] = defaultdict(list)

    for item in items:
        # Extract attributes that we stored at ingest time
        attrs = item.get("analysis", {}).get("attributes", {})
        if not isinstance(attrs, dict):
            continue
        regime = attrs.get("physics_regime", "unknown")
        parent = attrs.get("parent_patent", "unknown")
        by_regime[regime].append(item)
        by_patent[parent].append(item)

    # === Regime distribution ===
    print("=" * 80)
    print("SURVIVOR DISTRIBUTION BY PHYSICS REGIME")
    print("=" * 80)
    print(f"{'Regime':40s} {'Count':>8} {'Avg Composite':>15} {'Max Composite':>15}")
    print("-" * 80)
    for regime, survivors in sorted(by_regime.items(), key=lambda x: -len(x[1])):
        composites = [s["analysis"]["scores"]["composite"] for s in survivors]
        if composites:
            avg = statistics.mean(composites)
            mx = max(composites)
            print(f"{regime[:40]:40s} {len(survivors):>8d} {avg:>15.4f} {mx:>15.4f}")

    # === Patent distribution ===
    print()
    print("=" * 80)
    print("SURVIVOR DISTRIBUTION BY PARENT PATENT")
    print("=" * 80)
    print(f"{'Patent':35s} {'Chunks':>8} {'Avg Comp':>10} {'Max Comp':>10} {'Regime':>25}")
    print("-" * 100)
    patent_stats = []
    for patent, survivors in by_patent.items():
        if not survivors:
            continue
        composites = [s["analysis"]["scores"]["composite"] for s in survivors]
        regime = survivors[0]["analysis"].get("attributes", {}).get("physics_regime", "?")
        patent_stats.append({
            "patent": patent,
            "count": len(survivors),
            "avg_comp": statistics.mean(composites),
            "max_comp": max(composites),
            "regime": regime,
        })

    patent_stats.sort(key=lambda x: -x["avg_comp"])
    for ps in patent_stats:
        print(f"{ps['patent'][:35]:35s} {ps['count']:>8d} {ps['avg_comp']:>10.4f} {ps['max_comp']:>10.4f} {ps['regime'][:25]:>25s}")

    # === Cross-resolution variance analysis ===
    print()
    print("=" * 80)
    print("CROSS-RESOLUTION VARIANCE — looking for US1119732-style anomalies")
    print("=" * 80)

    # For each survivor, check lattice_profile for variance across resolutions
    variance_records = []
    for item in items:
        lp = item.get("analysis", {}).get("lattice_profile", {})
        if not isinstance(lp, dict):
            continue
        coarse = lp.get("coarse_resolution", {})
        medium = lp.get("medium_resolution", {})
        fine = lp.get("fine_resolution", {})

        def get_flip_rate(resolution_data):
            if isinstance(resolution_data, dict):
                return resolution_data.get("flip_rate", 1.0)
            return 1.0

        c_rate = get_flip_rate(coarse)
        m_rate = get_flip_rate(medium)
        f_rate = get_flip_rate(fine)

        rates = [c_rate, m_rate, f_rate]
        if len(rates) >= 2:
            variance = statistics.variance(rates)
        else:
            variance = 0.0

        attrs = item.get("analysis", {}).get("attributes", {})
        if not isinstance(attrs, dict):
            attrs = {}

        variance_records.append({
            "entity": item.get("entity_key", "?"),
            "parent_patent": attrs.get("parent_patent", "?"),
            "regime": attrs.get("physics_regime", "?"),
            "coarse": c_rate,
            "medium": m_rate,
            "fine": f_rate,
            "variance": variance,
            "composite": item["analysis"]["scores"]["composite"],
        })

    # Sort by variance and show top entities
    variance_records.sort(key=lambda x: -x["variance"])
    print("Top 20 entities by cross-resolution variance (BTUT's signature of interest):")
    print(f"{'Entity':40s} {'Regime':>22} {'Coarse':>8} {'Medium':>8} {'Fine':>8} {'Var':>10} {'Comp':>8}")
    print("-" * 115)
    for r in variance_records[:20]:
        print(f"{r['entity'][:40]:40s} {r['regime'][:22]:>22} "
              f"{r['coarse']:>8.4f} {r['medium']:>8.4f} {r['fine']:>8.4f} "
              f"{r['variance']:>10.6f} {r['composite']:>8.4f}")

    # Count high-variance entities by regime
    high_var_threshold = 0.001
    high_var_by_regime = Counter()
    for r in variance_records:
        if r["variance"] > high_var_threshold:
            high_var_by_regime[r["regime"]] += 1

    print()
    print(f"High-variance entities (var > {high_var_threshold}) by regime:")
    for regime, count in high_var_by_regime.most_common():
        total_in_regime = sum(1 for r in variance_records if r["regime"] == regime)
        pct = (count / total_in_regime * 100) if total_in_regime > 0 else 0
        print(f"  {regime}: {count}/{total_in_regime} ({pct:.1f}%)")

    # === Cross-era cluster check ===
    print()
    print("=" * 80)
    print("CROSS-ERA CHECK — which Tesla patents cluster with modern Corum patents?")
    print("=" * 80)

    tesla_sw_chunks = [item for item in items
                       if item.get("analysis", {}).get("attributes", {}).get("physics_regime") == "tesla_surface_wave"]
    corum_sw_chunks = [item for item in items
                       if item.get("analysis", {}).get("attributes", {}).get("physics_regime") == "modern_surface_wave"]
    witricity_chunks = [item for item in items
                        if item.get("analysis", {}).get("attributes", {}).get("physics_regime") == "inductive_non_radiative"]
    radio_chunks = [item for item in items
                    if item.get("analysis", {}).get("attributes", {}).get("physics_regime") == "radiative_radio"]

    print(f"Tesla surface-wave survivors:       {len(tesla_sw_chunks)}")
    print(f"Modern Corum surface-wave survivors: {len(corum_sw_chunks)}")
    print(f"WiTricity inductive survivors:      {len(witricity_chunks)}")
    print(f"Radio radiative survivors:          {len(radio_chunks)}")

    # If BTUT is detecting physics regime through lattice fingerprints,
    # chunks from the same regime should share fingerprint clusters
    def fingerprint_overlap(chunks_a, chunks_b):
        """Check how many fingerprints overlap between two chunk groups."""
        fps_a = set()
        fps_b = set()
        for item in chunks_a:
            lp = item.get("analysis", {}).get("lattice_profile", {})
            if isinstance(lp, dict):
                fp = lp.get("fingerprint_48bit", "")
                if fp:
                    fps_a.add(fp)
        for item in chunks_b:
            lp = item.get("analysis", {}).get("lattice_profile", {})
            if isinstance(lp, dict):
                fp = lp.get("fingerprint_48bit", "")
                if fp:
                    fps_b.add(fp)
        overlap = fps_a & fps_b
        return len(fps_a), len(fps_b), len(overlap)

    comparisons = [
        ("Tesla SW", tesla_sw_chunks, "Corum SW", corum_sw_chunks),
        ("Tesla SW", tesla_sw_chunks, "WiTricity IND", witricity_chunks),
        ("Tesla SW", tesla_sw_chunks, "Radio RAD", radio_chunks),
        ("Corum SW", corum_sw_chunks, "WiTricity IND", witricity_chunks),
        ("Corum SW", corum_sw_chunks, "Radio RAD", radio_chunks),
        ("WiTricity IND", witricity_chunks, "Radio RAD", radio_chunks),
    ]

    print()
    print("Fingerprint overlap between regime pairs:")
    print(f"{'Comparison':>30s}   unique_A  unique_B  overlap  overlap_pct")
    for name_a, chunks_a, name_b, chunks_b in comparisons:
        a_n, b_n, ov = fingerprint_overlap(chunks_a, chunks_b)
        total_unique = len((set() if not chunks_a else
                            {item.get("analysis", {}).get("lattice_profile", {}).get("fingerprint_48bit", "")
                             for item in chunks_a}) |
                           (set() if not chunks_b else
                            {item.get("analysis", {}).get("lattice_profile", {}).get("fingerprint_48bit", "")
                             for item in chunks_b}))
        pct = (ov / max(total_unique, 1)) * 100
        print(f"  {name_a:>12} vs {name_b:<15}   {a_n:>8}  {b_n:>8}  {ov:>7}  {pct:>10.1f}%")

    # Save detailed report
    report = {
        "regime_distribution": {
            regime: {
                "count": len(survivors),
                "avg_composite": statistics.mean([s["analysis"]["scores"]["composite"] for s in survivors]),
                "max_composite": max([s["analysis"]["scores"]["composite"] for s in survivors]),
            }
            for regime, survivors in by_regime.items() if survivors
        },
        "patent_stats": patent_stats,
        "top_20_by_variance": variance_records[:20],
        "high_variance_by_regime": dict(high_var_by_regime),
    }

    out_path = Path(__file__).parent / "output" / "btut_analysis_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print()
    print(f"Full report saved to: {out_path}")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else str(
        Path(__file__).parent / "output" / "btut_convergent_output.json"
    )
    analyze(path)
