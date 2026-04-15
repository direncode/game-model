"""MySQL connector — auto-detect schema from MySQL/MariaDB databases."""
from __future__ import annotations

import json
import logging
from typing import Any

from ..base import (
    BaseConnector,
    ColumnInfo,
    ConnectorConfig,
    DatasetMeta,
    EntityTypeConfig,
    SchemaMap,
    TableInfo,
)

logger = logging.getLogger(__name__)


def _singularize(name: str) -> str:
    if not name:
        return name
    lower = name.lower()
    if lower.endswith("ies") and len(lower) > 3:
        return name[:-3] + "y"
    if lower.endswith("s") and not lower.endswith("ss"):
        return name[:-1]
    return name


class MySQLConnector(BaseConnector):
    """Connect to MySQL/MariaDB databases.

    Uses SQLAlchemy with ``mysql+pymysql`` driver.

    Requires ``sqlalchemy`` and ``pymysql``.
    Install with: ``pip install sqlalchemy pymysql``

    Usage::

        connector = MySQLConnector("mysql+pymysql://user:pass@host/db")
        connector = MySQLConnector("mysql://user:pass@host/db")
    """

    def __init__(
        self,
        connection_string: str,
        config: ConnectorConfig | None = None,
    ) -> None:
        try:
            from sqlalchemy import create_engine, inspect, text  # noqa: F401
            self._sa_create_engine = create_engine
            self._sa_inspect = inspect
            self._sa_text = text
        except ImportError:
            raise ImportError(
                "sqlalchemy and pymysql are required for MySQL support. "
                "Install with: pip install sqlalchemy pymysql"
            )

        self._dsn = self._normalize_dsn(connection_string)
        _config = config or ConnectorConfig(
            name="mysql",
            driver="mysql",
            connection_string=connection_string,
        )
        super().__init__(_config)

        self._schema: SchemaMap | None = None
        self._engine = None
        self._db_name = self._dsn.rsplit("/", 1)[-1].split("?")[0]

    @staticmethod
    def _normalize_dsn(dsn: str) -> str:
        """Ensure the DSN uses the mysql+pymysql dialect."""
        if dsn.startswith("mysql://"):
            dsn = dsn.replace("mysql://", "mysql+pymysql://", 1)
        elif dsn.startswith("mysql+") and "+pymysql" not in dsn:
            # Replace other drivers with pymysql
            dsn = "mysql+pymysql://" + dsn.split("://", 1)[1]
        return dsn

    def _get_engine(self):
        if self._engine is None:
            self._engine = self._sa_create_engine(
                self._dsn,
                connect_args={"connect_timeout": 10},
            )
        return self._engine

    # ------------------------------------------------------------------ #
    #  Schema introspection
    # ------------------------------------------------------------------ #

    def introspect_schema(self) -> SchemaMap:
        if self._schema is not None:
            return self._schema

        engine = self._get_engine()
        insp = self._sa_inspect(engine)

        tables: list[TableInfo] = []
        all_foreign_keys: list[dict] = []

        table_names = insp.get_table_names()
        logger.info("Found %d tables in MySQL database '%s'", len(table_names), self._db_name)

        for table_name in table_names:
            raw_columns = insp.get_columns(table_name)
            pk_constraint = insp.get_pk_constraint(table_name)
            pk_cols = set(pk_constraint.get("constrained_columns", []))
            fk_list = insp.get_foreign_keys(table_name)

            fk_map: dict[str, str] = {}
            for fk in fk_list:
                referred_table = fk["referred_table"]
                for local_col, ref_col in zip(
                    fk["constrained_columns"], fk["referred_columns"]
                ):
                    fk_map[local_col] = f"{referred_table}.{ref_col}"
                    all_foreign_keys.append({
                        "from_table": table_name,
                        "from_col": local_col,
                        "to_table": referred_table,
                        "to_col": ref_col,
                    })

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

            # Row count estimate
            row_count = self._estimate_row_count(table_name)

            tables.append(
                TableInfo(
                    name=table_name,
                    schema=self._db_name,
                    columns=columns,
                    row_count_estimate=row_count,
                )
            )

        self._schema = SchemaMap(tables=tables, foreign_keys=all_foreign_keys)
        return self._schema

    def _estimate_row_count(self, table_name: str) -> int:
        """Estimate row count using information_schema."""
        engine = self._get_engine()
        try:
            with engine.connect() as conn:
                result = conn.execute(
                    self._sa_text(
                        "SELECT TABLE_ROWS FROM information_schema.TABLES "
                        "WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :tbl"
                    ),
                    {"db": self._db_name, "tbl": table_name},
                )
                row = result.fetchone()
                return int(row[0]) if row and row[0] else 0
        except Exception:
            return 0

    # ------------------------------------------------------------------ #
    #  DatasetMeta
    # ------------------------------------------------------------------ #

    def get_meta(self) -> DatasetMeta:
        schema = self.introspect_schema()
        entity_types = self.suggest_entity_types()

        return DatasetMeta(
            dataset_id=f"mysql:{self._db_name}",
            display_name=f"MySQL: {self._db_name}",
            description=f"Auto-detected schema with {len(schema.tables)} tables",
            entity_types=entity_types,
            lookup_field="name",
            lookup_label="Entity",
        )

    # ------------------------------------------------------------------ #
    #  Entity fetching
    # ------------------------------------------------------------------ #

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        schema = self.introspect_schema()
        engine = self._get_engine()
        from ..generic.entity_mapper import EntityMapper
        mapper = EntityMapper()

        total_rows = sum(t.row_count_estimate for t in schema.tables) or 1
        all_entities: list[dict] = []

        for table in schema.tables:
            if len(all_entities) >= limit:
                break

            table_limit = max(100, int(limit * (table.row_count_estimate / total_rows)))
            table_limit = min(table_limit, limit - len(all_entities))

            pk_cols = [c.name for c in table.columns if c.is_primary_key]
            name_col = pk_cols[0] if pk_cols else (table.columns[0].name if table.columns else None)

            try:
                sql = f"SELECT * FROM `{table.name}` LIMIT :lim"
                with engine.connect() as conn:
                    result = conn.execute(self._sa_text(sql), {"lim": table_limit})
                    columns = list(result.keys())
                    rows = [dict(zip(columns, r)) for r in result.fetchall()]

                for row in rows:
                    for key, value in row.items():
                        if isinstance(value, (dict, list)):
                            row[key] = json.dumps(value, default=str)

                entities = mapper.map_rows(table.name, rows)
                all_entities.extend(entities)
            except Exception:
                logger.exception("Failed to fetch from MySQL table %s", table.name)

        logger.info("Fetched %d entities from MySQL", len(all_entities))
        return all_entities

    # ------------------------------------------------------------------ #
    #  Edge inference
    # ------------------------------------------------------------------ #

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        schema = self.introspect_schema()
        engine = self._get_engine()
        from ..generic.edge_inferrer import EdgeInferrer
        inferrer = EdgeInferrer()

        tables_needed: set[str] = set()
        for fk in schema.foreign_keys:
            tables_needed.add(fk["from_table"])

        rows_by_table: dict[str, list[dict]] = {}
        for table_name in tables_needed:
            try:
                with engine.connect() as conn:
                    result = conn.execute(
                        self._sa_text(f"SELECT * FROM `{table_name}` LIMIT 50000")
                    )
                    columns = list(result.keys())
                    rows = [dict(zip(columns, r)) for r in result.fetchall()]
                    for row in rows:
                        for key, value in row.items():
                            if isinstance(value, (dict, list)):
                                row[key] = json.dumps(value, default=str)
                    rows_by_table[table_name] = rows
            except Exception:
                logger.exception("Failed to fetch edges from MySQL table %s", table_name)
                rows_by_table[table_name] = []

        edges = inferrer.infer_edges(entities, schema, rows_by_table)
        logger.info("Inferred %d edges from MySQL", len(edges))
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
        from .csv_connector import _generic_anomaly_tags
        return _generic_anomaly_tags(record, scores, cluster_size, flips)
