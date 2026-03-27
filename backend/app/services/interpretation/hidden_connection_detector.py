"""Hidden connection detection using learned embeddings.

Identifies non-obvious relationships between entities that have high
embedding similarity but no direct edge in the input data.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.neo4j import Neo4jConnection
from app.models.module import HiddenConnection, Module, ModuleEntity

logger = logging.getLogger(__name__)


@dataclass
class DetectedConnection:
    """A potential hidden connection between two entities."""

    source_entity: str
    target_entity: str
    source_module_index: int
    target_module_index: int
    similarity_score: float
    has_direct_edge: bool


class HiddenConnectionDetector:
    """Detect non-obvious relationships using learned entity embeddings."""

    def __init__(self, db: AsyncSession, neo4j: Neo4jConnection) -> None:
        self._db = db
        self._neo4j = neo4j

    async def detect(
        self,
        modules: list[Module],
        embeddings: dict[str, list[float]],
        dataset_id: str,
        similarity_threshold: float = 0.7,
        top_n_per_module: int = 10,
    ) -> list[DetectedConnection]:
        """Find hidden connections within each module.

        For each module, compute pairwise cosine similarity between entities
        using learned embeddings, then filter pairs with high similarity
        but no direct edge in the input data.

        Args:
            modules: List of Module instances to analyze.
            embeddings: Entity name -> embedding vector mapping.
            dataset_id: Dataset UUID string.
            similarity_threshold: Minimum similarity to consider (0-1).
            top_n_per_module: Maximum hidden connections per module.

        Returns:
            List of detected hidden connections sorted by similarity.
        """
        logger.info(
            "Detecting hidden connections: %d modules, %d embeddings, threshold=%.2f",
            len(modules),
            len(embeddings),
            similarity_threshold,
        )

        all_connections: list[DetectedConnection] = []

        for module in modules:
            module_connections = await self._detect_for_module(
                module,
                embeddings,
                dataset_id,
                similarity_threshold,
                top_n_per_module,
            )
            all_connections.extend(module_connections)

        # Also detect cross-module hidden connections
        cross_module = await self._detect_cross_module(
            modules, embeddings, dataset_id, similarity_threshold, top_n_per_module
        )
        all_connections.extend(cross_module)

        # Sort by similarity descending
        all_connections.sort(key=lambda c: c.similarity_score, reverse=True)

        logger.info(
            "Detected %d total hidden connections across %d modules",
            len(all_connections),
            len(modules),
        )
        return all_connections

    async def _detect_for_module(
        self,
        module: Module,
        embeddings: dict[str, list[float]],
        dataset_id: str,
        threshold: float,
        top_n: int,
    ) -> list[DetectedConnection]:
        """Detect hidden connections within a single module."""
        result = await self._db.execute(
            select(ModuleEntity).where(ModuleEntity.module_id == module.id)
        )
        entities = result.scalars().all()

        # Filter to entities with embeddings
        entity_embs: list[tuple[str, list[float]]] = []
        for e in entities:
            if e.entity_name in embeddings:
                entity_embs.append((e.entity_name, embeddings[e.entity_name]))

        if len(entity_embs) < 2:
            return []

        # Get existing edges for this module's entities
        entity_names = [name for name, _ in entity_embs]
        existing_edges = await self._get_existing_edges(dataset_id, entity_names)

        # Compute pairwise similarities
        candidates: list[DetectedConnection] = []
        for i in range(len(entity_embs)):
            for j in range(i + 1, len(entity_embs)):
                name_a, emb_a = entity_embs[i]
                name_b, emb_b = entity_embs[j]

                sim = self._cosine_similarity(emb_a, emb_b)
                if sim < threshold:
                    continue

                edge_key = tuple(sorted([name_a, name_b]))
                has_edge = edge_key in existing_edges

                # Only report as hidden if no direct edge
                if not has_edge:
                    candidates.append(
                        DetectedConnection(
                            source_entity=name_a,
                            target_entity=name_b,
                            source_module_index=module.module_index,
                            target_module_index=module.module_index,
                            similarity_score=round(sim, 4),
                            has_direct_edge=False,
                        )
                    )

        # Return top N by similarity
        candidates.sort(key=lambda c: c.similarity_score, reverse=True)
        return candidates[:top_n]

    async def _detect_cross_module(
        self,
        modules: list[Module],
        embeddings: dict[str, list[float]],
        dataset_id: str,
        threshold: float,
        top_n: int,
    ) -> list[DetectedConnection]:
        """Detect hidden connections between entities in different modules."""
        # Build module membership map
        module_entities: dict[int, list[tuple[str, list[float]]]] = {}

        for module in modules:
            result = await self._db.execute(
                select(ModuleEntity).where(ModuleEntity.module_id == module.id)
            )
            entities = result.scalars().all()

            ents = []
            for e in entities:
                if e.entity_name in embeddings:
                    ents.append((e.entity_name, embeddings[e.entity_name]))
            module_entities[module.module_index] = ents

        # Compare across module pairs
        candidates: list[DetectedConnection] = []
        module_indices = sorted(module_entities.keys())

        for i_idx, mod_a in enumerate(module_indices):
            for mod_b in module_indices[i_idx + 1:]:
                ents_a = module_entities[mod_a]
                ents_b = module_entities[mod_b]

                all_names = [n for n, _ in ents_a] + [n for n, _ in ents_b]
                existing_edges = await self._get_existing_edges(
                    dataset_id, all_names
                )

                for name_a, emb_a in ents_a:
                    for name_b, emb_b in ents_b:
                        sim = self._cosine_similarity(emb_a, emb_b)
                        if sim < threshold:
                            continue

                        edge_key = tuple(sorted([name_a, name_b]))
                        if edge_key not in existing_edges:
                            candidates.append(
                                DetectedConnection(
                                    source_entity=name_a,
                                    target_entity=name_b,
                                    source_module_index=mod_a,
                                    target_module_index=mod_b,
                                    similarity_score=round(sim, 4),
                                    has_direct_edge=False,
                                )
                            )

        candidates.sort(key=lambda c: c.similarity_score, reverse=True)
        return candidates[:top_n]

    async def _get_existing_edges(
        self, dataset_id: str, entity_names: list[str]
    ) -> set[tuple[str, str]]:
        """Query Neo4j for existing edges between named entities."""
        dataset_label = dataset_id.replace("-", "_")

        edges = await self._neo4j.execute_query(
            f"""
            MATCH (a:Entity:`{dataset_label}`)-[r:RELATES_TO]->(b:Entity:`{dataset_label}`)
            WHERE a.name IN $names AND b.name IN $names
            RETURN a.name AS source, b.name AS target
            """,
            {"names": entity_names},
        )

        return {
            tuple(sorted([e["source"], e["target"]])) for e in edges
        }

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if len(a) != len(b) or not a:
            return 0.0

        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return dot / (norm_a * norm_b)
