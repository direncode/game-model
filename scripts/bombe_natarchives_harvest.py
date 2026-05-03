#!/usr/bin/env python3
"""
Bombe National Archives harvest: catalogue-level descriptions of GC&CS / GCHQ
records held at The National Archives, Kew (HW department) -> deterministic
NDJSON for the existing BTUT formation pipeline.

This is a *catalogue metadata* substrate — archivist-written scope-and-content
prose for thousands of file/item-level records under the HW classes
(HW 1 directorate-to-PM, HW 5 German Army/Air Force high-grade decrypts,
 HW 12 diplomatic decrypts, HW 17 Comintern, HW 18 Naval Section,
 HW 33 Japanese Army, HW 56 Air Section weekly reports, etc).
The text per record is short, but the operational vocabulary varies sharply
between series, which is the variation the substrate is designed to surface
and the variation Wikipedia prose did not have.

Output NDJSON shape mirrors scripts/bombe_harvest.py so scripts/arxiv_analyze.py
runs unchanged with --corpus-path / --showcase-name.

Usage:
  python scripts/bombe_natarchives_harvest.py \\
      --output /opt/latentocean/data/formed_models/_inputs/bombe_tna.ndjson \\
      --target-records 5000

Source: Discovery API at The National Archives, Kew.
        https://discovery.nationalarchives.gov.uk/help/api
        Catalog descriptions are © Crown copyright but redistributable as
        catalogue data under the Open Government Licence v3.0.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

# Discovery API gates default User-Agents. Use a generic browser UA.
USER_AGENT = (
    "Mozilla/5.0 (compatible; LatentOcean-Bombe-TNA/1.0; "
    "+https://www.latentocean.com)"
)
SEARCH_URL   = "https://discovery.nationalarchives.gov.uk/API/search/v1/records"
CHILDREN_URL = "https://discovery.nationalarchives.gov.uk/API/records/v1/children"
THROTTLE = 0.5  # 2 req/sec — TNA's API is conservative on rate limits.

# ---------------------------------------------------------------------------
# DECISION POINT — which HW sub-series to harvest, and what label each gets.
#
# The "archive" tag is what the substrate's cluster purity is measured against.
# Pick series with operationally *distinct* vocabulary so a real clustering
# can surface them as separate clusters. Labels are short slugs (used in
# cluster-purity charts, so keep them human-readable). The titles after each
# tuple are the actual TNA catalog titles (verified against Discovery API
# Level3 search) so the labels accurately reflect what the records contain.
#
# Edit this list to focus or broaden the substrate.
# ---------------------------------------------------------------------------
SEED_SERIES = [
    # (citable_ref, label, catalog_title_snippet)
    ("HW 1",  "directorate_to_pm",       "Sigint passed to the Prime Minister"),
    ("HW 3",  "personal_papers",         "Personal papers, unofficial histories 1914-45"),
    ("HW 5",  "german_machine_decrypts", "German Section: German Army/AF high-grade machine decrypts"),
    ("HW 7",  "ww1_history",             "Room 40 and successors: WWI official histories"),
    ("HW 11", "ww2_history",             "WWII official histories"),
    ("HW 12", "diplomatic_decrypts",     "Diplomatic Section: decrypts of intercepted diplomatic comms"),
    ("HW 13", "sigint_summaries",        "WWII intelligence summaries based on sigint"),
    ("HW 14", "directorate_policy",      "Directorate: WWII policy papers"),
    ("HW 17", "comintern_decrypts",      "Decrypts of Communist International (COMINTERN) messages"),
    ("HW 18", "naval_section",           "Naval Section: German/Italian/French/Spanish/Portuguese navies"),
    ("HW 20", "tactical_sigint",         "Tactical sigint forwarded to allied commands"),
    ("HW 25", "cryptographic_studies",   "Cryptographic studies"),
    ("HW 33", "japanese_army",           "Military Section: reports of Japanese Army decrypts"),
    ("HW 34", "rss_admin",               "Administration files on the Radio Security Service"),
    ("HW 43", "british_sigint_history",  "Histories of British Sigint"),
    ("HW 50", "history_writing",         "Records re writing the history of British signals"),
    ("HW 56", "air_section",             "Air Section: weekly reports"),
    ("HW 67", "japanese_sigint",         "Signals intelligence on Japanese communications"),
]

# ---------------------------------------------------------------------------
# DECISION POINT — text fusion strategy.
#
# Each Discovery record carries a few short fields. The fingerprinter needs
# enough textual mass to produce a usable n-gram fingerprint. Trade-offs:
#
#  (a) desc_only: tightest per-record signal, but ~30% of records are below
#      80 chars and get dropped (same threshold as bombe_harvest.py).
#  (b) title_desc: usually 80-300 chars; covers most records.
#  (c) title_desc_dates (default): adds reference + dates as a stable header
#      ("HW 1/1698 (1943 May 20)") that the n-gram fingerprinter picks up.
#  (d) title_desc_context: adds the parent series's prose to every child —
#      richer per record but BIASES the substrate toward SEED_SERIES labels
#      (each child inherits the series-level vocabulary). Use (c) when you
#      want the discovery story to be honest; use (d) for denser signal.
# ---------------------------------------------------------------------------
TEXT_FUSION = "title_desc_dates"  # one of: desc_only | title_desc | title_desc_dates | title_desc_context

WS_RE       = re.compile(r"[ \t]+")
NEWLINES_RE = re.compile(r"\n{3,}")
TAGS_RE     = re.compile(r"<[^>]+>")
ENTITY_RE   = re.compile(r"&#34")  # Discovery uses &#34 (no ;) for embedded quotes

_last_req = 0.0


def _http_get(url: str, params: dict | None = None) -> dict:
    """GET a Discovery API endpoint, throttled, with retry."""
    global _last_req
    since = time.time() - _last_req
    if since < THROTTLE:
        time.sleep(THROTTLE - since)
    if params:
        qs = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
        full = f"{url}?{qs}"
    else:
        full = url
    req = urllib.request.Request(
        full,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                _last_req = time.time()
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            last_err = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Discovery API failed after 3 attempts: {full[:100]} -> {last_err}")


def resolve_series_id(reference: str) -> tuple[str, str]:
    """Find the Level3 (series-level) catalogueId + title for a citable ref
    like 'HW 1'. Series-level records all live at catalogueLevel == 3."""
    params = {
        "sps.references":      reference,
        "sps.heldByCode":      "TNA",
        "sps.catalogueLevels": "Level3",
        "sps.batchSize":       "5",
        "sps.startIndex":      "0",
    }
    resp = _http_get(SEARCH_URL, params)
    for rec in resp.get("records", []) or []:
        if (rec.get("reference") or "") == reference:
            return rec.get("id") or "", rec.get("title") or ""
    raise RuntimeError(f"could not resolve series-level id for {reference}")


def fetch_children(cat_id: str, limit: int = 500) -> list[dict]:
    """Fetch up to `limit` (max ~500) child records of a series by catalogueId.

    The /children/<id> endpoint returns a richer structure than the search
    endpoint: scopeContent.description carries the archivist's full scope
    prose, not just the search-result snippet. We accept the 500-cap; with
    18 SEED_SERIES that's a 9k-record ceiling, well above target_records.
    """
    resp = _http_get(f"{CHILDREN_URL}/{cat_id}", {"limit": str(limit)})
    return resp.get("assets", []) or []


def clean_text(s: str | None) -> str:
    """Strip XML/HTML tags, decode entities, normalize whitespace.

    Discovery returns scope-and-content as embedded EAD-style XML, e.g.
    "<scopecontent><head>Scope</head><p>Records of...</p></scopecontent>".
    Also uses bare numeric-entity refs (&#34 with no ;) for embedded quotes.
    """
    if not s:
        return ""
    s = ENTITY_RE.sub('"', s)
    s = html.unescape(s)
    s = TAGS_RE.sub(" ", s)
    s = WS_RE.sub(" ", s)
    s = NEWLINES_RE.sub("\n\n", s)
    return s.strip()


def get_record_fields(rec: dict) -> dict:
    """Normalize a /children/ asset into the fields we use downstream.

    The /children/ response shape differs from the /search/ response:
      - Title is in scopeContent.description (or sometimes nested EAD)
      - Citable reference is in `citableReference`
      - Description is in scopeContent.description (rich EAD prose)
      - Covering dates are in `coveringDates`
    """
    citable    = rec.get("citableReference") or ""
    cat_id     = str(rec.get("catalogueId") or "")
    sc         = rec.get("scopeContent") or {}
    desc_xml   = sc.get("description") or rec.get("description") or ""
    desc       = clean_text(desc_xml)
    title      = clean_text(rec.get("title") or desc_xml)
    dates      = rec.get("coveringDates") or ""
    start_y    = rec.get("coveringFromDate") or 0
    return {
        "id":        f"C{cat_id}" if cat_id and not cat_id.startswith("C") else cat_id,
        "reference": citable,
        "title":     title,
        "desc":      desc,
        "dates":     dates,
        "year":      int(str(start_y)[:4]) if start_y else 0,
    }


def fuse_text(fields: dict, mode: str = TEXT_FUSION) -> str:
    """Apply the chosen text-fusion strategy. Returns "" if record has
    insufficient text under the chosen strategy.

    For many HW records the search-result title and the scopeContent
    description are the same string (the children endpoint returns
    description-as-title). Dedupe so the fingerprinter doesn't see
    duplicated text mass.
    """
    title    = fields["title"]
    desc     = fields["desc"]
    refcode  = fields["reference"]
    dates    = fields["dates"]

    # Dedup title vs desc when one is a strict prefix/suffix of the other
    # or they're equal after whitespace-strip.
    if title and desc and (title.strip() == desc.strip()
                           or desc.strip().startswith(title.strip())):
        title = ""
    elif title and desc and title.strip().startswith(desc.strip()):
        desc = ""

    if mode == "desc_only":
        return desc
    if mode == "title_desc":
        return "\n\n".join(p for p in (title, desc) if p).strip()
    if mode == "title_desc_dates":
        head = f"{refcode} ({dates})".strip(" ()")
        body = "\n\n".join(p for p in (title, desc) if p)
        return f"{head}\n\n{body}".strip() if body else ""
    if mode == "title_desc_context":
        # Used in run() with series-context injected by caller via fields["context"].
        ctx = fields.get("context") or ""
        return "\n\n".join(p for p in (ctx, title, desc) if p).strip()
    raise ValueError(f"unknown TEXT_FUSION mode: {mode}")


def run(output_path: Path, target_records: int) -> dict:
    print(f"Harvesting up to {target_records} TNA HW catalogue records "
          f"across {len(SEED_SERIES)} series with TEXT_FUSION={TEXT_FUSION}...")

    # Stage 1 — resolve each citable reference to its Level3 catalogueId.
    series_ids: list[tuple[str, str, str, str]] = []  # (ref, label, cat_id, title)
    for ref, label, _ in SEED_SERIES:
        try:
            cat_id, title = resolve_series_id(ref)
            series_ids.append((ref, label, cat_id, title))
            print(f"  resolved {ref:6s} -> {cat_id:8s}  ({label})")
        except Exception as e:
            print(f"  could not resolve {ref}: {e}", file=sys.stderr)

    # Stage 2 — fetch up to 500 children per series, deterministic order.
    series_records: dict[str, list[dict]] = {}  # ref -> list of children
    series_context: dict[str, str] = {}         # ref -> series-level prose (for title_desc_context mode)
    for ref, label, cat_id, title in series_ids:
        kids = fetch_children(cat_id, limit=500)
        # Deterministic order: by reference within series.
        kids.sort(key=lambda k: (k.get("citableReference") or "", k.get("catalogueId") or 0))
        series_records[ref] = kids
        series_context[ref] = clean_text(title)
        print(f"  {ref:6s} ({label:25s}): {len(kids)} children")

    # Stage 3 — round-robin flatten across series so the target_records
    # budget spans ALL series fairly. Without this, the first big series
    # (HW 1, 500 children) eats the entire budget. Determinism: outer loop
    # is record-index, inner loop is series order from SEED_SERIES.
    flat: list[tuple[dict, str, str]] = []  # (asset, ref, label)
    max_per_series = max(len(v) for v in series_records.values()) if series_records else 0
    for idx in range(max_per_series):
        for ref, label, _, _ in series_ids:
            kids = series_records.get(ref, [])
            if idx < len(kids):
                flat.append((kids[idx], ref, label))
                if len(flat) >= target_records:
                    break
        if len(flat) >= target_records:
            break

    print(f"\nStage 4 — emitting NDJSON for {len(flat)} records...")

    # Stage 4 — emit NDJSON with the chosen text-fusion strategy.
    output_path.parent.mkdir(parents=True, exist_ok=True)
    kept = 0
    skipped_thin = 0
    seen_ids: set[str] = set()
    with output_path.open("w", encoding="utf-8", newline="\n") as out:
        for asset, ref, label in flat:
            f = get_record_fields(asset)
            if not f["id"] or f["id"] in seen_ids:
                continue
            seen_ids.add(f["id"])
            f["context"] = series_context.get(ref, "")

            text_body = fuse_text(f)
            if len(text_body) < 80:
                skipped_thin += 1
                continue

            row = {
                "paper_id":          f["id"],
                "wikipedia_url":     f"https://discovery.nationalarchives.gov.uk/details/r/{f['id']}",
                "primary_category":  ref,    # e.g. "HW 5"
                "archive":           label,  # e.g. "german_machine_decrypts"
                "categories":        [ref, "HW", "TNA"],
                "year":              f["year"],
                "authors_count":     0,
                "title":             f["title"] or f["reference"] or f["id"],
                "abstract":          f["desc"] or text_body[: min(400, len(text_body))],
                "text":              text_body,
            }
            out.write(json.dumps(row, sort_keys=True, ensure_ascii=False, separators=(",", ":")))
            out.write("\n")
            kept += 1

    return {
        "series_attempted":  len(SEED_SERIES),
        "series_resolved":   len(series_ids),
        "records_seen":      sum(len(v) for v in series_records.values()),
        "records_kept":      kept,
        "skipped_thin":      skipped_thin,
        "text_fusion_mode":  TEXT_FUSION,
        "output_path":       str(output_path),
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
    p.add_argument("--target-records", type=int, default=5000)
    args = p.parse_args(argv)

    stats = run(args.output, args.target_records)
    print(json.dumps(stats, indent=2))
    print(f"corpus_sha256: {file_sha256(args.output)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
