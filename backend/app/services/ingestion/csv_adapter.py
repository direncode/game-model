"""CSV file parser for entity-relationship graph extraction.

Supports two formats:
1. Edge list: source, target, [type], [weight], [attributes...]
2. Adjacency with schema mapping: entity columns + relationship columns
"""

from __future__ import annotations

import csv
import io
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ParsedEntity:
    """A single entity extracted from input data."""

    name: str
    entity_type: str | None
    attributes: dict


@dataclass
class ParsedRelationship:
    """A relationship between two entities."""

    source: str
    target: str
    relationship_type: str | None
    weight: float = 1.0
    attributes: dict | None = None


@dataclass
class ParsedGraph:
    """Complete entity-relationship graph extracted from input data."""

    entities: list[ParsedEntity] = field(default_factory=list)
    relationships: list[ParsedRelationship] = field(default_factory=list)


class CSVAdapter:
    """Parse CSV files into entity-relationship graphs.

    Supports two formats:
    1. Edge list: source, target, [type], [weight], [attributes...]
    2. Adjacency: entity columns + relationship columns with schema mapping
    """

    async def parse(
        self, content: bytes, schema_mapping: dict | None = None
    ) -> ParsedGraph:
        """Parse CSV content into a graph structure.

        Args:
            content: Raw CSV bytes (UTF-8 encoded).
            schema_mapping: Optional column mapping configuration.
                Expected keys: source_column, target_column,
                entity_type_column, relationship_type_column,
                weight_column, attribute_columns.

        Returns:
            ParsedGraph with extracted entities and relationships.

        Raises:
            ValueError: If CSV is empty or has fewer than 2 columns.
            UnicodeDecodeError: If content is not valid UTF-8.
        """
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            logger.error("CSV content is not valid UTF-8")
            raise

        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)

        if not rows:
            raise ValueError("CSV file is empty")

        logger.info(
            "Parsing CSV with %d rows, columns: %s",
            len(rows),
            list(rows[0].keys()),
        )

        if schema_mapping:
            return self._parse_with_mapping(rows, schema_mapping)
        return self._auto_detect(rows)

    def _parse_with_mapping(
        self, rows: list[dict], mapping: dict
    ) -> ParsedGraph:
        """Parse rows using explicit column mapping."""
        entities: dict[str, ParsedEntity] = {}
        relationships: list[ParsedRelationship] = []

        source_col = mapping["source_column"]
        target_col = mapping["target_column"]
        type_col = mapping.get("entity_type_column")
        rel_type_col = mapping.get("relationship_type_column")
        weight_col = mapping.get("weight_column")
        attr_cols = mapping.get("attribute_columns", [])

        skipped = 0
        for row in rows:
            source = row.get(source_col, "").strip()
            target = row.get(target_col, "").strip()
            if not source or not target:
                skipped += 1
                continue

            entity_type = (
                row.get(type_col, "").strip() if type_col else None
            )
            attrs = {col: row.get(col) for col in attr_cols if col in row}

            if source not in entities:
                entities[source] = ParsedEntity(
                    name=source, entity_type=entity_type, attributes=attrs
                )
            if target not in entities:
                entities[target] = ParsedEntity(
                    name=target, entity_type=entity_type, attributes={}
                )

            rel_type = (
                row.get(rel_type_col, "").strip()
                if rel_type_col
                else "related_to"
            )
            weight = 1.0
            if weight_col:
                try:
                    weight = float(row.get(weight_col, 1.0))
                except (ValueError, TypeError):
                    weight = 1.0

            rel_attrs = {
                k: v
                for k, v in row.items()
                if k
                not in {source_col, target_col, type_col, rel_type_col, weight_col}
                and k not in attr_cols
            }

            relationships.append(
                ParsedRelationship(
                    source=source,
                    target=target,
                    relationship_type=rel_type or "related_to",
                    weight=weight,
                    attributes=rel_attrs if rel_attrs else None,
                )
            )

        if skipped:
            logger.warning("Skipped %d rows with missing source/target", skipped)

        logger.info(
            "Parsed %d entities and %d relationships from CSV",
            len(entities),
            len(relationships),
        )
        return ParsedGraph(
            entities=list(entities.values()), relationships=relationships
        )

    def _auto_detect(self, rows: list[dict]) -> ParsedGraph:
        """Auto-detect edge list format: first two columns are source/target."""
        headers = list(rows[0].keys())
        if len(headers) < 2:
            raise ValueError(
                "CSV must have at least 2 columns for source and target"
            )

        source_col, target_col = headers[0], headers[1]
        logger.info(
            "Auto-detected edge list: source='%s', target='%s'",
            source_col,
            target_col,
        )

        mapping: dict = {
            "source_column": source_col,
            "target_column": target_col,
        }

        # Third column: relationship type if non-numeric, else weight
        if len(headers) > 2:
            sample_val = rows[0].get(headers[2], "")
            if self._is_numeric(sample_val):
                mapping["weight_column"] = headers[2]
            else:
                mapping["relationship_type_column"] = headers[2]

        # Fourth column: weight if third was type
        if len(headers) > 3 and "relationship_type_column" in mapping:
            sample_val = rows[0].get(headers[3], "")
            if self._is_numeric(sample_val):
                mapping["weight_column"] = headers[3]

        # Remaining columns become attributes
        used = {
            mapping.get("source_column"),
            mapping.get("target_column"),
            mapping.get("relationship_type_column"),
            mapping.get("weight_column"),
        }
        remaining = [h for h in headers if h not in used]
        if remaining:
            mapping["attribute_columns"] = remaining

        return self._parse_with_mapping(rows, mapping)

    @staticmethod
    def _is_numeric(value: str) -> bool:
        """Check if a string value is numeric."""
        try:
            float(value)
            return True
        except (ValueError, TypeError):
            return False
