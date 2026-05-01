#!/usr/bin/env python3
"""
Analyze the DocSouth formed model and emit a public-facing artifact.

Joins BTUT survivor fingerprints (which carry only recordIdx) back to the
original corpus metadata (collection, author, title, year, url). Then
computes:

  1. Cluster purity by collection — does k-means on the BTUT survivors
     recover the archive's curatorial structure unsupervised?
  2. Decade centroids + drift — 180 years of structural movement, 1740s-1920s.
  3. Decade × collection composition — how the four collections are
     distributed across each decade.
  4. Top-10 rarest survivors named — with collection, author, title, year,
     and the canonical DocSouth URL for each.

Output: /data/formed_models/_public/docsouth.json (read by the public
range-public endpoint with no auth).
"""
from __future__ import annotations
import datetime
import hashlib
import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

import os as _os
_HOST_BASE = "/opt/latentocean/data/formed_models"
_CONT_BASE = "/data/formed_models"
_BASE = _CONT_BASE if _os.path.isdir(_CONT_BASE) else _HOST_BASE
CORPUS_PATH = Path(f"{_BASE}/_inputs/docsouth.ndjson")
PUBLIC_OUT  = Path(f"{_BASE}/_public/docsouth.json")
TOKEN_PATH  = Path("/tmp/.doctok")
MODEL_ID    = "rng_772c6fb01bea38cb6a3a"   # the formation with persistence + RunPod
BASE        = "https://www.latentocean.com"


def hamming48(a: int, b: int) -> int:
    x = a ^ b
    c = 0
    while x:
        x &= x - 1
        c += 1
    return c


def weighted_purity(labels: list[int], golds: list[str]) -> tuple[float, list[dict]]:
    """Compute weighted-purity over (cluster_label, gold_label) pairs.

    Same metric the engine uses on its taxonomy classes: for each cluster,
    take the share of records whose gold label is the cluster's plurality
    label; weight by cluster size; sum.
    """
    by_cluster: dict[int, Counter] = defaultdict(Counter)
    for lab, g in zip(labels, golds):
        by_cluster[lab][g] += 1
    rows = []
    weighted = 0
    total = 0
    for cid, ctr in by_cluster.items():
        size = sum(ctr.values())
        if size == 0:
            continue
        dom_label, dom_n = max(ctr.items(), key=lambda x: x[1])
        rows.append({
            "cluster":             cid,
            "size":                size,
            "dominant":            dom_label,
            "dominant_share":      round(dom_n / size, 3),
            "collections":         dict(ctr),
        })
        weighted += dom_n
        total += size
    rows.sort(key=lambda x: -x["size"])
    return (round(weighted / total, 3) if total else 0.0, rows)


# --- Content-weighted fingerprint variant ---
#
# The 48-bit BTUT fingerprint is structure-driven (schema-agnostic, byte-
# canonical, weighted by field entropy). On a text corpus it captures
# stable archive features like genre and register, not the topical content
# of any one decade. As an honest comparison, we compute a *content-driven*
# 48-bit variant: hash the top-K TF-IDF terms of each record into a 48-bit
# fingerprint. Decade drift on these content-fingerprints reveals topical
# movement that the structural fingerprint smooths out.

WORD_RE = re.compile(r"[a-z][a-z'-]{2,}")


def content_fp48(top_terms: list[str]) -> int:
    """Hash a record's top TF-IDF terms into a 48-bit fingerprint.

    Each term sets 3 bits via SHA-256-derived hash positions (Bloom-style),
    bounded to 48-bit space. Two records with overlapping top terms produce
    fp48s with low Hamming distance.
    """
    fp = 0
    for t in top_terms:
        h = hashlib.sha256(t.encode("utf-8")).digest()
        p1 = int.from_bytes(h[0:2], "big") % 48
        p2 = int.from_bytes(h[2:4], "big") % 48
        p3 = int.from_bytes(h[4:6], "big") % 48
        fp |= (1 << p1) | (1 << p2) | (1 << p3)
    return fp & 0xFFFFFFFFFFFF


def load_model() -> dict:
    token = TOKEN_PATH.read_text().strip()
    req = urllib.request.Request(
        f"{BASE}/api/range-form/{MODEL_ID}",
        headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": "Mozilla/5.0 (compatible; LatentOcean/1.0)",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def load_corpus_index() -> dict[int, dict]:
    """Build idx -> metadata map. The corpus is NDJSON; idx is line position."""
    out: dict[int, dict] = {}
    with CORPUS_PATH.open(encoding="utf-8") as f:
        idx = 0
        for line in f:
            if not line.strip():
                continue
            try:
                rec = json.loads(line)
            except Exception:
                idx += 1
                continue
            out[idx] = {
                "collection":     rec.get("collection", ""),
                "filename":       rec.get("filename", ""),
                "author":         rec.get("author", ""),
                "title":          rec.get("title", ""),
                "year":           rec.get("year", ""),
                "segment_idx":    rec.get("segment_idx", 0),
                "total_segments": rec.get("total_segments", 0),
                "url":            rec.get("url", ""),
            }
            idx += 1
    return out


def main() -> int:
    print("Loading model from API...")
    model = load_model()
    print(f"  id={model['id']}  records={model['corpus_records']:,}")
    print(f"  fingerprints (survivors)={len(model['fingerprints']):,}")

    print("Loading corpus index...")
    idx_to_meta = load_corpus_index()
    print(f"  {len(idx_to_meta):,} records indexed")

    # Join survivors -> metadata
    survivors = []
    missing = 0
    for fp in model["fingerprints"]:
        idx = int(fp["recordIdx"])
        meta = idx_to_meta.get(idx)
        if not meta:
            missing += 1
            continue
        survivors.append({
            "idx":         idx,
            "fp48Hex":     fp["fp48Hex"],
            "fp48":        int(fp["fp48Hex"], 16),
            "collection":  meta["collection"],
            "author":      meta["author"],
            "title":       meta["title"],
            "year":        meta["year"],
            "filename":    meta["filename"],
            "url":         meta["url"],
            "segment_idx": meta["segment_idx"],
            "text":        "",   # filled below
        })
    print(f"  {len(survivors):,} survivors joined  (missing: {missing})")

    # Second pass over corpus to capture text for survivors only
    print("\nLoading survivor texts (second pass over corpus)...")
    survivor_idxs = {s["idx"]: s for s in survivors}
    with CORPUS_PATH.open(encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i in survivor_idxs:
                try:
                    rec = json.loads(line)
                    survivor_idxs[i]["text"] = rec.get("text", "")
                except Exception:
                    pass
    text_lens = [len(s["text"]) for s in survivors]
    print(f"  text loaded: median={sorted(text_lens)[len(text_lens)//2]} bytes, max={max(text_lens)} bytes")

    # ---- 1. Cluster purity by collection ----
    print("\nComputing cluster purity by collection...")
    classes = model["taxonomy"]["classes"]
    class_centroids = [(c["id"], int(c["centroid_fp48Hex"], 16)) for c in classes]

    class_collections: dict[int, Counter] = defaultdict(Counter)
    for s in survivors:
        best_class, best_d = None, 49
        for cid, centroid in class_centroids:
            d = hamming48(s["fp48"], centroid)
            if d < best_d:
                best_d, best_class = d, cid
        if best_class is not None:
            class_collections[best_class][s["collection"]] += 1

    cluster_purity = []
    for cid, _ in class_centroids:
        counts = dict(class_collections[cid])
        size = sum(counts.values())
        if size == 0:
            continue
        dominant_col, dominant_n = max(counts.items(), key=lambda x: x[1])
        cluster_purity.append({
            "class_id":            cid,
            "size":                size,
            "dominant_collection": dominant_col,
            "dominant_share":      round(dominant_n / size, 3),
            "collections":         counts,
        })
    cluster_purity.sort(key=lambda x: -x["size"])
    weighted = sum(c["dominant_share"] * c["size"] for c in cluster_purity)
    total    = sum(c["size"] for c in cluster_purity)
    engine_purity = round(weighted / total, 3) if total else 0.0
    print(f"  weighted purity (engine) = {engine_purity}")
    for cp in cluster_purity[:5]:
        print(f"  class #{cp['class_id']}: {cp['size']} survivors  dom={cp['dominant_collection'][:25]} ({int(cp['dominant_share']*100)}%)")

    # ---- Cross-collection bleed: per class, what does the non-dominant share look like? ----
    print("\nCross-collection bleed analysis...")
    bleed_per_class = []
    for cp in cluster_purity:
        # Identify the survivors actually assigned to this cluster.
        cluster_survivors = []
        for s in survivors:
            best_c, best_d = None, 49
            for cid, centroid in class_centroids:
                d = hamming48(s["fp48"], centroid)
                if d < best_d:
                    best_d, best_c = d, cid
            if best_c == cp["class_id"]:
                cluster_survivors.append(s)
        dom = cp["dominant_collection"]
        bleed = [s for s in cluster_survivors if s["collection"] != dom]
        if not bleed:
            bleed_per_class.append({
                "class_id":          cp["class_id"],
                "dominant":          dom,
                "dominant_share":    cp["dominant_share"],
                "size":              cp["size"],
                "bleed_share":       0.0,
                "bleed_breakdown":   {},
                "bleed_year_range":  None,
                "bleed_authors":     [],
            })
            continue
        bleed_breakdown = Counter(s["collection"] for s in bleed)
        bleed_years = []
        for s in bleed:
            try:
                y = int(s["year"]) if s["year"] else None
                if y: bleed_years.append(y)
            except Exception: pass
        bleed_authors = Counter(s["author"] for s in bleed if s["author"])
        bleed_per_class.append({
            "class_id":         cp["class_id"],
            "dominant":         dom,
            "dominant_share":   cp["dominant_share"],
            "size":             cp["size"],
            "bleed_share":      round(len(bleed) / cp["size"], 3),
            "bleed_breakdown":  dict(bleed_breakdown),
            "bleed_year_range": [min(bleed_years), max(bleed_years)] if bleed_years else None,
            "bleed_authors":    [a for a, _ in bleed_authors.most_common(5)],
        })
    bleed_per_class.sort(key=lambda x: -x["size"])
    for b in bleed_per_class[:5]:
        print(f"  class #{b['class_id']} (dom={b['dominant'][:25]}, {int(b['dominant_share']*100)}%): bleed={int(b['bleed_share']*100)}%, {b['bleed_breakdown']}")

    # ---- Baseline 1: TF-IDF + k-means ----
    print("\nBaseline · TF-IDF + KMeans(k=12)...")
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import KMeans
    from sklearn.decomposition import LatentDirichletAllocation, TruncatedSVD
    from sklearn.feature_extraction.text import CountVectorizer

    texts = [s["text"] for s in survivors]
    collections = [s["collection"] for s in survivors]

    K = 12
    rs = 42
    vec = TfidfVectorizer(
        max_features=20_000,
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.85,
        stop_words="english",
        lowercase=True,
        token_pattern=r"(?u)\b[a-z][a-z'-]+\b",
    )
    X = vec.fit_transform(texts)
    print(f"  TF-IDF matrix: {X.shape[0]} x {X.shape[1]}")
    km = KMeans(n_clusters=K, random_state=rs, n_init=10).fit(X)
    tfidf_purity, tfidf_clusters = weighted_purity(km.labels_.tolist(), collections)
    print(f"  TF-IDF purity = {tfidf_purity}")

    # ---- Baseline 2: LDA topics, argmax → cluster ----
    print("\nBaseline · LDA(K=12, max_iter=20) on count vectors...")
    cv = CountVectorizer(
        max_features=10_000,
        min_df=2,
        max_df=0.85,
        stop_words="english",
        lowercase=True,
        token_pattern=r"(?u)\b[a-z][a-z'-]+\b",
    )
    Xc = cv.fit_transform(texts)
    lda = LatentDirichletAllocation(
        n_components=K, random_state=rs, max_iter=20, learning_method="online", batch_size=512,
    ).fit(Xc)
    lda_topic_dist = lda.transform(Xc)
    lda_labels = lda_topic_dist.argmax(axis=1).tolist()
    lda_purity, lda_clusters = weighted_purity(lda_labels, collections)
    print(f"  LDA purity = {lda_purity}")

    # Random / chance baseline
    chance_purity = round(1.0 / len(set(collections)), 3)

    print("\nBaseline summary:")
    print(f"  chance               = {chance_purity}")
    print(f"  engine (BTUT + Hamming + KMeans) = {engine_purity}")
    print(f"  TF-IDF + KMeans      = {tfidf_purity}")
    print(f"  LDA argmax           = {lda_purity}")

    baselines = [
        {"method": "chance",         "purity": chance_purity, "k": K, "note": "1/k for k collections"},
        {"method": "engine",         "purity": engine_purity, "k": K, "note": "BTUT 48-bit fp + KMeans on Hamming distance"},
        {"method": "tfidf_kmeans",   "purity": tfidf_purity,  "k": K, "note": "sklearn TfidfVectorizer (1-2 gram, 20k features) + KMeans, random_state=42"},
        {"method": "lda_argmax",     "purity": lda_purity,    "k": K, "note": "sklearn LatentDirichletAllocation (k=12, online, 20 iter), argmax → hard cluster"},
    ]

    # ---- Content-weighted fingerprint variant ----
    print("\nContent-weighted fingerprint variant (top-32 TF-IDF terms per record → 48-bit Bloom-style fp)...")
    feature_names = vec.get_feature_names_out()
    content_fps = []
    Xarr = X.toarray()
    for i in range(len(survivors)):
        row = Xarr[i]
        # Top-32 features by TF-IDF weight
        top_idxs = row.argsort()[-32:][::-1]
        top_terms = [feature_names[j] for j in top_idxs if row[j] > 0]
        content_fps.append(content_fp48(top_terms))

    # Decade centroids on content fingerprints (parallel to the structural one)
    by_decade_content: dict[int, list[int]] = defaultdict(list)
    by_decade_struct: dict[int, list[int]]  = defaultdict(list)
    for i, s in enumerate(survivors):
        try:
            year = int(s["year"]) if s["year"] else None
        except Exception:
            year = None
        if year is None or year < 1700 or year > 1950:
            continue
        decade = (year // 10) * 10
        by_decade_content[decade].append(content_fps[i])
        by_decade_struct[decade].append(s["fp48"])

    def decade_drift(by_dec: dict[int, list[int]]) -> list[dict]:
        decs = sorted(by_dec.keys())
        out = []
        prev = None
        for d in decs:
            mems = by_dec[d]
            cent = 0
            for bit in range(48):
                mask = 1 << bit
                ones = sum(1 for m in mems if m & mask)
                if ones * 2 >= len(mems):
                    cent |= mask
            drift = hamming48(cent, prev) if prev is not None else 0
            out.append({
                "decade":           d,
                "count":            len(mems),
                "centroid_fp48Hex": f"{cent:012x}",
                "drift_from_prev":  drift,
            })
            prev = cent
        return out

    structural_drift = decade_drift(by_decade_struct)
    content_drift    = decade_drift(by_decade_content)

    avg_struct  = round(sum(d["drift_from_prev"] for d in structural_drift[1:]) / max(1, len(structural_drift) - 1), 2)
    avg_content = round(sum(d["drift_from_prev"] for d in content_drift[1:])   / max(1, len(content_drift) - 1),   2)
    max_struct  = max((d["drift_from_prev"] for d in structural_drift[1:]), default=0)
    max_content = max((d["drift_from_prev"] for d in content_drift[1:]),   default=0)
    print(f"  structural drift: avg={avg_struct}/48, max={max_struct}/48")
    print(f"  content    drift: avg={avg_content}/48, max={max_content}/48  (lift = +{round(avg_content - avg_struct, 2)})")

    # ---- 2 + 3. Decade centroids + decade × collection composition ----
    print("\nComputing decade centroids + composition...")
    by_decade_fps: dict[int, list[int]] = defaultdict(list)
    by_decade_cols: dict[int, Counter] = defaultdict(Counter)
    for s in survivors:
        try:
            year = int(s["year"]) if s["year"] else None
        except Exception:
            year = None
        if year is None or year < 1700 or year > 1950:
            continue
        decade = (year // 10) * 10
        by_decade_fps[decade].append(s["fp48"])
        by_decade_cols[decade][s["collection"]] += 1

    decade_data = []
    decades = sorted(by_decade_fps.keys())
    prev_centroid = None
    for d in decades:
        members = by_decade_fps[d]
        # Majority-bit centroid
        centroid = 0
        for bit in range(48):
            mask = 1 << bit
            ones = sum(1 for m in members if m & mask)
            if ones * 2 >= len(members):
                centroid |= mask
        drift = hamming48(centroid, prev_centroid) if prev_centroid is not None else 0
        decade_data.append({
            "decade":           d,
            "count":            len(members),
            "centroid_fp48Hex": f"{centroid:012x}",
            "drift_from_prev":  drift,
            "collections":      dict(by_decade_cols[d]),
        })
        prev_centroid = centroid

    print(f"  {len(decade_data)} decades represented")
    for d in decade_data:
        print(f"  {d['decade']}s: n={d['count']:>3}  drift={d['drift_from_prev']:>2}/48")

    # ---- 4. Named rare records (Hamming-min over 32-survivor lookback) ----
    print("\nComputing rare records (Hamming-min over 32-record lookback)...")
    survivors_sorted = sorted(survivors, key=lambda s: s["idx"])
    rarities = []
    for i, s in enumerate(survivors_sorted):
        ham_min = 49 if i > 0 else 24  # match the form route's heuristic
        lo = max(0, i - 32)
        for k in range(lo, i):
            d = hamming48(s["fp48"], survivors_sorted[k]["fp48"])
            if d < ham_min:
                ham_min = d
        rarities.append((ham_min, s))
    rarities.sort(key=lambda x: -x[0])

    named_rare = []
    for ham_min, s in rarities[:10]:
        title = s["title"] or "[untitled]"
        if len(title) > 140:
            title = title[:140].rstrip() + "..."
        named_rare.append({
            "idx":          s["idx"],
            "fp48Hex":      s["fp48Hex"],
            "hamming_min":  ham_min,
            "collection":   s["collection"],
            "author":       s["author"] or "Unknown",
            "title":        title,
            "year":         s["year"],
            "filename":     s["filename"],
            "url":          s["url"],
        })

    print("  top 5 rare:")
    for r in named_rare[:5]:
        print(f"    Hamming {r['hamming_min']:>2}/48  ·  {r['year']}  ·  {r['author'][:30]:<30}  ·  {r['title'][:70]}")

    # ---- Compose public artifact ----
    public = {
        "showcase":           "docsouth",
        "model_id":           model["id"],
        "tenant_id":          "docsouth_showcase",
        "name":               model["name"],
        "corpus_records":     model["corpus_records"],
        "corpus_bytes":       model["corpus_bytes"],
        "corpus_sha256":      model["corpus_sha256"],
        "corpus_format":      model["corpus_format"],
        "formed_at":          model["formed_at"],
        "formation_ms":       model["formation_ms"],
        "fingerprinter_mode": model["fingerprinter_mode"],
        "effective_strategy": model["effective_strategy"],
        "coverage_pct":       model["coverage_pct"],
        "response_digest":    model["response_digest"],
        "encrypted":          model.get("encrypted", True),
        "chunked":            model.get("chunked", {}),
        "adapter_chain":      model.get("adapter_chain", []),
        "taxonomy_summary": {
            "classes":          len(model["taxonomy"]["classes"]),
            "silhouette":       model["taxonomy"]["silhouette"],
            "null_test_z":      model["taxonomy"]["null_test_z"],
            "novel_class_count": model["taxonomy"]["novel_class_count"],
        },
        "persistence":        model.get("persistence"),
        "runpod":             model.get("runpod"),
        # New analyses
        "survivors_total":    len(survivors),
        "collections":        dict(Counter(s["collection"] for s in survivors)),
        "cluster_purity": {
            "weighted_purity": engine_purity,
            "classes":         cluster_purity,
        },
        "cross_collection_bleed": bleed_per_class,
        "baselines": baselines,
        "decade_centroids":   decade_data,
        "content_decade_drift": content_drift,
        "drift_summary": {
            "structural_avg":  avg_struct,
            "structural_max":  max_struct,
            "content_avg":     avg_content,
            "content_max":     max_content,
            "lift_avg":        round(avg_content - avg_struct, 2),
            "method":          "content fingerprint = Bloom-style 48-bit projection of top-32 TF-IDF terms (1-2 gram, English stop-words removed). Decade centroid = majority bit per position over the decade's records.",
        },
        "named_rare":         named_rare,
        "source": {
            "url":         "https://docsouth.unc.edu/docsouthdata/",
            "license":     "Open / public domain (DocSouth full-text archives)",
            "publisher":   "UNC Libraries · University of North Carolina at Chapel Hill",
            "collections": [
                "North American Slave Narratives",
                "First-Person Narratives of the American South",
                "Library of Southern Literature",
                "The Church in the Southern Black Community",
            ],
            "source_texts": 711,
        },
        "verification": {
            "instructions": "1) Re-download the four DocSouth ZIPs from https://docsouth.unc.edu/docsouthdata/ . 2) Re-run scripts/docsouth_harvest.py to produce docsouth.ndjson. 3) sha256sum docsouth.ndjson should equal corpus_sha256. 4) Re-form via POST /api/range-form with corpus_path, compute_persistence, use_runpod, seed=42. The response_digest is invariant under (corpus_sha256, model_id_within_tenant, seed).",
            "corpus_sha256_check": "Run sha256sum on the rebuilt /data/formed_models/_inputs/docsouth.ndjson.",
        },
        "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    PUBLIC_OUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUT.write_text(json.dumps(public, indent=2))
    size = PUBLIC_OUT.stat().st_size
    print(f"\nWrote {PUBLIC_OUT}  ({size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
