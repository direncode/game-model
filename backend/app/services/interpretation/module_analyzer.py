"""Per-module statistical analysis for crystallized modules.

Computes entity composition, internal connectivity, centrality scores,
anchor entities, and external connection metrics.
"""

from __future__ import annotations

import logging
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.neo4j import Neo4jConnection
from app.models.module import Module, ModuleEntity

logger = logging.getLogger(__name__)


@dataclass
class EntityCentrality:
    """Centrality metrics for a single entity."""

    name: str
    entity_type: str
    degree_centrality: float
    internal_connections: int
    external_connections: int


@dataclass
class ModuleAnalysis:
    """Complete statistical analysis of a single module."""

    module_id: str
    module_index: int
    entity_count: int
    entity_composition: dict[str, int]  # type -> count
    internal_edge_count: int
    internal_density: float
    centrality_scores: list[EntityCentrality]
    anchor_entities: list[EntityCentrality]  # top 5 by centrality
    external_connection_count: int
    external_connected_modules: list[dict]  # [{module_id, shared_count}]


class ModuleAnalyzer:
    """Analyze crystallized modules for statistical properties."""

    def __init__(self, db: AsyncSession, neo4j: Neo4jConnection) -> None:
        self._db = db
        self._neo4j = neo4j

    async def analyze_module(
        self, module: Module, dataset_id: str
    ) -> ModuleAnalysis:
        """Perform full statistical analysis on a single module.

        Args:
            module: Module ORM instance with loaded entities relationship.
            dataset_id: UUID string of the parent dataset.

        Returns:
            ModuleAnalysis with all computed metrics.
        """
        logger.info(
            "Analyzing module %d (id=%s) with %d entities",
            module.module_index,
            module.id,
            module.entity_count or 0,
        )

        # Load entities for this module
        result = await self._db.execute(
            select(ModuleEntity).where(ModuleEntity.module_id == module.id)
        )
        entities = result.scalars().all()
        entity_names = {e.entity_name for e in entities}

        # Entity composition
        composition: Counter[str] = Counter()
        for e in entities:
            composition[e.entity_type or "unknown"] += 1

        # Query Neo4j for internal and external edges
        dataset_label = dataset_id.replace("-", "_")
        internal_edges, external_edges = await self._query_edges(
            dataset_label, entity_names
        )

        # Compute internal density
        n = len(entity_names)
        max_edges = n * (n - 1) / 2 if n > 1 else 1
        internal_density = len(internal_edges) / max_edges if max_edges > 0 else 0.0

        # Compute centrality scores
        centrality_scores = self._compute_centrality(
            entities, entity_names, internal_edges, external_edges
        )

        # Top 5 anchor entities
        anchor_entities = sorted(
            centrality_scores,
            key=lambda c: c.degree_centrality,
            reverse=True,
        )[:5]

        # External module connections
        external_modules = self._count_external_modules(
            external_edges, entity_names
        )

        analysis = ModuleAnalysis(
            module_id=str(module.id),
            module_index=module.module_index,
            entity_count=len(entity_names),
            entity_composition=dict(composition.most_common()),
            internal_edge_count=len(internal_edges),
            internal_density=round(internal_density, 6),
            centrality_scores=centrality_scores,
            anchor_entities=anchor_entities,
            external_connection_count=len(external_edges),
            external_connected_modules=external_modules,
        )

        logger.info(
            "Module %d analysis: density=%.4f, anchors=%s, external=%d",
            module.module_index,
            internal_density,
            [a.name for a in anchor_entities],
            len(external_edges),
        )
        return analysis

    async def _query_edges(
        self, dataset_label: str, entity_names: set[str]
    ) -> tuple[list[dict], list[dict]]:
        """Query internal and external edges for a set of entities.

        Returns:
            Tuple of (internal_edges, external_edges).
        """
        name_list = list(entity_names)

        # Internal edges: both endpoints in entity_names
        internal = await self._neo4j.execute_query(
            f"""
            MATCH (a:Entity:`{dataset_label}`)-[r:RELATES_TO]->(b:Entity:`{dataset_label}`)
            WHERE a.name IN $names AND b.name IN $names
            RETURN a.name AS source, b.name AS target, r.type AS type
            """,
            {"names": name_list},
        )

        # External edges: one endpoint in entity_names, one outside
        external = await self._neo4j.execute_query(
            f"""
            MATCH (a:Entity:`{dataset_label}`)-[r:RELATES_TO]->(b:Entity:`{dataset_label}`)
            WHERE (a.name IN $names AND NOT b.name IN $names)
               OR (NOT a.name IN $names AND b.name IN $names)
            RETURN a.name AS source, b.name AS target, r.type AS type
            """,
            {"names": name_list},
        )

        return internal, external

    @staticmethod
    def _compute_centrality(
        entities: list[ModuleEntity],
        entity_names: set[str],
        internal_edges: list[dict],
        external_edges: list[dict],
    ) -> list[EntityCentrality]:
        """Compute degree centrality for each entity in the module."""
        internal_degree: Counter[str] = Counter()
        for edge in internal_edges:
            internal_degree[edge["source"]] += 1
            internal_degree[edge["target"]] += 1

        external_degree: Counter[str] = Counter()
        for edge in external_edges:
            if edge["source"] in entity_names:
                external_degree[edge["source"]] += 1
            if edge["target"] in entity_names:
                external_degree[edge["target"]] += 1

        n = len(entity_names)
        max_degree = n - 1 if n > 1 else 1

        scores = []
        for entity in entities:
            name = entity.entity_name
            int_deg = internal_degree.get(name, 0)
            ext_deg = external_degree.get(name, 0)
            centrality = int_deg / max_degree if max_degree > 0 else 0.0

            scores.append(
                EntityCentrality(
                    name=name,
                    entity_type=entity.entity_type or "unknown",
                    degree_centrality=round(centrality, 4),
                    internal_connections=int_deg,
                    external_connections=ext_deg,
                )
            )

        return scores

    @staticmethod
    def _count_external_modules(
        external_edges: list[dict], entity_names: set[str]
    ) -> list[dict]:
        """Count connections to other entities outside this module."""
        external_entities: Counter[str] = Counter()
        for edge in external_edges:
            if edge["source"] not in entity_names:
                external_entities[edge["source"]] += 1
            if edge["target"] not in entity_names:
                external_entities[edge["target"]] += 1

        # Return top connected external entities as a proxy for modules
        return [
            {"entity": name, "connection_count": count}
            for name, count in external_entities.most_common(20)
        ]
