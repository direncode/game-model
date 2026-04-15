"""Auto-detect database schema and suggest entity/relationship mappings."""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from ..base import (
    ColumnInfo,
    EntityTypeConfig,
    RelationshipSuggestion,
    SchemaMap,
    TableInfo,
)
from .type_classifier import TypeClassifier

logger = logging.getLogger(__name__)

# Color palette for auto-assigned entity types
_PALETTE = [
    "#00d4ff", "#ff6b6b", "#51cf66", "#ffd43b",
    "#845ef7", "#ff922b", "#20c997", "#e64980",
    "#339af0", "#f06595", "#94d82d", "#ffa94d",
    "#be4bdb", "#22b8cf", "#fab005", "#ff8787",
]


def _singularize(name: str) -> str:
    """Naive English singularization for table names."""
    if not name:
        return name
    lower = name.lower()
    if lower.endswith("ies") and len(lower) > 3:
        return name[:-3] + "y"
    if lower.endswith("sses"):
        return name[:-2]
    if lower.endswith("ses") and not lower.endswith("sses"):
        return name[:-1]
    if lower.endswith("s") and not lower.endswith("ss"):
        return name[:-1]
    return name


def _clean_name(name: str) -> str:
    """Convert a table name to a human-friendly entity type name.

    ``user_accounts`` -> ``user_account``
    ``OrderItems`` -> ``order_item``
    """
    # camelCase / PascalCase -> snake_case
    s1 = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", name)
    s2 = re.sub(r"([a-z\d])([A-Z])", r"\1_\2", s1)
    cleaned = s2.lower().replace("-", "_")
    return _singularize(cleaned)


class SchemaIntrospector:
    """Introspect any database schema and suggest entity/edge mappings.

    This is the core intelligence that makes 'connect any database' possible.
    It examines tables, columns, PKs, FKs, and column types to automatically
    map a customer's schema to the engine's ``{name, type, attributes}`` format.
    """

    def __init__(self) -> None:
        self._classifier = TypeClassifier()

    # ------------------------------------------------------------------ #
    #  Core introspection
    # ------------------------------------------------------------------ #

    def introspect(self, tables: list[TableInfo]) -> SchemaMap:
        """Build a :class:`SchemaMap` from raw table introspection results.

        Organises tables and derives the ``foreign_keys`` list from
        :attr:`ColumnInfo.references` annotations on each column.
        """
        foreign_keys: list[dict] = []

        for table in tables:
            for col in table.columns:
                if col.is_foreign_key and col.references:
                    # references format: "schema.table.column" or "table.column"
                    parts = col.references.split(".")
                    if len(parts) >= 2:
                        to_table = parts[-2]
                        to_col = parts[-1]
                    else:
                        to_table = col.references
                        to_col = "id"

                    foreign_keys.append({
                        "from_table": table.name,
                        "from_col": col.name,
                        "to_table": to_table,
                        "to_col": to_col,
                    })

        schema = SchemaMap(tables=list(tables), foreign_keys=foreign_keys)
        logger.info(
            "Introspected %d tables, %d foreign keys",
            len(schema.tables),
            len(schema.foreign_keys),
        )
        return schema

    # ------------------------------------------------------------------ #
    #  Column classification
    # ------------------------------------------------------------------ #

    def classify_columns(self, schema: SchemaMap) -> dict[str, dict[str, str]]:
        """Classify each column as text/numeric/temporal/categorical/json/embedding.

        Returns a nested dict: ``{table_name: {column_name: classification}}``.

        Heuristics:
        - Column type mapping (varchar/text -> text, int/float -> numeric, etc.)
        - Column name patterns ('_at', '_date', 'timestamp' -> temporal)
        - JSON/JSONB -> json
        - Array types -> embedding (if float[])
        """
        result: dict[str, dict[str, str]] = {}

        for table in schema.tables:
            table_classifications: dict[str, str] = {}
            for col in table.columns:
                table_classifications[col.name] = self._classifier.classify(
                    col.name, col.dtype,
                )
            result[table.name] = table_classifications

        return result

    # ------------------------------------------------------------------ #
    #  Entity type suggestions
    # ------------------------------------------------------------------ #

    def suggest_entity_types(self, schema: SchemaMap) -> list[EntityTypeConfig]:
        """Suggest entity types from tables.

        Heuristics:
        - Tables with PKs that are not pure junction tables -> entity types
        - Table name -> entity type name (singularize, clean)
        - First text column -> primary_field
        - Second text column -> secondary_field
        - Assign colors from a palette
        """
        junction_tables = self._detect_junction_tables(schema)
        classifications = self.classify_columns(schema)
        suggestions: list[EntityTypeConfig] = []

        for i, table in enumerate(schema.tables):
            if table.name in junction_tables:
                continue

            # Only tables with at least one PK
            has_pk = any(c.is_primary_key for c in table.columns)
            if not has_pk and len(table.columns) > 0:
                # Still create an entity type — many tables have implicit PKs
                pass

            entity_name = _clean_name(table.name)
            col_classes = classifications.get(table.name, {})

            # Find text columns for primary/secondary fields
            text_cols = [
                c.name for c in table.columns
                if col_classes.get(c.name) == "text" and not c.is_primary_key
            ]

            # Find the PK column(s)
            pk_cols = [c.name for c in table.columns if c.is_primary_key]

            primary_field = text_cols[0] if text_cols else (pk_cols[0] if pk_cols else "id")
            secondary_field = text_cols[1] if len(text_cols) > 1 else (pk_cols[0] if pk_cols else "")

            # Don't duplicate primary as secondary
            if secondary_field == primary_field:
                secondary_field = ""

            # Pick detail fields: first 5 non-PK, non-ID columns
            detail_fields = [
                c.name for c in table.columns
                if not c.is_primary_key
                and col_classes.get(c.name) != "id"
            ][:5]

            suggestions.append(
                EntityTypeConfig(
                    name=entity_name,
                    color=_PALETTE[i % len(_PALETTE)],
                    primary_field=primary_field,
                    secondary_field=secondary_field,
                    detail_fields=detail_fields,
                )
            )

        logger.info("Suggested %d entity types from %d tables", len(suggestions), len(schema.tables))
        return suggestions

    # ------------------------------------------------------------------ #
    #  Relationship suggestions
    # ------------------------------------------------------------------ #

    def suggest_relationships(self, schema: SchemaMap) -> list[RelationshipSuggestion]:
        """Suggest edges from FK relationships.

        FK ``table.column`` -> referenced table -> edge from source entity
        to target entity.

        Junction tables (only FKs, no other meaningful columns) ->
        many-to-many edges.
        """
        suggestions: list[RelationshipSuggestion] = []
        junction_tables = self._detect_junction_tables(schema)

        # ── Direct FK relationships ───────────────────────────────────
        for fk in schema.foreign_keys:
            from_table = fk["from_table"]
            to_table = fk["to_table"]

            if from_table in junction_tables:
                continue  # Handled below

            suggestions.append(
                RelationshipSuggestion(
                    from_table=from_table,
                    from_column=fk["from_col"],
                    to_table=to_table,
                    to_column=fk["to_col"],
                    confidence=1.0,
                    basis="foreign_key",
                )
            )

        # ── Junction table many-to-many ───────────────────────────────
        for jt_name in junction_tables:
            jt_fks = [fk for fk in schema.foreign_keys if fk["from_table"] == jt_name]
            # Create a relationship between each pair of referenced tables
            for i, fk_a in enumerate(jt_fks):
                for fk_b in jt_fks[i + 1:]:
                    suggestions.append(
                        RelationshipSuggestion(
                            from_table=fk_a["to_table"],
                            from_column=fk_a["to_col"],
                            to_table=fk_b["to_table"],
                            to_column=fk_b["to_col"],
                            confidence=0.95,
                            basis="foreign_key",
                        )
                    )

        # ── Name-match heuristic ──────────────────────────────────────
        table_names = {t.name for t in schema.tables}
        existing = {(s.from_table, s.to_table) for s in suggestions}

        for table in schema.tables:
            for col in table.columns:
                if col.is_foreign_key:
                    continue  # Already handled above
                if col.name.endswith("_id"):
                    candidate = col.name[:-3]  # strip "_id"
                    if candidate in table_names and candidate != table.name:
                        if (table.name, candidate) not in existing:
                            suggestions.append(
                                RelationshipSuggestion(
                                    from_table=table.name,
                                    from_column=col.name,
                                    to_table=candidate,
                                    to_column="id",
                                    confidence=0.8,
                                    basis="name_match",
                                )
                            )
                            existing.add((table.name, candidate))

        logger.info("Suggested %d relationships", len(suggestions))
        return suggestions

    # ------------------------------------------------------------------ #
    #  Utility
    # ------------------------------------------------------------------ #

    def estimate_entity_count(self, table_counts: dict[str, int]) -> int:
        """Sum row counts across entity tables."""
        return sum(table_counts.values())

    # ------------------------------------------------------------------ #
    #  Private helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _detect_junction_tables(schema: SchemaMap) -> set[str]:
        """Identify tables that are pure junction/association tables.

        A junction table has 2+ FK columns and all remaining columns are
        either PKs, FKs, or metadata (timestamps, booleans, integers).

        Tables where ALL non-PK columns are foreign keys are also detected
        as junction tables (composite-key junction pattern).
        """
        fk_cols_by_table: dict[str, set[str]] = {}
        for fk in schema.foreign_keys:
            fk_cols_by_table.setdefault(fk["from_table"], set()).add(fk["from_col"])

        junction: set[str] = set()
        metadata_types = {
            "boolean", "bool",
            "timestamp", "timestamptz", "date",
            "timestamp with time zone", "timestamp without time zone",
            "integer", "int", "int2", "int4", "int8",
            "smallint", "bigint", "serial", "bigserial", "smallserial",
        }

        for table in schema.tables:
            fk_cols = fk_cols_by_table.get(table.name, set())
            if len(fk_cols) < 2:
                continue

            # Check if all non-PK/non-FK columns are metadata types
            is_junction = True
            non_key_cols = 0
            for col in table.columns:
                if col.is_primary_key or col.is_foreign_key or col.name in fk_cols:
                    continue
                non_key_cols += 1
                base_type = col.dtype.lower().split("(")[0].strip()
                if base_type not in metadata_types:
                    is_junction = False
                    break

            if is_junction:
                junction.add(table.name)

        return junction
