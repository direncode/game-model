#!/usr/bin/env python3
"""
DocSouth harvest → NDJSON corpus for Latent Ocean.

Walks the four DocSouth ZIP-extracted collections under WORKDIR, parses
each toc.csv for metadata (Filename, Author, Title, Date, URL),
loads the corresponding plain-text file, lightly cleans it (strips
[Image] markers, [Page N] page numbers, bibliographic headers), and
splits the body into ~2000-word segments. Each segment becomes one
NDJSON record:

  {"collection": "...", "filename": "...", "author": "...",
   "title": "...", "year": "1845", "segment_idx": 0,
   "total_segments": 17, "text": "..."}

The output corpus is written to OUT_PATH.

Run on the EC2 (where the DocSouth ZIPs are already extracted to
/tmp/docsouth_work) so the corpus lands directly on the bind-mount
at /opt/latentocean/data/formed_models/_inputs/docsouth.ndjson.
"""
from __future__ import annotations
import csv
import io
import json
import os
import re
import sys
from pathlib import Path

WORKDIR = Path("/tmp/docsouth_work")
OUT_PATH = Path("/opt/latentocean/data/formed_models/_inputs/docsouth.ndjson")
SEGMENT_TARGET_WORDS = 250   # paragraph-sized chunks (BTUT bridge body stays modest)
MAX_SEGMENTS_PER_TEXT = 60   # cap so a 200k-word text can't dominate the corpus

COLLECTIONS = {
    "church-southern-black-community":         "Church in the Southern Black Community",
    "first-person-narratives-american-south":  "First-Person Narratives of the American South",
    "library-southern-literature":             "Library of Southern Literature",
    "na-slave-narratives":                     "North American Slave Narratives",
}

IMAGE_RE   = re.compile(r"\[(?:Cover|Title Page|Frontispiece|Title Page Verso|Image|Illustration)[^\]]*\]")
PAGE_RE    = re.compile(r"\[Page\s+\d+[a-zA-Z]?\]")
BRACKET_RE = re.compile(r"\[\s*sic\s*\]")
WS_RE      = re.compile(r"[ \t]+")


def clean(text: str) -> str:
    text = IMAGE_RE.sub("", text)
    text = PAGE_RE.sub("", text)
    text = BRACKET_RE.sub("[sic]", text)
    text = WS_RE.sub(" ", text)
    # collapse triple+ newlines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def year_of(date_field: str) -> str:
    """Extract a 4-digit year from a varied date string. Default empty."""
    m = re.search(r"\b(1[5-9]\d{2}|20\d{2})\b", date_field or "")
    return m.group(1) if m else ""


def split_into_segments(text: str, target: int = SEGMENT_TARGET_WORDS) -> list[str]:
    """
    Split text into ~target-word segments. Prefers paragraph boundaries but
    HARD-splits any segment that grows beyond 1.5× target — DocSouth texts
    sometimes contain single-paragraph chapters that would otherwise
    produce 10k-word records.
    """
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    hard_cap = int(target * 1.5)
    segments: list[str] = []
    current: list[str] = []
    word_count = 0

    def flush_words(words: list[str]) -> None:
        # split a flat word list into target-sized segments
        for i in range(0, len(words), target):
            piece = " ".join(words[i:i + target])
            if piece:
                segments.append(piece)

    for p in paragraphs:
        pw_list = p.split()
        pw = len(pw_list)
        if pw > hard_cap:
            # close out any pending buffer first
            if current:
                segments.append("\n\n".join(current))
                current, word_count = [], 0
            # hard-split this oversized paragraph
            flush_words(pw_list)
            continue
        if word_count + pw > target and current:
            segments.append("\n\n".join(current))
            current = [p]
            word_count = pw
        else:
            current.append(p)
            word_count += pw
    if current:
        segments.append("\n\n".join(current))
    return segments or [text.strip()]


def harvest_collection(slug: str, name: str) -> list[dict]:
    base = WORKDIR / slug / slug / "data"
    toc = base / "toc.csv"
    texts_dir = base / "texts"
    if not toc.exists():
        print(f"[WARN] no toc.csv at {toc}", file=sys.stderr)
        return []
    rows: list[dict] = []
    with toc.open(encoding="utf-8", newline="") as f:
        for entry in csv.DictReader(f):
            xml_filename = entry.get("Filename", "").strip()
            if not xml_filename:
                continue
            stem = xml_filename.rsplit(".", 1)[0]
            txt = texts_dir / f"{stem}.txt"
            if not txt.exists():
                continue
            try:
                body = clean(txt.read_text(encoding="utf-8", errors="replace"))
            except Exception as e:
                print(f"[WARN] {txt}: {e}", file=sys.stderr)
                continue
            segs = split_into_segments(body)[:MAX_SEGMENTS_PER_TEXT]
            year = year_of(entry.get("Date", ""))
            for idx, seg in enumerate(segs):
                rows.append({
                    "collection": name,
                    "filename": stem,
                    "author": (entry.get("Author") or "").strip(),
                    "title": (entry.get("Title") or "").strip(),
                    "year": year,
                    "date_raw": (entry.get("Date") or "").strip(),
                    "url": (entry.get("URL") or "").strip(),
                    "segment_idx": idx,
                    "total_segments": len(segs),
                    "text": seg,
                })
    return rows


def main() -> int:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    bytes_written = 0
    per_collection_counts: dict[str, int] = {}
    with OUT_PATH.open("w", encoding="utf-8") as out:
        for slug, name in COLLECTIONS.items():
            rows = harvest_collection(slug, name)
            per_collection_counts[name] = len(rows)
            for r in rows:
                line = json.dumps(r, ensure_ascii=False) + "\n"
                out.write(line)
                bytes_written += len(line.encode("utf-8"))
            total += len(rows)
            print(f"  {name}: {len(rows):,} segments")
    print(f"\nTotal: {total:,} records · {bytes_written / 1024 / 1024:.1f} MB → {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
