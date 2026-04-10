"""Novelty query for LATK.

Given a BTUT result (the lattice of survivors with 48-bit fingerprints
and cluster assignments), fingerprint an arbitrary text query against
that lattice and return:

    - novelty_score: scalar novelty in [0, 1], where 0 means the query's
      fingerprint exactly matches an existing survivor and 1 means it
      is as far as possible in Hamming space.
    - nearest_entities: ranked list of BTUT survivors closest to the
      query's fingerprint.
    - matched_clusters: lattice clusters the nearest matches belong to.
    - era_distribution: counts of historical vs modern entities in the
      matched clusters, for lineage interpretation.

This is the Phase 0 prototype. It uses a reasonable deterministic
48-bit hash for query fingerprinting as a stand-in for the BTUT engine's
internal fingerprint function. Phase 1 will replace the standalone hash
with a direct call into `app.services.btut.pipeline._compute_fingerprint`
so that query fingerprints are bit-identical with lattice fingerprints.

Usage
-----
    from latk_tool.query.novelty import load_lattice, query_novelty
    lattice = load_lattice(
        "scripts/cross_era_analysis/output/linguistics_btut_result.json"
    )
    report = query_novelty(
        "Meaning is determined by a word's opposition to all others.",
        lattice,
    )
    print(report.novelty_score)
    for match in report.nearest_entities[:5]:
        print(match.entity_name, match.hamming_distance, match.cluster)
"""

from __future__ import annotations

import ast
import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple


FINGERPRINT_BITS = 48
HISTORICAL_PREFIXES = (
    "historical_",
    "ancient_",
    "medieval_",
    "classical_",
    "panini_",
    "portroyal_",
    "humboldt_",
    "saussure_",
    "newton_",
    "leonardo_",
    "vonneumann_",
    "tesla_",
    "shannon_",
)
MODERN_PREFIXES = (
    "modern_",
    "arxiv_",
    "uspto_",
    "contemporary_",
    "transformer",
    "distributional",
    "chomsky",
    "bnf",
)


@dataclass
class LatticeEntry:
    entity_name: str
    entity_type: str
    cluster: str
    fingerprint_bits: str
    composite: float
    era: str = "unknown"


@dataclass
class LatticeIndex:
    entries: List[LatticeEntry]
    by_cluster: Dict[str, List[LatticeEntry]] = field(default_factory=dict)
    source_path: Optional[str] = None

    @property
    def size(self) -> int:
        return len(self.entries)

    @property
    def n_clusters(self) -> int:
        return len(self.by_cluster)


@dataclass
class NoveltyMatch:
    entity_name: str
    entity_type: str
    cluster: str
    hamming_distance: int
    composite: float
    era: str


@dataclass
class NoveltyReport:
    query_text: str
    query_fingerprint: str
    novelty_score: float
    nearest_entities: List[NoveltyMatch]
    matched_clusters: List[str]
    era_distribution: Dict[str, int]
    notes: List[str] = field(default_factory=list)


def _era_for_entity_name(name: str) -> str:
    """Heuristically classify an entity as historical / modern / unknown.

    Handles several naming conventions from the investigation corpora:
    - `historical_*` / `modern_*` prefixes (CET tool convention)
    - `latk_<domain>__historical_*` / `latk_<domain>__modern_*` (LATK merger)
    - `newton_*`, `leonardo_*`, `tesla_*`, `saussure_*` etc. (domain-specific)
    """
    lname = name.lower()
    parts = lname.split("__")
    # LATK prefix strip: latk_<domain>__<original_name>__...
    if parts and parts[0].startswith("latk_") and len(parts) > 1:
        parts = parts[1:]
    joined = "__".join(parts)

    if joined.startswith("historical_") or "__historical_" in joined:
        return "historical"
    if joined.startswith("modern_") or "__modern_" in joined:
        return "modern"
    if any(joined.startswith(p) for p in HISTORICAL_PREFIXES):
        return "historical"
    if any(p in joined for p in MODERN_PREFIXES):
        return "modern"
    return "unknown"


def _parse_entity_blob(entity_str: str) -> Tuple[str, str]:
    """BTUT survivors store the entity as a stringified dict.

    Example: "{'name': 'modern_chomsky_hierarchy__concept__...', 'type': 'concept', ...}"
    We use ast.literal_eval for safety, falling back to a regex if it fails.
    """
    try:
        d = ast.literal_eval(entity_str)
        if isinstance(d, dict):
            return (
                str(d.get("name", "<unknown>")),
                str(d.get("type", "<unknown>")),
            )
    except (ValueError, SyntaxError):
        pass
    m = re.search(r"'name':\s*'([^']+)'", entity_str)
    t = re.search(r"'type':\s*'([^']+)'", entity_str)
    return (m.group(1) if m else "<unknown>", t.group(1) if t else "<unknown>")


def _parse_scores_blob(scores_str: str) -> float:
    try:
        d = ast.literal_eval(scores_str)
        if isinstance(d, dict) and "composite" in d:
            return float(d["composite"])
    except (ValueError, SyntaxError):
        pass
    m = re.search(r"'composite':\s*([0-9.]+)", scores_str)
    return float(m.group(1)) if m else 0.0


def load_lattice(btut_result_path: str | Path) -> LatticeIndex:
    """Load a BTUT result JSON into a lattice index."""
    path = Path(btut_result_path)
    with path.open("r", encoding="utf-8") as fp:
        data = json.load(fp)

    survivors = data.get("survivors", [])
    entries: List[LatticeEntry] = []

    for s in survivors:
        entity_blob = s.get("entity", "")
        scores_blob = s.get("scores", "")
        if isinstance(entity_blob, dict):
            name = str(entity_blob.get("name", "<unknown>"))
            etype = str(entity_blob.get("type", "<unknown>"))
        else:
            name, etype = _parse_entity_blob(str(entity_blob))

        if isinstance(scores_blob, dict):
            composite = float(scores_blob.get("composite", 0.0))
        else:
            composite = _parse_scores_blob(str(scores_blob))

        fingerprint = str(s.get("fingerprint_48bit", "")).strip()
        if len(fingerprint) != FINGERPRINT_BITS:
            continue

        cluster = str(s.get("cluster", "?"))

        entries.append(
            LatticeEntry(
                entity_name=name,
                entity_type=etype,
                cluster=cluster,
                fingerprint_bits=fingerprint,
                composite=composite,
                era=_era_for_entity_name(name),
            )
        )

    by_cluster: Dict[str, List[LatticeEntry]] = {}
    for e in entries:
        by_cluster.setdefault(e.cluster, []).append(e)

    return LatticeIndex(
        entries=entries,
        by_cluster=by_cluster,
        source_path=str(path),
    )


def _tokenize(text: str) -> List[str]:
    return [w for w in re.findall(r"[A-Za-z][A-Za-z0-9_\-]+", text.lower()) if len(w) > 2]


def _chunk_tokens(tokens: List[str], size: int = 15) -> List[List[str]]:
    if not tokens:
        return []
    step = max(1, size // 2)
    return [tokens[i : i + size] for i in range(0, max(1, len(tokens) - size + 1), step)]


def _hash_chunk_to_48bits(chunk_tokens: List[str]) -> int:
    """Deterministic 48-bit chunk hash.

    This is a stand-in for BTUT's internal fingerprint function. Phase 1
    will replace this with a direct call into the pipeline.
    """
    joined = " ".join(sorted(set(chunk_tokens)))
    h = hashlib.blake2b(joined.encode("utf-8"), digest_size=6).digest()
    return int.from_bytes(h, "big") & ((1 << FINGERPRINT_BITS) - 1)


def fingerprint_text(text: str) -> str:
    """Compute a 48-bit fingerprint string for an arbitrary text.

    Produces a bitstring of length 48 compatible with BTUT survivor
    fingerprint_48bit fields. The bits are the result of OR-ing hashed
    token-chunk signatures together (MinHash-style aggregation).
    """
    tokens = _tokenize(text)
    chunks = _chunk_tokens(tokens, size=15)
    if not chunks:
        return "0" * FINGERPRINT_BITS

    acc = 0
    for c in chunks:
        acc |= _hash_chunk_to_48bits(c)

    bits = bin(acc)[2:].rjust(FINGERPRINT_BITS, "0")[-FINGERPRINT_BITS:]
    return bits


def _hamming_distance(a: str, b: str) -> int:
    if len(a) != len(b):
        return max(len(a), len(b))
    return sum(x != y for x, y in zip(a, b))


def query_novelty(
    query_text: str,
    lattice: LatticeIndex,
    top_k: int = 20,
) -> NoveltyReport:
    """Fingerprint `query_text` and rank nearest lattice entries.

    Returns a NoveltyReport with:
    - novelty_score: min Hamming distance / 48 (0 = exact match, 1 = max)
    - nearest_entities: top_k closest survivors with their cluster ids
    - matched_clusters: clusters touched by the top matches
    - era_distribution: historical / modern / unknown counts over matches
    """
    query_fp = fingerprint_text(query_text)

    scored: List[NoveltyMatch] = []
    for e in lattice.entries:
        dist = _hamming_distance(query_fp, e.fingerprint_bits)
        scored.append(
            NoveltyMatch(
                entity_name=e.entity_name,
                entity_type=e.entity_type,
                cluster=e.cluster,
                hamming_distance=dist,
                composite=e.composite,
                era=e.era,
            )
        )

    scored.sort(key=lambda m: (m.hamming_distance, -m.composite))
    top = scored[:top_k]

    min_dist = top[0].hamming_distance if top else FINGERPRINT_BITS
    novelty_score = min_dist / FINGERPRINT_BITS

    matched_clusters: List[str] = []
    for m in top:
        if m.cluster not in matched_clusters:
            matched_clusters.append(m.cluster)

    era_distribution: Dict[str, int] = {"historical": 0, "modern": 0, "unknown": 0}
    for m in top:
        era_distribution[m.era] = era_distribution.get(m.era, 0) + 1

    notes: List[str] = []
    if novelty_score < 0.1:
        notes.append("Very low novelty: query fingerprint nearly identical to existing lattice entry.")
    elif novelty_score < 0.3:
        notes.append("Low novelty: query fingerprint lands inside an existing dense cluster.")
    elif novelty_score > 0.6:
        notes.append("High novelty: query fingerprint is far from any existing lattice entry.")

    if era_distribution.get("historical", 0) >= 3:
        notes.append(f"Strong historical lineage: {era_distribution['historical']} historical ancestors in top {top_k}.")
    if era_distribution.get("modern", 0) >= 3 and era_distribution.get("historical", 0) == 0:
        notes.append("No historical ancestors found in top matches — either genuinely novel or corpus gap.")

    return NoveltyReport(
        query_text=query_text[:200],
        query_fingerprint=query_fp,
        novelty_score=round(novelty_score, 4),
        nearest_entities=top,
        matched_clusters=matched_clusters,
        era_distribution=era_distribution,
        notes=notes,
    )


def format_report(report: NoveltyReport, width: int = 80) -> str:
    """Pretty-print a NoveltyReport for CLI display."""
    lines = []
    lines.append("=" * width)
    lines.append("LATK Novelty Query Report")
    lines.append("=" * width)
    lines.append(f"Query     : {report.query_text[:width-12]}")
    lines.append(f"FP (48bit): {report.query_fingerprint}")
    lines.append(f"Novelty   : {report.novelty_score:.4f} (0 = matches existing, 1 = max novel)")
    lines.append(f"Era dist  : {report.era_distribution}")
    lines.append(f"Clusters  : {', '.join(report.matched_clusters[:10])}")
    lines.append("")
    lines.append("Top nearest lattice entries:")
    lines.append("-" * width)
    for i, m in enumerate(report.nearest_entities[:10], 1):
        tag = f"[{m.era[:4]}]"
        name = m.entity_name[: width - 30]
        lines.append(f"  {i:2d}. {tag} H={m.hamming_distance:2d} c={m.cluster:>3} {name}")
    if report.notes:
        lines.append("")
        lines.append("Notes:")
        for n in report.notes:
            lines.append(f"  - {n}")
    lines.append("=" * width)
    return "\n".join(lines)
