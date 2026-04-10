"""Analyze BTUT survivors from the standalone run on the 1679-entity cross-era corpus.

The critical questions:
  1. Are physics regimes preserved in BTUT's lattice clustering?
  2. Do cross-era pairs (Tesla 1900 ↔ Corum 2018, NTRU 2001 ↔ Isara 2018,
     Shannon 1948 ↔ Huffman 1952, JPEG 1992 ↔ HEVC 2013) share fingerprints
     more than chance?
  3. Does BTUT's medium-resolution variance correctly identify the most
     anomalous physics-regime documents (matching the keyword discriminator)?
"""

import json
from collections import Counter, defaultdict
from pathlib import Path
import statistics

OUTPUT = Path(__file__).parent / "output"


def main() -> None:
    with open(OUTPUT / "standalone_btut_result.json", "r") as f:
        data = json.load(f)

    survivors = data["result"]["survivors"]
    summary = data["result"]["summary"]

    print("=" * 100)
    print("BTUT STANDALONE RUN ON 1679-ENTITY CROSS-ERA CORPUS — ANALYSIS")
    print("=" * 100)
    print()
    print(f"Input entities:           {summary['total_entities']}")
    print(f"Clusters formed:          {summary['clusters']}")
    print(f"Unique 48-bit fingerprints: {summary['unique_48bit_fingerprints']}")
    print(f"Survivors:                {summary['survivors']} ({summary['reduction']}x reduction)")
    print(f"Wall time:                {summary['wall_seconds']:.1f}s")
    print()

    # === Per-regime survivor distribution ===
    by_regime = defaultdict(list)
    by_patent = defaultdict(list)
    by_cluster = defaultdict(list)
    by_fingerprint = defaultdict(list)

    for s in survivors:
        attrs = s["entity"]["attributes"]
        regime = attrs.get("physics_regime", "?")
        patent = attrs.get("parent_patent", "?")
        by_regime[regime].append(s)
        by_patent[patent].append(s)
        by_cluster[s["cluster"]].append(s)
        by_fingerprint[s["fingerprint_48bit"]].append(s)

    # Original entity counts per regime (from the input file)
    with open(OUTPUT / "fullcorpus_btut_input.json", "r") as f:
        input_data = json.load(f)
    original_entities = input_data["entities"]
    original_by_regime = Counter(e["attributes"]["physics_regime"] for e in original_entities)

    print("=" * 100)
    print("REGIME SURVIVAL ANALYSIS")
    print("=" * 100)
    print()
    print(f"{'Regime':35s} {'Original':>10} {'Survivors':>10} {'Survival%':>10} {'Vs Baseline':>12}")
    print("-" * 90)

    baseline_survival = sum(len(v) for v in by_regime.values()) / len(original_entities)
    print(f"  baseline survival rate: {baseline_survival:.3f} ({baseline_survival*100:.1f}%)")
    print()

    enrichment_records = []
    for regime, surv_list in sorted(by_regime.items(), key=lambda x: -len(x[1])):
        orig = original_by_regime.get(regime, 0)
        surv = len(surv_list)
        rate = surv / max(orig, 1)
        enrichment = rate / baseline_survival
        enrichment_records.append((regime, orig, surv, rate, enrichment))
        marker = " ENRICHED" if enrichment > 1.2 else (" depleted" if enrichment < 0.8 else "")
        print(f"{regime[:35]:35s} {orig:>10} {surv:>10} {rate:>9.1%} {enrichment:>11.2f}x{marker}")

    # === Cluster regime composition ===
    print()
    print("=" * 100)
    print("CLUSTER REGIME COMPOSITION (top 15 clusters)")
    print("=" * 100)
    print()

    sorted_clusters = sorted(by_cluster.items(), key=lambda x: -len(x[1]))
    for cluster_id, members in sorted_clusters[:15]:
        regime_counts = Counter(m["entity"]["attributes"]["physics_regime"] for m in members)
        regime_str = ", ".join(f"{r[:15]}={c}" for r, c in regime_counts.most_common(4))
        print(f"  Cluster {cluster_id:3d} ({len(members):3d} members): {regime_str}")

    # === Cross-era fingerprint sharing ===
    print()
    print("=" * 100)
    print("CROSS-ERA FINGERPRINT SHARING")
    print("=" * 100)
    print()

    # For each pair of cross-era patents, count shared fingerprints
    cross_era_pairs = [
        # Wireless surface wave
        ("tesla_US1119732", "corum_US10084223", "Tesla 1902 -> Corum 2018", 116),
        ("tesla_US649621", "corum_US9923385", "Tesla 1900 -> Corum 2015", 115),
        ("tesla_US645576", "corum_US9910144", "Tesla 1897 -> Corum 2018", 121),
        ("tesla_US649621", "corum_US9912031", "Tesla 1900 -> Corum 2013", 113),
        # Crypto cross-era
        ("crypto_NTRU_US6298137", "crypto_modern_PQ_US10097351", "NTRU 2001 -> Isara 2018", 17),
        # Info theory cross-era
        ("info_SHANNON1948", "info_HUFFMAN1952", "Shannon 1948 -> Huffman 1952", 4),
        ("info_JPEG1992", "info_HEVC2013", "JPEG 1992 -> HEVC 2013", 21),
        # NEGATIVE controls (different regimes, should NOT share)
        ("tesla_US1119732", "marconi_US586193", "Tesla 1902 vs Marconi 1896 (radio)", 6),
        ("tesla_US1119732", "witricity_US7741734", "Tesla 1902 vs WiTricity 2010 (inductive)", 108),
        ("crypto_NTRU_US6298137", "crypto_AES", "NTRU vs AES (lattice vs symmetric)", 0),
        ("info_HUFFMAN1952", "info_JPEG1992", "Huffman vs JPEG (entropy vs transform)", 40),
    ]

    def fingerprints_for_patent(patent_id):
        return set(s["fingerprint_48bit"] for s in by_patent.get(patent_id, []))

    print(f"{'Pair':50s} {'Gap':>5} {'A_uniq':>7} {'B_uniq':>7} {'Shared':>7} {'Result':>10}")
    print("-" * 100)
    for a, b, label, gap in cross_era_pairs:
        fps_a = fingerprints_for_patent(a)
        fps_b = fingerprints_for_patent(b)
        if not fps_a or not fps_b:
            result_str = "N/A"
        else:
            shared = fps_a & fps_b
            jaccard = len(shared) / max(len(fps_a | fps_b), 1)
            result_str = f"{len(shared)}/{min(len(fps_a), len(fps_b))} ({jaccard*100:.0f}%)"
        print(f"{label[:50]:50s} {gap:>5} {len(fps_a):>7} {len(fps_b):>7} {len(fps_a & fps_b):>7} {result_str:>10}")

    # === Cluster co-occurrence ===
    print()
    print("=" * 100)
    print("CLUSTER CO-OCCURRENCE: Do cross-era patents land in the same BTUT clusters?")
    print("=" * 100)
    print()

    def clusters_for_patent(patent_id):
        return Counter(s["cluster"] for s in by_patent.get(patent_id, []))

    print(f"{'Pair':50s} {'A_clusters':>15} {'B_clusters':>15} {'Shared':>12}")
    print("-" * 100)
    for a, b, label, gap in cross_era_pairs:
        cs_a = clusters_for_patent(a)
        cs_b = clusters_for_patent(b)
        if not cs_a or not cs_b:
            continue
        shared = set(cs_a) & set(cs_b)
        overlap = sum(min(cs_a[c], cs_b[c]) for c in shared)
        print(f"{label[:50]:50s} {dict(cs_a.most_common(3))!s:>15} {dict(cs_b.most_common(3))!s:>15} {len(shared):>5} clusters")

    # === Anomaly score by regime ===
    print()
    print("=" * 100)
    print("LATTICE ANOMALY SCORES BY REGIME")
    print("=" * 100)
    print()
    print(f"{'Regime':35s} {'Mean Composite':>15} {'Mean Anomaly':>15} {'Mean Diversity':>15}")
    print("-" * 90)
    for regime, surv_list in sorted(by_regime.items(), key=lambda x: -statistics.mean([s['scores']['composite'] for s in x[1]]) if x[1] else 0):
        if not surv_list:
            continue
        mc = statistics.mean(s['scores']['composite'] for s in surv_list)
        ma = statistics.mean(s['scores']['anomaly'] for s in surv_list)
        md = statistics.mean(s['scores']['diversity'] for s in surv_list)
        print(f"{regime[:35]:35s} {mc:>15.4f} {ma:>15.4f} {md:>15.4f}")

    # === Top 20 highest-composite survivors ===
    print()
    print("=" * 100)
    print("TOP 20 LATTICE ANOMALIES (highest composite score)")
    print("=" * 100)
    print()

    top20 = sorted(survivors, key=lambda s: -s['scores']['composite'])[:20]
    print(f"{'Patent (chunk)':45s} {'Regime':>30s} {'Comp':>7} {'Anom':>7} {'Div':>7}")
    print("-" * 100)
    for s in top20:
        attrs = s["entity"]["attributes"]
        name = s["entity"]["name"]
        regime = attrs.get("physics_regime", "?")
        scores = s["scores"]
        print(f"{name[:45]:45s} {regime[:30]:>30s} {scores['composite']:>7.4f} {scores['anomaly']:>7.4f} {scores['diversity']:>7.4f}")


if __name__ == "__main__":
    main()
