"""Phase 1 arXiv physics bulk ingest.

Paginates through ``fetch_arxiv_category`` across a curated list of physics
subcategories and writes the resulting PaperRecord stream to a JSONL file.
Designed to be restartable: if the output file already exists, the script
resumes from the last-recorded ``start`` cursor per category.

Usage::

    PYTHONPATH=scripts/cross_era_analysis python \\
        scripts/cross_era_analysis/latk_tool/scale/ingest_arxiv_physics.py \\
        --total 50000 \\
        --output scripts/cross_era_analysis/output/latk_physics_arxiv.jsonl \\
        --categories physics.gen-ph,quant-ph,cond-mat.stat-mech

Flags
-----
``--total`` : total papers to fetch across all categories (default 50000)
``--output`` : path to the JSONL sink
``--categories`` : comma-separated arXiv category list
``--page-size`` : papers per API request (arXiv hard cap ~1000; default 100)
``--start-year`` : minimum submission year filter (default None)
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import asdict
from pathlib import Path
from typing import Dict, List

REPO_ROOT = Path(__file__).resolve().parents[4]
CEA_DIR = REPO_ROOT / "scripts" / "cross_era_analysis"
if str(CEA_DIR) not in sys.path:
    sys.path.insert(0, str(CEA_DIR))

from latk_tool.ingest.arxiv_ingest import fetch_arxiv_page  # noqa: E402


DEFAULT_CATEGORIES = [
    "physics.gen-ph",      # general physics
    "physics.hist-ph",     # history of physics — useful for historical lineage
    "quant-ph",            # quantum mechanics
    "cond-mat.stat-mech",  # statistical mechanics
    "hep-th",              # high-energy theory
    "gr-qc",               # general relativity / quantum cosmology
    "astro-ph.CO",         # cosmology
    "physics.class-ph",    # classical physics
    "physics.optics",      # optics
]


def _load_cursor(cursor_path: Path) -> Dict[str, int]:
    if cursor_path.exists():
        with cursor_path.open("r", encoding="utf-8") as fp:
            return json.load(fp)
    return {}


def _save_cursor(cursor_path: Path, cursor: Dict[str, int]) -> None:
    cursor_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = cursor_path.with_suffix(cursor_path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as fp:
        json.dump(cursor, fp, indent=2)
    tmp.replace(cursor_path)


def ingest_arxiv_physics(
    total: int,
    output_path: Path,
    categories: List[str],
    page_size: int = 100,
    start_year: int | None = None,
) -> int:
    """Pull ``total`` physics papers into ``output_path`` (JSONL)."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cursor_path = output_path.with_suffix(output_path.suffix + ".cursor.json")
    cursor = _load_cursor(cursor_path)

    written = 0
    if output_path.exists():
        with output_path.open("r", encoding="utf-8") as fp:
            for _ in fp:
                written += 1
        print(f"  resuming: {written} papers already in {output_path.name}")

    per_cat_target = max(1, total // len(categories))
    overall_start = time.time()

    with output_path.open("a", encoding="utf-8") as sink:
        for cat in categories:
            if written >= total:
                break
            cat_start = cursor.get(cat, 0)
            cat_fetched_this_session = 0
            query = f"cat:{cat}"
            if start_year is not None:
                query += f" AND submittedDate:[{start_year}0101 TO 22000101]"

            print(f"\ncategory={cat} start={cat_start} target={per_cat_target}")
            while cat_fetched_this_session < per_cat_target and written < total:
                try:
                    page = fetch_arxiv_page(
                        query,
                        start=cat_start,
                        max_results=page_size,
                    )
                except Exception as exc:
                    print(f"  [warn] arxiv fetch failed: {exc}; sleeping 10s")
                    time.sleep(10)
                    continue

                if not page.records:
                    print(f"  empty page at start={cat_start}, moving on")
                    break

                for rec in page.records:
                    sink.write(json.dumps(asdict(rec), ensure_ascii=False) + "\n")
                    written += 1
                    cat_fetched_this_session += 1

                cat_start = page.next_start
                cursor[cat] = cat_start
                _save_cursor(cursor_path, cursor)

                elapsed = time.time() - overall_start
                rate = written / max(elapsed, 1e-3)
                print(
                    f"  fetched={len(page.records)} "
                    f"total_written={written}/{total} "
                    f"rate={rate:.1f} p/s "
                    f"eta={(total - written) / max(rate, 1e-3):.0f}s"
                )

    print(f"\nDone: {written} papers written to {output_path}")
    return written


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--total", type=int, default=50_000)
    p.add_argument("--output", type=Path, default=CEA_DIR / "output" / "latk_physics_arxiv.jsonl")
    p.add_argument("--categories", type=str, default=",".join(DEFAULT_CATEGORIES))
    p.add_argument("--page-size", type=int, default=100)
    p.add_argument("--start-year", type=int, default=None)
    args = p.parse_args()

    cats = [c.strip() for c in args.categories.split(",") if c.strip()]
    ingest_arxiv_physics(
        total=args.total,
        output_path=args.output,
        categories=cats,
        page_size=args.page_size,
        start_year=args.start_year,
    )


if __name__ == "__main__":
    main()
