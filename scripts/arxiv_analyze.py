#!/usr/bin/env python3
"""
Analyze the Atlas formed model and emit the public artifact JSON.

Joins BTUT survivor fingerprints back to the original corpus metadata
(paper_id, primary_category, archive, year). Computes:

  1. Cluster purity vs. 8 archive-level disciplines (headline)
  2. Cluster purity vs. ~152 primary subcategories (verification appendix)
  3. Decade trajectory 1990s, 2000s, 2010s, 2020s
  4. Cross-discipline bleed
  5. Top-25 rarest survivors (with arxiv_url click-through)
  6. Young+tight+diverse emergence candidates (no naming)
  7. Baseline panel (TF-IDF + KMeans, LDA)

Output: /data/formed_models/_public/arxiv.json (read by /api/range-public/showcase/atlas)

Usage:
  python scripts/arxiv_analyze.py \\
      --model-id rng_xxxxxxxx \\
      --snapshot-date 2026-04-30 \\
      --corpus-input-sha256 <kaggle-file-hash> \\
      --corpus-sha256 <ndjson-hash>
"""
from __future__ import annotations

import argparse
import datetime
import json
import math
import os
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

# Resolve corpus + output paths against either container (/data/...) or host
# bind-mount (/opt/latentocean/data/...).
_HOST_BASE = "/opt/latentocean/data/formed_models"
_CONT_BASE = "/data/formed_models"
_BASE = _CONT_BASE if os.path.isdir(_CONT_BASE) else _HOST_BASE
CORPUS_PATH = Path(f"{_BASE}/_inputs/arxiv.ndjson")
PUBLIC_OUT  = Path(f"{_BASE}/_public/arxiv.json")
TOKEN_PATH  = Path("/tmp/.atlastoken")
BASE_URL    = os.environ.get("LO_BASE_URL", "https://www.latentocean.com")


# ---------- pure functions (extensively unit-tested) ----------

def archive_of(primary_category: str) -> str:
    """Map a primary category to its top-level archive.
    cs.LG -> cs; math.NT -> math; q-bio.GN -> q-bio; physics.optics -> physics.
    Legacy categories without a dot (hep-th, astro-ph, cond-mat) are their
    own archive name.
    """
    if "." in primary_category:
        return primary_category.split(".", 1)[0]
    return primary_category


def decade_of(year: int) -> str:
    if year < 1990:
        return "pre-1990s"
    return f"{(year // 10) * 10}s"


def hamming48(a: int, b: int) -> int:
    x = a ^ b
    c = 0
    while x:
        x &= x - 1
        c += 1
    return c


def weighted_purity(labels: list, golds: list) -> tuple[float, list[dict]]:
    """For each cluster, take the share of records whose gold label is the
    cluster's plurality label; weight by cluster size; sum.
    """
    by_cluster: dict[Any, Counter] = defaultdict(Counter)
    for lab, g in zip(labels, golds):
        by_cluster[lab][g] += 1
    rows: list[dict] = []
    weighted = 0
    total = 0
    for cid, ctr in by_cluster.items():
        size = sum(ctr.values())
        if size == 0:
            continue
        dom_label, dom_n = max(ctr.items(), key=lambda x: x[1])
        rows.append({
            "cluster":         cid,
            "size":            size,
            "dominant":        dom_label,
            "dominant_share": round(dom_n / size, 3),
            "breakdown":       dict(ctr),
        })
        weighted += dom_n
        total += size
    rows.sort(key=lambda x: -x["size"])
    return (round(weighted / total, 3) if total else 0.0, rows)


def category_entropy(categories: list[str]) -> float:
    """Shannon entropy of a multiset of categories."""
    if not categories:
        return 0.0
    counts = Counter(categories)
    n = len(categories)
    h = 0.0
    for c in counts.values():
        p = c / n
        h -= p * math.log2(p)
    return h


def flag_emergence_candidates(
    cluster_meta: list[dict],
    *,
    min_median_year: int,
    max_year_spread: int,
    min_category_entropy: float,
) -> list[dict]:
    """A cluster is a candidate emerged-field if it is young (recent median
    publication year), tight (small spread of years), and diverse (high
    Shannon entropy over primary categories — meaning it pulls papers from
    several subcategories rather than mirroring one).

    NO naming. The artifact page lists the candidate clusters and their
    rare-record exemplars; readers judge.
    """
    return [
        c for c in cluster_meta
        if c.get("median_year", 0) >= min_median_year
        and c.get("year_spread", 999) <= max_year_spread
        and c.get("category_entropy", 0.0) >= min_category_entropy
    ]


def assign_to_class(fp48: int, classes: list[dict]) -> int | None:
    """Return the class_id whose centroid has the smallest Hamming distance to fp48.
    None when classes is empty."""
    best_id, best_d = None, 49
    for c in classes:
        d = hamming48(fp48, c["centroid_fp48"])
        if d < best_d:
            best_d, best_id = d, c["id"]
    return best_id


def top_rare(survivors: list[dict], k: int = 25) -> list[dict]:
    """Rank survivors by their min-Hamming-distance to any other survivor (descending).
    A survivor with no close neighbors is structurally rare."""
    fps = [s["fp48"] for s in survivors]
    rarities: list[tuple[int, int]] = []
    for i, fp_i in enumerate(fps):
        best = 49
        for j, fp_j in enumerate(fps):
            if i == j:
                continue
            d = hamming48(fp_i, fp_j)
            if d < best:
                best = d
        rarities.append((i, best))
    rarities.sort(key=lambda x: -x[1])
    out = []
    for i, dist in rarities[:k]:
        s = survivors[i]
        out.append({
            "paper_id":         s["paper_id"],
            "title":            s.get("title", ""),
            "year":             s.get("year", 0),
            "primary_category": s.get("primary_category", ""),
            "archive":          s.get("archive", ""),
            "min_hamming":      dist,
            "arxiv_url":        f"https://arxiv.org/abs/{s['paper_id']}",
        })
    return out


def bleed_per_class(survivors: list[dict], classes: list[dict]) -> list[dict]:
    """For each cluster, identify the dominant archive and the off-archive bleed share.
    Mirrors DocSouth's bleed analysis but at archive-level instead of collection-level.
    """
    by_class: dict[Any, list[dict]] = defaultdict(list)
    for s in survivors:
        cid = assign_to_class(s["fp48"], classes)
        if cid is not None:
            by_class[cid].append(s)
    rows: list[dict] = []
    for cid, ss in by_class.items():
        if not ss:
            continue
        archives = Counter(s["archive"] for s in ss)
        dom_archive, dom_n = archives.most_common(1)[0]
        bleed = [s for s in ss if s["archive"] != dom_archive]
        bleed_breakdown = Counter(s["archive"] for s in bleed)
        bleed_years = [s["year"] for s in bleed if s.get("year")]
        rows.append({
            "class_id":          cid,
            "size":              len(ss),
            "dominant":          dom_archive,
            "dominant_share":    round(dom_n / len(ss), 3),
            "bleed_share":       round(len(bleed) / len(ss), 3),
            "bleed_breakdown":   dict(bleed_breakdown),
            "bleed_year_range":  [min(bleed_years), max(bleed_years)] if bleed_years else None,
            "bleed_examples":    [
                {"paper_id": s["paper_id"], "title": s.get("title", ""), "archive": s["archive"]}
                for s in bleed[:5]
            ],
        })
    rows.sort(key=lambda x: -x["size"])
    return rows


# ---------- IO + orchestration ----------

def load_model(model_id: str) -> dict:
    """Fetch full model meta + survivors via /api/range-form/<id>."""
    token = TOKEN_PATH.read_text().strip()
    req = urllib.request.Request(
        f"{BASE_URL}/api/range-form/{model_id}",
        headers={"Authorization": f"Bearer {token}",
                 "User-Agent": "Mozilla/5.0 (compatible; LatentOcean/1.0)"},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def load_corpus_index(corpus_path: Path) -> dict[int, dict]:
    """idx -> record. idx = line position in the NDJSON."""
    out: dict[int, dict] = {}
    with corpus_path.open(encoding="utf-8") as f:
        for idx, line in enumerate(f):
            if not line.strip():
                continue
            try:
                rec = json.loads(line)
            except Exception:
                continue
            out[idx] = rec
    return out


def join_survivors(model: dict, idx_to_meta: dict[int, dict]) -> list[dict]:
    """Project model['fingerprints'] back onto corpus metadata."""
    survivors: list[dict] = []
    for fp in model.get("fingerprints", []):
        idx = int(fp["recordIdx"])
        m = idx_to_meta.get(idx)
        if not m:
            continue
        survivors.append({
            "idx":               idx,
            "fp48Hex":           fp["fp48Hex"],
            "fp48":              int(fp["fp48Hex"], 16),
            "paper_id":          m["paper_id"],
            "primary_category":  m.get("primary_category", ""),
            "archive":           m.get("archive", ""),
            "categories":        m.get("categories", []),
            "year":              int(m.get("year") or 0),
            "title":             m.get("title", ""),
            "text":              m.get("text", ""),
        })
    return survivors


def compute_cluster_meta(survivors: list[dict], labels: list, coarse_rows: list[dict]) -> list[dict]:
    """Per cluster: median pub year, year-spread (p90 - p10), Shannon entropy
    over primary categories. Used downstream for emergence-candidate filtering."""
    cluster_meta: list[dict] = []
    for row in coarse_rows:
        cid = row["cluster"]
        cluster_survivors = [s for s, l in zip(survivors, labels) if l == cid]
        years = [s["year"] for s in cluster_survivors if s["year"]]
        cats = [s["primary_category"] for s in cluster_survivors if s["primary_category"]]
        if not years:
            continue
        years.sort()
        median_year = years[len(years) // 2]
        if len(years) >= 10:
            p10 = years[max(0, int(0.1 * len(years)))]
            p90 = years[min(len(years) - 1, int(0.9 * len(years)))]
        else:
            p10, p90 = years[0], years[-1]
        cluster_meta.append({
            "cluster_id":        cid,
            "size":              len(cluster_survivors),
            "median_year":       median_year,
            "year_spread":       p90 - p10,
            "category_entropy":  round(category_entropy(cats), 3),
        })
    return cluster_meta


def baseline_panel(survivors: list[dict], k: int = 12, random_state: int = 42) -> dict:
    """TF-IDF + KMeans and LDA baselines. Both compared to gold via weighted_purity vs. archive."""
    from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
    from sklearn.cluster import KMeans
    from sklearn.decomposition import LatentDirichletAllocation

    texts = [s.get("text", "") for s in survivors]
    archives = [s.get("archive", "") for s in survivors]
    if not any(texts):
        return {"K": k, "chance": 0.0, "tfidf_kmeans": 0.0, "lda_argmax": 0.0,
                "note": "no text payload available — baselines skipped"}

    vec = TfidfVectorizer(
        max_features=20_000, ngram_range=(1, 2), min_df=2, max_df=0.85,
        stop_words="english", lowercase=True,
        token_pattern=r"(?u)\b[a-z][a-z'-]+\b",
    )
    X = vec.fit_transform(texts)
    km = KMeans(n_clusters=k, random_state=random_state, n_init=10).fit(X)
    tfidf_purity, _ = weighted_purity(km.labels_.tolist(), archives)

    cv = CountVectorizer(
        max_features=10_000, min_df=2, max_df=0.85, stop_words="english",
        lowercase=True, token_pattern=r"(?u)\b[a-z][a-z'-]+\b",
    )
    Xc = cv.fit_transform(texts)
    lda = LatentDirichletAllocation(
        n_components=k, random_state=random_state, max_iter=20,
        learning_method="online", batch_size=512,
    ).fit(Xc)
    lda_labels = lda.transform(Xc).argmax(axis=1).tolist()
    lda_purity, _ = weighted_purity(lda_labels, archives)

    n_archives = len(set(a for a in archives if a))
    return {
        "K":            k,
        "chance":       round(1.0 / n_archives, 3) if n_archives else 0.0,
        "tfidf_kmeans": tfidf_purity,
        "lda_argmax":   lda_purity,
    }


def build_public_artifact(
    model: dict,
    corpus_path: Path,
    *,
    snapshot_date: str,
    corpus_input_sha256: str,
    corpus_sha256: str,
    sample_strategy: str = "stratified-by-year",
    target_per_year: int = 14500,
    include_baselines: bool = True,
) -> dict:
    """Build the full public-artifact dict. Pure-ish: only IO is reading the corpus NDJSON."""
    idx_to_meta = load_corpus_index(corpus_path)
    survivors = join_survivors(model, idx_to_meta)

    classes = [
        {"id": c["id"], "centroid_fp48": int(c["centroid_fp48Hex"], 16)}
        for c in model.get("taxonomy", {}).get("classes", [])
    ]

    labels = [assign_to_class(s["fp48"], classes) for s in survivors]
    valid = [(s, l) for s, l in zip(survivors, labels) if l is not None]
    valid_survivors = [v[0] for v in valid]
    valid_labels    = [v[1] for v in valid]

    archives_gold = [s["archive"] for s in valid_survivors]
    coarse_purity, coarse_rows = weighted_purity(valid_labels, archives_gold)

    primary_cats = [s["primary_category"] for s in valid_survivors]
    fine_purity, _fine_rows = weighted_purity(valid_labels, primary_cats)

    by_decade: dict[str, list[dict]] = defaultdict(list)
    for s in valid_survivors:
        if s["year"]:
            by_decade[decade_of(s["year"])].append(s)
    decade_trajectory = []
    for dec in sorted(by_decade.keys()):
        ss = by_decade[dec]
        archive_counts = Counter(s["archive"] for s in ss)
        decade_trajectory.append({
            "decade":        dec,
            "n_survivors":   len(ss),
            "archive_share": {a: round(c / len(ss), 3) for a, c in archive_counts.items()},
        })

    bleed = bleed_per_class(valid_survivors, classes)
    rare = top_rare(valid_survivors, k=25)
    cluster_meta = compute_cluster_meta(valid_survivors, valid_labels, coarse_rows)
    candidates = flag_emergence_candidates(
        cluster_meta,
        min_median_year=2015,
        max_year_spread=5,
        min_category_entropy=2.0,
    )

    baseline = baseline_panel(valid_survivors, k=12) if include_baselines else None

    return {
        "showcase":              "atlas",
        "kaggle_snapshot_date":  snapshot_date,
        "sample_strategy":       sample_strategy,
        "target_per_year":       target_per_year,
        "corpus_input_sha256":   corpus_input_sha256,
        "corpus_sha256":         corpus_sha256,
        "corpus_records":        model.get("corpus_records"),
        "corpus_bytes":          model.get("corpus_bytes"),
        "model_id":              model.get("id"),
        "tenant_id":             model.get("tenant_id"),
        "name":                  model.get("name"),
        "formed_at":             model.get("formed_at"),
        "formation_ms":          model.get("formation_ms"),
        "fingerprinter_mode":    model.get("fingerprinter_mode"),
        "effective_strategy":    model.get("effective_strategy"),
        "coverage_pct":          model.get("coverage_pct"),
        "response_digest":       model.get("response_digest"),
        "encrypted":             model.get("encrypted"),
        "chunked":               model.get("chunked"),
        "adapter_chain":         model.get("adapter_chain"),
        "taxonomy_summary":      model.get("taxonomy_summary"),
        "persistence":           model.get("persistence"),
        "purity": {
            "coarse_8_archive": coarse_purity,
            "fine_subcategory": fine_purity,
            "rows":             coarse_rows,
        },
        "decade_trajectory":     decade_trajectory,
        "bleed_per_class":       bleed,
        "rare_records":          rare,
        "cluster_meta":          cluster_meta,
        "emergence_candidates":  candidates,
        "baseline_panel":        baseline,
        "n_survivors":           len(valid_survivors),
        "generated_at":          datetime.datetime.utcnow().isoformat() + "Z",
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Analyze Atlas formed model -> public artifact JSON.")
    p.add_argument("--model-id", required=True)
    p.add_argument("--snapshot-date", required=True, help="Kaggle snapshot date YYYY-MM-DD")
    p.add_argument("--corpus-input-sha256", required=True)
    p.add_argument("--corpus-sha256", required=True)
    p.add_argument("--target-per-year", type=int, default=14500)
    p.add_argument("--output", default=str(PUBLIC_OUT))
    p.add_argument("--no-baselines", action="store_true",
                   help="Skip TF-IDF + LDA baselines (useful for fast smoke tests)")
    args = p.parse_args(argv)

    print(f"Loading model {args.model_id} ...")
    model = load_model(args.model_id)
    print(f"  records={model.get('corpus_records'):,}  fingerprints={len(model.get('fingerprints', [])):,}")

    artifact = build_public_artifact(
        model, CORPUS_PATH,
        snapshot_date=args.snapshot_date,
        corpus_input_sha256=args.corpus_input_sha256,
        corpus_sha256=args.corpus_sha256,
        target_per_year=args.target_per_year,
        include_baselines=not args.no_baselines,
    )

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(artifact, indent=2))
    print(f"\nwrote {out_path}  ({out_path.stat().st_size:,} bytes)")
    print(f"  coarse purity (8 archives): {artifact['purity']['coarse_8_archive']}")
    print(f"  fine purity (subcategory):  {artifact['purity']['fine_subcategory']}")
    print(f"  emergence candidates:       {len(artifact['emergence_candidates'])}")
    print(f"  rare records:               {len(artifact['rare_records'])}")
    if artifact.get("baseline_panel"):
        b = artifact["baseline_panel"]
        print(f"  baseline (chance):          {b.get('chance')}")
        print(f"  baseline (TF-IDF + KMeans): {b.get('tfidf_kmeans')}")
        print(f"  baseline (LDA argmax):      {b.get('lda_argmax')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
