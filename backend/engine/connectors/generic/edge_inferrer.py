"""Infer edges from foreign key relationships in the schema."""
from __future__ import annotations

import logging
from typing import Any

from ..base import SchemaMap

logger = logging.getLogger(__name__)


def _singularize(name: str) -> str:
    """Naive singularization matching entity_mapper logic."""
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


class EdgeInferrer:
    """Derives edges from FK relationships and junction tables.

    Edges have the form::

        {
            "source": "<entity_name>",
            "target": "<entity_name>",
            "type": "<relationship_label>",
            "weight": 1.0
        }
    """

    def infer_edges(
        self,
        entities: list[dict],
        schema: SchemaMap,
        rows_by_table: dict[str, list[dict]],
    ) -> list[dict]:
        """Build ``{source, target, type, weight}`` edges from FK relationships.

        Parameters
        ----------
        entities:
            Already-mapped entities (``{name, type, attributes}``).
        schema:
            The introspected :class:`SchemaMap` with FK info.
        rows_by_table:
            Raw rows keyed by table name, used to resolve FK values.
        """
        # Build lookup: (table_name, pk_value) -> entity name
        entity_index = self._build_entity_index(entities)

        # Detect junction tables (tables whose only meaningful columns are FKs)
        junction_tables = self._detect_junction_tables(schema)

        edges: list[dict] = []

        # ── Direct FK edges ───────────────────────────────────────────
        for fk in schema.foreign_keys:
            from_table = fk["from_table"]
            from_col = fk["from_col"]
            to_table = fk["to_table"]
            to_col = fk["to_col"]

            if from_table in junction_tables:
                continue  # Handled separately below

            edge_type = f"{_singularize(from_table)}_to_{_singularize(to_table)}"

            for row in rows_by_table.get(from_table, []):
                fk_value = row.get(from_col)
                if fk_value is None:
                    continue

                source_name = self._row_entity_name(from_table, row, entity_index)
                target_name = self._pk_entity_name(to_table, to_col, fk_value, entity_index)

                if source_name and target_name:
                    edges.append({
                        "source": source_name,
                        "target": target_name,
                        "type": edge_type,
                        "weight": 1.0,
                    })

        # ── Junction table (many-to-many) edges ──────────────────────
        for jt_name in junction_tables:
            jt_fks = [
                fk for fk in schema.foreign_keys
                if fk["from_table"] == jt_name
            ]
            if len(jt_fks) < 2:
                continue

            # Create edges between all FK pairs in the junction table
            for row in rows_by_table.get(jt_name, []):
                resolved: list[tuple[str, str]] = []  # (table, entity_name)
                for fk in jt_fks:
                    fk_value = row.get(fk["from_col"])
                    if fk_value is None:
                        continue
                    ename = self._pk_entity_name(
                        fk["to_table"], fk["to_col"], fk_value, entity_index,
                    )
                    if ename:
                        resolved.append((fk["to_table"], ename))

                # Connect each pair
                for i in range(len(resolved)):
                    for j in range(i + 1, len(resolved)):
                        t1, n1 = resolved[i]
                        t2, n2 = resolved[j]
                        edge_type = f"{_singularize(t1)}_x_{_singularize(t2)}"
                        edges.append({
                            "source": n1,
                            "target": n2,
                            "type": edge_type,
                            "weight": 1.0,
                        })

        logger.info("Inferred %d edges from %d FK relationships", len(edges), len(schema.foreign_keys))
        return edges

    # ------------------------------------------------------------------ #
    #  Internal helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _build_entity_index(entities: list[dict]) -> dict[tuple[str, Any], str]:
        """Build ``(type, id_value) -> entity_name`` lookup.

        We index by entity type + every attribute value that looks like
        an ID (column name ends with ``_id`` or is ``id``).
        """
        index: dict[tuple[str, Any], str] = {}
        for ent in entities:
            etype = ent.get("type", "")
            name = ent.get("name", "")
            attrs = ent.get("attributes", {})

            # Index by the 'id' attribute if present
            if "id" in attrs:
                index[(etype, attrs["id"])] = name
            # Also index by name itself
            index[(etype, name)] = name

            # Index by any *_id column too for FK resolution
            for k, v in attrs.items():
                if k == "id":
                    continue
                index[(etype, v)] = name

        return index

    @staticmethod
    def _row_entity_name(
        table: str,
        row: dict,
        index: dict[tuple[str, Any], str],
    ) -> str | None:
        """Resolve a row to its entity name."""
        etype = _singularize(table)
        # Try id attribute
        if "id" in row:
            key = (etype, row["id"])
            if key in index:
                return index[key]
        # Try name attribute
        if "name" in row:
            key = (etype, row["name"])
            if key in index:
                return index[key]
        return None

    @staticmethod
    def _pk_entity_name(
        table: str,
        pk_col: str,
        pk_value: Any,
        index: dict[tuple[str, Any], str],
    ) -> str | None:
        """Look up an entity name by its table's PK value."""
        etype = _singularize(table)
        key = (etype, pk_value)
        return index.get(key)

    @staticmethod
    def _detect_junction_tables(schema: SchemaMap) -> set[str]:
        """Detect tables that are pure junction/association tables.

        A junction table is one where:
        - It has 2+ FK columns
        - All non-PK, non-FK columns are metadata (timestamps, booleans)
        """
        fk_cols_by_table: dict[str, set[str]] = {}
        for fk in schema.foreign_keys:
            fk_cols_by_table.setdefault(fk["from_table"], set()).add(fk["from_col"])

        junction: set[str] = set()
        for table in schema.tables:
            fk_cols = fk_cols_by_table.get(table.name, set())
            if len(fk_cols) < 2:
                continue

            # Check if non-FK, non-PK columns are all "metadata"
            metadata_types = {"boolean", "bool", "timestamp", "timestamptz", "date", "integer", "int"}
            is_junction = True
            for col in table.columns:
                if col.is_primary_key or col.is_foreign_key or col.name in fk_cols:
                    continue
                base_type = col.dtype.lower().split("(")[0].strip()
                if base_type not in metadata_types:
                    is_junction = False
                    break

            if is_junction:
                junction.add(table.name)

        return junction
