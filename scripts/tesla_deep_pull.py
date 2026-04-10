#!/usr/bin/env python3
"""Tesla Deep Pull — fetch full patent text + archive.org writings, chunk into entities.

Pulls:
- Full text for all 112 US patents from Google Patents
- Complete Tesla writings from archive.org (Martin compilation, 1.2M chars)
- Chunks all text into paragraph-level entities (~500 words each)
- Builds cross-reference edges between chunks sharing concepts

Target: 5,000-10,000 entities from real primary source text.
"""

import json
import os
import re
import ssl
import sys
import time
from collections import defaultdict
from urllib.request import Request, urlopen

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, os.path.join(ROOT_DIR, "backend"))
os.chdir(ROOT_DIR)

# SSL context for Google Patents
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

REQUEST_DELAY = 1.0  # Be polite to Google Patents


def fetch_patent_text(patent_number: str) -> str | None:
    """Fetch full patent text from Google Patents."""
    time.sleep(REQUEST_DELAY)
    url = f"https://patents.google.com/patent/{patent_number}/en"
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; LatentOcean/1.0)"})
    try:
        with urlopen(req, timeout=20, context=SSL_CTX) as resp:
            html = resp.read().decode("utf-8", errors="replace")

        # Extract description section
        desc_match = re.search(
            r'<section[^>]*itemprop="description"[^>]*>(.*?)</section>',
            html, re.DOTALL,
        )
        if desc_match:
            text = re.sub(r"<[^>]+>", " ", desc_match.group(1))
            text = re.sub(r"\s+", " ", text).strip()
            if len(text) > 100:
                return text

        # Fallback: extract all text, find patent content
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text).strip()
        # Look for patent description markers
        for marker in ["Be it known that", "SPECIFICATION", "I claim", "What I claim"]:
            idx = text.find(marker)
            if idx > 0:
                return text[max(0, idx - 200):idx + 5000]

        return None
    except Exception:
        return None


def fetch_archive_text(url: str) -> str | None:
    """Fetch text from archive.org."""
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; LatentOcean/1.0)"})
    try:
        with urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception:
        return None


def chunk_text(text: str, chunk_size: int = 400, overlap: int = 50) -> list[str]:
    """Split text into overlapping word chunks."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words) and len(chunks) < 200:
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if len(chunk) >= 80:
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


def extract_concepts_from_text(text: str) -> list[str]:
    """Extract Tesla-related concept tags from text."""
    text_lower = text.lower()
    concept_keywords = {
        "alternating_current": ["alternating current", "alternating-current", "a.c.", "polyphase"],
        "motor": ["motor", "armature", "rotor", "stator"],
        "dynamo": ["dynamo", "generator"],
        "transformer": ["transformer", "induction coil", "induction device"],
        "high_frequency": ["high frequency", "high-frequency", "oscillat"],
        "tesla_coil": ["tesla coil", "resonant transformer", "secondary coil"],
        "wireless": ["wireless", "without wires", "radiant energy"],
        "transmission": ["transmission", "transmit", "transmitted"],
        "lighting": ["lamp", "lighting", "incandescent", "fluorescent", "illuminat"],
        "condenser": ["condenser", "capacitor", "capacity"],
        "radio": ["radio", "signaling", "hertz", "marconi"],
        "turbine": ["turbine", "bladeless", "fluid propulsion"],
        "remote_control": ["teleautomaton", "remote control", "controlled mechanism"],
        "resonance": ["resonance", "resonant", "oscillation"],
        "magnetism": ["magnetic", "magnet", "electro-magnet"],
        "power": ["power", "energy", "electrical energy"],
        "circuit": ["circuit", "controller", "switch"],
    }

    found = []
    for concept, keywords in concept_keywords.items():
        for kw in keywords:
            if kw in text_lower:
                found.append(concept)
                break
    return found


def main():
    from app.services.btut.adapters.tesla import US_PATENTS, PEOPLE, CONCEPTS, LOCATIONS, FBI_DOCUMENTS, TIMELINE_EVENTS, WRITINGS

    print("=" * 70)
    print("  TESLA DEEP PULL — Full Patent Text + Archive.org Writings")
    print("=" * 70)

    entities = []
    edges = []
    concept_chunks: dict[str, list[str]] = defaultdict(list)  # concept -> chunk entity names

    # ── Phase 1: Fetch all 112 patent full texts ─────────────────
    print(f"\nPhase 1: Fetching full text for {len(US_PATENTS)} patents from Google Patents...")
    print(f"  Rate: 1 patent/sec, estimated time: {len(US_PATENTS) // 60 + 1} minutes")

    patent_chunks_total = 0
    for i, (pnum, title, date, concepts) in enumerate(US_PATENTS):
        if i % 20 == 0:
            print(f"  [{i+1}/{len(US_PATENTS)}] {patent_chunks_total} chunks so far...")

        text = fetch_patent_text(pnum)
        if not text or len(text) < 200:
            # Create metadata-only entity
            entities.append({
                "name": f"patent_{pnum}",
                "type": "patent",
                "attributes": json.dumps({
                    "patent_number": pnum, "title": title,
                    "grant_date": date, "concepts": concepts,
                }),
            })
            continue

        # Chunk the patent text into paragraph-level entities
        chunks = chunk_text(text, chunk_size=400, overlap=50)
        for ci, chunk in enumerate(chunks):
            chunk_name = f"patent_chunk_{pnum}_{ci}"
            chunk_concepts = extract_concepts_from_text(chunk) or concepts

            entities.append({
                "name": chunk_name,
                "type": "patent_chunk",
                "attributes": json.dumps({
                    "patent_number": pnum, "title": title,
                    "grant_date": date, "chunk_index": ci,
                    "total_chunks": len(chunks),
                    "text": chunk[:500],  # Store first 500 chars for display
                    "concepts": chunk_concepts,
                }),
            })
            patent_chunks_total += 1

            # Track concept -> chunk for cross-reference edges
            for c in chunk_concepts:
                concept_chunks[c].append(chunk_name)

            # Edge: chunk -> parent patent metadata
            if ci == 0:
                # First chunk also creates the parent patent entity
                entities.append({
                    "name": f"patent_{pnum}",
                    "type": "patent",
                    "attributes": json.dumps({
                        "patent_number": pnum, "title": title,
                        "grant_date": date, "concepts": concepts,
                        "chunk_count": len(chunks),
                        "text_length": len(text),
                    }),
                })

            edges.append({
                "source": chunk_name, "target": f"patent_{pnum}",
                "type": "chunk_of", "weight": 1.0,
            })

            # Sequential chunk edges
            if ci > 0:
                edges.append({
                    "source": f"patent_chunk_{pnum}_{ci-1}",
                    "target": chunk_name,
                    "type": "followed_by", "weight": 0.8,
                })

    print(f"  Patent chunks: {patent_chunks_total} from {len(US_PATENTS)} patents")

    # ── Phase 2: Fetch Tesla writings from archive.org ────────────
    print(f"\nPhase 2: Fetching Tesla writings from archive.org...")

    archive_urls = [
        ("martin_compilation", "https://archive.org/download/inventionsresear00martiala/inventionsresear00martiala_djvu.txt",
         "The Inventions, Researches and Writings of Nikola Tesla"),
        ("my_inventions", "https://archive.org/download/myinventionsothe0000tesl/myinventionsothe0000tesl_djvu.txt",
         "My Inventions: The Autobiography of Nikola Tesla"),
        ("selected_writings", "https://archive.org/download/NikolaTeslaSelectedTeslaWritingsVol1/Nikola%20Tesla%20-%20Selected%20Tesla%20Writings%20-%20Vol%201_djvu.txt",
         "Selected Tesla Writings Vol 1"),
    ]

    writing_chunks_total = 0
    for source_id, url, title in archive_urls:
        print(f"  Fetching: {title}...")
        text = fetch_archive_text(url)
        if not text:
            print(f"    Failed to fetch")
            continue

        # Clean OCR text
        text = re.sub(r"[^\x20-\x7E\n]", " ", text)  # Remove non-ASCII
        text = re.sub(r"\n{3,}", "\n\n", text)  # Collapse excessive newlines
        text = re.sub(r" {3,}", " ", text)  # Collapse spaces

        print(f"    Raw text: {len(text)} chars")

        chunks = chunk_text(text, chunk_size=400, overlap=50)
        print(f"    Chunks: {len(chunks)}")

        for ci, chunk in enumerate(chunks):
            chunk_name = f"writing_chunk_{source_id}_{ci}"
            chunk_concepts = extract_concepts_from_text(chunk)

            entities.append({
                "name": chunk_name,
                "type": "writing_chunk",
                "attributes": json.dumps({
                    "source": source_id, "source_title": title,
                    "chunk_index": ci, "total_chunks": len(chunks),
                    "text": chunk[:500],
                    "concepts": chunk_concepts,
                }),
            })
            writing_chunks_total += 1

            for c in chunk_concepts:
                concept_chunks[c].append(chunk_name)

            if ci > 0:
                edges.append({
                    "source": f"writing_chunk_{source_id}_{ci-1}",
                    "target": chunk_name,
                    "type": "followed_by", "weight": 0.7,
                })

    print(f"  Writing chunks: {writing_chunks_total}")

    # ── Phase 3: Add structural entities (people, concepts, etc.) ─
    print(f"\nPhase 3: Adding structural entities...")

    for pid, name, role, desc in PEOPLE:
        entities.append({
            "name": f"person_{pid}", "type": "person",
            "attributes": json.dumps({"full_name": name, "role": role, "description": desc}),
        })

    for cid, name, desc in CONCEPTS:
        entities.append({
            "name": f"concept_{cid}", "type": "concept",
            "attributes": json.dumps({"concept_name": name, "description": desc}),
        })

    for lid, name, ltype, sig in LOCATIONS:
        entities.append({
            "name": f"location_{lid}", "type": "location",
            "attributes": json.dumps({"location_name": name, "location_type": ltype, "significance": sig}),
        })

    for did, title, dr, desc in FBI_DOCUMENTS:
        entities.append({
            "name": f"document_{did}", "type": "document",
            "attributes": json.dumps({"title": title, "date_range": dr, "description": desc, "source": "FBI/FOIA"}),
        })

    for eid, title, date, desc in TIMELINE_EVENTS:
        entities.append({
            "name": f"event_{eid}", "type": "event",
            "attributes": json.dumps({"event_name": title, "date": date, "description": desc}),
        })

    for wid, title, year, wtype, venue in WRITINGS:
        entities.append({
            "name": f"writing_{wid}", "type": "writing",
            "attributes": json.dumps({"title": title, "year": year, "type": wtype, "venue": venue}),
        })

    # ── Phase 4: Build cross-reference edges ─────────────────────
    print(f"\nPhase 4: Building cross-reference edges...")

    # Concept co-occurrence: chunks sharing the same concept
    for concept, chunk_names in concept_chunks.items():
        concept_entity = f"concept_{concept}"
        entity_names = {e["name"] for e in entities}

        # Link chunks to concept entities
        if concept_entity in entity_names:
            for cn in chunk_names[:50]:  # Cap per concept
                edges.append({"source": cn, "target": concept_entity, "type": "mentions_concept", "weight": 0.7})

        # Cross-reference: chunks from DIFFERENT sources sharing same concept
        patent_chunks_list = [c for c in chunk_names if c.startswith("patent_chunk_")]
        writing_chunks_list = [c for c in chunk_names if c.startswith("writing_chunk_")]

        # Patent <-> writing cross-references (the most valuable edges)
        for pc in patent_chunks_list[:10]:
            for wc in writing_chunks_list[:10]:
                edges.append({"source": pc, "target": wc, "type": "cross_reference", "weight": 0.6})

        # Within-type shared concept edges (sample)
        for chunks_list in [patent_chunks_list[:20], writing_chunks_list[:20]]:
            for i in range(min(len(chunks_list), 10)):
                for j in range(i + 1, min(len(chunks_list), 10)):
                    edges.append({"source": chunks_list[i], "target": chunks_list[j], "type": "shared_concept", "weight": 0.5})

    print(f"  Cross-reference edges: {len(edges)}")

    # ── Phase 5: Summary and save ────────────────────────────────
    type_counts = defaultdict(int)
    for e in entities:
        type_counts[e["type"]] += 1
    edge_type_counts = defaultdict(int)
    for e in edges:
        edge_type_counts[e["type"]] += 1

    print(f"\n{'=' * 70}")
    print(f"  TESLA DEEP CORPUS")
    print(f"{'=' * 70}")
    print(f"  Total entities: {len(entities)}")
    for t, c in sorted(type_counts.items()):
        print(f"    {t}: {c}")
    print(f"  Total edges: {len(edges)}")
    for t, c in sorted(edge_type_counts.items()):
        print(f"    {t}: {c}")

    # Save raw entities/edges for the adapter
    cache_path = os.path.join(SCRIPT_DIR, "tesla_deep_cache.json")
    with open(cache_path, "w") as f:
        json.dump({"entities": entities, "edges": edges}, f)
    print(f"\n  Cached to: {cache_path}")

    # ── Phase 6: Run BTUT pipeline ───────────────────────────────
    print(f"\n{'=' * 70}")
    print(f"  RUNNING BTUT PIPELINE")
    print(f"{'=' * 70}")

    from app.services.btut.pipeline import run_btut_pipeline

    unique_types = sorted(type_counts.keys())
    result = run_btut_pipeline(
        entities=entities,
        edges=edges,
        unique_types=unique_types,
        target_survivors=500,
        progress_callback=lambda msg: print(f"  {msg}"),
    )

    # Save result
    result_path = os.path.join(SCRIPT_DIR, "results", "tesla_superpower_result.json")
    os.makedirs(os.path.dirname(result_path), exist_ok=True)
    with open(result_path, "w") as f:
        json.dump(result, f, indent=2)

    s = result["summary"]
    print(f"\n{'=' * 70}")
    print(f"  RESULTS")
    print(f"{'=' * 70}")
    print(f"  Entities:     {s['total_entities']:,}")
    print(f"  Clusters:     {s['clusters']}")
    print(f"  Fingerprints: {s['unique_48bit_fingerprints']}")
    print(f"  Survivors:    {s['survivors']} ({s['reduction']}x reduction)")
    print(f"  Types:        {s['survivor_types']}")

    sorted_survs = sorted(result["survivors"], key=lambda x: -x["scores"]["composite"])
    print(f"\n  Top 15 Survivors:")
    for i, sv in enumerate(sorted_survs[:15]):
        ent = sv["entity"]
        attrs = json.loads(ent.get("attributes", "{}")) if isinstance(ent.get("attributes"), str) else ent.get("attributes", {})
        name = attrs.get("title", attrs.get("event_name", attrs.get("full_name", attrs.get("concept_name", ent.get("name", "")))))
        pnum = attrs.get("patent_number", "")
        print(f"    {i+1:>2}. [{pnum or '-':<10}] {str(name)[:60]:<60} score={sv['scores']['composite']:.4f}")

    print(f"\n  Saved to: {result_path}")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
