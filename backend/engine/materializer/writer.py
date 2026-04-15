"""SQL generation utilities for materializer drivers.

Generates DDL (CREATE SCHEMA, CREATE TABLE) and DML (UPSERT, TRUNCATE)
statements from the table schema definitions in ``table_schemas.py``.

The generated SQL targets PostgreSQL by default. Drivers for other
databases can subclass ``SQLWriter`` and override methods to adapt
syntax (e.g. MySQL's INSERT ON DUPLICATE KEY UPDATE).
"""
from __future__ import annotations

from .table_schemas import MATERIALIZED_TABLES


class SQLWriter:
    """Generate SQL statements for materializer operations.

    All methods return raw SQL strings. The caller is responsible for
    executing them against the target database via SQLAlchemy ``text()``
    or a raw cursor.
    """

    def generate_create_schema(self, schema_name: str) -> str:
        """Generate CREATE SCHEMA IF NOT EXISTS statement.

        Args:
            schema_name: The schema to create.

        Returns:
            SQL string.
        """
        return f"CREATE SCHEMA IF NOT EXISTS {schema_name}"

    def generate_create_table(
        self,
        schema: str,
        table_name: str,
        table_def: dict | None = None,
    ) -> str:
        """Generate CREATE TABLE IF NOT EXISTS statement.

        Args:
            schema: Target schema name.
            table_name: Table name (without schema prefix).
            table_def: Table definition from MATERIALIZED_TABLES.
                If None, looks up from the registry.

        Returns:
            SQL string with full CREATE TABLE statement.
        """
        if table_def is None:
            table_def = MATERIALIZED_TABLES.get(table_name)
            if table_def is None:
                raise KeyError(f"Unknown table: {table_name}")

        columns = table_def["columns"]
        foreign_keys = table_def.get("foreign_keys", [])

        col_lines = []
        for col_name, col_type in columns:
            col_lines.append(f"    {col_name} {col_type}")

        # Add foreign key constraints
        for fk in foreign_keys:
            fk_resolved = fk.format(schema=schema)
            col_lines.append(f"    {fk_resolved}")

        cols_sql = ",\n".join(col_lines)
        return (
            f"CREATE TABLE IF NOT EXISTS {schema}.{table_name} (\n"
            f"{cols_sql}\n"
            f")"
        )

    def generate_indexes(
        self,
        schema: str,
        table_name: str,
        table_def: dict | None = None,
    ) -> list[str]:
        """Generate CREATE INDEX statements for a table.

        Args:
            schema: Target schema name.
            table_name: Table name.
            table_def: Table definition. Looked up if None.

        Returns:
            List of SQL strings, one per index.
        """
        if table_def is None:
            table_def = MATERIALIZED_TABLES.get(table_name)
            if table_def is None:
                raise KeyError(f"Unknown table: {table_name}")

        indexes = table_def.get("indexes", [])
        return [idx.format(schema=schema) for idx in indexes]

    def generate_create_all(self, schema: str) -> list[str]:
        """Generate all DDL statements: schema, tables, indexes.

        Args:
            schema: Target schema name.

        Returns:
            Ordered list of SQL statements to execute sequentially.
        """
        statements = [self.generate_create_schema(schema)]

        # Tables first (order matters for FK references)
        table_order = [
            "lo_survivors",
            "lo_connections",
            "lo_anomalies",
            "lo_clusters",
            "lo_magnitude",
            "lo_quality",
            "lo_lineage",
        ]

        for table_name in table_order:
            table_def = MATERIALIZED_TABLES.get(table_name)
            if table_def is None:
                continue
            statements.append(
                self.generate_create_table(schema, table_name, table_def)
            )

        # Indexes after all tables
        for table_name in table_order:
            table_def = MATERIALIZED_TABLES.get(table_name)
            if table_def is None:
                continue
            statements.extend(
                self.generate_indexes(schema, table_name, table_def)
            )

        return statements

    def generate_upsert(
        self,
        schema: str,
        table_name: str,
        columns: list[str],
        conflict_column: str,
    ) -> str:
        """Generate an UPSERT (INSERT ON CONFLICT UPDATE) statement.

        Uses PostgreSQL's INSERT ... ON CONFLICT ... DO UPDATE syntax.

        Args:
            schema: Target schema name.
            table_name: Table name.
            columns: List of column names to insert.
            conflict_column: Column to detect conflicts on (usually PK).

        Returns:
            SQL string with :param placeholders for SQLAlchemy text().
        """
        placeholders = ", ".join(f":{col}" for col in columns)
        col_list = ", ".join(columns)

        # UPDATE SET for all non-conflict columns
        update_cols = [c for c in columns if c != conflict_column]
        update_set = ", ".join(
            f"{col} = EXCLUDED.{col}" for col in update_cols
        )

        sql = (
            f"INSERT INTO {schema}.{table_name} ({col_list})\n"
            f"VALUES ({placeholders})\n"
            f"ON CONFLICT ({conflict_column}) DO UPDATE SET\n"
            f"    {update_set}"
        )
        return sql

    def generate_insert(
        self,
        schema: str,
        table_name: str,
        columns: list[str],
    ) -> str:
        """Generate a plain INSERT statement (no conflict handling).

        Args:
            schema: Target schema name.
            table_name: Table name.
            columns: List of column names to insert.

        Returns:
            SQL string with :param placeholders.
        """
        placeholders = ", ".join(f":{col}" for col in columns)
        col_list = ", ".join(columns)
        return (
            f"INSERT INTO {schema}.{table_name} ({col_list})\n"
            f"VALUES ({placeholders})"
        )

    def generate_truncate(self, schema: str, table_name: str) -> str:
        """Generate a TRUNCATE TABLE statement.

        Args:
            schema: Target schema name.
            table_name: Table name.

        Returns:
            SQL string.
        """
        return f"TRUNCATE TABLE {schema}.{table_name} CASCADE"

    def generate_drop_table(self, schema: str, table_name: str) -> str:
        """Generate a DROP TABLE IF EXISTS statement.

        Args:
            schema: Target schema name.
            table_name: Table name.

        Returns:
            SQL string.
        """
        return f"DROP TABLE IF EXISTS {schema}.{table_name} CASCADE"

    def generate_count(self, schema: str, table_name: str) -> str:
        """Generate a SELECT COUNT(*) statement.

        Args:
            schema: Target schema name.
            table_name: Table name.

        Returns:
            SQL string.
        """
        return f"SELECT COUNT(*) FROM {schema}.{table_name}"
