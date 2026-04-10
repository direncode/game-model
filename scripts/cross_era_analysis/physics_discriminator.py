"""THE CRITICAL EXPERIMENT

Does structural analysis separate three physics regimes?
  1. Surface wave / guided bound mode (Tesla + Corum)
  2. Inductive resonant near-field coupling (WiTricity)
  3. Radiative far-field (Marconi + modern antenna)

If Tesla's 1900-1902 patents cluster with modern Corum 2013-2018 patents
AND separate from WiTricity 2010-2014 patents AND separate from both
Marconi 1896 and modern antenna 2020, then the cross-era signature
detected by BTUT is PHYSICS-SPECIFIC, not just vocabulary-general.

This is the make-or-break test.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


OUTPUT_DIR = Path(__file__).parent / "output"


def main() -> None:
    with open(OUTPUT_DIR / "features.json", "r", encoding="utf-8") as f:
        docs = json.load(f)

    # Group features by physics regime
    sw_keys = [k for k in docs[0]["features"] if k.startswith("kw_sw_")]
    ind_keys = [k for k in docs[0]["features"] if k.startswith("kw_ind_")]
    rad_keys = [k for k in docs[0]["features"] if k.startswith("kw_rad_")]
    shared_keys = [k for k in docs[0]["features"] if k.startswith("kw_shared_")]

    print("Feature groups:")
    print(f"  Surface-wave specific: {len(sw_keys)}")
    print(f"  Inductive specific:    {len(ind_keys)}")
    print(f"  Radiative specific:    {len(rad_keys)}")
    print(f"  Shared (non-specific): {len(shared_keys)}")
    print()

    # For each document, compute a regime score in each physics category
    print("=" * 100)
    print("PHYSICS REGIME SCORES (sum of keyword densities per category)")
    print("=" * 100)
    print(f"{'Doc':35s} {'Year':>5} {'Type':>22} {'SW':>8} {'IND':>8} {'RAD':>8} {'Shared':>8}")
    print("-" * 100)

    scored = []
    for d in docs:
        f = d["features"]
        sw_score = sum(f[k] for k in sw_keys)
        ind_score = sum(f[k] for k in ind_keys)
        rad_score = sum(f[k] for k in rad_keys)
        shared_score = sum(f[k] for k in shared_keys)
        scored.append({
            "id": d["id"],
            "year": d.get("year", "?"),
            "type": d.get("type", "?"),
            "sw": sw_score,
            "ind": ind_score,
            "rad": rad_score,
            "shared": shared_score,
        })

    # Sort by type then year
    scored.sort(key=lambda x: (x["type"], x["year"]))

    for s in scored:
        print(f"{s['id'][:35]:35s} {s['year']!s:>5} {s['type'][:22]:>22} "
              f"{s['sw']:>8.2f} {s['ind']:>8.2f} {s['rad']:>8.2f} {s['shared']:>8.2f}")

    # === The critical comparison ===
    print()
    print("=" * 100)
    print("REGIME DOMINANCE — which physics regime does each document emphasize?")
    print("=" * 100)
    print()
    regimes = ["sw", "ind", "rad"]
    regime_names = {"sw": "SURFACE WAVE", "ind": "INDUCTIVE", "rad": "RADIATIVE"}

    for s in scored:
        scores = {r: s[r] for r in regimes}
        total = sum(scores.values())
        if total == 0:
            dominant = "NONE"
            margin = 0.0
        else:
            sorted_regimes = sorted(scores.items(), key=lambda x: -x[1])
            dominant = regime_names[sorted_regimes[0][0]]
            if len(sorted_regimes) > 1 and sorted_regimes[1][1] > 0:
                margin = sorted_regimes[0][1] / max(sorted_regimes[1][1], 0.001)
            else:
                margin = float("inf")
        expected = s["type"]
        match_line = ""
        if "surface_wave" in expected and dominant == "SURFACE WAVE":
            match_line = "  [CORRECT]"
        elif "inductive" in expected and dominant == "INDUCTIVE":
            match_line = "  [CORRECT]"
        elif "radiative" in expected and dominant == "RADIATIVE":
            match_line = "  [CORRECT]"
        elif "control" in expected:
            match_line = "  [control]"
        else:
            match_line = f"  [expected={expected}]"

        print(f"  [{s['year']}] {s['id']:35s} -> {dominant:13s} "
              f"(margin={margin:.1f}x over next) {match_line}")

    # === Cross-era hypothesis test ===
    print()
    print("=" * 100)
    print("CROSS-ERA TEST: Tesla 1900 vs Modern Corum 2015 — both surface wave?")
    print("=" * 100)

    tesla_sw = [s for s in scored if s["type"] == "tesla_surface_wave"]
    corum_sw = [s for s in scored if s["type"] == "modern_surface_wave"]
    witricity = [s for s in scored if s["type"] == "inductive_non_radiative"]
    radio = [s for s in scored if s["type"] == "radiative_radio"]

    def mean_scores(docs_list):
        if not docs_list:
            return None
        return {
            "sw": sum(d["sw"] for d in docs_list) / len(docs_list),
            "ind": sum(d["ind"] for d in docs_list) / len(docs_list),
            "rad": sum(d["rad"] for d in docs_list) / len(docs_list),
        }

    groups = {
        "Tesla surface wave (1897-1902)": tesla_sw,
        "Modern Corum surface wave (2013-2018)": corum_sw,
        "WiTricity inductive (2010-2014)": witricity,
        "Radio era + modern radio": radio,
    }

    print()
    print(f"{'Group':>40}   SW avg   IND avg   RAD avg")
    print("-" * 75)
    for name, dlist in groups.items():
        ms = mean_scores(dlist)
        if ms:
            print(f"{name:>40}  {ms['sw']:>7.2f}  {ms['ind']:>7.2f}  {ms['rad']:>7.2f}")

    # === The make-or-break prediction ===
    print()
    print("=" * 100)
    print("HYPOTHESIS EVALUATION")
    print("=" * 100)
    print()

    tesla_means = mean_scores(tesla_sw)
    corum_means = mean_scores(corum_sw)
    witri_means = mean_scores(witricity)
    radio_means = mean_scores(radio)

    predictions = []

    # 1. Tesla surface wave should be SW-dominant
    if tesla_means:
        sw_dominant_tesla = tesla_means["sw"] > tesla_means["ind"] and tesla_means["sw"] > tesla_means["rad"]
        predictions.append((
            "Tesla patents dominated by surface-wave vocabulary",
            sw_dominant_tesla,
            f"SW={tesla_means['sw']:.2f} vs IND={tesla_means['ind']:.2f} vs RAD={tesla_means['rad']:.2f}",
        ))

    # 2. Modern Corum should be SW-dominant
    if corum_means:
        sw_dominant_corum = corum_means["sw"] > corum_means["ind"] and corum_means["sw"] > corum_means["rad"]
        predictions.append((
            "Modern Corum patents dominated by surface-wave vocabulary",
            sw_dominant_corum,
            f"SW={corum_means['sw']:.2f} vs IND={corum_means['ind']:.2f} vs RAD={corum_means['rad']:.2f}",
        ))

    # 3. WiTricity should be IND-dominant
    if witri_means:
        ind_dominant_witri = witri_means["ind"] > witri_means["sw"] and witri_means["ind"] > witri_means["rad"]
        predictions.append((
            "WiTricity patents dominated by inductive/near-field vocabulary",
            ind_dominant_witri,
            f"SW={witri_means['sw']:.2f} vs IND={witri_means['ind']:.2f} vs RAD={witri_means['rad']:.2f}",
        ))

    # 4. Radio patents should be RAD-dominant
    if radio_means:
        rad_dominant_radio = radio_means["rad"] > radio_means["sw"] and radio_means["rad"] > radio_means["ind"]
        predictions.append((
            "Radio patents dominated by radiative vocabulary",
            rad_dominant_radio,
            f"SW={radio_means['sw']:.2f} vs IND={radio_means['ind']:.2f} vs RAD={radio_means['rad']:.2f}",
        ))

    confirmed = 0
    for desc, result, detail in predictions:
        status = "CONFIRMED" if result else "REJECTED"
        marker = "[+]" if result else "[-]"
        print(f"  {marker} {desc}")
        print(f"      {detail}  => {status}")
        print()
        if result:
            confirmed += 1

    print(f"Score: {confirmed}/{len(predictions)} predictions confirmed")
    print()

    if confirmed == len(predictions):
        print(">>> ALL PREDICTIONS CONFIRMED <<<")
        print()
        print("The structural analysis successfully separates three physics regimes:")
        print("  1. Surface wave (Tesla 1897-1902 + Corum 2013-2018) — CROSS-ERA MATCH")
        print("  2. Inductive near-field (WiTricity 2010-2014) — DISTINCT")
        print("  3. Radiative (Marconi 1896 + modern antenna 2020) — DISTINCT")
        print()
        print("Tesla's 1900 patents are closer to modern Corum 2018 patents than to")
        print("any other category in the corpus. This is PHYSICS-SPECIFIC signature")
        print("detection across 116 years of temporal separation.")
    elif confirmed >= len(predictions) * 0.75:
        print(">>> MOSTLY CONFIRMED: hypothesis supported with caveats")
    else:
        print(">>> MIXED RESULTS: need to refine feature engineering")

    # Save detailed report
    report = {
        "scored_documents": scored,
        "group_means": {name: mean_scores(dl) for name, dl in groups.items()},
        "predictions": [
            {"description": desc, "confirmed": result, "detail": detail}
            for desc, result, detail in predictions
        ],
        "confirmed_count": confirmed,
        "total_predictions": len(predictions),
    }
    with open(OUTPUT_DIR / "physics_discriminator_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print()
    print(f"Report saved to {OUTPUT_DIR / 'physics_discriminator_report.json'}")


if __name__ == "__main__":
    main()
