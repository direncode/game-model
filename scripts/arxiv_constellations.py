#!/usr/bin/env python3
"""
Atlas Constellations: 100-finding catalog generator for arXiv.

Reads /data/formed_models/_public/arxiv.json (the analyze-script output)
and emits showcases/atlas_findings.json — a structured catalog of
findings grouped into thematic constellations.

Categories (each constellation produces a different *kind* of finding):

  - structurally_singular_papers   : the 25 most distant-from-everything
    survivors. Each gets a finding naming the paper, its archive, its
    distance, and an arxiv.org clickthrough.
  - candidate_emerged_clusters     : young + tight + diverse clusters
    flagged by the analyze script's emergence detector. No naming —
    each finding lists the cluster's metrics and its rare-record
    exemplars at the centroid.
  - interdisciplinary_bleed        : the highest-bleed clusters where
    a dominant-archive cluster pulls in papers from other archives.
    One finding per top-10 bleed cluster.
  - decade_drift                   : one finding per decade naming the
    archive-share shifts.
  - baseline_comparison            : engine vs. TF-IDF + KMeans, vs.
    LDA, vs. chance. Two or three findings comparing the numbers.
  - structural_anachronisms        : papers whose pub year deviates
    sharply from their cluster's median year. Identified during analyze
    via cluster_meta + survivor join.

The DocSouth constellations script is humanities-style (regex entity
extraction over text + hand-curated outward_links and citations).
arXiv constellations are scientific-style (algorithmic findings over
the public artifact JSON, citations are arxiv.org URLs).

A future v2 may add entity extraction (method names, dataset names,
model architectures) over abstracts. v1 ships the algorithmic catalog.
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
from pathlib import Path
from typing import Any

_HOST_BASE = "/opt/latentocean/data/formed_models"
_CONT_BASE = "/data/formed_models"
_BASE = _CONT_BASE if os.path.isdir(_CONT_BASE) else _HOST_BASE
DEFAULT_INPUT  = Path(f"{_BASE}/_public/arxiv.json")
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "showcases" / "atlas_findings.json"


# ---------- finding generators (each pure: artifact -> list[dict]) ----------

def findings_structurally_singular(art: dict) -> list[dict]:
    out: list[dict] = []
    for i, r in enumerate(art.get("rare_records", []), start=1):
        out.append({
            "category":   "structurally_singular_papers",
            "title":      f"{r.get('title') or r['paper_id']} sits structurally outside its archive",
            "summary":    (
                f"Among the analyzed survivors, paper {r['paper_id']} "
                f"({r.get('archive') or 'unknown archive'} / "
                f"{r.get('primary_category') or 'no category'}, "
                f"{r.get('year') or 'undated'}) has the rank-{i} largest "
                f"min-Hamming distance to any other survivor "
                f"(>= {r.get('min_hamming')} bits). Its abstract's structural "
                f"fingerprint does not echo any of its archive peers."
            ),
            "arxiv_url":   r.get("arxiv_url"),
            "metrics":     {"min_hamming": r.get("min_hamming"), "rank": i},
        })
    return out


def findings_emerged_clusters(art: dict) -> list[dict]:
    out: list[dict] = []
    candidates = art.get("emergence_candidates") or []
    cluster_meta_by_id = {c["cluster_id"]: c for c in art.get("cluster_meta", [])}
    purity_rows = {row["cluster"]: row for row in art.get("purity", {}).get("rows", [])}
    for cand in candidates:
        cid = cand["cluster_id"]
        meta = cluster_meta_by_id.get(cid, cand)
        purity = purity_rows.get(cid, {})
        out.append({
            "category":  "candidate_emerged_clusters",
            "title":     f"Cluster #{cid} matches the structural signature of an emerging field",
            "summary":   (
                f"Cluster #{cid} contains {meta.get('size', 0)} survivors with "
                f"median publication year {meta.get('median_year')}, "
                f"year-spread {meta.get('year_spread')} years, and "
                f"category Shannon entropy {meta.get('category_entropy')}. "
                f"Its dominant archive is "
                f"{purity.get('dominant') or 'mixed'} "
                f"({int(round(purity.get('dominant_share', 0) * 100))}% share). "
                f"Atlas does not name what this cluster is — readers can "
                f"inspect the cluster's centroid and rare-record exemplars "
                f"and decide for themselves."
            ),
            "metrics":   meta,
            "purity":    purity,
        })
    return out


def findings_interdisciplinary_bleed(art: dict, k: int = 10) -> list[dict]:
    out: list[dict] = []
    bleed_rows = sorted(
        art.get("bleed_per_class", []),
        key=lambda r: -r.get("bleed_share", 0),
    )[:k]
    for row in bleed_rows:
        if row.get("bleed_share", 0) <= 0:
            continue
        breakdown = row.get("bleed_breakdown") or {}
        breakdown_str = ", ".join(f"{a} ({n})" for a, n in sorted(breakdown.items(), key=lambda x: -x[1]))
        out.append({
            "category":  "interdisciplinary_bleed",
            "title":     f"Cluster #{row['class_id']} is dominantly {row.get('dominant')} but pulls from {len(breakdown)} other archives",
            "summary":   (
                f"Of cluster #{row['class_id']}'s {row.get('size')} survivors, "
                f"{int(round(row.get('bleed_share', 0) * 100))}% sit outside "
                f"the dominant archive {row.get('dominant')}. The off-archive "
                f"breakdown is: {breakdown_str}. "
                f"Bleed-record examples include "
                f"{', '.join(ex.get('paper_id', '?') for ex in (row.get('bleed_examples') or [])[:3])}."
            ),
            "metrics":   {
                "size":           row.get("size"),
                "dominant":       row.get("dominant"),
                "bleed_share":    row.get("bleed_share"),
                "bleed_breakdown": breakdown,
                "bleed_year_range": row.get("bleed_year_range"),
            },
            "examples":  row.get("bleed_examples", []),
        })
    return out


def findings_decade_drift(art: dict) -> list[dict]:
    out: list[dict] = []
    for row in art.get("decade_trajectory", []):
        shares = row.get("archive_share") or {}
        if not shares:
            continue
        top = sorted(shares.items(), key=lambda x: -x[1])[:3]
        top_str = ", ".join(f"{a} {int(round(s * 100))}%" for a, s in top)
        out.append({
            "category":  "decade_drift",
            "title":     f"{row.get('decade')} survivors: top-3 archive shares",
            "summary":   (
                f"The {row.get('decade')} bucket holds {row.get('n_survivors')} "
                f"survivors. Top archive shares: {top_str}. "
                f"Compare with adjacent decades to see the structural "
                f"reweighting of arXiv across time."
            ),
            "metrics":   {
                "decade":      row.get("decade"),
                "n_survivors": row.get("n_survivors"),
                "archive_share": shares,
            },
        })
    return out


def findings_baseline_comparison(art: dict) -> list[dict]:
    panel = art.get("baseline_panel") or {}
    coarse = art.get("purity", {}).get("coarse_8_archive")
    if not panel or coarse is None:
        return []
    chance = panel.get("chance")
    tfidf  = panel.get("tfidf_kmeans")
    lda    = panel.get("lda_argmax")
    return [
        {
            "category":  "baseline_comparison",
            "title":     f"Engine recovers archive structure {coarse} unsupervised; chance baseline is {chance}",
            "summary":   (
                f"The BTUT structural fingerprint plus k-means clustering at "
                f"K=12 produces a weighted purity of {coarse} against arXiv's "
                f"8 archive-level disciplines. The chance-baseline (uniform-random "
                f"label assignment) is {chance}. The lift over chance "
                f"is the unsupervised-recovery signal: the engine sees only "
                f"abstract+title text, never the gold-standard archive label."
            ),
            "metrics":   {"engine": coarse, "chance": chance},
        },
        {
            "category":  "baseline_comparison",
            "title":     f"Content-driven baseline: TF-IDF + KMeans@K=12 reaches {tfidf}",
            "summary":   (
                f"For honest comparison, a purely-content baseline (TF-IDF "
                f"vectorization with bigrams + k-means at K=12) reaches "
                f"weighted purity {tfidf} against the same 8-archive gold. "
                f"This isolates how much of the engine's signal comes from "
                f"the structural-fingerprint primitive itself versus what "
                f"any sklearn pipeline recovers from the same text."
            ),
            "metrics":   {"tfidf_kmeans": tfidf, "engine": coarse},
        },
        {
            "category":  "baseline_comparison",
            "title":     f"Topic-modeling baseline: LDA argmax at K=12 reaches {lda}",
            "summary":   (
                f"Latent Dirichlet Allocation with K=12 topics, argmax cluster "
                f"assignment on count-vectorized abstracts, produces weighted "
                f"purity {lda} against the 8-archive gold. LDA is a topic-mixture "
                f"model rather than a hard-clustering algorithm, so its argmax "
                f"reading should be read alongside the TF-IDF + KMeans number."
            ),
            "metrics":   {"lda_argmax": lda, "engine": coarse},
        },
    ]


def findings_structural_anachronisms(art: dict) -> list[dict]:
    """A paper is a structural anachronism if its publication year is far
    outside its cluster's [median - 2*spread, median + 2*spread] window —
    e.g., a 1995 paper that fingerprints into a 2018-median cluster.

    Identified by joining rare_records with cluster_meta. Without per-rare-record
    cluster_id information in the public artifact, this generator surfaces only
    the obvious pre-2000 entries among the rare set as a v1 placeholder.
    """
    out: list[dict] = []
    for r in art.get("rare_records", []):
        year = r.get("year") or 0
        if year and year < 2000:
            out.append({
                "category":  "structural_anachronisms",
                "title":     f"{r.get('title') or r['paper_id']} ({year}): pre-2000 paper among the structurally singular",
                "summary":   (
                    f"Paper {r['paper_id']} ({r.get('archive') or '?'}, {year}) "
                    f"is in the top-25 rarest survivors despite predating most "
                    f"of arXiv's volume growth. Either it is a structurally "
                    f"distinctive early paper or its early-era abstract style "
                    f"is itself the source of the distance signal. Worth "
                    f"qualitative review."
                ),
                "arxiv_url": r.get("arxiv_url"),
                "metrics":   {"year": year, "min_hamming": r.get("min_hamming")},
            })
    return out


# ---------- top-level catalog ----------

CATEGORY_BLURBS = {
    "structurally_singular_papers":  "Survivors with the largest min-Hamming distance to any other survivor — papers whose abstract structure does not echo any of their archive peers.",
    "candidate_emerged_clusters":    "Clusters matching the structural signature of an emerging field: young median publication year, narrow year spread, high category entropy.",
    "interdisciplinary_bleed":       "Clusters where a dominant-archive grouping pulls in papers from other archives — the structural signature of cross-disciplinary discourse.",
    "decade_drift":                  "Per-decade archive-share snapshots showing how the corpus's structural mix shifts across time.",
    "baseline_comparison":           "The engine's recovery number against TF-IDF + KMeans, LDA, and the chance baseline.",
    "structural_anachronisms":       "Papers whose publication year deviates sharply from their structural neighborhood's typical era.",
}


def build_catalog(art: dict) -> dict:
    findings: list[dict] = []
    findings.extend(findings_structurally_singular(art))
    findings.extend(findings_emerged_clusters(art))
    findings.extend(findings_interdisciplinary_bleed(art))
    findings.extend(findings_decade_drift(art))
    findings.extend(findings_baseline_comparison(art))
    findings.extend(findings_structural_anachronisms(art))

    # Stable ordering for byte-identical re-runs: sort by (category, title)
    findings.sort(key=lambda f: (f.get("category", ""), f.get("title", "")))
    for i, f in enumerate(findings, start=1):
        f["id"] = i

    return {
        "showcase":      "atlas",
        "version":       1,
        "title":         "Atlas Constellations: a 100-Finding Catalog of arXiv's Structural Map",
        "subtitle":      (
            "Each finding names a structural property of the corpus — a "
            "singular paper, an emergence candidate, an interdisciplinary "
            "bleed pattern, a decade shift — derived deterministically from "
            "the public artifact JSON."
        ),
        "method":        (
            "Algorithmic generation over /api/range-public/showcase/atlas. "
            "Six finding categories derived from rare_records, "
            "emergence_candidates, bleed_per_class, decade_trajectory, and "
            "baseline_panel. No human curation in v1. v2 will add an "
            "entity-extraction layer (method/dataset/architecture names)."
        ),
        "categories":    CATEGORY_BLURBS,
        "generated_at":  datetime.datetime.utcnow().isoformat() + "Z",
        "n_findings":    len(findings),
        "source_keys":   sorted([k for k in art.keys() if k != "fingerprints"])[:25],
        "findings":      findings,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Generate Atlas constellations findings catalog.")
    p.add_argument("--input", default=str(DEFAULT_INPUT), type=Path,
                   help="Path to /data/formed_models/_public/arxiv.json")
    p.add_argument("--output", default=str(DEFAULT_OUTPUT), type=Path,
                   help="Path to write atlas_findings.json")
    args = p.parse_args(argv)

    if not args.input.exists():
        print(f"ERROR: input artifact not found: {args.input}", file=sys.stderr)
        print("Run scripts/arxiv_analyze.py first.", file=sys.stderr)
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
