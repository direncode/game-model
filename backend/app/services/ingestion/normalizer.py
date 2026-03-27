"""Entity and relationship normalization for parsed graphs.

Handles deduplication, type inference, and relationship normalization
to produce clean, consistent graph data for downstream processing.
"""

from __future__ import annotations

import logging
import re
from collections import Counter

from app.services.ingestion.csv_adapter import (
    ParsedEntity,
    ParsedGraph,
    ParsedRelationship,
)

logger = logging.getLogger(__name__)

# Common attribute patterns that suggest entity types
_TYPE_INFERENCE_PATTERNS: dict[str, list[str]] = {
    "person": ["email", "phone", "first_name", "last_name", "age", "dob", "birth"],
    "organization": ["industry", "revenue", "employees", "founded", "headquarters"],
    "location": ["latitude", "longitude", "lat", "lng", "address", "city", "country"],
    "document": ["title", "author", "pages", "published", "isbn"],
    "product": ["price", "sku", "brand", "category", "manufacturer"],
    "event": ["start_date", "end_date", "venue", "duration", "attendees"],
}

# Normalize relationship type aliases
_RELATIONSHIP_ALIASES: dict[str, str] = {
    "connected_to": "related_to",
    "links_to": "related_to",
    "associated_with": "related_to",
    "belongs_to": "member_of",
    "part_of": "member_of",
    "contained_in": "member_of",
    "works_at": "employed_by",
    "works_for": "employed_by",
    "located_in": "located_at",
    "based_in": "located_at",
    "created": "created_by",
    "authored": "created_by",
    "wrote": "created_by",
    "knows": "knows",
    "owns": "owns",
    "manages": "manages",
    "reports_to": "reports_to",
}


class Normalizer:
    """Normalize parsed graphs by deduplicating entities, inferring types,
    and standardizing relationship labels."""

    async def normalize(self, graph: ParsedGraph) -> ParsedGraph:
        """Run full normalization pipeline on a parsed graph.

        Steps:
        1. Deduplicate entities by case-insensitive name.
        2. Infer missing entity types from attributes.
        3. Normalize relationship types.
        4. Remap relationship endpoints to canonical entity names.

        Args:
            graph: Raw parsed graph from an adapter.

        Returns:
            Normalized ParsedGraph with clean, deduplicated data.
        """
        logger.info(
            "Normalizing graph: %d entities, %d relationships",
            len(graph.entities),
            len(graph.relationships),
        )

        # Step 1: Deduplicate entities
        entities, name_map = self._deduplicate_entities(graph.entities)

        # Step 2: Infer types
        entities = self._infer_types(entities)

        # Step 3 & 4: Normalize and remap relationships
        relationships = self._normalize_relationships(
            graph.relationships, name_map
        )

        logger.info(
            "Normalization complete: %d entities, %d relationships "
            "(deduped from %d entities, %d relationships)",
            len(entities),
            len(relationships),
            len(graph.entities),
            len(graph.relationships),
        )

        return ParsedGraph(entities=entities, relationships=relationships)

    def _deduplicate_entities(
        self, entities: list[ParsedEntity]
    ) -> tuple[list[ParsedEntity], dict[str, str]]:
        """Deduplicate entities by case-insensitive name.

        When duplicates are found, merge attributes from all occurrences.
        The first occurrence's casing is used as the canonical name.

        Returns:
            Tuple of (deduplicated entities, original_name -> canonical_name map).
        """
        canonical: dict[str, ParsedEntity] = {}
        name_map: dict[str, str] = {}
        duplicates_found = 0

        for entity in entities:
            key = entity.name.strip().lower()
            name_map[entity.name] = (
                canonical[key].name if key in canonical else entity.name
            )

            if key in canonical:
                duplicates_found += 1
                existing = canonical[key]
                # Merge attributes (new values don't overwrite existing)
                merged_attrs = {**entity.attributes, **existing.attributes}
                # Prefer non-None type
                merged_type = existing.entity_type or entity.entity_type
                canonical[key] = ParsedEntity(
                    name=existing.name,
                    entity_type=merged_type,
                    attributes=merged_attrs,
                )
            else:
                canonical[key] = ParsedEntity(
                    name=entity.name,
                    entity_type=entity.entity_type,
                    attributes=dict(entity.attributes),
                )

        if duplicates_found:
            logger.info("Merged %d duplicate entities", duplicates_found)

        return list(canonical.values()), name_map

    def _infer_types(
        self, entities: list[ParsedEntity]
    ) -> list[ParsedEntity]:
        """Infer entity types from attribute patterns when type is not set."""
        inferred_count = 0
        result: list[ParsedEntity] = []

        for entity in entities:
            if entity.entity_type:
                result.append(entity)
                continue

            inferred = self._infer_type_from_attributes(entity.attributes)
            if inferred:
                inferred_count += 1
                result.append(
                    ParsedEntity(
                        name=entity.name,
                        entity_type=inferred,
                        attributes=entity.attributes,
                    )
                )
            else:
                result.append(entity)

        if inferred_count:
            logger.info("Inferred types for %d entities", inferred_count)

        return result

    def _infer_type_from_attributes(self, attributes: dict) -> str | None:
        """Score attribute keys against known type patterns."""
        if not attributes:
            return None

        attr_keys = {k.lower() for k in attributes.keys()}
        scores: Counter[str] = Counter()

        for entity_type, patterns in _TYPE_INFERENCE_PATTERNS.items():
            for pattern in patterns:
                for key in attr_keys:
                    if pattern in key:
                        scores[entity_type] += 1

        if not scores:
            return None

        best_type, best_score = scores.most_common(1)[0]
        if best_score >= 2:
            return best_type
        return None

    def _normalize_relationships(
        self,
        relationships: list[ParsedRelationship],
        name_map: dict[str, str],
    ) -> list[ParsedRelationship]:
        """Normalize relationship types and remap entity names."""
        result: list[ParsedRelationship] = []
        seen: set[tuple[str, str, str]] = set()

        for rel in relationships:
            source = name_map.get(rel.source, rel.source)
            target = name_map.get(rel.target, rel.target)

            rel_type = self._normalize_relationship_type(
                rel.relationship_type
            )

            # Deduplicate identical relationships
            key = (source, target, rel_type)
            if key in seen:
                continue
            seen.add(key)

            result.append(
                ParsedRelationship(
                    source=source,
                    target=target,
                    relationship_type=rel_type,
                    weight=rel.weight,
                    attributes=rel.attributes,
                )
            )

        return result

    @staticmethod
    def _normalize_relationship_type(rel_type: str | None) -> str:
        """Normalize a relationship type string to a canonical form."""
        if not rel_type:
            return "related_to"

        # Lowercase and convert spaces/hyphens to underscores
        normalized = re.sub(r"[\s\-]+", "_", rel_type.strip().lower())

        # Check alias map
        return _RELATIONSHIP_ALIASES.get(normalized, normalized)
