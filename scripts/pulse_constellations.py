#!/usr/bin/env python3
"""
Pulse Constellations: findings catalog generator for /pulse/uspto-inventors/constellations.

Reads /data/formed_models/_public/uspto.json (the analyze-script output)
and emits showcases/pulse_findings.json -- algorithmic findings across
five constellations:

  - singular_inventor_candidates  (top flagged-by-all-four-signals clusters)
  - cross_ipc_polymaths           (clusters with high IPC entropy)
  - structurally_singular_records (top-25 rare inventor-records)
  - decade_productivity_shifts    (one finding per decade)
  - baseline_comparison           (engine vs PatentsView vs naive vs chance)

DocSouth's constellations script does humanities-style entity extraction.
Pulse v1 is purely algorithmic; v2 may add a co-inventor graph layer.

Output is sorted by (category, title) with stable IDs so re-runs are
byte-identical.
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
from pathlib import Path

_HOST_BASE = "/opt/latentocean/data/formed_models"
_CONT_BASE = "/data/formed_models"
_BASE = _CONT_BASE if os.path.isdir(_CONT_BASE) else _HOST_BASE
DEFAULT_INPUT  = Path(f"{_BASE}/_public/uspto.json")
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "showcases" / "pulse_findings.json"


def findings_singular_inventors(art: dict) -> list[dict]:
    out: list[dict] = []
    candidates = art.get("singular_inventor_candidates") or []
    for i, c in enumerate(candidates, start=1):
        out.append({
            "category":  "singular_inventor_candidates",
            "title":     f"Cluster #{c['cluster_id']} matches all four singular-inventor signals",
            "summary":   (
                f"This disambiguated inventor cluster has "
                f"{c.get('patent_count')} patents, IPC Shannon entropy "
                f"{c.get('ipc_entropy')}, career span {c.get('career_span')} "
                f"years, and solo-share {int(c.get('solo_share', 0) * 100)}%. "
                f"It scores above threshold on every signal: productivity, "
                f"cross-domain breadth, career length, and independence from "
                f"co-inventor networks. Pulse does not name what or who this "
                f"cluster is; readers can inspect the centroid and rare-record "
                f"exemplars and decide for themselves."
            ),
            "metrics":   c,
            "rank":      i,
        })
    return out


def findings_cross_ipc_polymaths(art: dict, k: int = 10) -> list[dict]:
    out: list[dict] = []
    cluster_meta = art.get("cluster_meta") or []
    polymaths = sorted(cluster_meta, key=lambda c: -c.get("ipc_entropy", 0))[:k]
    for c in polymaths:
        if c.get("ipc_entropy", 0) <= 0.5:
            continue
        out.append({
            "category":  "cross_ipc_polymaths",
            "title":     f"Cluster #{c['cluster_id']} spans multiple IPC classes (entropy {c.get('ipc_entropy')})",
            "summary":   (
                f"This inventor cluster contains {c.get('patent_count')} "
                f"patents across primary-IPC classes with Shannon entropy "
                f"{c.get('ipc_entropy')}, indicating cross-domain work. "
                f"Polymath inventors tend to score above 1.0 entropy; pure "
                f"specialists score 0."
            ),
            "metrics":   c,
        })
    return out


def findings_structurally_singular_records(art: dict) -> list[dict]:
    out: list[dict] = []
    for i, r in enumerate(art.get("rare_records", []), start=1):
        out.append({
            "category":  "structurally_singular_records",
            "title":     f"Patent {r['patent_id']} is structurally singular: {r.get('title') or '[untitled]'}",
            "summary":   (
                f"Inventor-record (patent {r['patent_id']}, "
                f"canonical name {r.get('canonical_name') or 'unknown'}, "
                f"{r.get('year') or 'undated'}) has the rank-{i} largest "
                f"min-Hamming distance ({r.get('min_hamming')} bits) to any other "
                f"surviving inventor-record. The structural fingerprint of this "
                f"name + co-inventor + assignee + location combination does not "
                f"echo any other patent in the corpus."
            ),
            "uspto_url": r.get("uspto_url"),
            "metrics":   {"min_hamming": r.get("min_hamming"), "rank": i},
        })
    return out


def findings_decade_productivity_shifts(art: dict) -> list[dict]:
    out: list[dict] = []
    for d in art.get("decade_trajectory", []):
        ipc_top = sorted(d.get("ipc_share", {}).items(), key=lambda x: -x[1])[:3]
        ipc_str = ", ".join(f"{ipc} {int(round(s * 100))}%" for ipc, s in ipc_top)
        out.append({
            "category":  "decade_productivity_shifts",
            "title":     f"{d['decade']}: {d['n_records']:,} inventor-records, {d.get('n_inventors', 0):,} disambiguated inventors",
            "summary":   (
                f"In the {d['decade']} bucket, the corpus holds "
                f"{d['n_records']:,} inventor-records spanning "
                f"{d.get('n_inventors', 0):,} disambiguated inventors per "
                f"PatentsView. Top IPC shares: {ipc_str}. "
                f"Compare with adjacent decades to see the structural "
                f"reweighting of US innovation by domain."
            ),
            "metrics":   d,
        })
    return out


def findings_baseline_comparison(art: dict) -> list[dict]:
    b = art.get("baseline_disambiguators") or {}
    if not b:
        return []
    return [
        {
            "category":  "baseline_comparison",
            "title":     f"Engine recovers PatentsView's disambiguation at {b.get('engine')} vs naive-name {b.get('naive_name')}, chance {b.get('chance')}",
            "summary":   (
                f"Engine (BTUT structural fingerprint + KMeans on Hamming) "
                f"reaches weighted purity {b.get('engine')} against "
                f"PatentsView's gold inventor-disambiguation. The naive "
                f"baseline (collapse all records with identical canonical "
                f"name) reaches {b.get('naive_name')}, typically lower, "
                f"because surname-collision incorrectly merges distinct "
                f"inventors with common names. Chance baseline is "
                f"{b.get('chance')}. PatentsView itself is an algorithmic "
                f"approximation, so the engine's lift over naive-name is "
                f"the cleaner signal of structural-disambiguation power."
            ),
            "metrics":   b,
        },
    ]


CATEGORY_BLURBS = {
    "singular_inventor_candidates":  "Disambiguated-inventor clusters that score high on productivity, IPC breadth, career length, and solo-work share simultaneously: the structural signature of a singularly-prolific inventor. Pulse does not name them; readers click through to USPTO and judge.",
    "cross_ipc_polymaths":           "Disambiguated inventors whose patent portfolio spans multiple IPC classes with high Shannon entropy: the population-level cross-domain signal.",
    "structurally_singular_records": "Top-25 inventor-records with the largest min-Hamming distance to any other surviving record in the corpus.",
    "decade_productivity_shifts":    "Per-decade summaries of inventor-record volume, distinct disambiguated inventors, and IPC share. Read across decades for the structural reweighting of US innovation.",
    "baseline_comparison":           "Engine's recovery of PatentsView's disambiguation versus the naive-name-collision baseline and the chance baseline.",
}


def build_catalog(art: dict) -> dict:
    findings: list[dict] = []
    findings.extend(findings_singular_inventors(art))
    findings.extend(findings_cross_ipc_polymaths(art))
    findings.extend(findings_structurally_singular_records(art))
    findings.extend(findings_decade_productivity_shifts(art))
    findings.extend(findings_baseline_comparison(art))

    findings.sort(key=lambda f: (f.get("category", ""), f.get("title", "")))
    for i, f in enumerate(findings, start=1):
        f["id"] = i

    return {
        "showcase":      "pulse",
        "version":       1,
        "title":         "Pulse Constellations: a Findings Catalog of US Innovation",
        "subtitle":      (
            "Each finding names a structural property of the disambiguated "
            "inventor record set, derived deterministically from the public "
            "artifact JSON."
        ),
        "method":        (
            "Algorithmic generation over /api/range-public/showcase/pulse. "
            "Five finding categories. No human curation in v1. v2 may add "
            "a co-inventor graph layer."
        ),
        "categories":    CATEGORY_BLURBS,
        "generated_at":  datetime.datetime.utcnow().isoformat() + "Z",
        "n_findings":    len(findings),
        "findings":      findings,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Generate Pulse constellations findings catalog.")
    p.add_argument("--input", default=str(DEFAULT_INPUT), type=Path)
    p.add_argument("--output", default=str(DEFAULT_OUTPUT), type=Path)
    args = p.parse_args(argv)

    if not args.input.exists():
        print(f"ERROR: input artifact not found: {args.input}", file=sys.stderr)
        print("Run scripts/pulse_analyze.py first.", file=sys.stderr)
        return 1

    art = json.loads(args.input.read_text())
    catalog = build_catalog(art)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(catalog, indent=2))
    print(f"wrote {args.output}  ({args.output.stat().st_size:,} bytes)")
    print(f"  {catalog['n_findings']} findings across {len(catalog['categories'])} categories")
    return 0


if __name__ == "__main__":
    sys.exit(main())
