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
import json
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

CORPUS_PATH = Path("/opt/latentocean/data/formed_models/_inputs/docsouth.ndjson")
PUBLIC_OUT  = Path("/opt/latentocean/data/formed_models/_public/docsouth.json")
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
        })
    print(f"  {len(survivors):,} survivors joined  (missing: {missing})")

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
    weighted_purity = round(weighted / total, 3) if total else 0.0
    print(f"  weighted purity = {weighted_purity}")
    for cp in cluster_purity[:5]:
        print(f"  class #{cp['class_id']}: {cp['size']} survivors  dom={cp['dominant_collection'][:25]} ({int(cp['dominant_share']*100)}%)")

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
            "weighted_purity": weighted_purity,
            "classes":         cluster_purity,
        },
        "decade_centroids":   decade_data,
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
