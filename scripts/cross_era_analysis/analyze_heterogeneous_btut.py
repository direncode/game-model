"""Analyze the heterogeneous BTUT run for paradigm-shifting validation.

This is the make-or-break analysis. The questions:
  1. Does BTUT find higher-confidence regime separation with heterogeneous types?
  2. Do cross-era patents share lattice fingerprints?
  3. Do BTUT's anomaly scores agree with the keyword discriminator's classifications?
  4. Are persons/writings/events/concepts pulled into clusters with their patents?
"""

import json
import statistics
from collections import Counter, defaultdict
from pathlib import Path

OUT = Path(__file__).parent / "output"


def main() -> None:
    with open(OUT / "heterogeneous_btut_result.json", "r") as f:
        data = json.load(f)

    summary = data["summary"]
    survivors = data["survivors"]

    print("=" * 100)
    print("HETEROGENEOUS BTUT RESULTS — 1851 entities, 6 entity types, 11 physics regimes")
    print("=" * 100)
    print()
    print(f"Input entities:                {summary['total_entities']}")
    print(f"BTUT clusters:                 {summary['clusters']}")
    print(f"Unique 48-bit fingerprints:    {summary['unique_48bit_fingerprints']}")
    print(f"Survivors:                     {summary['survivors']} ({summary['reduction']}x reduction)")
    print()

    # Survivor type breakdown
    print("Survivor types:")
    for t, c in sorted(summary['survivor_types'].items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}")
    print()

    # === Regime survival ===
    by_regime = defaultdict(list)
    by_patent = defaultdict(list)
    by_cluster = defaultdict(list)
    by_fingerprint = defaultdict(list)

    for s in survivors:
        attrs = s["entity"]["attributes"]
        regime = attrs.get("physics_regime", "?")
        parent = attrs.get("parent_patent", attrs.get("name", "?"))
        by_regime[regime].append(s)
        by_patent[parent].append(s)
        by_cluster[s["cluster"]].append(s)
        by_fingerprint[s["fingerprint_48bit"]].append(s)

    # Original counts from corpus
    with open(OUT / "heterogeneous_corpus.json", "r") as f:
        corpus = json.load(f)
    original_by_regime = Counter(e["attributes"].get("physics_regime", "?") for e in corpus["entities"])

    print("=" * 100)
    print("REGIME SURVIVAL (heterogeneous corpus)")
    print("=" * 100)
    print()
    baseline = sum(len(v) for v in by_regime.values()) / len(corpus["entities"])
    print(f"Baseline survival: {baseline*100:.1f}%")
    print()
    print(f"{'Regime':35s} {'Original':>10} {'Surv':>8} {'Rate':>8} {'Vs Base':>10}")
    print("-" * 80)
    for regime, surv in sorted(by_regime.items(), key=lambda x: -len(x[1])):
        orig = original_by_regime.get(regime, 0)
        n = len(surv)
        rate = n / max(orig, 1)
        enrich = rate / baseline
        marker = " ENRICHED" if enrich > 1.15 else (" depleted" if enrich < 0.85 else "")
        print(f"{regime[:35]:35s} {orig:>10} {n:>8} {rate*100:>7.1f}% {enrich:>9.2f}x{marker}")

    # === Cross-type cluster analysis ===
    print()
    print("=" * 100)
    print("CLUSTERS WITH CROSS-TYPE MEMBERSHIP (the BTUT signature of structural coherence)")
    print("=" * 100)
    print()

    sorted_clusters = sorted(by_cluster.items(), key=lambda x: -len(x[1]))
    for cluster_id, members in sorted_clusters[:15]:
        type_counts = Counter(m["entity"]["type"] for m in members)
        regime_counts = Counter(m["entity"]["attributes"].get("physics_regime", "?") for m in members)
        types_str = ", ".join(f"{t}={c}" for t, c in type_counts.most_common())
        regimes_str = ", ".join(f"{r[:15]}={c}" for r, c in regime_counts.most_common(3))
        print(f"  Cluster {cluster_id:3d} ({len(members):3d}m): types=[{types_str}]")
        print(f"             regimes: {regimes_str}")

    # === Cross-era fingerprint sharing (heterogeneous) ===
    print()
    print("=" * 100)
    print("CROSS-ERA FINGERPRINT SHARING (heterogeneous corpus)")
    print("=" * 100)
    print()

    # Build patent->fingerprints map (using parent_patent)
    patent_fps = defaultdict(set)
    patent_clusters = defaultdict(Counter)
    for s in survivors:
        attrs = s["entity"]["attributes"]
        parent = attrs.get("parent_patent")
        if parent:
            patent_fps[parent].add(s["fingerprint_48bit"])
            patent_clusters[parent][s["cluster"]] += 1

    cross_era_pairs = [
        ("tesla_US1119732", "corum_US10084223", "Tesla 1902 -> Corum 2018", "surface wave"),
        ("tesla_US649621", "corum_US9923385", "Tesla 1900 -> Corum 2015", "surface wave"),
        ("tesla_US645576", "corum_US9910144", "Tesla 1897 -> Corum 2018", "surface wave"),
        ("tesla_US649621", "corum_US9912031", "Tesla 1900 -> Corum 2013", "surface wave"),
        ("crypto_NTRU_US6298137", "crypto_modern_PQ_US10097351", "NTRU 2001 -> Isara 2018", "lattice"),
        ("info_SHANNON1948", "info_HUFFMAN1952", "Shannon 1948 -> Huffman 1952", "entropy"),
        ("info_JPEG1992", "info_HEVC2013", "JPEG 1992 -> HEVC 2013", "transform"),
        ("tesla_US1119732", "marconi_US586193", "[NEG] Tesla vs Marconi", "diff regime"),
        ("tesla_US1119732", "witricity_US7741734", "[NEG] Tesla vs WiTricity", "diff regime"),
        ("crypto_NTRU_US6298137", "crypto_RSA_US4405829", "[NEG] NTRU vs RSA", "diff math"),
        ("crypto_NTRU_US6298137", "crypto_AES", "[NEG] NTRU vs AES", "diff regime"),
    ]

    print(f"{'Pair':50s} {'A_fps':>6} {'B_fps':>6} {'Shared':>7} {'Pct':>7}")
    print("-" * 90)
    for a, b, label, regime_label in cross_era_pairs:
        fps_a = patent_fps.get(a, set())
        fps_b = patent_fps.get(b, set())
        shared = fps_a & fps_b
        union_size = len(fps_a | fps_b)
        pct = (len(shared) / max(union_size, 1)) * 100
        print(f"{label[:50]:50s} {len(fps_a):>6} {len(fps_b):>6} {len(shared):>7} {pct:>6.0f}%")

    # === Per-regime anomaly scores ===
    print()
    print("=" * 100)
    print("LATTICE ANOMALY SCORES BY REGIME")
    print("=" * 100)
    print()
    print(f"{'Regime':35s} {'N':>6} {'Comp':>10} {'Anomaly':>10} {'Diversity':>10}")
    print("-" * 85)
    regime_scores = []
    for regime, surv in by_regime.items():
        if not surv:
            continue
        composites = [s["scores"]["composite"] for s in surv]
        anomalies = [s["scores"]["anomaly"] for s in surv]
        diversities = [s["scores"]["diversity"] for s in surv]
        regime_scores.append((regime, len(surv), statistics.mean(composites), statistics.mean(anomalies), statistics.mean(diversities)))

    regime_scores.sort(key=lambda x: -x[2])
    for regime, n, mc, ma, md in regime_scores:
        print(f"{regime[:35]:35s} {n:>6} {mc:>10.4f} {ma:>10.4f} {md:>10.4f}")

    # === Top 25 anomalies (BTUT's most structurally distinctive entities) ===
    print()
    print("=" * 100)
    print("TOP 25 BTUT ANOMALIES (highest composite score) — the medium-resolution signal")
    print("=" * 100)
    print()

    top25 = sorted(survivors, key=lambda s: -s["scores"]["composite"])[:25]
    print(f"{'Entity':50s} {'Type':>12} {'Regime':>22} {'Comp':>7}")
    print("-" * 100)
    for s in top25:
        attrs = s["entity"]["attributes"]
        name = s["entity"]["name"]
        etype = s["entity"]["type"]
        regime = attrs.get("physics_regime", "?")[:22]
        comp = s["scores"]["composite"]
        print(f"{name[:50]:50s} {etype[:12]:>12} {regime:>22} {comp:>7.4f}")

    # === Cross-validation: does BTUT flag the same entities as the keyword discriminator? ===
    print()
    print("=" * 100)
    print("CROSS-METHOD VALIDATION: BTUT vs Keyword Discriminator")
    print("=" * 100)
    print()

    # Patents the keyword discriminator classified as SURFACE WAVE with high confidence
    keyword_sw_patents = {
        "tesla_US645576", "tesla_US649621", "tesla_US1119732",
        "corum_US9912031", "corum_US9923385", "corum_US10084223", "corum_US9910144",
    }

    # How many BTUT survivors come from these patents?
    sw_survivors = [s for s in survivors if s["entity"]["attributes"].get("parent_patent") in keyword_sw_patents]
    print(f"Total survivors: {len(survivors)}")
    print(f"Survivors from keyword-flagged surface-wave patents: {len(sw_survivors)}")
    print(f"Percentage: {len(sw_survivors)/len(survivors)*100:.1f}%")

    # Are these survivors enriched compared to baseline?
    sw_chunks_in_corpus = sum(1 for e in corpus["entities"]
                              if e["attributes"].get("parent_patent") in keyword_sw_patents)
    print(f"Total chunks from these patents in corpus: {sw_chunks_in_corpus}")
    print(f"Survival rate: {len(sw_survivors)/sw_chunks_in_corpus*100:.1f}%")
    print(f"Vs baseline: {(len(sw_survivors)/sw_chunks_in_corpus) / baseline:.2f}x")

    # Does the apex cluster contain cross-era SW entities?
    sw_clusters = Counter(s["cluster"] for s in sw_survivors)
    print()
    print(f"Surface-wave survivors are concentrated in clusters: {dict(sw_clusters.most_common(5))}")

    # Save analysis report
    report = {
        "summary": summary,
        "regime_survival": {
            r: {"original": original_by_regime.get(r, 0), "survivors": len(s),
                "rate": len(s)/max(original_by_regime.get(r,1),1),
                "enrichment": (len(s)/max(original_by_regime.get(r,1),1))/baseline}
            for r, s in by_regime.items()
        },
        "regime_scores": [
            {"regime": r, "n": n, "mean_composite": mc, "mean_anomaly": ma, "mean_diversity": md}
            for r, n, mc, ma, md in regime_scores
        ],
        "cross_method_validation": {
            "sw_survivors": len(sw_survivors),
            "sw_chunks_in_corpus": sw_chunks_in_corpus,
            "sw_survival_rate": len(sw_survivors)/sw_chunks_in_corpus,
            "vs_baseline": (len(sw_survivors)/sw_chunks_in_corpus) / baseline,
        },
    }
    with open(OUT / "heterogeneous_btut_analysis.json", "w") as f:
        json.dump(report, f, indent=2)
    print()
    print(f"Report saved to {OUT / 'heterogeneous_btut_analysis.json'}")


if __name__ == "__main__":
    main()
