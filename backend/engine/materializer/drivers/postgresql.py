"""PostgreSQL materializer — writes lo_* tables to customer's PostgreSQL.

Uses SQLAlchemy Core with ``text()`` statements for all database operations.
Supports both incremental (UPSERT) and full-replace (TRUNCATE + INSERT) modes.

Creates a configurable schema (default: ``latent_ocean``) with tables:
    lo_survivors, lo_connections, lo_anomalies, lo_clusters,
    lo_magnitude, lo_quality, lo_lineage.

Example:
    >>> from engine.materializer import BaseMaterializer, MaterializerConfig
    >>> from engine.materializer.drivers import PostgreSQLMaterializer
    >>>
    >>> config = MaterializerConfig(
    ...     connection_string="postgresql://user:pass@host/db",
    ...     schema_name="latent_ocean",
    ... )
    >>> mat = PostgreSQLMaterializer(config)
    >>> mat.initialize()  # creates schema + tables
    >>> result = engine.run(connector, limit=10_000)
    >>> counts = mat.materialize_all(result)
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from ..base import BaseMaterializer, MaterializerConfig
from ..table_schemas import MATERIALIZED_TABLES
from ..writer import SQLWriter

logger = logging.getLogger(__name__)


class PostgreSQLMaterializer(BaseMaterializer):
    """Write engine results to PostgreSQL as native tables.

    Creates a ``latent_ocean`` schema (configurable) with all lo_* tables.
    Uses UPSERT (INSERT ON CONFLICT UPDATE) for incremental updates when
    ``config.incremental`` is True, otherwise TRUNCATE + INSERT.

    When ``config.dry_run`` is True, generates all SQL statements without
    connecting to any database. SQL is logged via logger.info() and
    collected in ``dry_run_statements`` for review.
    """

    def __init__(self, config: MaterializerConfig) -> None:
        super().__init__(config)
        self._engine: Engine | None = None
        self._writer = SQLWriter()
        self.dry_run_statements: list[str] = []

    # ── Connection management ─────────────────────────────────────────

    @staticmethod
    def _normalize_dsn(dsn: str) -> str:
        """Strip asyncpg driver suffix so SQLAlchemy uses the sync psycopg2 driver.

        Handles both ``postgresql+asyncpg://`` and embedded ``+asyncpg``.
        """
        if "+asyncpg" in dsn:
            dsn = dsn.replace("+asyncpg", "")
        return dsn

    @property
    def engine(self) -> Engine:
        """Lazy-create SQLAlchemy engine.

        Raises RuntimeError in dry_run mode to prevent accidental connections.
        """
        if self.config.dry_run:
            raise RuntimeError(
                "Cannot access database engine in dry_run mode. "
                "Dry-run only generates SQL without connecting."
            )
        if self._engine is None:
            dsn = self._normalize_dsn(self.config.connection_string)
            self._engine = create_engine(
                dsn,
                pool_size=5,
                max_overflow=10,
                pool_pre_ping=True,
                echo=False,
            )
        return self._engine

    def close(self) -> None:
        """Dispose of the connection pool."""
        if self._engine is not None:
            self._engine.dispose()
            self._engine = None

    # ── Schema setup ──────────────────────────────────────────────────

    def initialize(self) -> None:
        """Create the target schema and all lo_* tables.

        Idempotent: uses IF NOT EXISTS for schema and tables, then
        creates indexes. Safe to call on every fork startup.

        In dry_run mode, collects all DDL statements without executing them.

        Verifies schema writability before proceeding with table creation.
        Wraps each statement in try/except so a single index failure
        does not block the rest of initialization.
        """
        schema = self.config.schema_name
        statements = self._writer.generate_create_all(schema)

        # Dry-run: collect DDL without connecting
        if self.config.dry_run:
            for stmt in statements:
                logger.info("[pg-materializer][dry-run] DDL: %s", stmt)
                self.dry_run_statements.append(stmt)
            self._initialized = True
            logger.info(
                "[pg-materializer][dry-run] collected %d DDL statements "
                "for schema=%s",
                len(statements),
                schema,
            )
            return

        errors: list[str] = []
        with self.engine.begin() as conn:
            # First statement is CREATE SCHEMA — execute it and verify writability
            if statements:
                conn.execute(text(statements[0]))

            # Verify the schema is writable by checking current_user has USAGE
            try:
                result = conn.execute(
                    text(
                        "SELECT has_schema_privilege(current_user, :schema, 'CREATE')"
                    ),
                    {"schema": schema},
                )
                row = result.fetchone()
                if row and not row[0]:
                    raise PermissionError(
                        f"Current database user does not have CREATE privilege "
                        f"on schema '{schema}'"
                    )
            except PermissionError:
                raise
            except Exception:
                # If the privilege check itself fails (e.g. older PG), proceed
                logger.debug("Could not verify schema privileges, proceeding")

            # Execute remaining DDL statements (tables, indexes)
            for stmt in statements[1:]:
                try:
                    conn.execute(text(stmt))
                except Exception as exc:
                    logger.warning(
                        "[pg-materializer] DDL statement failed: %s — %s",
                        stmt[:80],
                        exc,
                    )
                    errors.append(str(exc))

        self._initialized = True
        if errors:
            logger.warning(
                "[pg-materializer] initialized with %d DDL errors", len(errors)
            )
        logger.info(
            "[pg-materializer] initialized schema=%s tables=%d",
            schema,
            len(MATERIALIZED_TABLES),
        )

    # ── Helpers ───────────────────────────────────────────────────────

    def _dry_run_collect(self, sql: str, rows: list[dict]) -> int:
        """Collect SQL + row data for dry_run mode without executing.

        Renders the SQL template with sample values for review and
        logs each statement.

        Returns:
            Number of rows that would have been written.
        """
        for row in rows:
            # Build a readable representation of the parameterized SQL
            rendered = sql
            for key, value in row.items():
                placeholder = f":{key}"
                if isinstance(value, str):
                    rendered = rendered.replace(placeholder, f"'{value}'", 1)
                elif value is None:
                    rendered = rendered.replace(placeholder, "NULL", 1)
                else:
                    rendered = rendered.replace(placeholder, str(value), 1)
            logger.info("[pg-materializer][dry-run] DML: %s", rendered)
            self.dry_run_statements.append(rendered)
        return len(rows)

    def _batch_execute(
        self,
        conn: Any,
        sql: str,
        rows: list[dict],
    ) -> int:
        """Execute a parameterized SQL statement in batches.

        In dry_run mode, collects rendered SQL without executing.

        Args:
            conn: SQLAlchemy connection (inside a transaction), or None
                when in dry_run mode.
            sql: SQL with :param placeholders.
            rows: List of param dicts.

        Returns:
            Total rows affected.
        """
        if self.config.dry_run:
            return self._dry_run_collect(sql, rows)

        total = 0
        batch_size = self.config.batch_size
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            conn.execute(text(sql), batch)
            total += len(batch)
        return total

    def _truncate_if_needed(self, conn: Any, table_name: str) -> None:
        """Truncate table if not in incremental mode.

        In dry_run mode, collects the TRUNCATE statement without executing.
        """
        if not self.config.incremental:
            sql = self._writer.generate_truncate(
                self.config.schema_name, table_name
            )
            if self.config.dry_run:
                logger.info("[pg-materializer][dry-run] DML: %s", sql)
                self.dry_run_statements.append(sql)
                return
            conn.execute(text(sql))

    @staticmethod
    def _json_serialize(value: Any) -> str | None:
        """Serialize a value to JSON string for JSONB columns."""
        if value is None:
            return None
        if isinstance(value, str):
            return value
        return json.dumps(value, default=str)

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _make_id() -> str:
        return str(uuid.uuid4())

    # ── Materializer implementations ──────────────────────────────────

    def materialize_survivors(
        self,
        survivors: list[dict],
        summary: dict,
    ) -> int:
        """Write survivor entities to lo_survivors.

        Maps Survivor fields to table columns:
            entity.name -> entity_id, entity_name
            entity.type -> entity_type
            cluster -> cluster_id
            scores.composite -> composite_score
            scores.diversity -> diversity_score
            scores.reconstruction -> reconstruction_score
            scores.anomaly -> anomaly_score
            fingerprint -> fingerprint_48bit
            coord_8d, coord_3d -> JSONB arrays
            entity.attributes -> attributes JSONB
        """
        if not survivors:
            return 0

        schema = self.config.schema_name
        columns = [
            "entity_id", "entity_name", "entity_type", "cluster_id",
            "composite_score", "diversity_score", "reconstruction_score",
            "anomaly_score", "fingerprint_48bit", "coord_8d", "coord_3d",
            "attributes", "narrative", "updated_at",
        ]

        if self.config.incremental:
            sql = self._writer.generate_upsert(
                schema, "lo_survivors", columns, "entity_id"
            )
        else:
            sql = self._writer.generate_insert(schema, "lo_survivors", columns)

        rows = []
        for s in survivors:
            entity = s.get("entity", {})
            scores = s.get("scores", {})
            rows.append({
                "entity_id": entity.get("name", self._make_id()),
                "entity_name": s.get("display_name", "") or entity.get("name", ""),
                "entity_type": entity.get("type", ""),
                "cluster_id": s.get("cluster", 0),
                "composite_score": scores.get("composite", 0.0),
                "diversity_score": scores.get("diversity", 0.0),
                "reconstruction_score": scores.get("reconstruction", 0.0),
                "anomaly_score": scores.get("anomaly", 0.0),
                "fingerprint_48bit": s.get("fingerprint", ""),
                "coord_8d": self._json_serialize(s.get("coord_8d")),
                "coord_3d": self._json_serialize(s.get("coord_3d")),
                "attributes": self._json_serialize(entity.get("attributes")),
                "narrative": scores.get("narrative", ""),
                "updated_at": self._now(),
            })

        if self.config.dry_run:
            self._truncate_if_needed(None, "lo_survivors")
            count = self._batch_execute(None, sql, rows)
        else:
            with self.engine.begin() as conn:
                self._truncate_if_needed(conn, "lo_survivors")
                count = self._batch_execute(conn, sql, rows)

        logger.info("[pg-materializer] lo_survivors: %d rows", count)
        return count

    def materialize_connections(self, connections: list[dict]) -> int:
        """Write causal links to lo_connections."""
        if not connections:
            return 0

        schema = self.config.schema_name
        columns = [
            "connection_id", "source_entity_id", "target_entity_id",
            "signal_type", "strength", "metadata", "discovered_at",
        ]

        if self.config.incremental:
            sql = self._writer.generate_upsert(
                schema, "lo_connections", columns, "connection_id"
            )
        else:
            sql = self._writer.generate_insert(
                schema, "lo_connections", columns
            )

        rows = []
        for c in connections:
            source = c.get("source_a", "")
            target = c.get("source_b", "")
            signal = c.get("signal", "")
            # Deterministic ID from source+target+signal
            conn_id = f"{source}:{target}:{signal}"
            rows.append({
                "connection_id": conn_id,
                "source_entity_id": source,
                "target_entity_id": target,
                "signal_type": signal,
                "strength": c.get("strength", 0.0),
                "metadata": self._json_serialize(
                    c.get("metadata", {})
                ),
                "discovered_at": self._now(),
            })

        if self.config.dry_run:
            self._truncate_if_needed(None, "lo_connections")
            count = self._batch_execute(None, sql, rows)
        else:
            with self.engine.begin() as conn:
                self._truncate_if_needed(conn, "lo_connections")
                count = self._batch_execute(conn, sql, rows)

        logger.info("[pg-materializer] lo_connections: %d rows", count)
        return count

    def materialize_anomalies(self, anomalies: list[dict]) -> int:
        """Write anomaly detections to lo_anomalies."""
        if not anomalies:
            return 0

        schema = self.config.schema_name
        columns = [
            "anomaly_id", "entity_id", "entity_type", "anomaly_score",
            "severity", "tags", "description", "detected_at", "run_id",
        ]

        if self.config.incremental:
            sql = self._writer.generate_upsert(
                schema, "lo_anomalies", columns, "anomaly_id"
            )
        else:
            sql = self._writer.generate_insert(
                schema, "lo_anomalies", columns
            )

        rows = []
        for a in anomalies:
            entity_id = a.get("entity_id", "")
            rows.append({
                "anomaly_id": f"anom:{entity_id}:{self._make_id()[:8]}",
                "entity_id": entity_id,
                "entity_type": a.get("entity_type", ""),
                "anomaly_score": a.get("anomaly_score", 0.0),
                "severity": a.get("severity", "medium"),
                "tags": self._json_serialize(a.get("tags", [])),
                "description": a.get("description", ""),
                "detected_at": self._now(),
                "run_id": a.get("run_id", ""),
            })

        if self.config.dry_run:
            self._truncate_if_needed(None, "lo_anomalies")
            count = self._batch_execute(None, sql, rows)
        else:
            with self.engine.begin() as conn:
                self._truncate_if_needed(conn, "lo_anomalies")
                count = self._batch_execute(conn, sql, rows)

        logger.info("[pg-materializer] lo_anomalies: %d rows", count)
        return count

    def materialize_clusters(self, clusters: list[dict]) -> int:
        """Write cluster summaries to lo_clusters."""
        if not clusters:
            return 0

        schema = self.config.schema_name
        columns = [
            "cluster_id", "label", "member_count", "centroid_8d",
            "centroid_3d", "top_entities", "coherence_score",
            "metadata", "updated_at",
        ]

        if self.config.incremental:
            sql = self._writer.generate_upsert(
                schema, "lo_clusters", columns, "cluster_id"
            )
        else:
            sql = self._writer.generate_insert(
                schema, "lo_clusters", columns
            )

        rows = []
        for c in clusters:
            rows.append({
                "cluster_id": c.get("cluster_id", 0),
                "label": c.get("label", ""),
                "member_count": c.get("member_count", 0),
                "centroid_8d": self._json_serialize(c.get("centroid_8d")),
                "centroid_3d": self._json_serialize(c.get("centroid_3d")),
                "top_entities": self._json_serialize(
                    c.get("top_entities", [])
                ),
                "coherence_score": c.get("coherence_score"),
                "metadata": self._json_serialize(c.get("metadata", {})),
                "updated_at": self._now(),
            })

        if self.config.dry_run:
            self._truncate_if_needed(None, "lo_clusters")
            count = self._batch_execute(None, sql, rows)
        else:
            with self.engine.begin() as conn:
                self._truncate_if_needed(conn, "lo_clusters")
                count = self._batch_execute(conn, sql, rows)

        logger.info("[pg-materializer] lo_clusters: %d rows", count)
        return count

    def materialize_quality(self, quality: dict, run_id: str) -> int:
        """Write quality metrics to lo_quality."""
        schema = self.config.schema_name
        columns = [
            "run_id", "n_input", "n_survivors", "reduction_ratio",
            "variance_ratio", "coverage_at_1_0", "reconstruction_median_nn",
            "n_clusters", "unique_fingerprints", "wall_seconds",
            "estimated_cost_usd", "cost_breakdown", "created_at",
        ]

        if self.config.incremental:
            sql = self._writer.generate_upsert(
                schema, "lo_quality", columns, "run_id"
            )
        else:
            sql = self._writer.generate_insert(
                schema, "lo_quality", columns
            )

        row = {
            "run_id": run_id,
            "n_input": quality.get("n_input", 0),
            "n_survivors": quality.get("n_survivors", 0),
            "reduction_ratio": quality.get("reduction_ratio", 0),
            "variance_ratio": quality.get("variance_ratio", 0.0),
            "coverage_at_1_0": quality.get("coverage_at_1_0", 0.0),
            "reconstruction_median_nn": quality.get(
                "reconstruction_median_nn", 0.0
            ),
            "n_clusters": quality.get("n_clusters", 0),
            "unique_fingerprints": quality.get("unique_fingerprints", 0),
            "wall_seconds": quality.get("wall_seconds", 0.0),
            "estimated_cost_usd": quality.get("estimated_cost_usd", 0.0),
            "cost_breakdown": self._json_serialize(
                quality.get("cost_breakdown", {})
            ),
            "created_at": self._now(),
        }

        if self.config.dry_run:
            self._truncate_if_needed(None, "lo_quality")
            count = self._batch_execute(None, sql, [row])
        else:
            with self.engine.begin() as conn:
                self._truncate_if_needed(conn, "lo_quality")
                count = self._batch_execute(conn, sql, [row])

        logger.info("[pg-materializer] lo_quality: %d rows (run=%s)", count, run_id)
        return count

    def materialize_lineage(self, events: list[dict]) -> int:
        """Write lineage/provenance events to lo_lineage."""
        if not events:
            return 0

        schema = self.config.schema_name
        columns = [
            "event_id", "event_type", "entity_id", "source",
            "target", "action", "metadata", "timestamp", "run_id",
        ]

        if self.config.incremental:
            sql = self._writer.generate_upsert(
                schema, "lo_lineage", columns, "event_id"
            )
        else:
            sql = self._writer.generate_insert(
                schema, "lo_lineage", columns
            )

        rows = []
        for e in events:
            rows.append({
                "event_id": e.get("event_id", self._make_id()),
                "event_type": e.get("event_type", ""),
                "entity_id": e.get("entity_id", ""),
                "source": e.get("source", ""),
                "target": e.get("target", ""),
                "action": e.get("action", ""),
                "metadata": self._json_serialize(e.get("metadata", {})),
                "timestamp": e.get("timestamp", self._now()),
                "run_id": e.get("run_id", ""),
            })

        if self.config.dry_run:
            self._truncate_if_needed(None, "lo_lineage")
            count = self._batch_execute(None, sql, rows)
        else:
            with self.engine.begin() as conn:
                self._truncate_if_needed(conn, "lo_lineage")
                count = self._batch_execute(conn, sql, rows)

        logger.info("[pg-materializer] lo_lineage: %d rows", count)
        return count

    def materialize_magnitude(self, magnitude: list[dict]) -> int:
        """Write magnitude/flow metrics to lo_magnitude."""
        if not magnitude:
            return 0

        schema = self.config.schema_name
        columns = [
            "magnitude_id", "entity_id", "metric_name", "value",
            "unit", "dimensions", "measured_at", "run_id",
        ]

        if self.config.incremental:
            sql = self._writer.generate_upsert(
                schema, "lo_magnitude", columns, "magnitude_id"
            )
        else:
            sql = self._writer.generate_insert(
                schema, "lo_magnitude", columns
            )

        rows = []
        for m in magnitude:
            rows.append({
                "magnitude_id": self._make_id(),
                "entity_id": m.get("entity_id", ""),
                "metric_name": m.get("metric_name", ""),
                "value": m.get("value", 0.0),
                "unit": m.get("unit", ""),
                "dimensions": self._json_serialize(m.get("dimensions", {})),
                "measured_at": m.get("measured_at", self._now()),
                "run_id": m.get("run_id", ""),
            })

        if self.config.dry_run:
            self._truncate_if_needed(None, "lo_magnitude")
            count = self._batch_execute(None, sql, rows)
        else:
            with self.engine.begin() as conn:
                self._truncate_if_needed(conn, "lo_magnitude")
                count = self._batch_execute(conn, sql, rows)

        logger.info("[pg-materializer] lo_magnitude: %d rows", count)
        return count
