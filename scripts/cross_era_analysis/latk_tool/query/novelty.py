"""Novelty query for LATK (Phase 1 version).

Given a BTUT result (the lattice of survivors with 48-bit fingerprints,
8D embeddings, and cluster assignments), project an arbitrary text query
into the lattice's geometric space and return:

    - novelty_score: scalar in [0, 1] based on distance to nearest lattice entry
    - nearest_entities: ranked list of BTUT survivors closest to the query
    - matched_clusters: lattice clusters the nearest matches belong to
    - era_distribution: counts of historical vs modern entities in the matches

Phase 0 vs Phase 1
------------------
Phase 0 used a standalone blake2b 48-bit hash as a stand-in fingerprint and
ranked survivors by Hamming distance in that space. This worked well enough
to demonstrate the Saussure->Vaswani end-to-end query as a proof of concept,
but query fingerprints lived in a different subspace than lattice
fingerprints, so distances were noisier than they should have been.

Phase 1 replaces this with **Euclidean distance in the 8D embedding space**
the lattice actually clusters in, via ``latk_tool.fingerprint_core``. Query
text is embedded through the same deterministic projection chain the BTUT
pipeline uses, parametrized by the persisted ``EmbedContext`` state that
``run_btut_pipeline`` now writes alongside each result.

Legacy Phase 0 lattices (without ``embed_context``) automatically fall back
to the Hamming path so existing results stay usable.

Usage
-----
    from latk_tool.query.novelty import load_lattice, query_novelty
    lattice = load_lattice(
        "scripts/cross_era_analysis/output/latk_mini_btut_result.json"
    )
    report = query_novelty(
        "Meaning is determined by a word's opposition to all others.",
        lattice,
    )
    print(report.novelty_score, report.ranking_method)
    for match in report.nearest_entities[:5]:
        print(match.entity_name, match.distance, match.cluster)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

from latk_tool.fingerprint_core import (
    EMBED_8D,
    FINGERPRINT_BITS,
    EmbedContext,
    LatticeSurvivor,
    LatticeV2,
    embed_query_to_8d,
    fingerprint_text_legacy,
    load_lattice_v2,
    rank_lattice_by_8d,
    rank_lattice_by_hamming,
)


# Backwards-compat re-exports for any code that still imports from here
LatticeIndex = LatticeV2  # alias
LatticeEntry = LatticeSurvivor  # alias


@dataclass
class NoveltyMatch:
    entity_name: str
    entity_type: str
    cluster: str
    distance: float
    composite: float
    era: str
    # Legacy compat field: int Hamming distance for legacy lattices, else int-cast 8D distance
    hamming_distance: int = 0


@dataclass
class NoveltyReport:
    query_text: str
    novelty_score: float
    ranking_method: str  # "8d_euclidean" or "48bit_hamming"
    nearest_entities: List[NoveltyMatch]
    matched_clusters: List[str]
    era_distribution: Dict[str, int]
    notes: List[str] = field(default_factory=list)
    query_fingerprint: str = ""  # legacy field


def load_lattice(btut_result_path: str | Path) -> LatticeV2:
    """Load a BTUT result as a LatticeV2, handling both legacy and v2 formats."""
    return load_lattice_v2(btut_result_path)


def fingerprint_text(text: str) -> str:
    """Phase 0 legacy entry point — kept so existing imports keep working."""
    return fingerprint_text_legacy(text)


def query_novelty(
    query_text: str,
    lattice: LatticeV2,
    top_k: int = 20,
    method: str = "combined",
    entity_types: Optional[List[str]] = None,
) -> NoveltyReport:
    """Project query text into lattice space and rank nearest survivors.

    ``method`` controls which ranking signal is used:

    - ``"combined"`` (default, v2 only): merge 8D Euclidean and 48-bit Hamming
      rankings via reciprocal rank fusion. This preserves both geometric
      neighborhood (8D) and token-level overlap (Hamming) — the honest fix
      for the regression where the pure 8D signal loses Phase 0's
      Saussure->Vaswani-style token hits.
    - ``"8d"``: pure 8D Euclidean nearest neighbor (v2 only)
    - ``"hamming"``: pure 48-bit Hamming distance (Phase 0 legacy path)

    For legacy lattices without ``embed_context``, only ``"hamming"`` is
    available and ``"combined"``/``"8d"`` fall back silently.
    """
    if not (lattice.has_v2 and lattice.embed_context is not None):
        return _query_novelty_hamming(query_text, lattice, top_k, entity_types)

    if method == "8d":
        return _query_novelty_8d(query_text, lattice, top_k, entity_types)
    if method == "hamming":
        return _query_novelty_hamming(query_text, lattice, top_k, entity_types)
    # Default: combined
    return _query_novelty_combined(query_text, lattice, top_k, entity_types)


def _filter_matches_by_type(
    matches: List[NoveltyMatch],
    entity_types: Optional[List[str]],
    top_k: int,
) -> List[NoveltyMatch]:
    if not entity_types:
        return matches[:top_k]
    keep = set(entity_types)
    filtered = [m for m in matches if m.entity_type in keep]
    return filtered[:top_k]


def _query_novelty_combined(
    query_text: str,
    lattice: LatticeV2,
    top_k: int,
    entity_types: Optional[List[str]] = None,
) -> NoveltyReport:
    """Merge 8D Euclidean + 48-bit Hamming rankings via reciprocal rank fusion.

    RRF score for each survivor: sum(1 / (k + rank_i)) over both rankings,
    with k=60 (standard RRF constant). This is the honest combined signal
    that preserves both the geometric neighborhood that 8D gives us and the
    token-level lookup behavior that made Phase 0's Saussure->Vaswani work.
    """
    assert lattice.embed_context is not None
    assert lattice.embeddings_8d is not None

    # Compute both rankings over the ENTIRE lattice (not truncated).
    query_8d = embed_query_to_8d(query_text, lattice.embed_context)
    all_8d = rank_lattice_by_8d(query_8d, lattice, top_k=lattice.size)
    all_hamming = rank_lattice_by_hamming(query_text, lattice, top_k=lattice.size)

    # Length-adaptive RRF weights. Short queries (entity names, 1-8 tokens)
    # are dominated by noise in the blake2b 48-bit hash so we trust 8D more.
    # Long queries (quotes, abstracts, 20+ tokens) have enough token density
    # for Hamming to contribute meaningfully and recover the Phase 0
    # Saussure->Vaswani-style token-level hits.
    import re as _re
    tokens = [t for t in _re.findall(r"[A-Za-z][A-Za-z0-9_\-]+", query_text.lower()) if len(t) > 2]
    n_tokens = len(tokens)
    w_8d = 1.0
    w_hamming = max(0.0, min(1.0, (n_tokens - 3) / 17.0))  # 0 at <=3 tokens, 1 at >=20

    rrf_k = 60.0
    rrf_scores: Dict[int, float] = {}
    rank_8d: Dict[int, int] = {}
    rank_hamming: Dict[int, int] = {}
    dist_8d: Dict[int, float] = {}
    dist_hamming: Dict[int, int] = {}

    for rank, (idx, dist) in enumerate(all_8d):
        rrf_scores[idx] = rrf_scores.get(idx, 0.0) + w_8d / (rrf_k + rank)
        rank_8d[idx] = rank
        dist_8d[idx] = float(dist)

    if w_hamming > 0:
        for rank, (idx, dist) in enumerate(all_hamming):
            rrf_scores[idx] = rrf_scores.get(idx, 0.0) + w_hamming / (rrf_k + rank)
            rank_hamming[idx] = rank
            dist_hamming[idx] = int(dist)
    else:
        for idx, dist in all_hamming:
            dist_hamming[idx] = int(dist)

    # Highest RRF score first; overshoot if type filter
    overshoot = top_k * 10 if entity_types else top_k
    ranked = sorted(rrf_scores.items(), key=lambda kv: -kv[1])[:overshoot]

    matches: List[NoveltyMatch] = []
    for idx, _score in ranked:
        srv = lattice.survivors[idx]
        # Display distance = 8D distance (the primary geometric interpretation)
        matches.append(
            NoveltyMatch(
                entity_name=srv.entity_name,
                entity_type=srv.entity_type,
                cluster=srv.cluster,
                distance=round(dist_8d.get(idx, 0.0), 4),
                composite=srv.composite,
                era=srv.era,
                hamming_distance=dist_hamming.get(idx, FINGERPRINT_BITS),
            )
        )

    matches = _filter_matches_by_type(matches, entity_types, top_k)

    # Novelty: min 8D distance normalized against p95 lattice radius
    lattice_center = lattice.embeddings_8d.mean(axis=0)
    radii = np.linalg.norm(lattice.embeddings_8d - lattice_center, axis=1)
    p95_radius = float(np.percentile(radii, 95)) if radii.size > 0 else 1.0
    min_8d = matches[0].distance if matches else p95_radius
    novelty = 0.0 if p95_radius <= 1e-8 else min(1.0, min_8d / (2 * p95_radius))

    matched_clusters: List[str] = []
    for m in matches:
        if m.cluster not in matched_clusters:
            matched_clusters.append(m.cluster)

    era_distribution: Dict[str, int] = {"historical": 0, "modern": 0, "unknown": 0}
    for m in matches:
        era_distribution[m.era] = era_distribution.get(m.era, 0) + 1

    notes = _build_notes(novelty, era_distribution, top_k)
    notes.append(
        f"Ranking: combined (length-adaptive RRF, n_tokens={n_tokens}, "
        f"w_8d={w_8d:.2f}, w_hamming={w_hamming:.2f}). "
        "Preserves both geometric neighborhood and token-level signal."
    )

    return NoveltyReport(
        query_text=query_text[:200],
        novelty_score=round(float(novelty), 4),
        ranking_method="combined",
        nearest_entities=matches,
        matched_clusters=matched_clusters,
        era_distribution=era_distribution,
        notes=notes,
        query_fingerprint="",
    )


def _query_novelty_8d(
    query_text: str,
    lattice: LatticeV2,
    top_k: int,
    entity_types: Optional[List[str]] = None,
) -> NoveltyReport:
    """Phase 1 path: 8D Euclidean nearest neighbor."""
    assert lattice.embed_context is not None
    query_8d = embed_query_to_8d(query_text, lattice.embed_context)
    # Overshoot top_k so the type filter has candidates
    overshoot = top_k * 10 if entity_types else top_k
    ranked = rank_lattice_by_8d(query_8d, lattice, top_k=overshoot)

    matches: List[NoveltyMatch] = []
    for idx, dist in ranked:
        srv = lattice.survivors[idx]
        matches.append(
            NoveltyMatch(
                entity_name=srv.entity_name,
                entity_type=srv.entity_type,
                cluster=srv.cluster,
                distance=round(float(dist), 4),
                composite=srv.composite,
                era=srv.era,
                hamming_distance=int(round(float(dist) * 100)),  # scaled surrogate for display
            )
        )

    matches = _filter_matches_by_type(matches, entity_types, top_k)

    # Novelty normalization in 8D: map to [0, 1] using the lattice's own radius.
    assert lattice.embeddings_8d is not None
    lattice_center = lattice.embeddings_8d.mean(axis=0)
    radii = np.linalg.norm(lattice.embeddings_8d - lattice_center, axis=1)
    p95_radius = float(np.percentile(radii, 95)) if radii.size > 0 else 1.0
    min_dist = matches[0].distance if matches else p95_radius
    novelty = 0.0 if p95_radius <= 1e-8 else min(1.0, min_dist / (2 * p95_radius))

    matched_clusters: List[str] = []
    for m in matches:
        if m.cluster not in matched_clusters:
            matched_clusters.append(m.cluster)

    era_distribution: Dict[str, int] = {"historical": 0, "modern": 0, "unknown": 0}
    for m in matches:
        era_distribution[m.era] = era_distribution.get(m.era, 0) + 1

    notes = _build_notes(novelty, era_distribution, top_k)
    notes.append(f"Ranking: 8D Euclidean (lattice has embed_context, v2 path)")

    return NoveltyReport(
        query_text=query_text[:200],
        novelty_score=round(float(novelty), 4),
        ranking_method="8d_euclidean",
        nearest_entities=matches,
        matched_clusters=matched_clusters,
        era_distribution=era_distribution,
        notes=notes,
        query_fingerprint="",
    )


def _query_novelty_hamming(
    query_text: str,
    lattice: LatticeV2,
    top_k: int,
    entity_types: Optional[List[str]] = None,
) -> NoveltyReport:
    """Phase 0 legacy path: Hamming distance in the 48-bit fingerprint space."""
    overshoot = top_k * 10 if entity_types else top_k
    ranked = rank_lattice_by_hamming(query_text, lattice, top_k=overshoot)
    query_fp = fingerprint_text_legacy(query_text)

    matches: List[NoveltyMatch] = []
    for idx, dist in ranked:
        srv = lattice.survivors[idx]
        matches.append(
            NoveltyMatch(
                entity_name=srv.entity_name,
                entity_type=srv.entity_type,
                cluster=srv.cluster,
                distance=float(dist),
                composite=srv.composite,
                era=srv.era,
                hamming_distance=int(dist),
            )
        )

    matches = _filter_matches_by_type(matches, entity_types, top_k)

    min_dist = matches[0].hamming_distance if matches else FINGERPRINT_BITS
    novelty = min_dist / FINGERPRINT_BITS

    matched_clusters: List[str] = []
    for m in matches:
        if m.cluster not in matched_clusters:
            matched_clusters.append(m.cluster)

    era_distribution: Dict[str, int] = {"historical": 0, "modern": 0, "unknown": 0}
    for m in matches:
        era_distribution[m.era] = era_distribution.get(m.era, 0) + 1

    notes = _build_notes(novelty, era_distribution, top_k)
    notes.append("Ranking: legacy 48-bit Hamming (lattice has no embed_context)")

    return NoveltyReport(
        query_text=query_text[:200],
        novelty_score=round(novelty, 4),
        ranking_method="48bit_hamming",
        nearest_entities=matches,
        matched_clusters=matched_clusters,
        era_distribution=era_distribution,
        notes=notes,
        query_fingerprint=query_fp,
    )


def _build_notes(novelty: float, era_distribution: Dict[str, int], top_k: int) -> List[str]:
    notes: List[str] = []
    if novelty < 0.1:
        notes.append("Very low novelty: query lands nearly on top of an existing lattice entry.")
    elif novelty < 0.3:
        notes.append("Low novelty: query lands inside an existing dense cluster.")
    elif novelty > 0.6:
        notes.append("High novelty: query is far from any existing lattice entry.")
    if era_distribution.get("historical", 0) >= 3:
        notes.append(
            f"Strong historical lineage: {era_distribution['historical']} "
            f"historical ancestors in top {top_k}."
        )
    if era_distribution.get("modern", 0) >= 3 and era_distribution.get("historical", 0) == 0:
        notes.append(
            "No historical ancestors found in top matches — "
            "either genuinely novel or corpus gap."
        )
    return notes


def format_report(report: NoveltyReport, width: int = 80) -> str:
    """Pretty-print a NoveltyReport for CLI display."""
    lines = []
    lines.append("=" * width)
    lines.append("LATK Novelty Query Report")
    lines.append("=" * width)
    lines.append(f"Query   : {report.query_text[:width-12]}")
    lines.append(f"Ranking : {report.ranking_method}")
    lines.append(f"Novelty : {report.novelty_score:.4f} (0 = matches existing, 1 = max novel)")
    lines.append(f"Era dist: {report.era_distribution}")
    lines.append(f"Clusters: {', '.join(report.matched_clusters[:10])}")
    lines.append("")
    lines.append("Top nearest lattice entries:")
    lines.append("-" * width)
    for i, m in enumerate(report.nearest_entities[:10], 1):
        tag = f"[{m.era[:4]}]"
        name = m.entity_name[: width - 30]
        lines.append(f"  {i:2d}. {tag} d={m.distance:7.4f} c={m.cluster:>3} {name}")
    if report.notes:
        lines.append("")
        lines.append("Notes:")
        for n in report.notes:
            lines.append(f"  - {n}")
    lines.append("=" * width)
    return "\n".join(lines)
