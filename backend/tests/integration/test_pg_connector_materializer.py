"""Integration tests for PostgreSQL connector and materializer.

Requires a running PostgreSQL instance at localhost:5432 with the
``latent_intelligence`` database (created by alembic migrations).

Run with::

    pytest backend/tests/integration/ -m integration -v

Tests are automatically skipped when the database is unreachable.
"""
from __future__ import annotations

import pytest
from sqlalchemy import text

from engine.connectors.base import ConnectorConfig, SchemaMap
from engine.connectors.drivers.postgresql import PostgreSQLConnector
from engine.connectors.generic.schema_introspector import SchemaIntrospector
from engine.materializer import MaterializerConfig
from engine.materializer.drivers.postgresql import PostgreSQLMaterializer
from engine.materializer.table_schemas import MATERIALIZED_TABLES

from .conftest import PG_DSN, TEST_SCHEMA

pytestmark = pytest.mark.integration


# ── Schema Introspection ─────────────────────────────────────────────


class TestSchemaIntrospection:
    """Verify SchemaIntrospector against the live database."""

    def test_introspect_finds_tables(self, pg_dsn):
        """introspect_schema() returns a SchemaMap with known tables."""
        connector = PostgreSQLConnector(pg_dsn)
        schema = connector.introspect_schema()

        assert isinstance(schema, SchemaMap)
        assert len(schema.tables) > 0

        table_names = {t.name for t in schema.tables}
        # These tables should exist from alembic migrations
        for expected in ("users", "datasets", "organizations"):
            if expected not in table_names:
                # Not a hard failure — migrations may vary
                pytest.skip(
                    f"Table '{expected}' not found; "
                    f"available: {sorted(table_names)}"
                )

    def test_introspect_returns_columns(self, pg_dsn):
        """Each table in the schema has at least one column."""
        connector = PostgreSQLConnector(pg_dsn)
        schema = connector.introspect_schema()

        for table in schema.tables:
            assert len(table.columns) > 0, (
                f"Table '{table.name}' has no columns"
            )

    def test_introspect_detects_foreign_keys(self, pg_dsn):
        """Foreign keys are extracted from the schema."""
        connector = PostgreSQLConnector(pg_dsn)
        schema = connector.introspect_schema()

        # At least some tables should have FK relationships
        # (users -> organizations, datasets -> users, etc.)
        if not schema.foreign_keys:
            pytest.skip("No foreign keys found in schema")

        for fk in schema.foreign_keys:
            assert "from_table" in fk
            assert "from_col" in fk
            assert "to_table" in fk
            assert "to_col" in fk

    def test_suggest_entity_types(self, pg_dsn):
        """suggest_entity_types() returns non-empty results."""
        connector = PostgreSQLConnector(pg_dsn)
        entity_types = connector.suggest_entity_types()

        assert len(entity_types) > 0
        for et in entity_types:
            assert et.name, "Entity type name must not be empty"
            assert et.color, "Entity type color must not be empty"
            assert et.primary_field, "Primary field must not be empty"


# ── Entity Fetching ──────────────────────────────────────────────────


class TestEntityFetching:
    """Verify entity fetching from the live database."""

    def test_fetch_entities_returns_list(self, pg_dsn):
        """fetch_entities() returns a list of dicts."""
        connector = PostgreSQLConnector(pg_dsn)
        entities = connector.fetch_entities(limit=100)

        assert isinstance(entities, list)
        # May be empty if tables have no data, but should not crash
        if not entities:
            pytest.skip("No entities found (empty tables)")

    def test_entity_format(self, pg_dsn):
        """Each entity has {name, type, attributes} keys."""
        connector = PostgreSQLConnector(pg_dsn)
        entities = connector.fetch_entities(limit=100)

        if not entities:
            pytest.skip("No entities found")

        for entity in entities[:10]:  # Spot-check first 10
            assert "name" in entity, f"Entity missing 'name': {entity}"
            assert "type" in entity, f"Entity missing 'type': {entity}"
            assert "attributes" in entity, f"Entity missing 'attributes': {entity}"
            assert isinstance(entity["attributes"], dict)

    def test_fetch_entities_respects_limit(self, pg_dsn):
        """fetch_entities() does not return more than the requested limit."""
        connector = PostgreSQLConnector(pg_dsn)
        entities = connector.fetch_entities(limit=5)
        assert len(entities) <= 5

    def test_fetch_entities_handles_empty_tables(self, pg_dsn):
        """fetch_entities() does not crash when tables are empty."""
        connector = PostgreSQLConnector(pg_dsn)
        # Even with a very small limit, should not error
        entities = connector.fetch_entities(limit=1)
        assert isinstance(entities, list)


# ── Edge Inference ───────────────────────────────────────────────────


class TestEdgeInference:
    """Verify edge inference from FK relationships."""

    def test_fetch_edges_returns_list(self, pg_dsn):
        """fetch_edges() returns a list of dicts."""
        connector = PostgreSQLConnector(pg_dsn)
        entities = connector.fetch_entities(limit=100)
        edges = connector.fetch_edges(entities)

        assert isinstance(edges, list)

    def test_edge_format(self, pg_dsn):
        """Each edge has {source, target, type, weight} keys."""
        connector = PostgreSQLConnector(pg_dsn)
        entities = connector.fetch_entities(limit=100)
        edges = connector.fetch_edges(entities)

        if not edges:
            pytest.skip("No edges inferred (no FK relationships with data)")

        for edge in edges[:10]:
            assert "source" in edge, f"Edge missing 'source': {edge}"
            assert "target" in edge, f"Edge missing 'target': {edge}"
            assert "type" in edge, f"Edge missing 'type': {edge}"
            assert "weight" in edge, f"Edge missing 'weight': {edge}"


# ── Materializer ─────────────────────────────────────────────────────


class TestMaterializer:
    """Verify materializer creates tables and writes data."""

    def test_initialize_creates_tables(self, pg_dsn, test_schema, pg_engine):
        """initialize() creates all 7 lo_* tables in the test schema."""
        config = MaterializerConfig(
            connection_string=pg_dsn,
            schema_name=test_schema,
            incremental=True,
        )
        mat = PostgreSQLMaterializer(config)
        mat.initialize()

        # Verify tables exist
        with pg_engine.connect() as conn:
            result = conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = :schema ORDER BY table_name"
                ),
                {"schema": test_schema},
            )
            tables = {row[0] for row in result.fetchall()}

        expected_tables = set(MATERIALIZED_TABLES.keys())
        assert expected_tables.issubset(tables), (
            f"Missing tables: {expected_tables - tables}"
        )

    def test_materialize_survivors(self, pg_dsn, test_schema, pg_engine):
        """materialize_survivors() writes rows to lo_survivors."""
        config = MaterializerConfig(
            connection_string=pg_dsn,
            schema_name=test_schema,
            incremental=True,
        )
        mat = PostgreSQLMaterializer(config)
        mat.initialize()

        # Synthetic survivor data
        survivors = [
            {
                "entity": {"name": f"test_entity_{i}", "type": "test", "attributes": {"val": i}},
                "cluster": i % 3,
                "scores": {
                    "composite": 0.5 + i * 0.1,
                    "diversity": 0.3,
                    "reconstruction": 0.8,
                    "anomaly": 0.1,
                },
                "fingerprint": f"fp_{i:048b}"[:48],
                "coord_8d": [0.1 * j for j in range(8)],
                "coord_3d": [0.1 * j for j in range(3)],
                "display_name": f"Test Entity {i}",
            }
            for i in range(5)
        ]

        count = mat.materialize_survivors(survivors, summary={})
        assert count == 5

        # Verify data in database
        with pg_engine.connect() as conn:
            result = conn.execute(
                text(f"SELECT COUNT(*) FROM {test_schema}.lo_survivors")
            )
            assert result.fetchone()[0] == 5

    def test_materialize_quality(self, pg_dsn, test_schema, pg_engine):
        """materialize_quality() writes quality metrics."""
        config = MaterializerConfig(
            connection_string=pg_dsn,
            schema_name=test_schema,
            incremental=True,
        )
        mat = PostgreSQLMaterializer(config)
        mat.initialize()

        quality = {
            "n_input": 1000,
            "n_survivors": 100,
            "reduction_ratio": 10,
            "variance_ratio": 0.95,
            "coverage_at_1_0": 0.88,
            "reconstruction_median_nn": 0.12,
            "n_clusters": 5,
            "unique_fingerprints": 90,
            "wall_seconds": 3.5,
            "estimated_cost_usd": 0.02,
            "cost_breakdown": {"gpu": 0.01, "memory": 0.01},
        }
        count = mat.materialize_quality(quality, run_id="test_run_001")
        assert count == 1

        with pg_engine.connect() as conn:
            result = conn.execute(
                text(f"SELECT run_id, n_input FROM {test_schema}.lo_quality")
            )
            row = result.fetchone()
            assert row is not None
            assert row[0] == "test_run_001"
            assert row[1] == 1000

    def test_materialize_connections(self, pg_dsn, test_schema, pg_engine):
        """materialize_connections() writes connection rows."""
        config = MaterializerConfig(
            connection_string=pg_dsn,
            schema_name=test_schema,
            incremental=True,
        )
        mat = PostgreSQLMaterializer(config)
        mat.initialize()

        # First ensure survivors exist (FK constraint)
        survivors = [
            {
                "entity": {"name": f"conn_entity_{i}", "type": "test", "attributes": {}},
                "cluster": 0,
                "scores": {"composite": 0.5, "diversity": 0.3, "reconstruction": 0.8, "anomaly": 0.1},
                "fingerprint": "fp",
                "coord_8d": [0.0] * 8,
                "coord_3d": [0.0] * 3,
                "display_name": f"Entity {i}",
            }
            for i in range(2)
        ]
        mat.materialize_survivors(survivors, summary={})

        connections = [
            {
                "source_a": "conn_entity_0",
                "source_b": "conn_entity_1",
                "signal": "cosine",
                "strength": 0.85,
            }
        ]
        count = mat.materialize_connections(connections)
        assert count == 1

    def test_materialize_clusters(self, pg_dsn, test_schema, pg_engine):
        """materialize_clusters() writes cluster summary rows."""
        config = MaterializerConfig(
            connection_string=pg_dsn,
            schema_name=test_schema,
            incremental=True,
        )
        mat = PostgreSQLMaterializer(config)
        mat.initialize()

        clusters = [
            {
                "cluster_id": 0,
                "label": "cluster_0",
                "member_count": 3,
                "top_entities": ["a", "b", "c"],
                "coherence_score": 0.9,
            },
            {
                "cluster_id": 1,
                "label": "cluster_1",
                "member_count": 2,
                "top_entities": ["d", "e"],
                "coherence_score": 0.75,
            },
        ]
        count = mat.materialize_clusters(clusters)
        assert count == 2

    def test_dsn_normalization(self):
        """_normalize_dsn strips asyncpg driver from connection string."""
        assert PostgreSQLMaterializer._normalize_dsn(
            "postgresql+asyncpg://user:pass@host/db"
        ) == "postgresql://user:pass@host/db"

        assert PostgreSQLMaterializer._normalize_dsn(
            "postgresql://user:pass@host/db"
        ) == "postgresql://user:pass@host/db"


# ── Full Pipeline (Connector -> Materializer) ────────────────────────


class TestFullPipeline:
    """End-to-end: fetch from DB, materialize back."""

    def test_fetch_and_materialize(self, pg_dsn, test_schema, pg_engine):
        """Fetch entities from the live DB and materialize them."""
        connector = PostgreSQLConnector(pg_dsn)
        entities = connector.fetch_entities(limit=50)

        if not entities:
            pytest.skip("No entities to materialize")

        # Build synthetic survivor records from fetched entities
        survivors = []
        for i, entity in enumerate(entities[:10]):
            survivors.append({
                "entity": entity,
                "cluster": i % 3,
                "scores": {
                    "composite": 0.5,
                    "diversity": 0.3,
                    "reconstruction": 0.8,
                    "anomaly": 0.1,
                },
                "fingerprint": f"fp_{i:012x}",
                "coord_8d": [0.1] * 8,
                "coord_3d": [0.2] * 3,
                "display_name": str(entity.get("name", "")),
            })

        config = MaterializerConfig(
            connection_string=pg_dsn,
            schema_name=test_schema,
            incremental=True,
        )
        mat = PostgreSQLMaterializer(config)
        mat.initialize()

        count = mat.materialize_survivors(survivors, summary={})
        assert count == len(survivors)

        # Verify in DB
        with pg_engine.connect() as conn:
            result = conn.execute(
                text(f"SELECT COUNT(*) FROM {test_schema}.lo_survivors")
            )
            db_count = result.fetchone()[0]
            assert db_count >= len(survivors)

        # Write quality metrics
        quality = {
            "n_input": len(entities),
            "n_survivors": len(survivors),
            "reduction_ratio": max(len(entities) // max(len(survivors), 1), 1),
            "variance_ratio": 0.95,
            "coverage_at_1_0": 0.88,
            "reconstruction_median_nn": 0.12,
            "n_clusters": 3,
            "unique_fingerprints": len(survivors),
            "wall_seconds": 1.0,
            "estimated_cost_usd": 0.01,
            "cost_breakdown": {},
        }
        q_count = mat.materialize_quality(quality, run_id="integration_test_run")
        assert q_count == 1

        with pg_engine.connect() as conn:
            result = conn.execute(
                text(
                    f"SELECT n_input, n_survivors FROM {test_schema}.lo_quality "
                    f"WHERE run_id = 'integration_test_run'"
                )
            )
            row = result.fetchone()
            assert row is not None
            assert row[0] == len(entities)
