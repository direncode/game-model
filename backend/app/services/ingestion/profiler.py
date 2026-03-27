"""Dataset profiling and statistics generation.

Computes structural metrics, distributions, and a composite
data quality score for ingested entity-relationship graphs.
"""

from __future__ import annotations

import logging
import statistics
from collections import Counter
from dataclasses import dataclass, field

from app.services.ingestion.csv_adapter import ParsedGraph

logger = logging.getLogger(__name__)


@dataclass
class DegreeDistribution:
    """Summary statistics for node degree distribution."""

    min: int = 0
    max: int = 0
    mean: float = 0.0
    median: float = 0.0
    std_dev: float = 0.0


@dataclass
class DatasetProfile:
    """Complete statistical profile of a dataset."""

    entity_count: int = 0
    edge_count: int = 0
    density: float = 0.0
    entity_type_distribution: dict[str, int] = field(default_factory=dict)
    relationship_type_distribution: dict[str, int] = field(default_factory=dict)
    connected_component_count: int = 0
    degree_distribution: DegreeDistribution = field(
        default_factory=DegreeDistribution
    )
    data_quality_score: float = 0.0
    isolated_node_count: int = 0
    self_loop_count: int = 0
    avg_clustering_coefficient: float = 0.0

    def to_dict(self) -> dict:
        return {
            "entity_count": self.entity_count,
            "edge_count": self.edge_count,
            "density": round(self.density, 6),
            "entity_type_distribution": self.entity_type_distribution,
            "relationship_type_distribution": self.relationship_type_distribution,
            "connected_component_count": self.connected_component_count,
            "degree_distribution": {
                "min": self.degree_distribution.min,
                "max": self.degree_distribution.max,
                "mean": round(self.degree_distribution.mean, 2),
                "median": round(self.degree_distribution.median, 2),
                "std_dev": round(self.degree_distribution.std_dev, 2),
            },
            "data_quality_score": round(self.data_quality_score, 4),
            "isolated_node_count": self.isolated_node_count,
            "self_loop_count": self.self_loop_count,
        }


class Profiler:
    """Generate statistical profiles for entity-relationship graphs."""

    async def profile(self, graph: ParsedGraph) -> DatasetProfile:
        """Compute a full statistical profile of the graph.

        Args:
            graph: Normalized, validated parsed graph.

        Returns:
            DatasetProfile with all computed metrics.
        """
        n_entities = len(graph.entities)
        n_edges = len(graph.relationships)

        logger.info("Profiling graph: %d entities, %d edges", n_entities, n_edges)

        # Build adjacency for analysis
        adjacency: dict[str, set[str]] = {e.name: set() for e in graph.entities}
        self_loops = 0

        for rel in graph.relationships:
            if rel.source == rel.target:
                self_loops += 1
                continue
            adjacency.setdefault(rel.source, set()).add(rel.target)
            adjacency.setdefault(rel.target, set()).add(rel.source)

        # Density: actual edges / possible edges
        max_edges = n_entities * (n_entities - 1) / 2 if n_entities > 1 else 1
        density = n_edges / max_edges if max_edges > 0 else 0.0

        # Entity type distribution
        entity_types: Counter[str] = Counter()
        for entity in graph.entities:
            type_label = entity.entity_type or "unknown"
            entity_types[type_label] += 1

        # Relationship type distribution
        rel_types: Counter[str] = Counter()
        for rel in graph.relationships:
            type_label = rel.relationship_type or "unknown"
            rel_types[type_label] += 1

        # Degree distribution
        degrees = [len(neighbors) for neighbors in adjacency.values()]
        degree_dist = self._compute_degree_distribution(degrees)

        # Isolated nodes
        isolated = sum(1 for d in degrees if d == 0)

        # Connected components (BFS)
        component_count = self._count_connected_components(adjacency)

        # Data quality score
        quality = self._compute_quality_score(
            graph, n_entities, n_edges, isolated, self_loops, entity_types
        )

        profile = DatasetProfile(
            entity_count=n_entities,
            edge_count=n_edges,
            density=density,
            entity_type_distribution=dict(entity_types.most_common()),
            relationship_type_distribution=dict(rel_types.most_common()),
            connected_component_count=component_count,
            degree_distribution=degree_dist,
            data_quality_score=quality,
            isolated_node_count=isolated,
            self_loop_count=self_loops,
        )

        logger.info(
            "Profile complete: density=%.4f, components=%d, quality=%.2f",
            density,
            component_count,
            quality,
        )
        return profile

    @staticmethod
    def _compute_degree_distribution(
        degrees: list[int],
    ) -> DegreeDistribution:
        """Compute summary statistics for degree values."""
        if not degrees:
            return DegreeDistribution()

        return DegreeDistribution(
            min=min(degrees),
            max=max(degrees),
            mean=statistics.mean(degrees),
            median=statistics.median(degrees),
            std_dev=statistics.stdev(degrees) if len(degrees) > 1 else 0.0,
        )

    @staticmethod
    def _count_connected_components(
        adjacency: dict[str, set[str]],
    ) -> int:
        """Count connected components using BFS."""
        visited: set[str] = set()
        components = 0

        for node in adjacency:
            if node in visited:
                continue
            components += 1
            queue = [node]
            while queue:
                current = queue.pop(0)
                if current in visited:
                    continue
                visited.add(current)
                for neighbor in adjacency.get(current, set()):
                    if neighbor not in visited:
                        queue.append(neighbor)

        return components

    @staticmethod
    def _compute_quality_score(
        graph: ParsedGraph,
        n_entities: int,
        n_edges: int,
        isolated: int,
        self_loops: int,
        entity_types: Counter,
    ) -> float:
        """Compute a composite data quality score in [0, 1].

        Factors:
        - Completeness (30%): ratio of entities with types and attributes.
        - Consistency (25%): ratio of non-self-loop, non-isolated edges.
        - Connectivity (25%): ratio of connected (non-isolated) nodes.
        - Uniqueness (20%): diversity of entity types.
        """
        if n_entities == 0:
            return 0.0

        # Completeness: entities with type + at least one attribute
        typed = sum(1 for e in graph.entities if e.entity_type)
        has_attrs = sum(1 for e in graph.entities if e.attributes)
        completeness = (typed / n_entities * 0.6 + has_attrs / n_entities * 0.4)

        # Consistency: penalize self-loops and dangling references
        clean_edges = max(n_edges - self_loops, 0)
        consistency = clean_edges / max(n_edges, 1)

        # Connectivity: ratio of non-isolated nodes
        connectivity = (n_entities - isolated) / max(n_entities, 1)

        # Uniqueness: type diversity (Shannon-like, normalized)
        n_types = len(entity_types)
        if n_types <= 1:
            uniqueness = 0.5
        else:
            # Normalized against a reasonable max of 20 types
            uniqueness = min(n_types / 20, 1.0)

        score = (
            completeness * 0.30
            + consistency * 0.25
            + connectivity * 0.25
            + uniqueness * 0.20
        )
        return min(max(score, 0.0), 1.0)
