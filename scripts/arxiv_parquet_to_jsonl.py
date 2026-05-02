#!/usr/bin/env python3
"""
Convert HuggingFace's librarian-bots/arxiv-metadata-snapshot parquet files
into the JSON-lines format expected by scripts/arxiv_harvest.py (which was
written against the Kaggle Cornell-University/arxiv dump shape).

The HF parquet schema has the same field names as the Kaggle JSON-lines dump
(id, title, abstract, categories, authors, update_date, etc.), so the
conversion is essentially: read parquet -> emit one JSON object per row.

Streams row-by-row to keep memory bounded; can process the entire 3M-record
HF mirror without loading anything beyond a single parquet shard at a time.

Usage:
  python scripts/arxiv_parquet_to_jsonl.py \\
      --input-dir /tmp/arxiv_work/data/ \\
      --output /tmp/arxiv_work/arxiv-metadata-oai-snapshot.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def parquet_to_jsonl(input_dir: Path, output: Path) -> dict:
    try:
        import pyarrow.parquet as pq
    except ImportError:
        raise RuntimeError("pyarrow not installed; pip install pyarrow")

    parquet_files = sorted(input_dir.glob("*.parquet"))
    if not parquet_files:
        raise RuntimeError(f"no parquet files in {input_dir}")

    output.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    with output.open("w", encoding="utf-8", newline="\n") as out:
        for fp in parquet_files:
            table = pq.read_table(str(fp))
            n = len(table)
            print(f"  {fp.name}: {n:,} rows")
            for i in range(n):
                row = {col: _coerce(table[col][i].as_py()) for col in table.column_names}
                out.write(json.dumps(row, ensure_ascii=False))
                out.write("\n")
                total += 1
            del table
    return {"total_rows": total, "output": str(output)}


def _coerce(v):
    """Convert non-JSON-serializable types (datetime, Decimal, lists of arrays) to strings/lists.
    Specifically the HF parquet has 'update_date' as a Timestamp and 'versions'/'authors_parsed'
    as nested arrays — both need flattening to JSON-safe shapes.
    """
    if v is None:
        return None
    if hasattr(v, "isoformat"):
        # datetime / date / Timestamp -> "YYYY-MM-DD" (matching Kaggle dump convention)
        return v.isoformat()[:10] if hasattr(v, "year") else str(v)
    if isinstance(v, (list, tuple)):
        return [_coerce(x) for x in v]
    if isinstance(v, dict):
        return {k: _coerce(x) for k, x in v.items()}
    if isinstance(v, (str, int, float, bool)):
        return v
    # numpy / pyarrow scalars
    return str(v)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--input-dir", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args(argv)

    stats = parquet_to_jsonl(args.input_dir, args.output)
    print(f"\nwrote {stats['total_rows']:,} rows to {stats['output']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
