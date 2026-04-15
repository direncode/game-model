"""PostgreSQL connector driver using SQLAlchemy."""
from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

from ..base import (
    BaseConnector,
    ColumnInfo,
    ConnectorConfig,
    DatasetMeta,
    EntityTypeConfig,
    RelationshipSuggestion,
    SchemaMap,
    TableInfo,
)
from ..generic.edge_inferrer import EdgeInferrer
from ..generic.entity_mapper import EntityMapper, EntityMappingConfig
from ..generic.schema_introspector import SchemaIntrospector

logger = logging.getLogger(__name__)


class PostgreSQLConnector(BaseConnector):
    """Connect to any PostgreSQL database and auto-detect entities.

    Usage::

        connector = PostgreSQLConnector("postgresql://user:pass@host/db")
        schema = connector.introspect_schema()
        entities = connector.fetch_entities(limit=5000)
        edges = connector.fetch_edges(entities)
    """

    def __init__(
        self,
        connection_string: str,
        config: ConnectorConfig | None = None,
    ) -> None:
        self._dsn = connection_string
        self._config = config or ConnectorConfig(
            name="postgresql",
            driver="postgres",
            connection_string=connection_string,
        )
        super().__init__(self._config)

        self._introspector = SchemaIntrospector()
        self._schema: SchemaMap | None = None
        self._engine: Engine | None = None
        self._db_schema: str = self._config.options.get("schema", "public")

    # ------------------------------------------------------------------ #
    #  Connection management
    # ------------------------------------------------------------------ #

    @staticmethod
    def _normalize_dsn(dsn: str) -> str:
        """Convert async DSN to sync for SQLAlchemy.

        Strips ``+asyncpg`` from connection strings so the connector
        works with both async and sync DSNs transparently.
        """
        return dsn.replace("+asyncpg", "").replace("postgresql+asyncpg", "postgresql")

    def _get_engine(self) -> Engine:
        """Lazy-initialise SQLAlchemy engine with connection timeout."""
        if self._engine is None:
            dsn = self._normalize_dsn(self._dsn)
            self._engine = create_engine(
                dsn,
                connect_args={"connect_timeout": 10},
            )
        return self._engine

    def _test_connection(self) -> bool:
        """Verify database connectivity with a simple SELECT 1.

        Should be called before fetch_entities to fail fast on bad
        connection strings or unreachable hosts.

        Returns:
            True if the connection succeeds, False otherwise.
        """
        try:
            with self._get_engine().connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error("Connection test failed: %s", e)
            return False

    # ------------------------------------------------------------------ #
    #  Schema introspection
    # ------------------------------------------------------------------ #

    def introspect_schema(self) -> SchemaMap:
        """Read PostgreSQL information_schema to detect tables, columns, PKs, FKs.

        Uses SQLAlchemy's ``inspect()`` to retrieve full metadata.
        """
        if self._schema is not None:
            return self._schema

        engine = self._get_engine()
        insp = inspect(engine)

        tables: list[TableInfo] = []

        table_names = insp.get_table_names(schema=self._db_schema)
        logger.info("Found %d tables in schema '%s'", len(table_names), self._db_schema)

        for table_name in table_names:
            # Get columns
            raw_columns = insp.get_columns(table_name, schema=self._db_schema)
            pk_constraint = insp.get_pk_constraint(table_name, schema=self._db_schema)
            pk_cols = set(pk_constraint.get("constrained_columns", []))
            fk_list = insp.get_foreign_keys(table_name, schema=self._db_schema)

            # Build FK lookup: column_name -> "referred_table.referred_column"
            fk_map: dict[str, str] = {}
            for fk in fk_list:
                referred_table = fk["referred_table"]
                for local_col, ref_col in zip(
                    fk["constrained_columns"], fk["referred_columns"]
                ):
                    ref_schema = fk.get("referred_schema") or self._db_schema
                    fk_map[local_col] = f"{ref_schema}.{referred_table}.{ref_col}"

            columns: list[ColumnInfo] = []
            for col in raw_columns:
                col_name = col["name"]
                col_type = str(col["type"]).lower()
                columns.append(
                    ColumnInfo(
                        name=col_name,
                        dtype=col_type,
                        nullable=col.get("nullable", True),
                        is_primary_key=col_name in pk_cols,
                        is_foreign_key=col_name in fk_map,
                        references=fk_map.get(col_name, ""),
                    )
                )

            # Estimate row count (fast but approximate)
            row_count = self._estimate_row_count(table_name)

            tables.append(
                TableInfo(
                    name=table_name,
                    schema=self._db_schema,
                    columns=columns,
                    row_count_estimate=row_count,
                )
            )

        self._schema = self._introspector.introspect(tables)
        return self._schema

    def _estimate_row_count(self, table_name: str) -> int:
        """Fast row count estimate using pg_stat_user_tables.

        Falls back to ``COUNT(*)`` if stats are unavailable.
        """
        engine = self._get_engine()
        try:
            with engine.connect() as conn:
                result = conn.execute(
                    text(
                        "SELECT n_live_tup FROM pg_stat_user_tables "
                        "WHERE schemaname = :schema AND relname = :table"
                    ),
                    {"schema": self._db_schema, "table": table_name},
                )
                row = result.fetchone()
                if row and row[0] > 0:
                    return int(row[0])

                # Fallback: actual count (may be slow on large tables)
                result = conn.execute(
                    text(f'SELECT COUNT(*) FROM "{self._db_schema}"."{table_name}"')
                )
                row = result.fetchone()
                return int(row[0]) if row else 0
        except Exception:
            logger.debug("Could not estimate row count for %s", table_name)
            return 0

    # ------------------------------------------------------------------ #
    #  DatasetMeta
    # ------------------------------------------------------------------ #

    def get_meta(self) -> DatasetMeta:
        """Generate DatasetMeta from introspected schema."""
        schema = self.introspect_schema()
        entity_types = self._introspector.suggest_entity_types(schema)

        # Build a display name from the connection string (strip credentials)
        dsn_parts = self._dsn.split("/")
        db_name = dsn_parts[-1].split("?")[0] if dsn_parts else "database"

        return DatasetMeta(
            dataset_id=f"pg:{db_name}",
            display_name=f"PostgreSQL: {db_name}",
            description=f"Auto-detected schema with {len(schema.tables)} tables",
            entity_types=entity_types,
            lookup_field="name",
            lookup_label="Entity",
        )

    # ------------------------------------------------------------------ #
    #  Entity fetching
    # ------------------------------------------------------------------ #

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        """Fetch rows from entity tables, map to ``{name, type, attributes}``.

        Distributes the limit across tables proportionally to their row counts.
        Gracefully skips empty tables and tables with no primary key by
        falling back to the first column or ``ctid`` for entity names.

        Validates connectivity before fetching.
        """
        if not self._test_connection():
            raise ConnectionError(
                f"Cannot connect to PostgreSQL at "
                f"{self._dsn.split('@')[-1] if '@' in self._dsn else self._dsn}. "
                "Check DSN, network, and database availability."
            )

        schema = self.introspect_schema()
        engine = self._get_engine()
        mapper = EntityMapper()

        # Detect junction tables to skip
        junction_tables = self._introspector._detect_junction_tables(schema)

        # Filter to non-junction, non-empty tables for proportional limit calc
        candidate_tables = [
            t for t in schema.tables
            if t.name not in junction_tables and t.row_count_estimate > 0
        ]

        total_rows = sum(t.row_count_estimate for t in candidate_tables)
        all_entities: list[dict] = []

        for table in candidate_tables:
            # Proportional distribution, safe against total_rows == 0
            if total_rows > 0:
                table_limit = max(
                    100,
                    int(limit * (table.row_count_estimate / total_rows)),
                )
            else:
                table_limit = 100

            table_limit = min(table_limit, limit - len(all_entities))
            if table_limit <= 0:
                break

            try:
                # Determine name column: PK if available, else first column,
                # else ctid (PostgreSQL physical row ID)
                pk_cols = [c.name for c in table.columns if c.is_primary_key]
                if pk_cols:
                    name_col = pk_cols[0]
                elif table.columns:
                    name_col = table.columns[0].name
                else:
                    name_col = None

                # Build SELECT — include ctid as fallback name when no PK
                if name_col:
                    select_sql = (
                        f'SELECT * FROM "{self._db_schema}"."{table.name}" '
                        f"LIMIT :lim"
                    )
                else:
                    select_sql = (
                        f'SELECT ctid::text AS _ctid, * '
                        f'FROM "{self._db_schema}"."{table.name}" '
                        f"LIMIT :lim"
                    )

                with engine.connect() as conn:
                    result = conn.execute(text(select_sql), {"lim": table_limit})
                    columns = list(result.keys())
                    rows = [dict(zip(columns, r)) for r in result.fetchall()]

                # Serialize any nested JSON/dict/list values in attributes
                for row in rows:
                    for key, value in row.items():
                        if isinstance(value, (dict, list)):
                            row[key] = json.dumps(value, default=str)

                entities = mapper.map_rows(table.name, rows)
                all_entities.extend(entities)
            except Exception:
                logger.exception("Failed to fetch from table %s", table.name)

        logger.info("Fetched %d entities from %d tables", len(all_entities), len(schema.tables))
        return all_entities

    # ------------------------------------------------------------------ #
    #  Edge inference
    # ------------------------------------------------------------------ #

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        """Infer edges from FK relationships.

        Reads junction table rows and FK columns to build edges.
        """
        schema = self.introspect_schema()
        engine = self._get_engine()
        inferrer = EdgeInferrer()

        # Fetch rows for tables that participate in FK relationships
        tables_needed: set[str] = set()
        for fk in schema.foreign_keys:
            tables_needed.add(fk["from_table"])

        rows_by_table: dict[str, list[dict]] = {}
        for table_name in tables_needed:
            try:
                with engine.connect() as conn:
                    result = conn.execute(
                        text(
                            f'SELECT * FROM "{self._db_schema}"."{table_name}" '
                            f"LIMIT 50000"
                        )
                    )
                    columns = list(result.keys())
                    rows = [dict(zip(columns, r)) for r in result.fetchall()]
                    # Serialize nested JSON/dict/list values
                    for row in rows:
                        for key, value in row.items():
                            if isinstance(value, (dict, list)):
                                row[key] = json.dumps(value, default=str)
                    rows_by_table[table_name] = rows
            except Exception:
                logger.exception("Failed to fetch edges from table %s", table_name)
                rows_by_table[table_name] = []

        edges = inferrer.infer_edges(entities, schema, rows_by_table)
        logger.info("Inferred %d edges", len(edges))
        return edges

    # ------------------------------------------------------------------ #
    #  Anomaly tags
    # ------------------------------------------------------------------ #

    def get_anomaly_tags(
        self,
        record: dict,
        scores: dict,
        cluster_size: int,
        flips: int,
    ) -> list[dict]:
        """Generic anomaly tags for auto-detected entities.

        Uses statistical thresholds since we don't have domain-specific
        knowledge about the customer's data.
        """
        tags: list[dict] = []
        attrs = record.get("attributes", {})
        entity_type = record.get("type", "unknown")

        # Isolation score anomaly
        isolation = scores.get("isolation_score", 0)
        if isolation > 0.9:
            tags.append({
                "tag": "HIGHLY_ISOLATED",
                "severity": "high",
                "description": (
                    f"{entity_type} entity has isolation score {isolation:.2f} "
                    f"(very few connections)"
                ),
            })
        elif isolation > 0.7:
            tags.append({
                "tag": "ISOLATED",
                "severity": "medium",
                "description": (
                    f"{entity_type} entity has isolation score {isolation:.2f}"
                ),
            })

        # Small cluster
        if cluster_size <= 2:
            tags.append({
                "tag": "MICRO_CLUSTER",
                "severity": "medium",
                "description": (
                    f"Belongs to a cluster of only {cluster_size} entities"
                ),
            })

        # High cluster flips (instability)
        if flips >= 5:
            tags.append({
                "tag": "UNSTABLE_ASSIGNMENT",
                "severity": "high",
                "description": (
                    f"Cluster assignment changed {flips} times (unstable)"
                ),
            })
        elif flips >= 3:
            tags.append({
                "tag": "VOLATILE_ASSIGNMENT",
                "severity": "medium",
                "description": (
                    f"Cluster assignment changed {flips} times"
                ),
            })

        # Anomaly score
        anomaly_score = scores.get("anomaly_score", 0)
        if anomaly_score > 0.95:
            tags.append({
                "tag": "STATISTICAL_OUTLIER",
                "severity": "critical",
                "description": (
                    f"Anomaly score {anomaly_score:.3f} exceeds critical threshold"
                ),
            })
        elif anomaly_score > 0.8:
            tags.append({
                "tag": "ANOMALOUS",
                "severity": "high",
                "description": (
                    f"Anomaly score {anomaly_score:.3f} exceeds high threshold"
                ),
            })

        # Missing data quality signal
        missing_count = sum(1 for v in attrs.values() if v is None or v == "")
        total_count = len(attrs)
        if total_count > 0 and missing_count / total_count > 0.5:
            tags.append({
                "tag": "SPARSE_DATA",
                "severity": "info",
                "description": (
                    f"{missing_count}/{total_count} attributes are empty or null"
                ),
            })

        if not tags:
            tags.append({
                "tag": "NORMAL",
                "severity": "info",
                "description": "No anomalies detected",
            })

        return tags

    # ------------------------------------------------------------------ #
    #  Delegated suggestions
    # ------------------------------------------------------------------ #

    def suggest_entity_types(self) -> list[EntityTypeConfig]:
        """Delegate to SchemaIntrospector for smarter heuristics."""
        schema = self.introspect_schema()
        return self._introspector.suggest_entity_types(schema)

    def suggest_relationships(self) -> list[RelationshipSuggestion]:
        """Delegate to SchemaIntrospector."""
        schema = self.introspect_schema()
        return self._introspector.suggest_relationships(schema)
