"""Build the full polymath corpus by:
1. Chunking all polymath documents aggressively
2. Loading heterogeneous polymath entities
3. Combining into a single BTUT-ready JSON file
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from collections import Counter, defaultdict

from build_polymath_entities import generate_polymath_entities

CORPUS_DIR = Path(__file__).parent / "documents"
OUT = Path(__file__).parent / "output"


# Map each filename pattern to its regime
FILE_TO_REGIME = {
    # Newton
    "newton_alchemy": "newton_alchemy",
    "newton_principia": "newton_mechanics",
    "newton_opticks": "newton_optics",
    "newton_theology": "newton_theology_control",
    # Von Neumann
    "vn_self_reproducing": "vn_cellular_automata",
    "vn_cellular_automata": "vn_cellular_automata",
    "vn_edvac": "vn_computing",
    "vn_mathematical_foundations": "vn_quantum",
    "vn_theory_of_games": "vn_game_theory",
    "vn_monte_carlo": "vn_game_theory",
    # Leonardo
    "leonardo_flight": "leonardo_flight",
    "leonardo_codex_flight": "leonardo_flight",
    "leonardo_hydraulics": "leonardo_fluids",
    "leonardo_water": "leonardo_fluids",
    "leonardo_anatomy": "leonardo_anatomy",
    "leonardo_optics": "leonardo_anatomy",
    "leonardo_painting": "leonardo_art_control",
    "leonardo_art": "leonardo_art_control",
    # Modern descendants
    "modern_materials": "modern_materials",
    "modern_wolfram": "modern_complexity",
    "modern_conway": "modern_complexity",
    "modern_dna": "modern_complexity",
    "modern_self_assembly": "modern_complexity",
    "modern_reynolds": "modern_aerodynamics",
    "modern_rotor": "modern_aerodynamics",
    "modern_navier": "modern_aerodynamics",
}


def get_regime_for_file(filename: str) -> str | None:
    """Determine regime from filename using pattern matching."""
    for prefix, regime in FILE_TO_REGIME.items():
        if filename.startswith(prefix):
            return regime
    return None


def chunk_text(text: str, target_words: int = 15) -> list[str]:
    """Aggressive fixed-size word chunking."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), target_words):
        chunk = " ".join(words[i : i + target_words])
        if len(chunk.split()) >= 5:
            chunks.append(chunk)
    return chunks


def main() -> None:
    # Find all polymath-related files (excluding raw volumes that duplicate extracted sections)
    exclude_patterns = {"leonardo_vol1_raw.txt", "leonardo_vol2_raw.txt"}
    polymath_files = []
    for f in sorted(CORPUS_DIR.glob("*.txt")):
        if f.name in exclude_patterns:
            continue
        regime = get_regime_for_file(f.name)
        if regime is not None:
            polymath_files.append((f, regime))

    print(f"Found {len(polymath_files)} polymath document files")
    print()

    # Chunk each
    all_entities = []
    chunks_by_regime = defaultdict(list)
    chunks_by_patent = defaultdict(list)

    for doc_path, regime in polymath_files:
        with open(doc_path, "r", encoding="utf-8") as f:
            text = f.read()

        # Strip header if present
        if text.startswith("SOURCE:"):
            # Skip first two header lines
            lines = text.split("\n", 2)
            if len(lines) >= 3:
                text = lines[2]

        chunks = chunk_text(text, target_words=15)
        if not chunks:
            continue

        doc_id = doc_path.stem
        print(f"  {doc_id[:40]:40s} regime={regime[:25]:25s} chunks={len(chunks)}")

        for i, chunk_text_ in enumerate(chunks):
            chunk_id = f"{doc_id}__c{i:03d}"
            entity = {
                "name": chunk_id,
                "type": "patent_chunk",  # use same type for BTUT pipeline compat
                "attributes": {
                    "text": chunk_text_,
                    "parent_patent": doc_id,
                    "physics_regime": regime,
                    "chunk_index": i,
                    "text_word_count": len(chunk_text_.split()),
                },
            }
            all_entities.append(entity)
            chunks_by_regime[regime].append(chunk_id)
            chunks_by_patent[doc_id].append(chunk_id)

    print()
    print(f"Total chunks: {len(all_entities)}")
    print()
    print("Chunks per regime:")
    for r, ids in sorted(chunks_by_regime.items(), key=lambda x: -len(x[1])):
        print(f"  {r}: {len(ids)}")

    # Build next-chunk edges
    relationships = []
    for patent_id, chunk_ids in chunks_by_patent.items():
        for i in range(len(chunk_ids) - 1):
            relationships.append({
                "source": chunk_ids[i],
                "target": chunk_ids[i + 1],
                "type": "next_chunk",
                "weight": 0.9,
            })

    # Generate heterogeneous entities using first chunk in each regime as anchor
    regime_anchors = {r: ids[0] for r, ids in chunks_by_regime.items() if ids}
    hetero_entities, hetero_edges = generate_polymath_entities(regime_anchors)

    all_entities.extend(hetero_entities)
    relationships.extend(hetero_edges)

    print()
    print(f"Added {len(hetero_entities)} heterogeneous entities")
    print(f"Added {len(hetero_edges)} cross-type edges")
    print()
    print(f"TOTAL: {len(all_entities)} entities, {len(relationships)} relationships")

    # Type distribution
    type_counts = Counter(e["type"] for e in all_entities)
    print()
    print("Entity types:")
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}")

    OUT.mkdir(exist_ok=True)
    output_path = OUT / "polymath_corpus.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({"entities": all_entities, "relationships": relationships}, f, indent=2)

    print()
    print(f"Saved: {output_path}")
    print(f"File size: {output_path.stat().st_size / 1024:.1f} KB")
    print()
    print(f"BTUT activation thresholds:")
    print(f"  >500 entities for cascade_levels=2: {'YES' if len(all_entities) > 500 else 'no'}")
    print(f"  >1000 entities for full signal: {'YES' if len(all_entities) > 1000 else 'no'}")
    print(f"  Current: {len(all_entities)} entities")


if __name__ == "__main__":
    main()
