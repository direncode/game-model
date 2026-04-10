"""Generic text directory ingestion for LATK.

Reads a directory of .txt files and produces normalized PaperRecord
objects suitable for the LATK entity builder. This is the simplest
ingestion adapter and is used for the Phase 0 scaling test.

Usage
-----
    from latk_tool.ingest.text_ingest import ingest_text_directory
    records = ingest_text_directory(
        "scripts/cross_era_analysis/documents",
        regime="linguistics",
    )
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import List, Optional

from . import PaperRecord


_YEAR_RE = re.compile(r"\b(1[6-9]\d{2}|20\d{2})\b")
_AUTHOR_RE = re.compile(r"(?i)^\s*(?:by|author[s]?)\s*[:\-]\s*(.+)$")


def _guess_year(text: str) -> Optional[int]:
    match = _YEAR_RE.search(text[:2000])
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None
    return None


def _guess_authors(text: str) -> List[str]:
    for line in text.splitlines()[:10]:
        m = _AUTHOR_RE.match(line)
        if m:
            chunk = m.group(1)
            return [a.strip() for a in re.split(r",| and ", chunk) if a.strip()]
    return []


def _guess_title(filename: str, text: str) -> str:
    first = text.strip().splitlines()[0] if text.strip() else ""
    if first and len(first) < 200 and not first.lower().startswith("source"):
        return first
    return Path(filename).stem.replace("_", " ").title()


def ingest_text_file(
    path: str | Path,
    regime: Optional[str] = None,
    source: str = "local_text",
) -> PaperRecord:
    """Read a single .txt file and produce a PaperRecord."""
    path = Path(path)
    text = path.read_text(encoding="utf-8", errors="ignore")

    title = _guess_title(path.name, text)
    year = _guess_year(text)
    authors = _guess_authors(text)

    abstract = "\n".join(text.strip().splitlines()[:10])

    return PaperRecord(
        paper_id=f"{source}__{path.stem}",
        title=title,
        abstract=abstract,
        full_text=text,
        authors=authors,
        published_year=year,
        source=source,
        regime=regime,
        url=None,
    )


def ingest_text_directory(
    directory: str | Path,
    regime: Optional[str] = None,
    pattern: str = "*.txt",
    recursive: bool = False,
) -> List[PaperRecord]:
    """Read all text files in a directory and produce PaperRecord list.

    Parameters
    ----------
    directory : str or Path
        The directory to scan.
    regime : str, optional
        A regime label applied to every record.
    pattern : str
        Glob pattern for files to include.
    recursive : bool
        If True, descends into subdirectories.

    Returns
    -------
    list of PaperRecord
    """
    directory = Path(directory)
    if not directory.exists():
        raise FileNotFoundError(f"Directory not found: {directory}")

    iterator = directory.rglob(pattern) if recursive else directory.glob(pattern)

    records: List[PaperRecord] = []
    for p in sorted(iterator):
        if p.is_file():
            try:
                records.append(ingest_text_file(p, regime=regime))
            except Exception as exc:  # pragma: no cover
                print(f"[text_ingest] skip {p}: {exc}")
    return records
