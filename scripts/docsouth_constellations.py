#!/usr/bin/env python3
"""
DocSouth Constellation Engine.

Generic infrastructure: walk the corpus, extract proper-noun named entities
(people, titled clergy, places, ships, organizations, dates), build an
entity-by-text incidence matrix, derive an entity-co-occurrence graph,
and surface constellations — sets of entities that appear together across
multiple texts and link records the curators filed in different
collections.

Output: /data/formed_models/_public/docsouth_constellations.json

The engine is corpus-agnostic. The same code works on any NDJSON corpus
where each record has a `text` field. Tuning of the entity regex is the
only corpus-specific knob; the rest is general.
"""
from __future__ import annotations
import datetime
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

_HOST_BASE = "/opt/latentocean/data/formed_models"
_CONT_BASE = "/data/formed_models"
_BASE = _CONT_BASE if os.path.isdir(_CONT_BASE) else _HOST_BASE
CORPUS_PATH = Path(f"{_BASE}/_inputs/docsouth.ndjson")
PUBLIC_OUT  = Path(f"{_BASE}/_public/docsouth_constellations.json")

# ----- Entity extraction --------------------------------------------------
#
# Five overlapping regex passes, each tuned for a category. Order matters:
# title-prefixed clergy first (they pin the proper noun even when the
# surname is common), then ships (italicized + specific dictionary),
# place names (geographic suffixes), institutions (Church / College /
# Society / University), and finally bare capitalized bigrams as a
# fallback for plain personal names. Each match feeds the same graph.

# Clergy / officer titles followed by a Capitalized Name
TITLE_PATTERNS = [
    r"\b(?:Rev\.|Reverend|Bishop|Dr\.|Doctor|Father|Brother|Mrs\.|Mrs|Miss|Sister|Mr\.|Pres\.|President|Gov\.|Governor|Sen\.|Senator|Hon\.|Capt\.|Captain|Col\.|Colonel|Gen\.|General|Maj\.|Major|Lieut\.|Lieutenant|Prof\.|Professor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z\.]+){0,3})",
]
TITLE_RE = re.compile("|".join(TITLE_PATTERNS))

# Place names with geographic anchors
PLACE_KEYWORDS = [
    "Liberia", "Sierra Leone", "Africa", "Cape Coast", "Cape Palmas", "Monrovia", "Lagos", "Abeokuta", "Cameroon", "Bakundu",
    "South Africa", "Sierra", "Senegal", "Gambia", "Ghana", "Nigeria", "Congo",
    "Virginia", "North Carolina", "South Carolina", "Georgia", "Alabama", "Mississippi", "Tennessee", "Kentucky", "Maryland", "Louisiana", "Florida", "Texas", "Arkansas",
    "Charleston", "Savannah", "Richmond", "Atlanta", "Wilmington", "Raleigh", "Chapel Hill", "Durham", "Greensboro", "Charlotte", "New Orleans", "Mobile", "Memphis", "Nashville", "Louisville", "Baltimore", "Washington", "Philadelphia", "New York", "Boston", "Newport",
    "Wilberforce", "Oberlin", "Berea", "Hampton", "Tuskegee", "Howard", "Fisk", "Lincoln", "Storer",
]
PLACE_RE = re.compile(r"\b(" + "|".join(re.escape(p) for p in PLACE_KEYWORDS) + r")\b")

# Ships / vessels (manually curated since they're italicized in the originals)
SHIP_KEYWORDS = [
    "Horsa", "Laurada", "Yarmouth", "Black Star", "Pearl",
    "Majestic", "Teneriffe", "Liberia",
    "Wanderer", "Clotilda", "Amistad",
]
SHIP_RE = re.compile(r"\b(" + "|".join(re.escape(s) for s in SHIP_KEYWORDS) + r")\b")

# Institutions
_INST_LIST = [
    "African Methodist Episcopal Church", "AME Church",
    "Methodist Episcopal Church", "Baptist Church", "Presbyterian Church", "Episcopal Church",
    "American Colonization Society", "International Migration Society",
    "American Negro Academy", "Underground Railroad", "Freedmens Bureau",
    "Liberian Mission", "Negro Convention", "Anti-Slavery Society",
    "Wilberforce University", "Berea College", "Hampton Institute", "Tuskegee Institute",
    "Howard University", "Fisk University", "Oberlin College", "Lincoln University",
    "University of North Carolina", "Shaw University",
    "Voice of Missions", "Christian Recorder", "Liberator",
]
INSTITUTION_RE = re.compile(
    r"\b(" + "|".join(re.escape(s) for s in _INST_LIST) + r")\b"
)

# Plain capitalized bigrams — for personal names not caught by titles
NAME_BIGRAM_RE = re.compile(r"\b([A-Z][a-z]+)\s+([A-Z][a-z\.]+)\b")

# Names to suppress (high-frequency false positives)
STOPLIST = {
    "United States", "American", "African", "Christian", "Bible", "God", "Lord", "Jesus", "Christ",
    "New York", "United Kingdom", "Old Testament", "New Testament",
    "St. John", "St. Paul", "St. Peter", "St. Mark", "St. James", "St. Luke",
    "Sunday School", "Holy Spirit", "Holy Ghost",
}


def extract_entities(text: str) -> dict[str, set[str]]:
    """Run all regex passes; return {category: {entity, ...}}."""
    out: dict[str, set[str]] = {
        "person":      set(),
        "place":       set(),
        "ship":        set(),
        "institution": set(),
    }
    # Titled persons
    for m in TITLE_RE.finditer(text):
        for g in m.groups():
            if g:
                name = g.strip().rstrip(".,;:")
                if name and name not in STOPLIST and len(name) > 3:
                    out["person"].add(name)
    # Bigram persons (sparse — they have lots of false positives)
    for m in NAME_BIGRAM_RE.finditer(text):
        a, b = m.group(1), m.group(2).rstrip(".")
        if a in {"The", "And", "But", "However", "Then", "When", "Where", "What", "Why",
                 "Which", "Who", "Whose", "Some", "These", "Those", "Both", "All", "Many",
                 "Most", "Such", "Each", "Every", "First", "Second", "Third", "Last",
                 "Only", "Even", "Just", "Yet", "Still", "Again", "Now", "There", "Here",
                 "Mr", "Mrs", "Dr", "Rev", "Bishop", "Father", "Sister", "Brother", "Miss",
                 "Capt", "Col", "Gen", "Maj", "Hon", "Sen", "Pres", "Prof",
                 "January", "February", "March", "April", "May", "June", "July",
                 "August", "September", "October", "November", "December",
                 "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
                 "Old", "New", "North", "South", "East", "West"}:
            continue
        if b in {"The", "And", "But"}:
            continue
        full = f"{a} {b}"
        if full in STOPLIST: continue
        if len(full) < 7: continue
        out["person"].add(full)
    # Places
    for m in PLACE_RE.finditer(text):
        out["place"].add(m.group(1))
    # Ships
    for m in SHIP_RE.finditer(text):
        out["ship"].add(m.group(1))
    # Institutions
    for m in INSTITUTION_RE.finditer(text):
        out["institution"].add(m.group(1))
    return out


def main() -> int:
    print("Loading corpus + extracting entities ...")
    # idx -> (collection, year, author, title, filename, url, entities_per_category)
    records: dict[int, dict] = {}
    entity_records: dict[str, set[int]] = defaultdict(set)
    entity_category: dict[str, str] = {}
    n_records = 0

    with CORPUS_PATH.open(encoding="utf-8") as f:
        for i, line in enumerate(f):
            if not line.strip():
                continue
            try:
                rec = json.loads(line)
            except Exception:
                continue
            text = rec.get("text", "") or ""
            if not text:
                continue
            ents = extract_entities(text)
            records[i] = {
                "collection": rec.get("collection", ""),
                "filename":   rec.get("filename", ""),
                "author":     rec.get("author", ""),
                "title":      rec.get("title", ""),
                "year":       rec.get("year", ""),
                "url":        rec.get("url", ""),
                "entities":   {k: sorted(v) for k, v in ents.items()},
            }
            for cat, names in ents.items():
                for n in names:
                    entity_records[n].add(i)
                    entity_category[n] = cat
            n_records += 1
            if n_records % 5000 == 0:
                print(f"  {n_records:,} records processed")

    print(f"  total: {n_records:,} records, {len(entity_records):,} unique entities")

    # Rank entities by # of distinct source-texts they appear in (filename-deduped)
    # Group records by filename so a single text doesn't inflate entity rank via
    # its many segments.
    file_index: dict[str, set[int]] = defaultdict(set)
    for idx, r in records.items():
        file_index[r["filename"]].add(idx)

    entity_filenames: dict[str, set[str]] = {}
    for ent, idx_set in entity_records.items():
        files = {records[i]["filename"] for i in idx_set if i in records}
        entity_filenames[ent] = files

    # Top entities by file-spread
    ranked_entities = sorted(
        entity_filenames.items(),
        key=lambda kv: (-len(kv[1]), kv[0]),
    )
    top = ranked_entities[:200]

    print("\nTop 30 entities by cross-text spread:")
    for name, files in top[:30]:
        print(f"  {name:<40s} {len(files):>4d} texts  [{entity_category.get(name, '?')}]")

    # Build entity-pair co-occurrence at the FILE level (not segment level).
    # For each pair of entities, count how many distinct source texts contain both.
    print("\nComputing entity-pair co-occurrence ...")
    top_set = {n for n, _ in top}
    file_entities: dict[str, set[str]] = defaultdict(set)
    for ent, files in entity_filenames.items():
        if ent not in top_set:
            continue
        for f in files:
            file_entities[f].add(ent)

    pair_counts: Counter = Counter()
    for f, ents in file_entities.items():
        ents_list = sorted(ents)
        for i in range(len(ents_list)):
            for j in range(i + 1, len(ents_list)):
                pair_counts[(ents_list[i], ents_list[j])] += 1

    top_pairs = pair_counts.most_common(120)

    # Constellations: starting from each top entity, find the set of texts that
    # contain it AND name 3+ other top entities. These are "dense" texts in the
    # citation network — likely hub texts a scholar should read first.
    print("\nDense hub texts (5+ top entities each):")
    hub_texts: list[dict] = []
    for f, ents in file_entities.items():
        if len(ents) < 5:
            continue
        # Pick representative metadata from any segment of this file
        sample_idx = next(iter(file_index[f]))
        meta = records[sample_idx]
        hub_texts.append({
            "filename":   f,
            "title":      meta["title"],
            "author":     meta["author"],
            "year":       meta["year"],
            "collection": meta["collection"],
            "url":        meta["url"],
            "entity_count": len(ents),
            "top_entities": sorted(ents, key=lambda e: -len(entity_filenames[e]))[:12],
        })
    hub_texts.sort(key=lambda h: -h["entity_count"])
    for h in hub_texts[:15]:
        print(f"  {h['entity_count']:>3d} ents  {h['year']:>5s}  {h['author'][:25]:<25s}  {h['title'][:50]}")

    # Cross-collection bridges: entities that appear in 3+ distinct DocSouth
    # collections. These are the structural cross-collection nodes.
    cross_coll: list[dict] = []
    for ent, files in entity_filenames.items():
        if ent not in top_set: continue
        cols = set()
        for f in files:
            sample_idx = next(iter(file_index[f]))
            cols.add(records[sample_idx]["collection"])
        if len(cols) >= 3:
            cross_coll.append({
                "entity":      ent,
                "category":    entity_category.get(ent, "?"),
                "n_files":     len(files),
                "collections": sorted(cols),
            })
    cross_coll.sort(key=lambda x: (-x["n_files"], x["entity"]))

    print(f"\nCross-collection bridge entities (in 3+ collections): {len(cross_coll)}")
    for c in cross_coll[:20]:
        print(f"  {c['entity']:<40s} {c['n_files']:>4d} texts  in {len(c['collections'])} collections  [{c['category']}]")

    # Compose output
    out = {
        "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "showcase":     "docsouth",
        "method":       "regex-based proper-noun + place + ship + institution NER over the corpus, deduped at filename level. Each entity gets a file-spread count (# of source texts mentioning it). Pairs counted across distinct files. Hub texts = those mentioning 5+ top entities. Cross-collection bridges = entities appearing in 3+ DocSouth collections.",
        "total_records":  n_records,
        "total_files":    len(file_index),
        "total_entities": len(entity_records),
        "top_entities": [
            {
                "name":      n,
                "category":  entity_category.get(n, "?"),
                "file_count": len(f),
                "files":     sorted(f)[:8],
            }
            for n, f in top[:60]
        ],
        "top_pairs": [
            {"entity_a": a, "entity_b": b, "count": c}
            for (a, b), c in top_pairs[:60]
        ],
        "hub_texts": hub_texts[:20],
        "cross_collection_bridges": cross_coll[:30],
    }

    PUBLIC_OUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUT.write_text(json.dumps(out, indent=2))
    size = PUBLIC_OUT.stat().st_size
    print(f"\nWrote {PUBLIC_OUT}  ({size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
