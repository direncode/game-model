"""Snowflake connector — connect to Snowflake data warehouse."""
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


class SnowflakeConnector(BaseConnector):
    """Connect to Snowflake warehouses.

    Uses ``snowflake-connector-python`` for direct connections or
    SQLAlchemy with Snowflake dialect.

    Requires: ``pip install snowflake-connector-python``

    Usage::

        connector = SnowflakeConnector(
            account="myorg-myaccount",
            user="user",
            password="pass",
            database="MY_DB",
            schema="PUBLIC",
            warehouse="COMPUTE_WH",
        )

        # Or via connection string:
        connector = SnowflakeConnector(
            connection_string="snowflake://user:pass@account/db/schema?warehouse=wh"
        )
    """

    def __init__(
        self,
        account: str | None = None,
        user: str | None = None,
        password: str | None = None,
        database: str | None = None,
        schema: str = "PUBLIC",
        warehouse: str | None = None,
        role: str | None = None,
        connection_string: str | None = None,
        config: ConnectorConfig | None = None,
    ) -> None:
        try:
            import snowflake.connector as sf  # noqa: F401
            self._sf = sf
        except ImportError:
            raise ImportError(
                "snowflake-connector-python is required for Snowflake support. "
                "Install with: pip install snowflake-connector-python"
            )

        self._connection_string = connection_string
        self._account = account
        self._user = user
        self._password = password
        self._database = database or ""
        self._sf_schema = schema
        self._warehouse = warehouse
        self._role = role
        self._conn = None
        self._schema_map: SchemaMap | None = None

        # Parse connection string if provided
        if connection_string and not account:
            self._parse_connection_string(connection_string)

        _config = config or ConnectorConfig(
            name="snowflake",
            driver="snowflake",
            connection_string=connection_string or f"snowflake://{account}/{database}",
        )
        super().__init__(_config)

    def _parse_connection_string(self, conn_str: str) -> None:
        """Parse snowflake://user:pass@account/database/schema?warehouse=wh."""
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(conn_str)
        self._user = parsed.username or self._user
        self._password = parsed.password or self._password
        self._account = parsed.hostname or self._account

        path_parts = [p for p in parsed.path.split("/") if p]
        if len(path_parts) >= 1:
            self._database = path_parts[0]
        if len(path_parts) >= 2:
            self._sf_schema = path_parts[1]

        qs = parse_qs(parsed.query)
        if "warehouse" in qs:
            self._warehouse = qs["warehouse"][0]
        if "role" in qs:
            self._role = qs["role"][0]

    def _get_connection(self):
        """Lazy-initialize Snowflake connection."""
        if self._conn is not None:
            return self._conn

        connect_kwargs: dict[str, Any] = {
            "account": self._account,
            "user": self._user,
            "password": self._password,
            "database": self._database,
            "schema": self._sf_schema,
            "login_timeout": 15,
            "network_timeout": 30,
        }
        if self._warehouse:
            connect_kwargs["warehouse"] = self._warehouse
        if self._role:
            connect_kwargs["role"] = self._role

        self._conn = self._sf.connect(**connect_kwargs)
        return self._conn

    def _execute(self, sql: str, params: dict | None = None) -> list[tuple]:
        """Execute a SQL query and return rows."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
            return cursor.fetchall()
        finally:
            cursor.close()

    def _execute_dict(self, sql: str, params: dict | None = None) -> list[dict]:
        """Execute and return rows as dicts."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
            columns = [desc[0].lower() for desc in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
        finally:
            cursor.close()

    # ------------------------------------------------------------------ #
    #  Schema introspection
    # ------------------------------------------------------------------ #

    def introspect_schema(self) -> SchemaMap:
        if self._schema_map is not None:
            return self._schema_map

        tables: list[TableInfo] = []
        all_foreign_keys: list[dict] = []

        # Get tables
        table_rows = self._execute_dict(
            f"SHOW TABLES IN SCHEMA {self._database}.{self._sf_schema}"
        )

        for trow in table_rows:
            table_name = trow.get("name", "")
            row_count = int(trow.get("rows", 0))

            # Get columns
            col_rows = self._execute_dict(f'DESCRIBE TABLE "{self._database}"."{self._sf_schema}"."{table_name}"')

            columns: list[ColumnInfo] = []
            for crow in col_rows:
                col_name = crow.get("name", "").lower()
                col_type = crow.get("type", "").lower()
                nullable = crow.get("null?", "Y") == "Y"
                is_pk = crow.get("primary key", "N") == "Y"

                columns.append(
                    ColumnInfo(
                        name=col_name,
                        dtype=col_type,
                        nullable=nullable,
                        is_primary_key=is_pk,
                        is_foreign_key=False,
                        references="",
                    )
                )

            tables.append(
                TableInfo(
                    name=table_name.lower(),
                    schema=self._sf_schema,
                    columns=columns,
                    row_count_estimate=row_count,
                )
            )

        # Get foreign keys from information_schema
        try:
            fk_rows = self._execute_dict(
                "SELECT fk.TABLE_NAME as from_table, "
                "fk.COLUMN_NAME as from_col, "
                "pk.TABLE_NAME as to_table, "
                "pk.COLUMN_NAME as to_col "
                f"FROM {self._database}.INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc "
                f"JOIN {self._database}.INFORMATION_SCHEMA.KEY_COLUMN_USAGE fk "
                "ON rc.CONSTRAINT_NAME = fk.CONSTRAINT_NAME "
                f"JOIN {self._database}.INFORMATION_SCHEMA.KEY_COLUMN_USAGE pk "
                "ON rc.UNIQUE_CONSTRAINT_NAME = pk.CONSTRAINT_NAME "
                f"WHERE fk.TABLE_SCHEMA = '{self._sf_schema}'"
            )
            for fkr in fk_rows:
                fk_entry = {
                    "from_table": fkr["from_table"].lower(),
                    "from_col": fkr["from_col"].lower(),
                    "to_table": fkr["to_table"].lower(),
                    "to_col": fkr["to_col"].lower(),
                }
                all_foreign_keys.append(fk_entry)
                # Mark FK columns
                for t in tables:
                    if t.name == fk_entry["from_table"]:
                        for c in t.columns:
                            if c.name == fk_entry["from_col"]:
                                c.is_foreign_key = True
                                c.references = f"{fk_entry['to_table']}.{fk_entry['to_col']}"
        except Exception:
            logger.debug("Could not fetch foreign keys from Snowflake information_schema")

        self._schema_map = SchemaMap(tables=tables, foreign_keys=all_foreign_keys)
        logger.info(
            "Introspected Snowflake: %d tables, %d foreign keys",
            len(tables),
            len(all_foreign_keys),
        )
        return self._schema_map

    # ------------------------------------------------------------------ #
    #  DatasetMeta
    # ------------------------------------------------------------------ #

    def get_meta(self) -> DatasetMeta:
        schema = self.introspect_schema()
        entity_types = self.suggest_entity_types()

        return DatasetMeta(
            dataset_id=f"snowflake:{self._database}",
            display_name=f"Snowflake: {self._database}.{self._sf_schema}",
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
        from ..generic.entity_mapper import EntityMapper
        mapper = EntityMapper()

        total_rows = sum(t.row_count_estimate for t in schema.tables) or 1
        all_entities: list[dict] = []

        for table in schema.tables:
            if len(all_entities) >= limit:
                break

            table_limit = max(100, int(limit * (table.row_count_estimate / total_rows)))
            table_limit = min(table_limit, limit - len(all_entities))

            try:
                rows = self._execute_dict(
                    f'SELECT * FROM "{self._database}"."{self._sf_schema}"."{table.name.upper()}" '
                    f"LIMIT {table_limit}"
                )

                for row in rows:
                    for key, value in list(row.items()):
                        if isinstance(value, (dict, list)):
                            row[key] = json.dumps(value, default=str)

                entities = mapper.map_rows(table.name, rows)
                all_entities.extend(entities)
            except Exception:
                logger.exception("Failed to fetch from Snowflake table %s", table.name)

        logger.info("Fetched %d entities from Snowflake", len(all_entities))
        return all_entities

    # ------------------------------------------------------------------ #
    #  Edge inference
    # ------------------------------------------------------------------ #

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        schema = self.introspect_schema()
        from ..generic.edge_inferrer import EdgeInferrer
        inferrer = EdgeInferrer()

        tables_needed: set[str] = set()
        for fk in schema.foreign_keys:
            tables_needed.add(fk["from_table"])

        rows_by_table: dict[str, list[dict]] = {}
        for table_name in tables_needed:
            try:
                rows = self._execute_dict(
                    f'SELECT * FROM "{self._database}"."{self._sf_schema}"."{table_name.upper()}" '
                    f"LIMIT 50000"
                )
                for row in rows:
                    for key, value in list(row.items()):
                        if isinstance(value, (dict, list)):
                            row[key] = json.dumps(value, default=str)
                rows_by_table[table_name] = rows
            except Exception:
                logger.exception("Failed to fetch edges from Snowflake table %s", table_name)
                rows_by_table[table_name] = []

        edges = inferrer.infer_edges(entities, schema, rows_by_table)
        logger.info("Inferred %d edges from Snowflake", len(edges))
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
