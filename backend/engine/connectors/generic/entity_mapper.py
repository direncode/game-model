"""Map database rows to engine entity format {name, type, attributes}."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class TableMappingConfig:
    """How to map a single table's rows to entities."""

    table_name: str
    entity_type: str = ""           # Override for the type field (default: singularized table name)
    name_column: str = ""           # Column to use as entity name (default: PK)
    name_template: str = ""         # Template e.g. "{first_name} {last_name}"
    exclude_columns: list[str] = field(default_factory=list)
    include_columns: list[str] = field(default_factory=list)  # Empty = all


@dataclass
class EntityMappingConfig:
    """Configuration for mapping database tables to engine entities."""

    tables: dict[str, TableMappingConfig] = field(default_factory=dict)
    # table_name -> mapping config

    def get_or_default(self, table_name: str) -> TableMappingConfig:
        """Return explicit config or a sensible default."""
        if table_name in self.tables:
            return self.tables[table_name]
        return TableMappingConfig(table_name=table_name)


def _singularize(name: str) -> str:
    """Naive English singularization for table names.

    Handles common patterns: companies -> company, statuses -> status,
    addresses -> address, users -> user.
    """
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


class EntityMapper:
    """Converts rows from a customer's database to engine entities.

    Each entity has the form::

        {
            "name": "<identifier>",
            "type": "<entity_type>",
            "attributes": { ... }
        }
    """

    def __init__(self, mapping_config: EntityMappingConfig | None = None) -> None:
        self._config = mapping_config or EntityMappingConfig()

    # ------------------------------------------------------------------ #

    def map_row(self, table_name: str, row: dict) -> dict:
        """Convert a single DB row to ``{name, type, attributes}``.

        - **name**: derived from the configured ``name_column``, a
          ``name_template``, or the first column in the row (assumed PK).
        - **type**: ``entity_type`` override or singularized table name.
        - **attributes**: all remaining columns as key-value pairs.
        """
        cfg = self._config.get_or_default(table_name)
        entity_type = cfg.entity_type or _singularize(table_name)

        # Determine entity name
        name = self._resolve_name(cfg, row)

        # Build attributes (everything except the name source column)
        attributes = self._build_attributes(cfg, row)

        return {
            "name": str(name),
            "type": entity_type,
            "attributes": attributes,
        }

    def map_rows(self, table_name: str, rows: list[dict]) -> list[dict]:
        """Batch conversion of rows to entities."""
        return [self.map_row(table_name, row) for row in rows]

    # ------------------------------------------------------------------ #
    #  Internal helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _resolve_name(cfg: TableMappingConfig, row: dict) -> Any:
        """Determine the entity name from the row."""
        # 1. Explicit template
        if cfg.name_template:
            try:
                return cfg.name_template.format(**row)
            except (KeyError, IndexError):
                pass

        # 2. Explicit name column
        if cfg.name_column and cfg.name_column in row:
            return row[cfg.name_column]

        # 3. First column (usually the PK) or 'id' / 'name'
        if "name" in row:
            return row["name"]

        # Use 'id' prefixed with table name for clarity
        if "id" in row:
            return f"{cfg.table_name}:{row['id']}"

        # Last resort: first value
        for v in row.values():
            return v
        return "unknown"

    @staticmethod
    def _build_attributes(cfg: TableMappingConfig, row: dict) -> dict:
        """Build the attributes dict, respecting include/exclude lists."""
        attrs: dict[str, Any] = {}
        for key, value in row.items():
            if cfg.include_columns and key not in cfg.include_columns:
                continue
            if key in cfg.exclude_columns:
                continue
            # Skip None values to keep payloads lean
            if value is None:
                continue
            attrs[key] = value
        return attrs
