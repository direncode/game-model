"""Analyze the polymath BTUT run for per-figure anomalies and cross-era matches.

This is the make-or-break analysis. For each polymath we're looking for:
  1. Documents from their forgotten paradigm flagged with high composite scores
  2. Cross-era fingerprint sharing with modern descendants
  3. BTUT cluster coherence per regime
  4. Top-K anomalies that are canonical regime markers (zero-shot regime detection)
"""

import json
import statistics
from collections import Counter, defaultdict
from pathlib import Path

OUT = Path(__file__).parent / "output"


def main() -> None:
    with open(OUT / "polymath_btut_result.json", "r") as f:
        data = json.load(f)

    summary = data["summary"]
    survivors = data["survivors"]

    print("=" * 100)
    print("POLYMATH BTUT RESULTS — Newton, Von Neumann, Leonardo")
    print("=" * 100)
    print()
    print(f"Input entities:                {summary['total_entities']}")
    print(f"BTUT clusters:                 {summary['clusters']}")
    print(f"Unique 48-bit fingerprints:    {summary['unique_48bit_fingerprints']}")
    print(f"Survivors:                     {summary['survivors']} ({summary['reduction']}x reduction)")
    print()

    # Group survivors
    by_regime = defaultdict(list)
    by_patent = defaultdict(list)
    by_cluster = defaultdict(list)
    by_fingerprint = defaultdict(list)
    by_figure = defaultdict(list)

    for s in survivors:
        attrs = s["entity"]["attributes"]
        regime = attrs.get("physics_regime", "?")
        parent = attrs.get("parent_patent", attrs.get("name", "?"))
        by_regime[regime].append(s)
        by_patent[parent].append(s)
        by_cluster[s["cluster"]].append(s)
        by_fingerprint[s["fingerprint_48bit"]].append(s)

        # Map to polymath figure
        if regime.startswith("newton_"):
            figure = "newton"
        elif regime.startswith("vn_"):
            figure = "vonneumann"
        elif regime.startswith("leonardo_"):
            figure = "leonardo"
        elif regime.startswith("modern_"):
            figure = "modern_descendant"
        else:
            figure = "other"
        by_figure[figure].append(s)

    # === Original corpus counts per regime ===
    with open(OUT / "polymath_corpus.json", "r") as f:
        corpus = json.load(f)
    original_by_regime = Counter(e["attributes"].get("physics_regime", "?") for e in corpus["entities"])

    # === Regime survival ===
    print("=" * 100)
    print("REGIME SURVIVAL (heterogeneous polymath corpus)")
    print("=" * 100)
    print()
    baseline = sum(len(v) for v in by_regime.values()) / len(corpus["entities"])
    print(f"Baseline survival: {baseline*100:.1f}%")
    print()
    print(f"{'Regime':35s} {'Orig':>7} {'Surv':>7} {'Rate':>8} {'vs Base':>10}")
    print("-" * 80)
    for regime, surv in sorted(by_regime.items(), key=lambda x: -len(x[1])):
        orig = original_by_regime.get(regime, 0)
        n = len(surv)
        rate = n / max(orig, 1)
        enrich = rate / baseline
        marker = " ENRICHED" if enrich > 1.15 else (" depleted" if enrich < 0.85 else "")
        print(f"{regime[:35]:35s} {orig:>7} {n:>7} {rate*100:>7.1f}% {enrich:>9.2f}x{marker}")

    # === Per-figure anomaly analysis ===
    print()
    print("=" * 100)
    print("PER-FIGURE ANOMALY ANALYSIS — top 15 highest composite per polymath")
    print("=" * 100)
    for figure_key, figure_label in [
        ("newton", "ISAAC NEWTON"),
        ("vonneumann", "JOHN VON NEUMANN"),
        ("leonardo", "LEONARDO DA VINCI"),
    ]:
        print()
        print(f"=== {figure_label} ===")
        figure_survivors = by_figure.get(figure_key, [])
        figure_top = sorted(figure_survivors, key=lambda s: -s["scores"]["composite"])[:15]
        print(f"Total survivors for {figure_label}: {len(figure_survivors)}")
        print()
        for s in figure_top:
            attrs = s["entity"]["attributes"]
            name = s["entity"]["name"]
            etype = s["entity"]["type"]
            regime = attrs.get("physics_regime", "?")
            comp = s["scores"]["composite"]
            anom = s["scores"]["anomaly"]
            div = s["scores"]["diversity"]
            print(f"  [{etype:>13}] {name[:45]:45s} regime={regime[:25]:25s} comp={comp:.4f} anom={anom:.4f} div={div:.4f}")

    # === Cross-era fingerprint sharing ===
    print()
    print("=" * 100)
    print("CROSS-ERA FINGERPRINT SHARING — polymath paradigm vs modern descendant")
    print("=" * 100)
    print()

    def fps_for_regime(regime):
        return set(s["fingerprint_48bit"] for s in by_regime.get(regime, []))

    cross_era_pairs = [
        ("newton_alchemy", "modern_materials", "Newton alchemy -> modern materials"),
        ("newton_mechanics", "modern_aerodynamics", "Newton mechanics -> modern aero (should be partial)"),
        ("newton_optics", "modern_aerodynamics", "Newton optics vs modern aero (should be low)"),
        ("vn_cellular_automata", "modern_complexity", "VN cellular automata -> modern complexity"),
        ("vn_computing", "modern_complexity", "VN computing vs modern complexity (partial)"),
        ("vn_quantum", "modern_materials", "VN quantum vs modern materials (should be low)"),
        ("leonardo_flight", "modern_aerodynamics", "Leonardo flight -> modern aero"),
        ("leonardo_fluids", "modern_aerodynamics", "Leonardo fluids -> modern aero"),
        ("leonardo_anatomy", "modern_complexity", "Leonardo anatomy vs modern complexity (should be low)"),
        # Negative controls - cross-figure paradigms (should be distant)
        ("newton_alchemy", "modern_aerodynamics", "[NEG] Newton alchemy vs modern aero"),
        ("vn_cellular_automata", "modern_materials", "[NEG] VN CA vs modern materials"),
        ("leonardo_flight", "modern_complexity", "[NEG] Leonardo flight vs modern complexity"),
        # Within-figure: forgotten paradigm vs mainstream (should be distant)
        ("newton_alchemy", "newton_mechanics", "[CTRL] Newton alchemy vs mechanics"),
        ("newton_alchemy", "newton_theology_control", "[CTRL] Newton alchemy vs theology"),
    ]

    print(f"{'Pair':55s} {'A_fps':>6} {'B_fps':>6} {'Shared':>7} {'Pct':>7}")
    print("-" * 90)
    for regime_a, regime_b, label in cross_era_pairs:
        fps_a = fps_for_regime(regime_a)
        fps_b = fps_for_regime(regime_b)
        shared = fps_a & fps_b
        union_size = len(fps_a | fps_b)
        pct = (len(shared) / max(union_size, 1)) * 100
        print(f"{label[:55]:55s} {len(fps_a):>6} {len(fps_b):>6} {len(shared):>7} {pct:>6.0f}%")

    # === Cluster composition for forgotten paradigm clusters ===
    print()
    print("=" * 100)
    print("CLUSTERS CONTAINING FORGOTTEN PARADIGM ENTITIES")
    print("=" * 100)
    print()

    target_regimes = ["newton_alchemy", "vn_cellular_automata", "leonardo_flight", "leonardo_fluids"]

    for target in target_regimes:
        print(f"=== Clusters containing {target} ===")
        # Find clusters with entities from this regime
        cluster_counts = Counter()
        for s in by_regime.get(target, []):
            cluster_counts[s["cluster"]] += 1

        for cluster_id, count in cluster_counts.most_common(5):
            members = by_cluster[cluster_id]
            regime_breakdown = Counter(m["entity"]["attributes"].get("physics_regime", "?") for m in members)
            type_breakdown = Counter(m["entity"]["type"] for m in members)
            print(f"  Cluster {cluster_id:3d} ({len(members):3d} members, {count} from {target}):")
            print(f"    Top regimes: {dict(regime_breakdown.most_common(4))}")
            print(f"    Types: {dict(type_breakdown)}")
        print()

    # === Top 25 overall anomalies ===
    print()
    print("=" * 100)
    print("TOP 25 OVERALL BTUT ANOMALIES (zero-shot regime markers)")
    print("=" * 100)
    print()
    top25 = sorted(survivors, key=lambda s: -s["scores"]["composite"])[:25]
    print(f"{'Entity':55s} {'Type':>12} {'Regime':>22} {'Comp':>7}")
    print("-" * 105)
    for s in top25:
        attrs = s["entity"]["attributes"]
        name = s["entity"]["name"]
        etype = s["entity"]["type"]
        regime = attrs.get("physics_regime", "?")[:22]
        comp = s["scores"]["composite"]
        print(f"{name[:55]:55s} {etype[:12]:>12} {regime:>22} {comp:>7.4f}")

    # Save report
    report = {
        "summary": summary,
        "regime_survival": {
            r: {"original": original_by_regime.get(r, 0), "survivors": len(s),
                "rate": len(s)/max(original_by_regime.get(r,1),1),
                "enrichment": (len(s)/max(original_by_regime.get(r,1),1))/baseline}
            for r, s in by_regime.items()
        },
        "top_25_overall": [
            {
                "name": s["entity"]["name"],
                "type": s["entity"]["type"],
                "regime": s["entity"]["attributes"].get("physics_regime"),
                "composite": s["scores"]["composite"],
                "anomaly": s["scores"]["anomaly"],
                "diversity": s["scores"]["diversity"],
                "fingerprint": s["fingerprint_48bit"],
                "cluster": s["cluster"],
            }
            for s in top25
        ],
        "per_figure_top_15": {
            figure: [
                {
                    "name": s["entity"]["name"],
                    "type": s["entity"]["type"],
                    "regime": s["entity"]["attributes"].get("physics_regime"),
                    "composite": s["scores"]["composite"],
                    "anomaly": s["scores"]["anomaly"],
                    "diversity": s["scores"]["diversity"],
                    "fingerprint": s["fingerprint_48bit"],
                }
                for s in sorted(by_figure[figure], key=lambda x: -x["scores"]["composite"])[:15]
            ]
            for figure in ["newton", "vonneumann", "leonardo"]
        },
    }

    with open(OUT / "polymath_btut_analysis.json", "w") as f:
        json.dump(report, f, indent=2)
    print()
    print(f"Report saved to {OUT / 'polymath_btut_analysis.json'}")


if __name__ == "__main__":
    main()
