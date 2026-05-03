#!/usr/bin/env python3
"""
Bombe harvest: Wikipedia public-domain corpus of WWII signals intelligence
articles -> deterministic NDJSON for the existing BTUT formation pipeline.

This is the historical-archive reanalysis the /bombe showcase claimed was
queued. It is structural analysis of public-domain *text* (Wikipedia
articles about Bletchley Park, codebreakers, WWII operations, the Enigma
machine, the GC&CS) — no cryptanalysis, no cipher work.

The output NDJSON shape mirrors arxiv_harvest.py so scripts/arxiv_analyze.py
can run unchanged with --output overridden.

Usage:
  python scripts/bombe_harvest.py \\
      --output /opt/latentocean/data/formed_models/_inputs/bombe.ndjson \\
      --target-articles 600
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

USER_AGENT = "LatentOcean-Bombe-Harvest/1.0 (https://www.latentocean.com)"
WIKI_API = "https://en.wikipedia.org/w/api.php"
THROTTLE = 0.25  # 4 req/sec, well within Wikipedia limits

# Categories chosen to span the major facets of WWII signals intelligence:
# people (codebreakers, operators), places (Bletchley huts, outstations),
# machines (Enigma, Bombe, Colossus), concepts (cryptanalysis methods),
# operations (specific intelligence operations), units (military groups).
SEED_CATEGORIES = [
    ("Bletchley_Park",                              "place"),
    ("Bletchley_Park_people",                       "people"),
    ("Enigma_machine",                              "machine"),
    ("Cipher_machines",                             "machine"),
    ("Cryptanalysis_of_the_Enigma",                 "operation"),
    ("World_War_II_intelligence_operations",        "operation"),
    ("Cryptanalysts",                               "people"),
    ("British_cryptographers",                      "people"),
    ("American_cryptographers",                     "people"),
    ("German_cryptographers",                       "people"),
    ("Polish_cryptographers",                       "people"),
    ("Codebreaking",                                "concept"),
    ("Allied_intelligence_organisations_of_World_War_II", "organization"),
    ("Espionage_in_World_War_II",                   "operation"),
    ("Cryptography_organizations",                  "organization"),
]

PARENS_RE = re.compile(r"\s*\([^)]*\)")
WS_RE     = re.compile(r"[ \t]+")
NEWLINES_RE = re.compile(r"\n{3,}")

_last_req = 0.0


def _get(params: dict) -> dict:
    """GET against the Wikipedia API, throttled."""
    global _last_req
    since = time.time() - _last_req
    if since < THROTTLE:
        time.sleep(THROTTLE - since)
    qs = urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    req = urllib.request.Request(
        f"{WIKI_API}?{qs}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        _last_req = time.time()
        return json.loads(r.read().decode("utf-8"))


def list_category_members(category: str, limit: int = 500) -> list[dict]:
    """Return article-type members of Category:<category>."""
    out = []
    cont = None
    while True:
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Category:{category}",
            "cmlimit": min(500, limit - len(out)),
            "cmtype": "page",  # exclude sub-categories
            "cmnamespace": "0",  # main namespace only
        }
        if cont:
            params["cmcontinue"] = cont
        resp = _get(params)
        members = resp.get("query", {}).get("categorymembers", [])
        out.extend(members)
        cont = resp.get("continue", {}).get("cmcontinue")
        if not cont or len(out) >= limit:
            break
    return out[:limit]


def fetch_extracts(pageids: list[int]) -> dict[int, dict]:
    """Fetch plain-text intro extracts for a batch of pageids. Wikipedia caps
    extract requests at 20 pages per call; this batches accordingly.
    """
    out: dict[int, dict] = {}
    for i in range(0, len(pageids), 20):
        batch = pageids[i : i + 20]
        params = {
            "action":      "query",
            "prop":        "extracts|categories|info",
            "exintro":     "1",
            "explaintext": "1",
            "exlimit":     "20",
            "cllimit":     "max",
            "inprop":      "url",
            "pageids":     "|".join(str(p) for p in batch),
        }
        try:
            resp = _get(params)
        except Exception as e:
            print(f"  fetch_extracts error: {e}", file=sys.stderr)
            continue
        for page in resp.get("query", {}).get("pages", []):
            pid = page.get("pageid")
            if not pid:
                continue
            cats = [c.get("title", "") for c in page.get("categories", [])]
            out[pid] = {
                "title":      page.get("title", ""),
                "extract":    page.get("extract", ""),
                "url":        page.get("fullurl", ""),
                "categories": cats,
            }
    return out


def normalize_extract(text: str) -> str:
    if not text:
        return ""
    text = PARENS_RE.sub("", text)
    text = WS_RE.sub(" ", text)
    text = NEWLINES_RE.sub("\n\n", text)
    return text.strip()


def run(output_path: Path, target_articles: int) -> dict:
    print(f"Harvesting up to {target_articles} Wikipedia articles across "
          f"{len(SEED_CATEGORIES)} category roots...")

    # Stage 1 — collect candidate (pageid, title, archive) triples by walking
    # the seed categories. Dedupe by pageid.
    candidates: dict[int, tuple[str, str]] = {}  # pageid -> (title, archive)
    for cat, archive in SEED_CATEGORIES:
        members = list_category_members(cat, limit=200)
        for m in members:
            pid = m.get("pageid")
            title = m.get("title", "")
            if not pid or not title:
                continue
            # Keep the first archive a page is found under (deterministic
            # ordering since SEED_CATEGORIES is fixed)
            if pid not in candidates:
                candidates[pid] = (title, archive)
        print(f"  Category:{cat}: {len(members)} members "
              f"({len(candidates)} unique so far)")

    # Cap at target
    sorted_pids = sorted(candidates.keys())[:target_articles]
    print(f"\nFetching extracts for {len(sorted_pids)} pages...")

    # Stage 2 — fetch extracts in batches of 20.
    extracts = fetch_extracts(sorted_pids)
    print(f"  got extracts for {len(extracts)} pages")

    # Stage 3 — emit NDJSON in deterministic order.
    output_path.parent.mkdir(parents=True, exist_ok=True)
    kept = 0
    skipped_empty = 0
    with output_path.open("w", encoding="utf-8", newline="\n") as out:
        for pid in sorted_pids:
            if pid not in extracts:
                continue
            ext = extracts[pid]
            extract_text = normalize_extract(ext["extract"])
            if len(extract_text) < 80:  # skip stubs
                skipped_empty += 1
                continue
            title, archive = candidates[pid]
            rec = {
                "paper_id":          str(pid),
                "wikipedia_url":     ext["url"],
                "primary_category":  archive,
                "archive":           archive,
                "categories":        ext["categories"][:8],
                "year":              0,  # Wikipedia article subjects span centuries; leave empty
                "authors_count":     0,
                "title":             title,
                "abstract":          extract_text,
                "text":              f"{title}\n\n{extract_text}",
            }
            out.write(json.dumps(rec, sort_keys=True, ensure_ascii=False, separators=(",", ":")))
            out.write("\n")
            kept += 1

    return {
        "candidates_seen":    len(candidates),
        "extracts_fetched":   len(extracts),
        "kept":               kept,
        "skipped_empty":      skipped_empty,
        "output_path":        str(output_path),
    }


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--target-articles", type=int, default=600)
    args = p.parse_args(argv)

    stats = run(args.output, args.target_articles)
    print(json.dumps(stats, indent=2))
    print(f"corpus_sha256: {file_sha256(args.output)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
