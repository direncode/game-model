"""Base connector for Latent Ocean Engine.

Extends BaseDatasetAdapter with schema introspection and CDC capabilities
for connecting to customer databases.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable


# ── Original adapter types (copied from app.services.btut.adapters.base) ──


@dataclass
class EntityTypeConfig:
    """Display configuration for an entity type within a dataset."""

    name: str  # e.g. "company", "paper", "patent"
    color: str  # Hex color for UI, e.g. "#00d4ff"
    primary_field: str  # Attribute key for display name, e.g. "company_name"
    secondary_field: str = ""  # Attribute key for subtitle, e.g. "ticker"
    detail_fields: list[str] = field(default_factory=list)  # Extra fields to show


@dataclass
class DatasetMeta:
    """Metadata about a dataset for the UI and query engine."""

    dataset_id: str  # e.g. "edgar", "pubmed"
    display_name: str  # e.g. "SEC EDGAR"
    description: str  # One-line description
    entity_types: list[EntityTypeConfig] = field(default_factory=list)
    lookup_field: str = "name"  # Primary lookup key in attributes
    lookup_label: str = "ID"  # UI label for that field


class BaseDatasetAdapter(ABC):
    """Abstract base class for dataset adapters.

    Each adapter knows how to:
    1. Fetch entities and edges from its data source
    2. Generate domain-specific anomaly tags
    3. Provide display configuration for the UI
    """

    @abstractmethod
    def get_meta(self) -> DatasetMeta:
        """Return static metadata about this dataset."""
        ...

    @abstractmethod
    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        """Fetch entities in {name, type, attributes} format.

        The attributes dict can contain any mix of:
        - Text values (str) -> embedded via text projector
        - Numeric values (int, float) -> embedded via numeric projector
        - Time-series (list[float]) -> embedded via time-series projector
        """
        ...

    @abstractmethod
    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        """Derive edges from the fetched entities.

        Returns list of {source, target, type, weight} dicts.
        Source and target must match entity name fields.
        """
        ...

    @abstractmethod
    def get_anomaly_tags(
        self,
        record: dict,
        scores: dict,
        cluster_size: int,
        flips: int,
    ) -> list[dict]:
        """Generate domain-specific anomaly tags for an entity.

        Returns list of {tag: str, severity: str, description: str}.
        Severity: "critical", "high", "medium", "info".
        """
        ...

    def get_data_quality_signals(self, record: dict) -> list[str]:
        """Check for missing or suspicious attributes.

        Returns list of signal strings. Default: check that primary/secondary
        fields from entity type config are present.
        """
        meta = self.get_meta()
        attrs = record.get("attributes", {})
        entity_type = record.get("type", "")
        signals = []

        for tc in meta.entity_types:
            if tc.name == entity_type:
                if tc.primary_field and not attrs.get(tc.primary_field):
                    signals.append(
                        f"MISSING_{tc.primary_field.upper()}: "
                        f"Expected {tc.primary_field} for {entity_type}"
                    )
                break

        return signals if signals else ["CLEAN: All expected attributes present"]

    def get_display_fields(self, record: dict) -> dict:
        """Map entity attributes to display fields.

        Returns {primary: str, secondary: str, detail: dict}.
        Default implementation uses EntityTypeConfig.
        """
        meta = self.get_meta()
        attrs = record.get("attributes", {})
        entity_type = record.get("type", "")

        for tc in meta.entity_types:
            if tc.name == entity_type:
                return {
                    "primary": str(attrs.get(tc.primary_field, record.get("name", ""))),
                    "secondary": (
                        str(attrs.get(tc.secondary_field, ""))
                        if tc.secondary_field else ""
                    ),
                    "detail": {
                        k: attrs.get(k, "") for k in tc.detail_fields if attrs.get(k)
                    },
                }

        return {"primary": record.get("name", ""), "secondary": "", "detail": {}}

    def get_type_colors(self) -> dict[str, str]:
        """Return {type_name: hex_color} mapping for the UI."""
        return {tc.name: tc.color for tc in self.get_meta().entity_types}


# ── Extended connector types ───────────────────────────────────────────


@dataclass
class ConnectorConfig:
    """Configuration for a database connector."""

    name: str
    driver: str  # e.g. "postgres", "mysql", "snowflake", "csv"
    connection_string: str = ""
    options: dict[str, Any] = field(default_factory=dict)
    poll_interval_seconds: int = 60


@dataclass
class ColumnInfo:
    """Schema information for a single column."""

    name: str
    dtype: str  # e.g. "varchar", "integer", "float", "timestamp"
    nullable: bool = True
    is_primary_key: bool = False
    is_foreign_key: bool = False
    references: str = ""  # "schema.table.column" if FK


@dataclass
class TableInfo:
    """Schema information for a single table."""

    name: str
    schema: str = "public"
    columns: list[ColumnInfo] = field(default_factory=list)
    row_count_estimate: int = 0


@dataclass
class SchemaMap:
    """Complete schema map for a connected database."""

    tables: list[TableInfo] = field(default_factory=list)
    foreign_keys: list[dict] = field(default_factory=list)
    # {from_table, from_col, to_table, to_col}


@dataclass
class RelationshipSuggestion:
    """An auto-detected or suggested relationship between tables."""

    from_table: str
    from_column: str
    to_table: str
    to_column: str
    confidence: float  # 0.0 - 1.0
    basis: str  # "foreign_key", "name_match", "value_overlap"


# ── BaseConnector (extends BaseDatasetAdapter) ─────────────────────────


class BaseConnector(BaseDatasetAdapter):
    """Extended adapter with schema introspection and CDC capabilities.

    While ``BaseDatasetAdapter`` is sufficient for static datasets,
    ``BaseConnector`` adds the ability to:

    - Introspect the target schema (tables, columns, foreign keys).
    - Auto-suggest entity types and relationships from the schema.
    - Watch for changes (CDC) and invoke callbacks on new/updated rows.

    Subclass this for database connectors (Postgres, MySQL, Snowflake,
    CSV, API endpoints, etc.).
    """

    def __init__(self, config: ConnectorConfig) -> None:
        self.config = config
        self._watching: bool = False
        self._watch_callback: Callable[[list[dict]], None] | None = None

    # ── Schema introspection ───────────────────────────────────────────

    @abstractmethod
    def introspect_schema(self) -> SchemaMap:
        """Scan the target database and return a complete schema map.

        Returns:
            A ``SchemaMap`` with tables, columns, and foreign key info.
        """
        ...

    def suggest_entity_types(self) -> list[EntityTypeConfig]:
        """Auto-suggest entity type configs from the schema.

        Default implementation creates one entity type per table, using
        the first text column as primary_field and the primary key as
        secondary_field. Override for smarter heuristics.

        Returns:
            List of ``EntityTypeConfig`` suggestions.
        """
        schema = self.introspect_schema()
        suggestions: list[EntityTypeConfig] = []
        colors = [
            "#00d4ff", "#ff6b6b", "#51cf66", "#ffd43b",
            "#845ef7", "#ff922b", "#20c997", "#e64980",
        ]
        for i, table in enumerate(schema.tables):
            # Find a reasonable primary field
            text_cols = [
                c.name for c in table.columns
                if c.dtype in ("varchar", "text", "string", "char")
                and not c.is_primary_key
            ]
            pk_cols = [c.name for c in table.columns if c.is_primary_key]

            suggestions.append(
                EntityTypeConfig(
                    name=table.name,
                    color=colors[i % len(colors)],
                    primary_field=text_cols[0] if text_cols else (pk_cols[0] if pk_cols else "id"),
                    secondary_field=pk_cols[0] if pk_cols else "",
                    detail_fields=[c.name for c in table.columns[:5]],
                )
            )
        return suggestions

    def suggest_relationships(self) -> list[RelationshipSuggestion]:
        """Auto-detect relationships from schema foreign keys and naming patterns.

        Default implementation uses explicit foreign keys from the schema
        map. Override to add value-overlap or naming-convention detection.

        Returns:
            List of ``RelationshipSuggestion`` objects.
        """
        schema = self.introspect_schema()
        suggestions: list[RelationshipSuggestion] = []

        # Explicit foreign keys
        for fk in schema.foreign_keys:
            suggestions.append(
                RelationshipSuggestion(
                    from_table=fk["from_table"],
                    from_column=fk["from_col"],
                    to_table=fk["to_table"],
                    to_column=fk["to_col"],
                    confidence=1.0,
                    basis="foreign_key",
                )
            )

        # Name-match heuristic: columns named "<table>_id" or "<table>Id"
        table_names = {t.name for t in schema.tables}
        for table in schema.tables:
            for col in table.columns:
                # Check for <other_table>_id pattern
                if col.name.endswith("_id"):
                    candidate = col.name[:-3]  # strip "_id"
                    if candidate in table_names and candidate != table.name:
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

        return suggestions

    # ── CDC (Change Data Capture) ──────────────────────────────────────

    def start_watching(
        self,
        callback: Callable[[list[dict]], None],
    ) -> None:
        """Begin watching for changes and invoke ``callback`` on each batch.

        The callback receives a list of entity dicts (same format as
        ``fetch_entities`` output) representing new or updated rows.

        Default implementation is a no-op stub. Override with
        driver-specific CDC logic (WAL tailing, polling, etc.).

        Args:
            callback: Called with ``(entities: list[dict])`` on each change batch.
        """
        self._watching = True
        self._watch_callback = callback

    def stop_watching(self) -> None:
        """Stop CDC watching. Safe to call even if not watching."""
        self._watching = False
        self._watch_callback = None
