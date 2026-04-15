"""Polling-based CDC -- works with any database that has timestamp columns."""
from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Any, Callable

from sqlalchemy import create_engine, text

from .watcher import CDCWatcher, ChangeEvent

logger = logging.getLogger(__name__)


class PollingCDCWatcher(CDCWatcher):
    """Polls for changes using timestamp columns.

    Requires tables to have an ``updated_at`` or similar column.
    Falls back to comparing full row hashes if no timestamp column
    is available.

    Parameters
    ----------
    connection_string:
        SQLAlchemy-compatible connection URI.
    tables:
        List of table names to watch.
    poll_interval_seconds:
        How often to poll (default 60s).
    timestamp_column:
        Name of the column used to detect changes (default ``updated_at``).
    schema:
        Database schema to query (default ``public``).
    """

    def __init__(
        self,
        connection_string: str,
        tables: list[str],
        poll_interval_seconds: int = 60,
        timestamp_column: str = "updated_at",
        schema: str = "public",
    ) -> None:
        # Normalise connection string for sync SQLAlchemy
        dsn = connection_string.replace("+asyncpg", "").replace(
            "postgresql+asyncpg", "postgresql"
        )
        self._engine = create_engine(dsn)
        self._tables = tables
        self._interval = poll_interval_seconds
        self._ts_col = timestamp_column
        self._schema = schema

        self._callback: Callable[[ChangeEvent], None] | None = None
        self._running = False
        self._thread: threading.Thread | None = None

        # Track high-water marks per table
        self._watermarks: dict[str, datetime] = {}
        # Track row hashes for tables without timestamp columns
        self._row_hashes: dict[str, dict[str, str]] = {}  # table -> {pk_str: hash}

    # ------------------------------------------------------------------ #
    #  Public API
    # ------------------------------------------------------------------ #

    def start(self, callback: Callable[[ChangeEvent], None]) -> None:
        """Start the polling thread."""
        if self._running:
            logger.warning("PollingCDCWatcher already running")
            return

        self._callback = callback
        self._running = True

        # Initialise watermarks to "now" so we only capture future changes
        now = datetime.now(timezone.utc)
        for table in self._tables:
            if table not in self._watermarks:
                self._watermarks[table] = now

        self._thread = threading.Thread(
            target=self._poll_loop,
            name="cdc-polling",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "PollingCDCWatcher started: %d tables, %ds interval",
            len(self._tables),
            self._interval,
        )

    def stop(self) -> None:
        """Signal the polling thread to stop."""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=self._interval + 5)
        self._thread = None
        logger.info("PollingCDCWatcher stopped")

    def is_running(self) -> bool:
        return self._running

    # ------------------------------------------------------------------ #
    #  Polling loop
    # ------------------------------------------------------------------ #

    def _poll_loop(self) -> None:
        """Main loop: sleep then poll each table."""
        while self._running:
            for table in self._tables:
                try:
                    self._poll_table(table)
                except Exception:
                    logger.exception("Error polling table %s", table)
            # Sleep in small increments so stop() is responsive
            for _ in range(self._interval):
                if not self._running:
                    return
                time.sleep(1)

    def _poll_table(self, table: str) -> None:
        """Poll a single table for changes."""
        if self._table_has_timestamp(table):
            self._poll_by_timestamp(table)
        else:
            self._poll_by_hash(table)

    # ------------------------------------------------------------------ #
    #  Timestamp-based polling
    # ------------------------------------------------------------------ #

    def _poll_by_timestamp(self, table: str) -> None:
        """Detect changes by querying rows newer than the high-water mark."""
        watermark = self._watermarks.get(table, datetime.min.replace(tzinfo=timezone.utc))

        query = text(
            f'SELECT * FROM "{self._schema}"."{table}" '
            f'WHERE "{self._ts_col}" > :watermark '
            f'ORDER BY "{self._ts_col}" ASC'
        )

        with self._engine.connect() as conn:
            result = conn.execute(query, {"watermark": watermark})
            columns = list(result.keys())
            rows = [dict(zip(columns, r)) for r in result.fetchall()]

        if not rows:
            return

        new_watermark = watermark
        for row in rows:
            ts = row.get(self._ts_col)
            if isinstance(ts, datetime) and ts > new_watermark:
                new_watermark = ts

            event = ChangeEvent(
                table=table,
                operation="UPDATE",  # Can't distinguish insert vs update with timestamps alone
                row_data=self._serialise_row(row),
                old_data=None,
                timestamp=ts if isinstance(ts, datetime) else datetime.now(timezone.utc),
            )
            if self._callback:
                self._callback(event)

        self._watermarks[table] = new_watermark
        logger.debug("Table %s: %d changes since %s", table, len(rows), watermark)

    # ------------------------------------------------------------------ #
    #  Hash-based polling (fallback)
    # ------------------------------------------------------------------ #

    def _poll_by_hash(self, table: str) -> None:
        """Detect changes by comparing row hashes (for tables without timestamps)."""
        pk_col = self._get_pk_column(table)
        if not pk_col:
            logger.warning("Table %s has no PK and no timestamp column; skipping", table)
            return

        query = text(f'SELECT * FROM "{self._schema}"."{table}"')
        with self._engine.connect() as conn:
            result = conn.execute(query)
            columns = list(result.keys())
            rows = [dict(zip(columns, r)) for r in result.fetchall()]

        old_hashes = self._row_hashes.get(table, {})
        new_hashes: dict[str, str] = {}
        now = datetime.now(timezone.utc)

        for row in rows:
            pk_value = str(row.get(pk_col, ""))
            row_hash = self._hash_row(row)
            new_hashes[pk_value] = row_hash

            if pk_value not in old_hashes:
                # New row
                event = ChangeEvent(
                    table=table, operation="INSERT",
                    row_data=self._serialise_row(row), old_data=None,
                    timestamp=now,
                )
                if self._callback:
                    self._callback(event)
            elif old_hashes[pk_value] != row_hash:
                # Changed row
                event = ChangeEvent(
                    table=table, operation="UPDATE",
                    row_data=self._serialise_row(row), old_data=None,
                    timestamp=now,
                )
                if self._callback:
                    self._callback(event)

        # Detect deletes
        for pk_value in old_hashes:
            if pk_value not in new_hashes:
                event = ChangeEvent(
                    table=table, operation="DELETE",
                    row_data={pk_col: pk_value}, old_data=None,
                    timestamp=now,
                )
                if self._callback:
                    self._callback(event)

        self._row_hashes[table] = new_hashes

    # ------------------------------------------------------------------ #
    #  Helpers
    # ------------------------------------------------------------------ #

    def _table_has_timestamp(self, table: str) -> bool:
        """Check if the table has the configured timestamp column."""
        query = text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = :schema AND table_name = :table "
            "AND column_name = :col"
        )
        with self._engine.connect() as conn:
            result = conn.execute(
                query, {"schema": self._schema, "table": table, "col": self._ts_col},
            )
            return result.fetchone() is not None

    def _get_pk_column(self, table: str) -> str | None:
        """Get the primary key column for a table."""
        query = text(
            "SELECT kcu.column_name "
            "FROM information_schema.table_constraints tc "
            "JOIN information_schema.key_column_usage kcu "
            "  ON tc.constraint_name = kcu.constraint_name "
            "  AND tc.table_schema = kcu.table_schema "
            "WHERE tc.constraint_type = 'PRIMARY KEY' "
            "  AND tc.table_schema = :schema "
            "  AND tc.table_name = :table "
            "LIMIT 1"
        )
        with self._engine.connect() as conn:
            result = conn.execute(query, {"schema": self._schema, "table": table})
            row = result.fetchone()
            return row[0] if row else None

    @staticmethod
    def _hash_row(row: dict) -> str:
        """Compute a stable hash of a row for change detection."""
        serialised = json.dumps(row, sort_keys=True, default=str)
        return hashlib.md5(serialised.encode()).hexdigest()

    @staticmethod
    def _serialise_row(row: dict) -> dict[str, Any]:
        """Convert non-serialisable values to strings."""
        out: dict[str, Any] = {}
        for k, v in row.items():
            if isinstance(v, datetime):
                out[k] = v.isoformat()
            elif isinstance(v, (str, int, float, bool, type(None))):
                out[k] = v
            else:
                out[k] = str(v)
        return out
