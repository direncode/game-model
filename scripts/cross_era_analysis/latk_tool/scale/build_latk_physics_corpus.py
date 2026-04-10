"""Build a LATK physics corpus JSON from the arXiv JSONL stream.

Takes the output of ``ingest_arxiv_physics.py`` and merges it into the
entity/edge JSON format expected by the BTUT pipeline (the same format
``latk_mini_corpus.json`` uses). Each paper becomes multiple entities:

- One ``writing`` entity for the paper itself
- One ``person`` entity per author (deduplicated by name)
- One ``chunk`` entity per 500-char chunk of the abstract (for text density)

Edges:
- author -> writing (``authored``)
- chunk -> writing (``part_of``)

The LATK namespace prefix is applied so the corpus can be merged with
other domain corpora without collisions: each entity gets the prefix
``latk_physics__arxiv__<category>__``.

Usage::

    PYTHONPATH=scripts/cross_era_analysis python \\
        scripts/cross_era_analysis/latk_tool/scale/build_latk_physics_corpus.py \\
        --input scripts/cross_era_analysis/output/latk_physics_arxiv.jsonl \\
        --output scripts/cross_era_analysis/output/latk_physics_corpus.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Set

REPO_ROOT = Path(__file__).resolve().parents[4]
CEA_DIR = REPO_ROOT / "scripts" / "cross_era_analysis"


def _slug(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", s.strip().lower())
    return s.strip("_")[:60]


def _chunk_text(text: str, size: int = 500, overlap: int = 100) -> List[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= size:
        return [text]
    chunks: List[str] = []
    step = max(1, size - overlap)
    for start in range(0, len(text), step):
        chunk = text[start : start + size]
        if chunk:
            chunks.append(chunk)
        if start + size >= len(text):
            break
    return chunks


def build_physics_corpus(
    input_path: Path,
    output_path: Path,
    max_papers: int | None = None,
    chunk_size: int = 500,
) -> Dict[str, Any]:
    if not input_path.exists():
        raise FileNotFoundError(f"input JSONL not found: {input_path}")

    entities: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    author_seen: Set[str] = set()
    paper_count = 0

    with input_path.open("r", encoding="utf-8") as fp:
        for line in fp:
            if max_papers is not None and paper_count >= max_papers:
                break
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue

            paper_id = rec.get("paper_id", "")
            title = rec.get("title", "").strip()
            abstract = rec.get("abstract", "").strip()
            year = rec.get("published_year")
            authors = rec.get("authors", []) or []
            category = rec.get("category") or "unknown"
            url = rec.get("url", "")

            if not paper_id or not title:
                continue

            cat_slug = _slug(category)
            paper_slug = _slug(paper_id)
            writing_name = f"latk_physics__arxiv_{cat_slug}__writing__{paper_slug}"
            writing_entity = {
                "name": writing_name,
                "type": "writing",
                "attributes": {
                    "title": title,
                    "abstract": abstract,
                    "year": year if isinstance(year, int) else 0,
                    "category": category,
                    "url": url,
                    "source": "arxiv",
                    "paper_id": paper_id,
                    "regime": "modern",
                },
            }
            entities.append(writing_entity)

            for author_name in authors:
                an = author_name.strip()
                if not an:
                    continue
                author_slug = _slug(an)
                author_entity_name = f"latk_physics__arxiv__person__{author_slug}"
                if author_entity_name not in author_seen:
                    author_seen.add(author_entity_name)
                    entities.append({
                        "name": author_entity_name,
                        "type": "person",
                        "attributes": {
                            "full_name": an,
                            "source": "arxiv",
                            "regime": "modern",
                        },
                    })
                edges.append({
                    "source": author_entity_name,
                    "target": writing_name,
                    "type": "authored",
                    "weight": 1.0,
                })

            for ci, chunk in enumerate(_chunk_text(abstract, size=chunk_size)):
                chunk_name = f"{writing_name}__c{ci:03d}"
                entities.append({
                    "name": chunk_name,
                    "type": "chunk",
                    "attributes": {
                        "text": chunk,
                        "chunk_index": ci,
                        "parent_paper": paper_id,
                        "regime": "modern",
                    },
                })
                edges.append({
                    "source": chunk_name,
                    "target": writing_name,
                    "type": "part_of",
                    "weight": 1.0,
                })

            paper_count += 1

    type_counts: Dict[str, int] = {}
    for e in entities:
        t = e.get("type", "unknown")
        type_counts[t] = type_counts.get(t, 0) + 1

    result = {
        "metadata": {
            "domain": "physics",
            "source": "arxiv",
            "papers": paper_count,
            "entities": len(entities),
            "edges": len(edges),
            "entity_types": type_counts,
            "chunk_size_chars": chunk_size,
            "namespace_prefix": "latk_physics__arxiv__",
        },
        "entities": entities,
        "relationships": edges,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fp:
        json.dump(result, fp, ensure_ascii=False)

    print(f"Built physics corpus:")
    print(f"  papers   : {paper_count}")
    print(f"  entities : {len(entities)}")
    print(f"  edges    : {len(edges)}")
    print(f"  types    : {type_counts}")
    print(f"  output   : {output_path}")
    return result


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--input",
        type=Path,
        default=CEA_DIR / "output" / "latk_physics_arxiv.jsonl",
    )
    p.add_argument(
        "--output",
        type=Path,
        default=CEA_DIR / "output" / "latk_physics_corpus.json",
    )
    p.add_argument("--max-papers", type=int, default=None)
    p.add_argument("--chunk-size", type=int, default=500)
    args = p.parse_args()
    build_physics_corpus(
        input_path=args.input,
        output_path=args.output,
        max_papers=args.max_papers,
        chunk_size=args.chunk_size,
    )


if __name__ == "__main__":
    main()
