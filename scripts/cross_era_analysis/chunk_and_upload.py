"""Chunk the cross-era corpus into paragraph-level entities for BTUT.

BTUT requires >200 entities to activate. 12 patents * ~25 chunks each = ~300 entities,
which is above the activation threshold. Each chunk is an entity with:
  - name: unique id (e.g., "tesla_US1119732__chunk_007")
  - type: the physics regime (surface_wave, inductive, radiative, control)
  - attributes: full text of chunk + parent patent id + regime metadata

Relationships:
  - same_patent: edges between chunks of the same patent
  - same_regime: a sparse subset of edges between chunks of the same regime
    (not exhaustive — keeps edge count manageable)
"""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path


CORPUS_DIR = Path(__file__).parent / "documents"
OUTPUT_DIR = Path(__file__).parent / "output"


def chunk_text(text: str, target_words: int = 60) -> list[str]:
    """Split text into roughly target_words-length chunks at paragraph boundaries."""
    # Split into paragraphs
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]

    chunks: list[str] = []
    current = ""
    current_words = 0

    for para in paragraphs:
        words = para.split()
        para_wc = len(words)

        if para_wc >= target_words * 2:
            # Long paragraph — split into sub-chunks of target_words
            if current:
                chunks.append(current)
                current = ""
                current_words = 0
            for i in range(0, para_wc, target_words):
                sub = " ".join(words[i : i + target_words])
                if sub:
                    chunks.append(sub)
        elif current_words + para_wc > target_words * 1.5:
            # Starting a new chunk
            if current:
                chunks.append(current)
            current = para
            current_words = para_wc
        else:
            # Append to current
            if current:
                current = current + " " + para
            else:
                current = para
            current_words += para_wc

    if current:
        chunks.append(current)

    return [c for c in chunks if len(c.split()) >= 15]  # drop tiny chunks


def main() -> None:
    manifest_path = CORPUS_DIR / "manifest.json"
    with open(manifest_path, "r", encoding="utf-8") as f:
        docs = json.load(f)

    entities: list[dict] = []
    relationships: list[dict] = []

    # Physics regime grouping for cross-regime edges
    chunks_by_regime: dict[str, list[str]] = {}
    chunks_by_patent: dict[str, list[str]] = {}

    for entry in docs:
        doc_path = CORPUS_DIR / entry["file"]
        if not doc_path.exists():
            print(f"Missing: {doc_path}")
            continue

        with open(doc_path, "r", encoding="utf-8") as f:
            text = f.read()

        chunks = chunk_text(text, target_words=60)
        patent_id = entry["id"]
        regime = entry["type"]

        print(f"  {patent_id:35s} year={entry.get('year','?')}  regime={regime[:20]:20s}  chunks={len(chunks)}")

        for i, chunk_text_ in enumerate(chunks):
            chunk_id = f"{patent_id}__chunk_{i:03d}"
            entity = {
                "name": chunk_id,
                "type": "patent_chunk",
                "attributes": {
                    "text": chunk_text_,
                    "parent_patent": patent_id,
                    "parent_title": entry.get("title", ""),
                    "patent_year": entry.get("year"),
                    "physics_regime": regime,
                    "chunk_index": i,
                    "total_chunks_in_patent": len(chunks),
                    "text_word_count": len(chunk_text_.split()),
                },
            }
            entities.append(entity)
            chunks_by_regime.setdefault(regime, []).append(chunk_id)
            chunks_by_patent.setdefault(patent_id, []).append(chunk_id)

    print()
    print(f"Total entities: {len(entities)}")

    # --- Build same_patent edges (consecutive chunks + first/last loops) ---
    for patent_id, chunk_ids in chunks_by_patent.items():
        for i in range(len(chunk_ids) - 1):
            relationships.append({
                "source": chunk_ids[i],
                "target": chunk_ids[i + 1],
                "type": "next_chunk",
                "weight": 0.9,
            })

    # --- Build sparse same_regime edges (connect first chunk of each patent
    # to first chunk of other patents in same regime) ---
    for regime, chunk_ids in chunks_by_regime.items():
        # Get first chunk of each patent in this regime
        first_chunks_per_patent = {}
        for cid in chunk_ids:
            patent = cid.rsplit("__chunk_", 1)[0]
            if patent not in first_chunks_per_patent:
                first_chunks_per_patent[patent] = cid
        firsts = list(first_chunks_per_patent.values())
        # Connect each first chunk to the next (cycle within regime)
        for i in range(len(firsts)):
            for j in range(i + 1, len(firsts)):
                relationships.append({
                    "source": firsts[i],
                    "target": firsts[j],
                    "type": "same_regime",
                    "weight": 0.6,
                })

    print(f"Total relationships: {len(relationships)}")

    # Stats
    from collections import Counter
    regime_counts = Counter(e["attributes"]["physics_regime"] for e in entities)
    print()
    print("Entities per regime:")
    for r, c in sorted(regime_counts.items()):
        print(f"  {r}: {c}")

    # Save as ingestion-ready JSON
    OUTPUT_DIR.mkdir(exist_ok=True)
    output_path = OUTPUT_DIR / "crossera_upload.json"
    payload = {
        "entities": entities,
        "relationships": relationships,
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print()
    print(f"Saved to: {output_path}")
    print(f"File size: {output_path.stat().st_size / 1024:.1f} KB")
    print()
    print(f"BTUT activation threshold: >200 entities")
    print(f"Our corpus: {len(entities)} entities -- {'ACTIVATED' if len(entities) > 200 else 'NOT YET ENOUGH'}")


if __name__ == "__main__":
    main()
