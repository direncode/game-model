"""arXiv ingestion adapter for LATK.

Uses the public arXiv API (http://export.arxiv.org/api/query) to fetch
paper metadata and abstracts. Designed for Phase 1 of LATK (physics at
scale) and beyond.

Rate limits
-----------
The arXiv API recommends no more than 1 request every 3 seconds and
discourages more than 1000 results per request. This module respects
both constraints by default.

Usage
-----
    from latk_tool.ingest.arxiv_ingest import fetch_arxiv_category
    records = fetch_arxiv_category(
        category="physics.gen-ph",
        max_results=100,
        start_year=2020,
    )

Phase 0 note
------------
This adapter is scaffolded but not invoked in Phase 0 because it
requires a network call. The Phase 0 scaling test uses the existing
validated domain corpora already on disk. This adapter is ready to
run as the first task of Phase 1.
"""

from __future__ import annotations

import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import List, Optional
from xml.etree import ElementTree as ET

from . import PaperRecord


ARXIV_API_BASE = "http://export.arxiv.org/api/query"
ARXIV_NAMESPACE = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom",
}
ARXIV_RATE_LIMIT_SECONDS = 3.0


@dataclass
class ArxivFetchResult:
    records: List[PaperRecord]
    total_results: int
    fetched: int
    next_start: int


def _parse_entry(entry: ET.Element) -> Optional[PaperRecord]:
    try:
        arxiv_id_raw = entry.findtext("atom:id", default="", namespaces=ARXIV_NAMESPACE)
        arxiv_id = arxiv_id_raw.rsplit("/", 1)[-1] if arxiv_id_raw else ""
        title = (entry.findtext("atom:title", default="", namespaces=ARXIV_NAMESPACE) or "").strip()
        abstract = (entry.findtext("atom:summary", default="", namespaces=ARXIV_NAMESPACE) or "").strip()
        published = entry.findtext("atom:published", default="", namespaces=ARXIV_NAMESPACE) or ""
        year = int(published[:4]) if len(published) >= 4 and published[:4].isdigit() else None

        authors = []
        for author in entry.findall("atom:author", namespaces=ARXIV_NAMESPACE):
            name = author.findtext("atom:name", default="", namespaces=ARXIV_NAMESPACE)
            if name:
                authors.append(name.strip())

        category = None
        primary = entry.find("arxiv:primary_category", namespaces=ARXIV_NAMESPACE)
        if primary is not None:
            category = primary.get("term")

        if not arxiv_id or not title:
            return None

        return PaperRecord(
            paper_id=f"arxiv__{arxiv_id}",
            title=title,
            abstract=abstract,
            full_text=abstract,  # full text requires per-paper PDF fetch
            authors=authors,
            published_year=year,
            source="arxiv",
            category=category,
            regime="modern" if year and year >= 1991 else "historical",
            url=f"https://arxiv.org/abs/{arxiv_id}",
        )
    except Exception as exc:  # pragma: no cover
        print(f"[arxiv_ingest] failed to parse entry: {exc}")
        return None


def fetch_arxiv_page(
    search_query: str,
    start: int = 0,
    max_results: int = 100,
    user_agent: str = "LATK/0.1 (research tool; mailto:latk@example.invalid)",
) -> ArxivFetchResult:
    """Fetch one page of arXiv results.

    Respects the arXiv rate limit via the `time.sleep` call at the end.
    """
    params = {
        "search_query": search_query,
        "start": str(start),
        "max_results": str(max_results),
    }
    url = f"{ARXIV_API_BASE}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": user_agent})

    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read()

    root = ET.fromstring(body)

    total_results = 0
    total_el = root.find("{http://a9.com/-/spec/opensearch/1.1/}totalResults")
    if total_el is not None and total_el.text:
        try:
            total_results = int(total_el.text)
        except ValueError:
            total_results = 0

    records: List[PaperRecord] = []
    for entry in root.findall("atom:entry", namespaces=ARXIV_NAMESPACE):
        rec = _parse_entry(entry)
        if rec is not None:
            records.append(rec)

    time.sleep(ARXIV_RATE_LIMIT_SECONDS)

    return ArxivFetchResult(
        records=records,
        total_results=total_results,
        fetched=len(records),
        next_start=start + len(records),
    )


def fetch_arxiv_category(
    category: str,
    max_results: int = 100,
    start_year: Optional[int] = None,
    page_size: int = 100,
) -> List[PaperRecord]:
    """Fetch all papers from an arXiv category, up to max_results.

    Paginates through the arXiv API respecting rate limits. For Phase 1
    (physics at scale) expects max_results in the millions; for Phase 0
    testing, use small values (~50-200).
    """
    query = f"cat:{category}"
    if start_year is not None:
        query += f" AND submittedDate:[{start_year}0101 TO 22000101]"

    out: List[PaperRecord] = []
    start = 0
    while len(out) < max_results:
        batch = min(page_size, max_results - len(out))
        page = fetch_arxiv_page(query, start=start, max_results=batch)
        if not page.records:
            break
        out.extend(page.records)
        start = page.next_start
        if page.fetched < batch:
            break

    return out
