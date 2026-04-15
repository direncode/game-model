"""Unit tests for SQLWriter and materializer table schemas.

These tests verify DDL/DML generation without any database connection.
They ensure the generated SQL is syntactically valid and contains
the expected clauses.
"""
from __future__ import annotations

import re

import pytest

from engine.materializer.table_schemas import (
    MATERIALIZED_TABLES,
    get_column_names,
    get_insertable_columns,
    get_table_names,
)
from engine.materializer.writer import SQLWriter


# ── SQLWriter.generate_create_schema() ────────────────────────────────


class TestGenerateCreateSchema:
    """Test CREATE SCHEMA statement generation."""

    def test_basic_schema(self):
        w = SQLWriter()
        sql = w.generate_create_schema("latent_ocean")
        assert sql == "CREATE SCHEMA IF NOT EXISTS latent_ocean"

    def test_custom_schema(self):
        w = SQLWriter()
        sql = w.generate_create_schema("my_custom_schema")
        assert "my_custom_schema" in sql
        assert "IF NOT EXISTS" in sql


# ── SQLWriter.generate_create_table() ────────────────────────────────


class TestGenerateCreateTable:
    """Test CREATE TABLE statement generation."""

    def test_all_tables_generate_valid_ddl(self):
        """Every table in MATERIALIZED_TABLES produces valid-looking DDL."""
        w = SQLWriter()
        for table_name, table_def in MATERIALIZED_TABLES.items():
            sql = w.generate_create_table("lo_test", table_name, table_def)

            assert sql.startswith("CREATE TABLE IF NOT EXISTS lo_test.")
            assert table_name in sql
            # Should contain column definitions
            assert "PRIMARY KEY" in sql or "TEXT" in sql
            # Should be balanced parentheses
            assert sql.count("(") == sql.count(")")

    def test_lo_survivors_ddl(self):
        """lo_survivors DDL contains expected columns."""
        w = SQLWriter()
        sql = w.generate_create_table("myschema", "lo_survivors")

        assert "entity_id TEXT PRIMARY KEY" in sql
        assert "entity_name TEXT" in sql
        assert "composite_score DOUBLE PRECISION" in sql
        assert "coord_8d JSONB" in sql
        assert "attributes JSONB" in sql
        assert "updated_at TIMESTAMP" in sql

    def test_lo_connections_ddl_has_foreign_keys(self):
        """lo_connections DDL includes FK constraints."""
        w = SQLWriter()
        sql = w.generate_create_table("myschema", "lo_connections")

        assert "FOREIGN KEY" in sql
        assert "source_entity_id" in sql
        assert "target_entity_id" in sql
        assert "ON DELETE CASCADE" in sql
        # FK references should use the correct schema
        assert "myschema.lo_survivors" in sql

    def test_lo_quality_ddl(self):
        """lo_quality DDL contains run metrics columns."""
        w = SQLWriter()
        sql = w.generate_create_table("myschema", "lo_quality")

        assert "run_id TEXT PRIMARY KEY" in sql
        assert "n_input INTEGER" in sql
        assert "variance_ratio DOUBLE PRECISION" in sql
        assert "cost_breakdown JSONB" in sql

    def test_unknown_table_raises(self):
        """generate_create_table() raises KeyError for unknown tables."""
        w = SQLWriter()
        with pytest.raises(KeyError, match="Unknown table"):
            w.generate_create_table("myschema", "nonexistent_table")


# ── SQLWriter.generate_upsert() ──────────────────────────────────────


class TestGenerateUpsert:
    """Test UPSERT (INSERT ON CONFLICT) statement generation."""

    def test_basic_upsert(self):
        w = SQLWriter()
        columns = ["entity_id", "entity_name", "score"]
        sql = w.generate_upsert("myschema", "lo_survivors", columns, "entity_id")

        assert "INSERT INTO myschema.lo_survivors" in sql
        assert "entity_id, entity_name, score" in sql
        assert ":entity_id, :entity_name, :score" in sql
        assert "ON CONFLICT (entity_id) DO UPDATE SET" in sql
        # The conflict column should NOT be in the UPDATE SET
        assert "entity_id = EXCLUDED.entity_id" not in sql
        # Other columns should be in the UPDATE SET
        assert "entity_name = EXCLUDED.entity_name" in sql
        assert "score = EXCLUDED.score" in sql

    def test_upsert_single_non_conflict_column(self):
        """UPSERT with only one non-conflict column."""
        w = SQLWriter()
        sql = w.generate_upsert("s", "t", ["pk", "val"], "pk")
        assert "val = EXCLUDED.val" in sql
        assert "pk = EXCLUDED.pk" not in sql

    def test_upsert_all_lo_tables(self):
        """Generate UPSERT for all materialized tables."""
        w = SQLWriter()
        for table_name, table_def in MATERIALIZED_TABLES.items():
            columns = [col[0] for col in table_def["columns"]]
            pk = table_def["primary_key"]

            sql = w.generate_upsert("myschema", table_name, columns, pk)
            assert "INSERT INTO" in sql
            assert "ON CONFLICT" in sql
            assert "DO UPDATE SET" in sql


# ── SQLWriter.generate_insert() ──────────────────────────────────────


class TestGenerateInsert:
    """Test plain INSERT statement generation."""

    def test_basic_insert(self):
        w = SQLWriter()
        sql = w.generate_insert("s", "t", ["a", "b", "c"])
        assert "INSERT INTO s.t (a, b, c)" in sql
        assert "VALUES (:a, :b, :c)" in sql
        assert "ON CONFLICT" not in sql

    def test_insert_single_column(self):
        w = SQLWriter()
        sql = w.generate_insert("s", "t", ["pk"])
        assert "INSERT INTO s.t (pk)" in sql
        assert "VALUES (:pk)" in sql


# ── SQLWriter.generate_truncate() ────────────────────────────────────


class TestGenerateTruncate:
    """Test TRUNCATE statement generation."""

    def test_truncate(self):
        w = SQLWriter()
        sql = w.generate_truncate("myschema", "lo_survivors")
        assert sql == "TRUNCATE TABLE myschema.lo_survivors CASCADE"


# ── SQLWriter.generate_create_all() ──────────────────────────────────


class TestGenerateCreateAll:
    """Test full DDL generation suite."""

    def test_create_all_ordering(self):
        """generate_create_all() returns statements in correct order."""
        w = SQLWriter()
        statements = w.generate_create_all("lo_test")

        # First statement: CREATE SCHEMA
        assert statements[0].startswith("CREATE SCHEMA")

        # Then CREATE TABLE statements
        create_tables = [s for s in statements if s.startswith("CREATE TABLE")]
        assert len(create_tables) == 7

        # Then CREATE INDEX statements
        create_indexes = [s for s in statements if s.startswith("CREATE INDEX")]
        assert len(create_indexes) > 0

        # Schema comes before tables which come before indexes
        schema_idx = 0
        first_table_idx = next(
            i for i, s in enumerate(statements) if s.startswith("CREATE TABLE")
        )
        first_index_idx = next(
            i for i, s in enumerate(statements) if s.startswith("CREATE INDEX")
        )
        assert schema_idx < first_table_idx < first_index_idx

    def test_create_all_has_all_tables(self):
        """generate_create_all() includes all 7 tables."""
        w = SQLWriter()
        statements = w.generate_create_all("lo_test")

        table_stmts = [s for s in statements if s.startswith("CREATE TABLE")]
        for table_name in MATERIALIZED_TABLES:
            found = any(table_name in s for s in table_stmts)
            assert found, f"Table '{table_name}' not found in DDL"


# ── SQLWriter.generate_indexes() ─────────────────────────────────────


class TestGenerateIndexes:
    """Test index statement generation."""

    def test_indexes_for_survivors(self):
        w = SQLWriter()
        indexes = w.generate_indexes("myschema", "lo_survivors")

        assert len(indexes) >= 3
        for idx in indexes:
            assert "CREATE INDEX IF NOT EXISTS" in idx
            assert "myschema.lo_survivors" in idx

    def test_unknown_table_raises(self):
        w = SQLWriter()
        with pytest.raises(KeyError, match="Unknown table"):
            w.generate_indexes("s", "nonexistent")


# ── Table schema helpers ──────────────────────────────────────────────


class TestTableSchemaHelpers:
    """Test helper functions from table_schemas module."""

    def test_get_table_names(self):
        names = get_table_names()
        assert len(names) == 7
        assert "lo_survivors" in names
        assert "lo_quality" in names

    def test_get_column_names(self):
        cols = get_column_names("lo_survivors")
        assert "entity_id" in cols
        assert "entity_name" in cols
        assert "composite_score" in cols

    def test_get_column_names_unknown_table(self):
        with pytest.raises(KeyError):
            get_column_names("nonexistent")

    def test_get_insertable_columns(self):
        cols = get_insertable_columns("lo_quality")
        assert "run_id" in cols
        assert "n_input" in cols

    def test_all_tables_have_primary_key(self):
        """Every materialized table defines a primary_key."""
        for name, defn in MATERIALIZED_TABLES.items():
            assert "primary_key" in defn, f"{name} missing primary_key"
            assert defn["primary_key"], f"{name} has empty primary_key"

    def test_all_tables_have_columns(self):
        """Every materialized table has at least one column."""
        for name, defn in MATERIALIZED_TABLES.items():
            assert len(defn["columns"]) > 0, f"{name} has no columns"

    def test_all_pk_columns_exist(self):
        """Each table's primary_key is present in its columns list."""
        for name, defn in MATERIALIZED_TABLES.items():
            pk = defn["primary_key"]
            col_names = [c[0] for c in defn["columns"]]
            assert pk in col_names, (
                f"{name}: primary_key '{pk}' not in columns {col_names}"
            )


# ── SQLWriter.generate_drop_table() / generate_count() ──────────────


class TestMiscStatements:
    """Test miscellaneous SQL generation."""

    def test_drop_table(self):
        w = SQLWriter()
        sql = w.generate_drop_table("myschema", "lo_survivors")
        assert sql == "DROP TABLE IF EXISTS myschema.lo_survivors CASCADE"

    def test_count(self):
        w = SQLWriter()
        sql = w.generate_count("myschema", "lo_survivors")
        assert sql == "SELECT COUNT(*) FROM myschema.lo_survivors"
