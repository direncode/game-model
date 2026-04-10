"""USPTO physics patent ingest for LATK.

Parses the USPTO bulk XML format (gray-book weekly/yearly dumps available
at ``https://bulkdata.uspto.gov/``) and extracts patents classified under
the physics CPC classes (G01 Measuring / G02 Optics / G03 Photography /
G04 Horology / G05 Controlling / G06 Computing / G08 Signalling / G09
Educating / G10 Musical / G11 Information storage / G12 Instrument details
/ G16 Information and communication tech / G21 Nuclear).

Honest scaffold status
----------------------
This ingester is structured to run against real USPTO bulk files but the
50k smoke slice does NOT exercise it — USPTO bulk dumps are 5-20 GB per
year and aren't bundled with the repo. The smoke path uses arXiv only.

To run for real::

    # Download one weekly bulk file (example: Jan 2 2024 ~1.8GB compressed)
    wget https://bulkdata.uspto.gov/data/patent/grant/redbook/fulltext/2024/ipg240102.zip
    unzip ipg240102.zip -d /tmp/uspto/

    PYTHONPATH=scripts/cross_era_analysis python \\
        scripts/cross_era_analysis/latk_tool/scale/ingest_uspto_physics.py \\
        --input /tmp/uspto/ipg240102.xml \\
        --output scripts/cross_era_analysis/output/latk_physics_uspto.jsonl \\
        --classes G01,G02,G06,G21

The parser uses a stream-based XML iterator (xml.etree.iterparse) so it
handles multi-GB files with bounded memory — it does not load the whole
file at once.
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import re
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Iterator, List, Optional
from xml.etree import ElementTree as ET

REPO_ROOT = Path(__file__).resolve().parents[4]
CEA_DIR = REPO_ROOT / "scripts" / "cross_era_analysis"
if str(CEA_DIR) not in sys.path:
    sys.path.insert(0, str(CEA_DIR))

from latk_tool.ingest import PaperRecord  # noqa: E402


DEFAULT_CLASSES = ["G01", "G02", "G03", "G05", "G06", "G08", "G11", "G16", "G21"]


def _extract_text(elem: Optional[ET.Element]) -> str:
    if elem is None:
        return ""
    return " ".join(t.strip() for t in elem.itertext() if t and t.strip())


def _matches_classes(cpc_text: str, classes: List[str]) -> bool:
    up = cpc_text.upper()
    return any(cls in up for cls in classes)


def iter_uspto_grants(xml_path: Path, classes: List[str]) -> Iterator[PaperRecord]:
    """Stream patents from a USPTO bulk XML file, yielding matching ones.

    USPTO bulk files concatenate many <us-patent-grant>...</us-patent-grant>
    documents. We use iterparse with ``clear()`` to bound memory.
    """
    if not xml_path.exists():
        raise FileNotFoundError(f"USPTO file not found: {xml_path}")

    context = ET.iterparse(str(xml_path), events=("end",))
    for _, elem in context:
        if elem.tag.endswith("us-patent-grant") or elem.tag.endswith("us-patent-application"):
            try:
                # Classification check
                cpc_text = _extract_text(elem.find(".//classifications-cpc"))
                ipc_text = _extract_text(elem.find(".//classification-ipc"))
                combined_class = (cpc_text + " " + ipc_text).strip()
                if not _matches_classes(combined_class, classes):
                    elem.clear()
                    continue

                # Identifiers
                doc_number = _extract_text(elem.find(".//publication-reference//doc-number"))
                doc_date = _extract_text(elem.find(".//publication-reference//date"))
                year = int(doc_date[:4]) if doc_date[:4].isdigit() else None

                # Title + abstract
                title = _extract_text(elem.find(".//invention-title")) or _extract_text(
                    elem.find(".//us-bibliographic-data-grant/invention-title")
                )
                abstract = _extract_text(elem.find(".//abstract"))

                # Inventors
                authors: List[str] = []
                for inv in elem.findall(".//inventors//inventor"):
                    first = _extract_text(inv.find(".//first-name"))
                    last = _extract_text(inv.find(".//last-name"))
                    name = f"{first} {last}".strip()
                    if name:
                        authors.append(name)

                if not doc_number or not title:
                    elem.clear()
                    continue

                yield PaperRecord(
                    paper_id=f"uspto__{doc_number}",
                    title=title,
                    abstract=abstract,
                    full_text=abstract,
                    authors=authors,
                    published_year=year,
                    source="uspto",
                    category=combined_class[:60],
                    regime="modern" if year and year >= 1991 else "historical",
                    url=f"https://patents.google.com/patent/US{doc_number}",
                )
            except Exception as exc:  # pragma: no cover
                print(f"  [warn] failed to parse grant: {exc}", file=sys.stderr)
            finally:
                elem.clear()


def ingest_uspto(
    input_path: Path,
    output_path: Path,
    classes: List[str],
    max_patents: Optional[int] = None,
) -> int:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with output_path.open("w", encoding="utf-8") as sink:
        for rec in iter_uspto_grants(input_path, classes):
            sink.write(json.dumps(dataclasses.asdict(rec), ensure_ascii=False) + "\n")
            written += 1
            if written % 500 == 0:
                print(f"  parsed {written} matching patents so far...")
            if max_patents is not None and written >= max_patents:
                break
    print(f"Done: {written} patents written to {output_path}")
    return written


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, required=True, help="USPTO bulk XML file")
    p.add_argument(
        "--output",
        type=Path,
        default=CEA_DIR / "output" / "latk_physics_uspto.jsonl",
    )
    p.add_argument("--classes", type=str, default=",".join(DEFAULT_CLASSES))
    p.add_argument("--max-patents", type=int, default=None)
    args = p.parse_args()
    classes = [c.strip() for c in args.classes.split(",") if c.strip()]
    ingest_uspto(args.input, args.output, classes, args.max_patents)


if __name__ == "__main__":
    main()
