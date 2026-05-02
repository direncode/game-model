#!/usr/bin/env python3
"""
Receipt fetch: SEC EDGAR -> 1,000 stratified 10-K filings.

Pulls SEC's quarterly form.idx files (2018-2025), filters to 10-K, samples
deterministically across years, fetches each filing's primary document,
extracts Items 1, 1A, 7, 8, and writes <accession>.txt to the output dir.

This is the ad-hoc operator-time fetcher referenced in the Receipt runbook.
It's NOT shipped as part of receipt_harvest.py because the actual harvest
step (the deterministic manifest builder) reads from the .txt files this
fetcher produces.

USER_AGENT identifies the fetcher per SEC's required policy.
Throttle: 0.105s between requests (just under 10 req/sec).

Usage:
  python scripts/receipt_fetch.py --output-dir /tmp/sec_edgar_filings/ --target-n 1000
"""
from __future__ import annotations

import argparse
import re
import sys
import time
import urllib.request
from pathlib import Path

USER_AGENT = "Diren Kumaratilleke direnavk@outlook.com"
EDGAR_BASE = "https://www.sec.gov"
THROTTLE = 0.11

# Items to extract from 10-K text. The regex looks for the boundary between
# section heads (allow flexible whitespace + page numbers).
ITEM_HEADERS = [
    (re.compile(r"\bITEM\s+1\.?\s+BUSINESS\b", re.IGNORECASE),       "ITEM 1. BUSINESS"),
    (re.compile(r"\bITEM\s+1A\.?\s+RISK\s+FACTORS\b", re.IGNORECASE), "ITEM 1A. RISK FACTORS"),
    (re.compile(r"\bITEM\s+7\.?\s+MANAGEMENT", re.IGNORECASE),       "ITEM 7. MANAGEMENT DISCUSSION"),
    (re.compile(r"\bITEM\s+8\.?\s+(FINANCIAL|CONSOLIDATED)\b", re.IGNORECASE), "ITEM 8. FINANCIAL STATEMENTS"),
    (re.compile(r"\bITEM\s+9\.?\s+", re.IGNORECASE),                  "ITEM 9 (boundary)"),
]

HTML_TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")

_last_req = 0.0


def get(url: str, accept_404: bool = False) -> str | None:
    global _last_req
    since = time.time() - _last_req
    if since < THROTTLE:
        time.sleep(THROTTLE - since)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            _last_req = time.time()
            return r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        _last_req = time.time()
        if accept_404 and e.code == 404:
            return None
        raise


def parse_form_idx(idx_text: str) -> list[dict]:
    """Each form.idx row is whitespace-padded:
      Form Type    Company Name    CIK    Date Filed    Filename
    We only care about 10-K rows.
    """
    out: list[dict] = []
    started = False
    for line in idx_text.splitlines():
        if not started:
            if line.startswith("---"):
                started = True
            continue
        # Form-type column is the first ~12 chars
        form_type = line[:12].strip()
        if form_type != "10-K":
            continue
        rest = line[12:]
        # CIK is 10 chars somewhere in the middle, before date YYYY-MM-DD
        m = re.match(r"\s*(.+?)\s{2,}(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\S+)\s*$", rest)
        if not m:
            continue
        company, cik, date, filename = m.groups()
        out.append({
            "company":  company.strip(),
            "cik":      cik,
            "date":     date,
            "filename": filename,
        })
    return out


def stratified_sample(rows: list[dict], target_per_year: int, years: list[int]) -> list[dict]:
    """Stride-sample rows into target_per_year per year."""
    by_year: dict[int, list[dict]] = {y: [] for y in years}
    for r in rows:
        y = int(r["date"][:4])
        if y in by_year:
            by_year[y].append(r)
    out: list[dict] = []
    for y in sorted(by_year.keys()):
        items = sorted(by_year[y], key=lambda r: r["filename"])
        if len(items) <= target_per_year:
            out.extend(items)
        else:
            step = len(items) / target_per_year
            out.extend(items[int(i * step)] for i in range(target_per_year))
    return out


def accession_from_filename(filename: str) -> str | None:
    """Extract accession from 'edgar/data/CIK/0001234567-24-000123-index.htm' or similar.
    The .txt master file is at .../<accession>-index.htm or .../<accession>.txt"""
    # filename is like edgar/data/320193/0000320193-24-000123-index.htm
    m = re.search(r"(\d{10}-\d{2}-\d{6})", filename)
    if m:
        return m.group(1)
    return None


def filing_index_url(cik: str, accession: str) -> str:
    cik_int = int(cik)
    a_clean = accession.replace("-", "")
    return f"{EDGAR_BASE}/Archives/edgar/data/{cik_int}/{a_clean}/index.json"


def fetch_filing_text(cik: str, accession: str) -> str | None:
    """Fetch the 10-K's primary document and return its plain text content.
    Tries the JSON index first to find the primary doc; falls back to .htm patterns.
    """
    idx = get(filing_index_url(cik, accession), accept_404=True)
    if not idx:
        return None
    try:
        import json
        meta = json.loads(idx)
        items = meta.get("directory", {}).get("item", [])
        # Primary doc heuristic: the .htm whose name matches the accession or is the largest
        candidates = [it for it in items if it.get("name", "").lower().endswith((".htm", ".html"))]
        if not candidates:
            return None
        # Pick the largest (excludes the index.htm itself which is small)
        candidates.sort(key=lambda it: int(it.get("size", 0)), reverse=True)
        primary = candidates[0]["name"]
    except Exception:
        return None

    cik_int = int(cik)
    a_clean = accession.replace("-", "")
    doc_url = f"{EDGAR_BASE}/Archives/edgar/data/{cik_int}/{a_clean}/{primary}"
    html = get(doc_url, accept_404=True)
    if not html:
        return None
    # Strip HTML, collapse whitespace
    text = HTML_TAG_RE.sub(" ", html)
    text = WS_RE.sub(" ", text)
    return text


def truncate_to_items(text: str, max_chars: int = 200_000) -> str:
    """Extract Item 1 + 1A + 7 + 8 (until Item 9). Falls back to first max_chars
    of the text if section detection fails."""
    matches = []
    for pat, label in ITEM_HEADERS:
        m = pat.search(text)
        if m:
            matches.append((m.start(), label, m))
    if len(matches) < 2:
        return text[:max_chars]
    matches.sort(key=lambda x: x[0])
    # The text we want is from the FIRST occurrence of "ITEM 1." onwards,
    # truncated at the FIRST occurrence of "ITEM 9" if present.
    start = matches[0][0]
    end = len(text)
    for pos, label, _ in matches:
        if "ITEM 9" in label:
            end = pos
            break
    extracted = text[start:end]
    return extracted[:max_chars]


def run(output_dir: Path, target_n: int) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    years = list(range(2018, 2026))  # 2018-2025
    target_per_year = target_n // len(years)

    print(f"Receipt SEC fetch: target {target_n} filings, {target_per_year}/year across {years}")

    # Pull all per-quarter form.idx for these years
    all_filings: list[dict] = []
    for year in years:
        for qtr in (1, 2, 3, 4):
            url = f"{EDGAR_BASE}/Archives/edgar/full-index/{year}/QTR{qtr}/form.idx"
            idx = get(url, accept_404=True)
            if not idx:
                print(f"  [{year} Q{qtr}] no form.idx (skipped)")
                continue
            rows = parse_form_idx(idx)
            print(f"  [{year} Q{qtr}] {len(rows)} 10-K rows")
            all_filings.extend(rows)

    print(f"Total 10-K rows pulled: {len(all_filings)}")

    sampled = stratified_sample(all_filings, target_per_year, years)
    sampled = sampled[:target_n]
    print(f"After stratified sample: {len(sampled)} filings")

    # Fetch each filing's text
    fetched = 0
    skipped = 0
    failed = 0
    for i, row in enumerate(sampled, start=1):
        accession = accession_from_filename(row["filename"])
        if not accession:
            skipped += 1
            continue
        out_path = output_dir / f"{accession}.txt"
        if out_path.exists() and out_path.stat().st_size > 1000:
            print(f"  [{i}/{len(sampled)}] {accession}: cached ({out_path.stat().st_size} bytes)")
            fetched += 1
            continue
        text = fetch_filing_text(row["cik"], accession)
        if not text or len(text) < 1000:
            failed += 1
            print(f"  [{i}/{len(sampled)}] {accession}: fetch failed or too small")
            continue
        truncated = truncate_to_items(text)
        out_path.write_text(truncated, encoding="utf-8", errors="replace")
        fetched += 1
        if i % 25 == 0:
            print(f"  [{i}/{len(sampled)}] {accession}: ok ({len(truncated)} chars)")

    return {
        "target_n":   target_n,
        "fetched":    fetched,
        "skipped":    skipped,
        "failed":     failed,
        "output_dir": str(output_dir),
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--output-dir", required=True, type=Path)
    p.add_argument("--target-n", type=int, default=1000)
    args = p.parse_args(argv)

    stats = run(args.output_dir, args.target_n)
    import json
    print(json.dumps(stats, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
