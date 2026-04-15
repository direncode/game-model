"""Shared fixtures for integration tests.

Provides a PostgreSQL connectivity check that skips the entire test
module when the dev database is unreachable.
"""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

# Dev database DSN — matches the local docker-compose setup
PG_DSN = "postgresql://li:li@localhost:5432/latent_intelligence"
TEST_SCHEMA = "test_lo_integration"


def _pg_is_reachable(dsn: str = PG_DSN) -> bool:
    """Return True if the PostgreSQL server accepts a connection."""
    try:
        engine = create_engine(dsn)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        return True
    except Exception:
        return False


# Module-level skip marker
pytestmark = pytest.mark.integration


@pytest.fixture(scope="session")
def pg_dsn():
    """Return the dev DSN, skipping if the database is unreachable."""
    if not _pg_is_reachable():
        pytest.skip("PostgreSQL dev database not reachable at localhost:5432")
    return PG_DSN


@pytest.fixture(scope="session")
def pg_engine(pg_dsn):
    """Create a shared SQLAlchemy engine for the test session."""
    engine = create_engine(pg_dsn)
    yield engine
    engine.dispose()


@pytest.fixture(scope="module")
def test_schema(pg_engine):
    """Create and tear down the integration test schema.

    Creates ``test_lo_integration`` before tests and drops it after.
    """
    with pg_engine.begin() as conn:
        conn.execute(text(f"DROP SCHEMA IF EXISTS {TEST_SCHEMA} CASCADE"))
        conn.execute(text(f"CREATE SCHEMA {TEST_SCHEMA}"))

    yield TEST_SCHEMA

    with pg_engine.begin() as conn:
        conn.execute(text(f"DROP SCHEMA IF EXISTS {TEST_SCHEMA} CASCADE"))
