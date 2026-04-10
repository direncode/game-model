"""Historical physics text ingest for LATK.

Loads pre-OCR'd historical physics texts from a directory and emits them as
PaperRecord entries. Expected layout::

    input_dir/
        maxwell_treatise_em_1873/
            metadata.json    # { "title", "author", "year" }
            chapter01.txt
            chapter02.txt
            ...
        einstein_ann_phys_1905/
            metadata.json
            paper.txt

Each subdirectory is one historical work. ``metadata.json`` supplies the
bibliographic info; all ``.txt`` files inside are concatenated into
``full_text`` and a cleaned ``abstract`` is synthesized from the first
1500 characters.

Honest scaffold status
----------------------
The 50k smoke slice does NOT exercise this path — historical physics
corpora (Maxwell's Treatise, Einstein's Annalen, Feynman's lectures, etc.)
are not bundled with the repo. The ingester runs if you point it at an
``input_dir`` with the expected layout.

Source hints (user must acquire):
- Project Gutenberg: https://www.gutenberg.org/ebooks/search/?query=physics
- Internet Archive: https://archive.org/details/texts?and%5B%5D=physics
- Euler Archive for pre-1850 mathematical physics
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import sys
from pathlib import Path
from typing import Iterator

REPO_ROOT = Path(__file__).resolve().parents[4]
CEA_DIR = REPO_ROOT / "scripts" / "cross_era_analysis"
if str(CEA_DIR) not in sys.path:
    sys.path.insert(0, str(CEA_DIR))

from latk_tool.ingest import PaperRecord  # noqa: E402


def iter_historical_works(input_dir: Path) -> Iterator[PaperRecord]:
    if not input_dir.exists():
        raise FileNotFoundError(f"historical input dir not found: {input_dir}")

    for work_dir in sorted(p for p in input_dir.iterdir() if p.is_dir()):
        meta_path = work_dir / "metadata.json"
        if not meta_path.exists():
            print(f"  [skip] {work_dir.name}: no metadata.json", file=sys.stderr)
            continue
        try:
            with meta_path.open("r", encoding="utf-8") as fp:
                meta = json.load(fp)
        except (json.JSONDecodeError, OSError) as exc:
            print(f"  [skip] {work_dir.name}: metadata error: {exc}", file=sys.stderr)
            continue

        title = meta.get("title", work_dir.name)
        author = meta.get("author", "unknown")
        year = meta.get("year")
        if isinstance(year, str) and year.isdigit():
            year = int(year)
        elif not isinstance(year, int):
            year = None

        text_files = sorted(work_dir.glob("*.txt"))
        if not text_files:
            print(f"  [skip] {work_dir.name}: no .txt files", file=sys.stderr)
            continue

        full_text_parts = []
        for tf in text_files:
            try:
                full_text_parts.append(tf.read_text(encoding="utf-8", errors="replace"))
            except OSError:
                continue
        full_text = "\n\n".join(full_text_parts)
        if not full_text.strip():
            continue

        abstract = full_text.strip()[:1500]

        yield PaperRecord(
            paper_id=f"historical__{work_dir.name}",
            title=title,
            abstract=abstract,
            full_text=full_text,
            authors=[author] if isinstance(author, str) else list(author),
            published_year=year,
            source="historical",
            category="physics",
            regime="historical",
            url=meta.get("url", ""),
        )


def ingest_historical(input_dir: Path, output_path: Path) -> int:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with output_path.open("w", encoding="utf-8") as sink:
        for rec in iter_historical_works(input_dir):
            sink.write(json.dumps(dataclasses.asdict(rec), ensure_ascii=False) + "\n")
            written += 1
            print(f"  wrote: {rec.paper_id} ({rec.published_year})")
    print(f"Done: {written} historical works written to {output_path}")
    return written


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True, help="directory of historical work subdirs")
    p.add_argument(
        "--output",
        type=Path,
        default=CEA_DIR / "output" / "latk_physics_historical.jsonl",
    )
    args = p.parse_args()
    ingest_historical(args.input, args.output)


if __name__ == "__main__":
    main()
