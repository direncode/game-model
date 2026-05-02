#!/usr/bin/env python3
"""
arXiv harvest: pinned Kaggle snapshot -> deterministic NDJSON corpus for Atlas.

Reads the Kaggle arXiv-metadata-oai-snapshot file (newline-delimited JSON,
one record per arXiv paper). Filters withdrawn, future-dated, and
empty-abstract records. Stratifies by year: when target_per_year > 0, each
year is capped at that count via deterministic stride sampling (no RNG).

The fingerprint payload (`text`) is title + "\n\n" + abstract only.
Categories and authors stay as metadata fields but never appear in `text` —
this keeps cluster-purity-vs-archive an honest unsupervised claim, not a
tautology.

Output records are sorted by paper_id ascending and serialized as canonical
JSON (sorted keys, no whitespace) so that re-runs against the same input
produce byte-identical NDJSON. Verifies via sha256.

Usage:
  python scripts/arxiv_harvest.py \\
      --input  /tmp/arxiv_work/arxiv-metadata-oai-snapshot.json \\
      --output /opt/latentocean/data/formed_models/_inputs/arxiv.ndjson \\
      --snapshot-date 2026-04-30 \\
      --target-per-year 14500
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

WITHDRAWN_RE = re.compile(
    r"^\s*This (paper|article|submission|preprint) (has been )?(withdrawn|been retracted)",
    re.IGNORECASE,
)


def parse_year(update_date: str) -> int:
    if not update_date or len(update_date) < 4:
        return 0
    try:
        return int(update_date[:4])
    except ValueError:
        return 0


def archive_of(primary_category: str) -> str:
    """Map a primary category to its top-level archive.

    cs.LG -> cs, math.NT -> math, q-bio.GN -> q-bio, physics.optics -> physics.

    Legacy categories without a dot (hep-th, astro-ph, cond-mat, gr-qc, ...)
    are treated as their own archive — the dash in 'hep-th' is part of the
    category name, not a dotted suffix.
    """
    if "." in primary_category:
        return primary_category.split(".", 1)[0]
    return primary_category


def to_record(rec: dict) -> dict:
    paper_id = rec["id"]
    title = (rec.get("title") or "").strip()
    abstract = (rec.get("abstract") or "").strip()
    categories_raw = (rec.get("categories") or "").strip()
    categories = categories_raw.split() if categories_raw else []
    primary = categories[0] if categories else ""
    authors_raw = (rec.get("authors") or "").strip()
    authors_count = len([a for a in authors_raw.split(",") if a.strip()]) if authors_raw else 0
    return {
        "paper_id":          paper_id,
        "primary_category":  primary,
        "archive":           archive_of(primary),
        "categories":        categories,
        "year":              parse_year(rec.get("update_date") or ""),
        "authors_count":     authors_count,
        "title":             title,
        "abstract":          abstract,
        "text":              f"{title}\n\n{abstract}",
    }


def stride_sample(items: list[dict], target: int) -> list[dict]:
    """Deterministic stride sample to exactly `target` items.

    items is assumed pre-sorted (we sort by paper_id elsewhere). When len > target,
    pick evenly-spaced indices: items[int(i * len/target)] for i in [0, target).
    No RNG — same input + same target -> byte-identical output.
    """
    if target <= 0 or len(items) <= target:
        return list(items)
    step = len(items) / target
    return [items[int(i * step)] for i in range(target)]


def run(
    input_path: Path | str,
    output_path: Path | str,
    *,
    snapshot_nominal_date: str,
    target_per_year: int = 0,
) -> dict:
    """Read Kaggle JSON, filter, transform, optionally stratify-sample, write NDJSON."""
    input_path = Path(input_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    by_year: dict[int, list[dict]] = defaultdict(list)
    skipped_withdrawn = 0
    skipped_future = 0
    skipped_empty = 0
    total = 0

    with input_path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            total += 1
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            abstract = (rec.get("abstract") or "").strip()
            if not abstract:
                skipped_empty += 1
                continue
            if WITHDRAWN_RE.match(abstract):
                skipped_withdrawn += 1
                continue
            update_date = rec.get("update_date") or ""
            if update_date and update_date > snapshot_nominal_date:
                skipped_future += 1
                continue
            transformed = to_record(rec)
            year = transformed["year"] or 0
            by_year[year].append(transformed)

    # Sort each year's bucket by paper_id so stride sampling is deterministic
    # and the final output is fully sorted.
    kept: list[dict] = []
    for year in sorted(by_year.keys()):
        bucket = sorted(by_year[year], key=lambda r: r["paper_id"])
        sampled = stride_sample(bucket, target_per_year)
        kept.extend(sampled)
    kept.sort(key=lambda r: r["paper_id"])

    with output_path.open("w", encoding="utf-8", newline="\n") as out:
        for rec in kept:
            out.write(json.dumps(rec, sort_keys=True, ensure_ascii=False, separators=(",", ":")))
            out.write("\n")

    return {
        "input_path":            str(input_path),
        "output_path":           str(output_path),
        "total_input_records":   total,
        "kept_records":          len(kept),
        "skipped_withdrawn":     skipped_withdrawn,
        "skipped_future":        skipped_future,
        "skipped_empty":         skipped_empty,
        "target_per_year":       target_per_year,
        "snapshot_nominal_date": snapshot_nominal_date,
    }


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Harvest arXiv Kaggle snapshot into deterministic NDJSON for Atlas.",
    )
    p.add_argument("--input", required=True, type=Path,
                   help="Path to arxiv-metadata-oai-snapshot.json (Kaggle dump).")
    p.add_argument("--output", required=True, type=Path,
                   help="Path to write the harvested arxiv.ndjson.")
    p.add_argument("--snapshot-date", required=True,
                   help="Nominal snapshot date YYYY-MM-DD; papers updated after this are dropped.")
    p.add_argument("--target-per-year", type=int, default=14500,
                   help="Per-year stratified-sample target. 0 = no sampling. Default 14500.")
    args = p.parse_args(argv)

    stats = run(
        args.input, args.output,
        snapshot_nominal_date=args.snapshot_date,
        target_per_year=args.target_per_year,
    )
    print(json.dumps(stats, indent=2))
    print(f"corpus_input_sha256: {file_sha256(args.input)}")
    print(f"corpus_sha256:       {file_sha256(args.output)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
