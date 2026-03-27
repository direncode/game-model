"""JSON file parser for entity-relationship graph extraction.

Expected input format:
{
  "entities": [{"name": "...", "type": "...", "attributes": {...}}],
  "relationships": [{"source": "...", "target": "...", "type": "...", "weight": 1.0}]
}
"""

from __future__ import annotations

import json
import logging

from app.services.ingestion.csv_adapter import (
    ParsedEntity,
    ParsedGraph,
    ParsedRelationship,
)

logger = logging.getLogger(__name__)


class JSONAdapter:
    """Parse JSON files into entity-relationship graphs.

    Supports the standard Latent Intelligence JSON format with entities
    and relationships arrays, as well as flat edge-list arrays.
    """

    async def parse(
        self, content: bytes, schema_mapping: dict | None = None
    ) -> ParsedGraph:
        """Parse JSON content into a graph structure.

        Args:
            content: Raw JSON bytes (UTF-8 encoded).
            schema_mapping: Optional field mapping overrides.
                Keys: entity_name_field, entity_type_field,
                relationship_source_field, relationship_target_field,
                relationship_type_field, relationship_weight_field.

        Returns:
            ParsedGraph with extracted entities and relationships.

        Raises:
            ValueError: If JSON structure is invalid or empty.
            json.JSONDecodeError: If content is not valid JSON.
        """
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            logger.error("JSON content is not valid UTF-8")
            raise

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            logger.error("Invalid JSON: %s", exc)
            raise ValueError(f"Invalid JSON content: {exc}") from exc

        if isinstance(data, dict):
            return self._parse_structured(data, schema_mapping)
        if isinstance(data, list):
            return self._parse_edge_list(data, schema_mapping)

        raise ValueError(
            "JSON root must be an object with 'entities'/'relationships' "
            "keys, or an array of edge objects"
        )

    def _parse_structured(
        self, data: dict, mapping: dict | None = None
    ) -> ParsedGraph:
        """Parse structured JSON with entities and relationships arrays."""
        raw_entities = data.get("entities", [])
        raw_relationships = data.get("relationships", data.get("edges", []))

        if not raw_entities and not raw_relationships:
            raise ValueError(
                "JSON must contain 'entities' and/or 'relationships' arrays"
            )

        name_field = (mapping or {}).get("entity_name_field", "name")
        type_field = (mapping or {}).get("entity_type_field", "type")
        src_field = (mapping or {}).get("relationship_source_field", "source")
        tgt_field = (mapping or {}).get("relationship_target_field", "target")
        rel_type_field = (mapping or {}).get("relationship_type_field", "type")
        weight_field = (mapping or {}).get("relationship_weight_field", "weight")

        # Parse entities
        entities: dict[str, ParsedEntity] = {}
        for raw in raw_entities:
            if not isinstance(raw, dict):
                logger.warning("Skipping non-dict entity: %s", type(raw))
                continue

            name = str(raw.get(name_field, "")).strip()
            if not name:
                logger.warning("Skipping entity with empty name")
                continue

            entity_type = raw.get(type_field)
            if entity_type is not None:
                entity_type = str(entity_type).strip() or None

            # Everything else is attributes
            reserved = {name_field, type_field}
            attributes = {
                k: v for k, v in raw.items() if k not in reserved
            }

            entities[name] = ParsedEntity(
                name=name,
                entity_type=entity_type,
                attributes=attributes,
            )

        # Parse relationships
        relationships: list[ParsedRelationship] = []
        for raw in raw_relationships:
            if not isinstance(raw, dict):
                logger.warning("Skipping non-dict relationship: %s", type(raw))
                continue

            source = str(raw.get(src_field, "")).strip()
            target = str(raw.get(tgt_field, "")).strip()
            if not source or not target:
                logger.warning("Skipping relationship with missing endpoints")
                continue

            rel_type = raw.get(rel_type_field)
            if rel_type is not None:
                rel_type = str(rel_type).strip() or None

            weight = 1.0
            raw_weight = raw.get(weight_field)
            if raw_weight is not None:
                try:
                    weight = float(raw_weight)
                except (ValueError, TypeError):
                    weight = 1.0

            reserved = {src_field, tgt_field, rel_type_field, weight_field}
            attrs = {k: v for k, v in raw.items() if k not in reserved}

            # Auto-create entities from relationships if not declared
            if source not in entities:
                entities[source] = ParsedEntity(
                    name=source, entity_type=None, attributes={}
                )
            if target not in entities:
                entities[target] = ParsedEntity(
                    name=target, entity_type=None, attributes={}
                )

            relationships.append(
                ParsedRelationship(
                    source=source,
                    target=target,
                    relationship_type=rel_type or "related_to",
                    weight=weight,
                    attributes=attrs if attrs else None,
                )
            )

        logger.info(
            "Parsed %d entities and %d relationships from JSON",
            len(entities),
            len(relationships),
        )
        return ParsedGraph(
            entities=list(entities.values()), relationships=relationships
        )

    def _parse_edge_list(
        self, data: list, mapping: dict | None = None
    ) -> ParsedGraph:
        """Parse a flat array of edge objects."""
        if not data:
            raise ValueError("JSON edge list is empty")

        # Wrap as structured format and reparse
        return self._parse_structured(
            {"entities": [], "relationships": data}, mapping
        )
