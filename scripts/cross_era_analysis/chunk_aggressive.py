"""Chunk corpus aggressively to get 1000+ entities for full BTUT lattice activation.

Target: ~15-word chunks at sentence boundaries. With 26 documents totaling ~25,000 words,
this gives ~1500-1700 entities, well above the 1000-entity threshold for BTUT's
multi-cascade lattice threading to activate fully.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

CORPUS_DIR = Path(__file__).parent / "documents"
OUTPUT_DIR = Path(__file__).parent / "output"


def chunk_text_aggressive(text: str, target_words: int = 12) -> list[str]:
    """Split text into fixed-size word chunks (ignoring sentence boundaries)."""
    # Clean and split into words
    words = text.split()
    chunks = []
    for i in range(0, len(words), target_words):
        chunk = " ".join(words[i : i + target_words])
        if len(chunk.split()) >= 5:
            chunks.append(chunk)
    return chunks


def main() -> None:
    manifest_path = CORPUS_DIR / "manifest.json"
    with open(manifest_path, "r", encoding="utf-8") as f:
        docs = json.load(f)

    entities: list[dict] = []
    relationships: list[dict] = []

    chunks_by_regime: dict[str, list[str]] = {}
    chunks_by_patent: dict[str, list[str]] = {}

    for entry in docs:
        doc_path = CORPUS_DIR / entry["file"]
        if not doc_path.exists():
            print(f"Missing: {doc_path}")
            continue

        with open(doc_path, "r", encoding="utf-8") as f:
            text = f.read()

        chunks = chunk_text_aggressive(text, target_words=15)
        patent_id = entry["id"]
        regime = entry["type"]

        print(f"  {patent_id[:35]:35s} year={entry.get('year','?')}  regime={regime[:25]:25s}  chunks={len(chunks)}")

        for i, chunk_text_ in enumerate(chunks):
            chunk_id = f"{patent_id}__c{i:03d}"
            entity = {
                "name": chunk_id,
                "type": "patent_chunk",
                "attributes": {
                    "text": chunk_text_,
                    "parent_patent": patent_id,
                    "patent_year": entry.get("year"),
                    "physics_regime": regime,
                    "chunk_index": i,
                    "text_word_count": len(chunk_text_.split()),
                },
            }
            entities.append(entity)
            chunks_by_regime.setdefault(regime, []).append(chunk_id)
            chunks_by_patent.setdefault(patent_id, []).append(chunk_id)

    print()
    print(f"Total entities: {len(entities)}")

    # Build relationships
    # 1. Sequential within patent (next_chunk)
    for patent_id, chunk_ids in chunks_by_patent.items():
        for i in range(len(chunk_ids) - 1):
            relationships.append({
                "source": chunk_ids[i],
                "target": chunk_ids[i + 1],
                "type": "next_chunk",
                "weight": 0.9,
            })

    # 2. Sparse same-regime edges (first chunk of each patent within regime)
    for regime, chunk_ids in chunks_by_regime.items():
        first_chunks_per_patent = {}
        for cid in chunk_ids:
            patent = cid.rsplit("__c", 1)[0]
            if patent not in first_chunks_per_patent:
                first_chunks_per_patent[patent] = cid
        firsts = list(first_chunks_per_patent.values())
        for i in range(len(firsts)):
            for j in range(i + 1, len(firsts)):
                relationships.append({
                    "source": firsts[i],
                    "target": firsts[j],
                    "type": "same_regime",
                    "weight": 0.7,
                })

    print(f"Total relationships: {len(relationships)}")

    from collections import Counter
    regime_counts = Counter(e["attributes"]["physics_regime"] for e in entities)
    print()
    print("Entities per regime:")
    for r, c in sorted(regime_counts.items(), key=lambda x: -x[1]):
        print(f"  {r}: {c}")

    OUTPUT_DIR.mkdir(exist_ok=True)
    output_path = OUTPUT_DIR / "fullcorpus_btut_input.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({"entities": entities, "relationships": relationships}, f, indent=2)

    print()
    print(f"Saved: {output_path}")
    print(f"File size: {output_path.stat().st_size / 1024:.1f} KB")
    print()
    print(f"BTUT activation: corpus has {len(entities)} entities")
    print(f"  cascade_levels=2 threshold: ~500 entities — {'YES' if len(entities) > 500 else 'no'}")
    print(f"  cascade_levels=3 threshold: ~1000 entities — {'YES' if len(entities) > 1000 else 'no'}")


if __name__ == "__main__":
    main()
