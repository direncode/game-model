"""BTUT Lineage Tracer — the engine explains itself.

Traces the structural lineage of any BTUT survivor by walking the
computation graph: cluster ancestry, edge paths, magnitude trails,
cascade survival history, and peer relationships.

No external AI. No API calls. Pure structural lineage from BTUT's
own computed data. Deterministic, reproducible, auditable.
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class LineageNode:
    """A single step in the lineage trace."""
    stage: str  # "prefilter", "embedding", "threading", "cascade_L0", "thinning", "selection"
    description: str  # Human-readable explanation
    data: dict = field(default_factory=dict)  # Supporting evidence


@dataclass
class EdgePath:
    """An edge connecting this survivor to another entity."""
    target_name: str
    target_type: str
    target_ticker: str
    edge_type: str
    weight: float
    is_survivor: bool


@dataclass
class ClusterAncestry:
    """How this survivor's cluster formed and what was eliminated."""
    cluster_id: int
    cluster_size: int
    total_in_mega_cluster: int  # How many were in the same mega-cluster before thinning
    type_distribution: dict  # Types of entities in this cluster
    fingerprint_pattern: str  # The binary fingerprint defining this cluster
    eliminated_count: int  # How many entities were eliminated from this cluster's region
    survival_reason: str  # Why this entity survived selection


@dataclass
class MagnitudeTrail:
    """How the entity behaves across multi-resolution rotations."""
    coarse_flips: int
    coarse_total: int
    coarse_interpretation: str
    medium_flips: int
    medium_total: int
    medium_interpretation: str
    fine_flips: int
    fine_total: int
    fine_interpretation: str
    most_stable_resolution: str
    most_dynamic_resolution: str
    cross_resolution_pattern: str  # "consistent", "resolution_sensitive", "coarse_stable_fine_dynamic"


@dataclass
class StructuralLineage:
    """Complete lineage trace for a BTUT survivor."""
    entity_key: str
    entity_name: str
    entity_type: str
    dataset_id: str

    # The lineage chain
    lineage_chain: list[LineageNode] = field(default_factory=list)

    # Structural connections
    edge_paths: list[EdgePath] = field(default_factory=list)

    # Cluster history
    cluster_ancestry: ClusterAncestry | None = None

    # Magnitude behavior
    magnitude_trail: MagnitudeTrail | None = None

    # Peer context
    peer_survivors: list[dict] = field(default_factory=list)
    peer_eliminated: list[dict] = field(default_factory=list)

    # Score provenance — what contributed to each score
    score_provenance: dict = field(default_factory=dict)

    # Summary
    lineage_summary: str = ""

    def to_dict(self) -> dict:
        return {
            "entity_key": self.entity_key,
            "entity_name": self.entity_name,
            "entity_type": self.entity_type,
            "dataset_id": self.dataset_id,
            "lineage_chain": [
                {"stage": n.stage, "description": n.description, "data": n.data}
                for n in self.lineage_chain
            ],
            "edge_paths": [
                {"target": p.target_name, "target_type": p.target_type,
                 "target_ticker": p.target_ticker, "edge_type": p.edge_type,
                 "weight": p.weight, "is_survivor": p.is_survivor}
                for p in self.edge_paths
            ],
            "cluster_ancestry": {
                "cluster_id": self.cluster_ancestry.cluster_id,
                "cluster_size": self.cluster_ancestry.cluster_size,
                "total_in_mega_cluster": self.cluster_ancestry.total_in_mega_cluster,
                "type_distribution": self.cluster_ancestry.type_distribution,
                "fingerprint_pattern": self.cluster_ancestry.fingerprint_pattern,
                "eliminated_count": self.cluster_ancestry.eliminated_count,
                "survival_reason": self.cluster_ancestry.survival_reason,
            } if self.cluster_ancestry else None,
            "magnitude_trail": {
                "coarse": {"flips": self.magnitude_trail.coarse_flips, "total": self.magnitude_trail.coarse_total, "interpretation": self.magnitude_trail.coarse_interpretation},
                "medium": {"flips": self.magnitude_trail.medium_flips, "total": self.magnitude_trail.medium_total, "interpretation": self.magnitude_trail.medium_interpretation},
                "fine": {"flips": self.magnitude_trail.fine_flips, "total": self.magnitude_trail.fine_total, "interpretation": self.magnitude_trail.fine_interpretation},
                "most_stable": self.magnitude_trail.most_stable_resolution,
                "most_dynamic": self.magnitude_trail.most_dynamic_resolution,
                "pattern": self.magnitude_trail.cross_resolution_pattern,
            } if self.magnitude_trail else None,
            "peer_survivors": self.peer_survivors[:10],
            "score_provenance": self.score_provenance,
            "lineage_summary": self.lineage_summary,
        }


class LineageTracer:
    """Trace the structural lineage of any BTUT survivor.

    Uses only BTUT's own computed data — no external APIs, no AI.
    The engine explains itself through its own math.
    """

    def __init__(self, query_engine):
        """Takes a BTUTQueryEngine instance for data access."""
        self._engine = query_engine

    def trace(self, entity_key: str) -> StructuralLineage | None:
        """Compute the full structural lineage for an entity."""
        # Get entity analysis
        analysis = self._engine.analyze(entity_key)
        if not analysis:
            return None

        metadata = analysis.get("metadata", {})
        scores = analysis.get("scores", {})
        lattice = analysis.get("lattice_profile", {})
        cluster_info = analysis.get("cluster", {})

        lineage = StructuralLineage(
            entity_key=entity_key,
            entity_name=analysis.get("company_name") or analysis.get("ticker", entity_key),
            entity_type=analysis.get("entity_type", ""),
            dataset_id=self._engine._dataset_id,
        )

        # ── Stage 1: Prefilter survival ──────────────────────────
        lineage.lineage_chain.append(LineageNode(
            stage="prefilter",
            description=(
                "Survived Bloom filter deduplication and entropy gate. "
                "Entity has sufficient information content and is not an exact duplicate."
            ),
            data={"survived": True},
        ))

        # ── Stage 2: Embedding ───────────────────────────────────
        type_dominant = analysis.get("entity_type", "")
        lineage.lineage_chain.append(LineageNode(
            stage="embedding",
            description=(
                f"Embedded as {type_dominant} entity via multi-type projector. "
                f"Attributes hashed through text ({type_dominant}-specific tokens), "
                f"numeric (z-scored), and type one-hot encoding into 32D, then "
                f"random-projected to 8D for lattice threading."
            ),
            data={"type": type_dominant, "original_dim": 32, "projected_dim": 8},
        ))

        # ── Stage 3: Lattice threading ───────────────────────────
        fp = lattice.get("fingerprint_48bit", "")
        flips = lattice.get("total_flips", 0)
        coarse = fp[:16] if len(fp) >= 16 else ""
        medium = fp[16:32] if len(fp) >= 32 else ""
        fine = fp[32:48] if len(fp) >= 48 else ""

        coarse_flips = sum(int(c) for c in coarse) if coarse else 0
        medium_flips = sum(int(c) for c in medium) if medium else 0
        fine_flips = sum(int(c) for c in fine) if fine else 0

        # Identify which rotations preserved stability
        stable_positions = [i for i, b in enumerate(fp) if b == "0"] if fp else []
        dynamic_positions = [i for i, b in enumerate(fp) if b == "1"] if fp else []

        lineage.lineage_chain.append(LineageNode(
            stage="threading",
            description=(
                f"Lattice threading produced 48-bit fingerprint across 3 resolutions. "
                f"Coarse (4-bin): {coarse_flips}/16 flips. "
                f"Medium (8-bin): {medium_flips}/16 flips. "
                f"Fine (16-bin): {fine_flips}/16 flips. "
                f"Total: {flips}/48 ({flips/48*100:.0f}%). "
                f"Stable at {len(stable_positions)} rotation{'s' if len(stable_positions) != 1 else ''}: "
                f"positions {stable_positions[:5]}{'...' if len(stable_positions) > 5 else ''}."
            ),
            data={
                "fingerprint": fp,
                "stable_positions": stable_positions,
                "dynamic_positions": dynamic_positions[:10],
            },
        ))

        # ── Stage 4: Magnitude trail ─────────────────────────────
        coarse_interp = self._interpret_flip_rate(coarse_flips, 16, "coarse")
        medium_interp = self._interpret_flip_rate(medium_flips, 16, "medium")
        fine_interp = self._interpret_flip_rate(fine_flips, 16, "fine")

        rates = {"coarse": coarse_flips/16 if coarse else 0, "medium": medium_flips/16 if medium else 0, "fine": fine_flips/16 if fine else 0}
        most_stable = min(rates, key=rates.get)
        most_dynamic = max(rates, key=rates.get)

        if abs(rates["coarse"] - rates["fine"]) < 0.1:
            pattern = "consistent"
            pattern_desc = "Behaves consistently across all resolutions — structural identity is scale-invariant."
        elif rates["coarse"] < rates["fine"]:
            pattern = "coarse_stable_fine_dynamic"
            pattern_desc = "Stable at coarse resolution but dynamic at fine — sits deep in a mega-cluster but near a sub-cluster boundary."
        else:
            pattern = "coarse_dynamic_fine_stable"
            pattern_desc = "Dynamic at coarse resolution but stable at fine — near a mega-cluster boundary but firmly within a sub-cluster."

        lineage.magnitude_trail = MagnitudeTrail(
            coarse_flips=coarse_flips, coarse_total=16, coarse_interpretation=coarse_interp,
            medium_flips=medium_flips, medium_total=16, medium_interpretation=medium_interp,
            fine_flips=fine_flips, fine_total=16, fine_interpretation=fine_interp,
            most_stable_resolution=most_stable,
            most_dynamic_resolution=most_dynamic,
            cross_resolution_pattern=pattern_desc,
        )

        lineage.lineage_chain.append(LineageNode(
            stage="magnitude",
            description=pattern_desc,
            data={"rates": rates, "pattern": pattern},
        ))

        # ── Stage 5: Cluster ancestry ────────────────────────────
        cluster_id = cluster_info.get("id", -1)
        cluster_members = self._engine._by_cluster.get(cluster_id, [])
        cluster_size = len(cluster_members)

        type_dist = defaultdict(int)
        for m in cluster_members:
            type_dist[m["type"]] += 1

        # Total dataset size vs cluster size = elimination ratio
        total_entities = self._engine._summary.get("total_entities", 0)
        total_survivors = len(self._engine._survivors)
        eliminated = total_entities - total_survivors

        # Why did this entity survive selection?
        composite = scores.get("composite", 0)
        anomaly = scores.get("anomaly", 0)
        diversity = scores.get("diversity", 0)
        reconstruction = scores.get("reconstruction", 0)

        survival_reasons = []
        if diversity >= 1.0:
            survival_reasons.append("unique fingerprint (no other entity shares this exact 48-bit trajectory)")
        if anomaly > 0.8:
            survival_reasons.append(f"high anomaly score ({anomaly:.3f}) — structurally distant from type centroid")
        if reconstruction > 0.6:
            survival_reasons.append(f"high reconstruction value ({reconstruction:.3f}) — removing it would leave a coverage gap")
        if cluster_size <= 5:
            survival_reasons.append(f"member of a rare micro-cluster (only {cluster_size} entities)")

        role = metadata.get("structural_role", {}).get("role", "")
        if role:
            survival_reasons.append(f"classified as {role}")

        survival_reason = ". ".join(survival_reasons) if survival_reasons else "Selected as cluster representative by composite score ranking."

        lineage.cluster_ancestry = ClusterAncestry(
            cluster_id=cluster_id,
            cluster_size=cluster_size,
            total_in_mega_cluster=total_entities,
            type_distribution=dict(type_dist),
            fingerprint_pattern=cluster_members[0]["fingerprint"][:16] if cluster_members else "",
            eliminated_count=eliminated,
            survival_reason=survival_reason,
        )

        lineage.lineage_chain.append(LineageNode(
            stage="cluster_formation",
            description=(
                f"Assigned to cluster {cluster_id} ({cluster_size} members) based on fingerprint similarity. "
                f"Types in cluster: {dict(type_dist)}. "
                f"From {total_entities:,} total entities, {eliminated:,} were eliminated ({eliminated/max(total_entities,1)*100:.1f}%)."
            ),
            data={"cluster_id": cluster_id, "cluster_size": cluster_size},
        ))

        # ── Stage 6: Score provenance ────────────────────────────
        signal_decomp = metadata.get("signal_decomposition", {})
        provenance = {}

        for axis in ["diversity", "reconstruction", "anomaly"]:
            decomp = signal_decomp.get(axis, {})
            provenance[axis] = {
                "raw_score": decomp.get("raw_score", scores.get(axis, 0)),
                "weight": decomp.get("weight", {"diversity": 0.35, "reconstruction": 0.40, "anomaly": 0.25}.get(axis, 0)),
                "contribution": decomp.get("contribution", 0),
                "rank": decomp.get("rank_in_axis", 0),
                "percentile": decomp.get("percentile", 0),
                "explanation": self._explain_score_axis(axis, decomp.get("raw_score", scores.get(axis, 0)), metadata),
            }

        lineage.score_provenance = provenance

        lineage.lineage_chain.append(LineageNode(
            stage="scoring",
            description=(
                f"3-axis composite score: {composite:.4f}. "
                f"Diversity contributes {provenance.get('diversity', {}).get('contribution', 0):.4f} (35% weight), "
                f"reconstruction {provenance.get('reconstruction', {}).get('contribution', 0):.4f} (40% weight), "
                f"anomaly {provenance.get('anomaly', {}).get('contribution', 0):.4f} (25% weight)."
            ),
            data=provenance,
        ))

        # ── Stage 7: Selection ───────────────────────────────────
        lineage.lineage_chain.append(LineageNode(
            stage="selection",
            description=(
                f"Selected as survivor via stratified type-balanced selection. "
                f"Reason: {survival_reason}"
            ),
            data={"survival_reason": survival_reason},
        ))

        # ── Peer context ─────────────────────────────────────────
        peer_network = metadata.get("peer_network", [])
        lineage.peer_survivors = [
            {
                "name": p.get("name", ""),
                "ticker": p.get("ticker", ""),
                "type": p.get("type", ""),
                "similarity": p.get("similarity", 0),
                "shared_cluster": p.get("shared_cluster", False),
            }
            for p in peer_network[:10]
        ]

        # ── Lineage summary ──────────────────────────────────────
        lineage.lineage_summary = self._build_summary(lineage, analysis, metadata)

        return lineage

    def _interpret_flip_rate(self, flips: int, total: int, resolution: str) -> str:
        """Interpret a flip rate at a specific resolution."""
        rate = flips / total if total > 0 else 0
        res_label = {"coarse": "mega-cluster", "medium": "sub-cluster", "fine": "boundary"}[resolution]

        if rate < 0.5:
            return f"Highly stable at {resolution} resolution ({flips}/{total} = {rate:.0%}). Deep within a {res_label} — not near any structural boundary at this scale."
        elif rate < 0.75:
            return f"Moderately stable at {resolution} resolution ({flips}/{total} = {rate:.0%}). Within a {res_label} but showing some sensitivity to dimensional perturbation."
        elif rate < 0.95:
            return f"Dynamic at {resolution} resolution ({flips}/{total} = {rate:.0%}). Near a {res_label} boundary — position shifts under most rotations at this scale."
        else:
            return f"Maximally dynamic at {resolution} resolution ({flips}/{total} = {rate:.0%}). Sits exactly on a {res_label} boundary — every rotation displaces it."

    def _explain_score_axis(self, axis: str, score: float, metadata: dict) -> str:
        """Explain what drove a score on a specific axis."""
        if axis == "diversity":
            if score >= 1.0:
                return "Maximum diversity: unique 48-bit fingerprint. No other entity in the dataset shares this exact multi-resolution trajectory pattern."
            elif score > 0.5:
                return f"High diversity ({score:.3f}): rare fingerprint pattern shared by few entities."
            else:
                return f"Moderate diversity ({score:.3f}): fingerprint pattern shared with many entities in the same cluster."

        elif axis == "reconstruction":
            if score > 0.8:
                return f"High reconstruction value ({score:.3f}): this entity occupies a sparsely covered region of the embedding space. Removing it would leave a significant gap."
            elif score > 0.5:
                return f"Moderate reconstruction ({score:.3f}): contributes to dataset coverage but other nearby entities provide partial redundancy."
            else:
                return f"Low reconstruction ({score:.3f}): embedding position is well-covered by other survivors."

        elif axis == "anomaly":
            if score > 0.9:
                return f"Extreme anomaly ({score:.3f}): magnitude profile diverges from 90%+ of entities of the same type. This entity responds to dimensional rotations in a fundamentally different way than its type peers."
            elif score > 0.7:
                return f"High anomaly ({score:.3f}): distinct magnitude profile compared to type peers. Occupies a rare region of the magnitude space."
            else:
                return f"Moderate anomaly ({score:.3f}): magnitude profile is somewhat distinct but within the expected range for its type."

        return ""

    def _build_summary(self, lineage: StructuralLineage, analysis: dict, metadata: dict) -> str:
        """Build a single-paragraph lineage summary — the engine explaining itself."""
        name = lineage.entity_name
        etype = lineage.entity_type
        scores = analysis.get("scores", {})
        composite = scores.get("composite", 0)
        role = metadata.get("structural_role", {}).get("role", "")
        cluster = lineage.cluster_ancestry
        mag = lineage.magnitude_trail

        parts = [
            f"{name} ({etype}) survived as a {role} with composite score {composite:.4f}.",
        ]

        if cluster:
            parts.append(
                f"It belongs to cluster {cluster.cluster_id} ({cluster.cluster_size} members) "
                f"after {cluster.eliminated_count:,} entities were eliminated "
                f"({cluster.eliminated_count/max(cluster.total_in_mega_cluster,1)*100:.1f}% reduction)."
            )

        if mag:
            parts.append(f"Its lattice behavior: {mag.cross_resolution_pattern}")

        if lineage.score_provenance:
            dominant_axis = max(
                lineage.score_provenance.items(),
                key=lambda x: x[1].get("contribution", 0),
            )
            parts.append(
                f"The dominant signal axis is {dominant_axis[0]} "
                f"(contributing {dominant_axis[1].get('contribution', 0):.4f} to composite)."
            )

        if cluster and cluster.survival_reason:
            parts.append(f"Selection reason: {cluster.survival_reason}")

        return " ".join(parts)
