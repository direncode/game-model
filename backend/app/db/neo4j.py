"""Neo4j driver wrapper with connection pooling and FastAPI dependency."""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from typing import Any

from neo4j import AsyncGraphDatabase, AsyncDriver, AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)


class Neo4jConnection:
    """Manages a Neo4j async driver with convenience query methods."""

    def __init__(self) -> None:
        self._driver: AsyncDriver | None = None

    async def connect(self) -> None:
        """Initialise the Neo4j async driver (connection pool)."""
        if self._driver is not None:
            return
        self._driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
            max_connection_pool_size=50,
        )
        logger.info("Neo4j connection pool established at %s", settings.NEO4J_URI)

    async def close(self) -> None:
        """Gracefully close the driver and release all pooled connections."""
        if self._driver is not None:
            await self._driver.close()
            self._driver = None
            logger.info("Neo4j connection pool closed")

    @property
    def driver(self) -> AsyncDriver:
        if self._driver is None:
            raise RuntimeError("Neo4j driver not initialised — call connect() first")
        return self._driver

    def session(self, **kwargs: Any) -> AsyncSession:
        """Return a new Neo4j async session from the pool."""
        return self.driver.session(**kwargs)

    async def execute_query(
        self,
        query: str,
        parameters: dict[str, Any] | None = None,
        *,
        database: str | None = None,
    ) -> list[dict[str, Any]]:
        """Run a Cypher query and return a list of record dicts."""
        async with self.session(database=database) as session:
            result = await session.run(query, parameters or {})
            records = await result.data()
            return records

    async def verify_connectivity(self) -> bool:
        """Return True if the driver can reach the Neo4j server."""
        try:
            await self.driver.verify_connectivity()
            return True
        except Exception:
            logger.exception("Neo4j connectivity check failed")
            return False


# ── Module-level singleton ──────────────────────────────────────────
neo4j_connection = Neo4jConnection()


# ── FastAPI dependency ──────────────────────────────────────────────
async def get_neo4j() -> AsyncGenerator[Neo4jConnection, None]:
    """Yield the shared Neo4j connection instance."""
    if neo4j_connection._driver is None:
        await neo4j_connection.connect()
    yield neo4j_connection
