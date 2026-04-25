"""SQLite persistence layer for the NATO Simulation vertical.

Why SQLite (not the main LO Postgres):
    - isolation — keeps sim tables out of the Alembic migration chain
    - zero ops — single file, trivial backup, easy teardown
    - dev/prod parity — identical behavior across environments
    - if the vertical is promoted post-sim, migration to Postgres is ~1 hour

File lives at ``data/nato-sim.db`` relative to the backend working directory.
All writes use WAL mode for concurrent read performance.

The schema is created idempotently by ``init_db()``. There is no migration
framework — if the schema needs to evolve during the sim, add a new column
with an ALTER in a new function and call it explicitly.
"""

from __future__ import annotations

import contextlib
import json
import logging
import sqlite3
import threading
import uuid
from pathlib import Path
from typing import Any, Iterable

logger = logging.getLogger(__name__)

_DB_PATH = Path("data/nato-sim.db")
# RLock — reentrant. ``init_db`` is called from inside ``get_db``'s
# critical section on first connection; with a plain ``Lock`` that
# nested call deadlocks. RLock allows the same thread to re-acquire.
_lock = threading.RLock()
_conn: sqlite3.Connection | None = None


def _resolve_path() -> Path:
    """Return the DB path, creating parent dirs on demand."""
    p = _DB_PATH
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def get_db() -> sqlite3.Connection:
    """Return a process-wide SQLite connection.

    The connection is created lazily on first use. ``check_same_thread=False``
    is safe here because every write goes through the module-level ``_lock``.
    """
    global _conn
    if _conn is None:
        with _lock:
            if _conn is None:
                path = _resolve_path()
                conn = sqlite3.connect(str(path), check_same_thread=False, isolation_level=None)
                conn.row_factory = sqlite3.Row
                conn.execute("PRAGMA journal_mode=WAL")
                conn.execute("PRAGMA foreign_keys=ON")
                conn.execute("PRAGMA synchronous=NORMAL")
                _conn = conn
                init_db()
                logger.info("nato_sim: sqlite initialized at %s", path)
    return _conn


_SCHEMA = """
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    channel TEXT,
    author TEXT,
    content TEXT NOT NULL,
    ts TEXT NOT NULL DEFAULT (datetime('now')),
    priority TEXT,
    raw_json TEXT,
    processed_at TEXT,
    outlier_score REAL DEFAULT 0.0,
    outlier_signals TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts DESC);
CREATE INDEX IF NOT EXISTS idx_messages_source ON messages(source);

CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    metadata TEXT,
    embedding TEXT,
    first_seen_at TEXT DEFAULT (datetime('now')),
    last_seen_at TEXT DEFAULT (datetime('now')),
    UNIQUE(type, canonical_name)
);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);

CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    made_by_entity TEXT,
    about_entity TEXT,
    source_message TEXT,
    confidence TEXT,
    ts TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(made_by_entity) REFERENCES entities(id) ON DELETE SET NULL,
    FOREIGN KEY(about_entity) REFERENCES entities(id) ON DELETE SET NULL,
    FOREIGN KEY(source_message) REFERENCES messages(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_claims_about ON claims(about_entity);

CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    from_entity TEXT NOT NULL,
    to_entity TEXT NOT NULL,
    kind TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    evidence TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(from_entity, to_entity, kind),
    FOREIGN KEY(from_entity) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY(to_entity) REFERENCES entities(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_entity);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_entity);

CREATE TABLE IF NOT EXISTS findings (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    confidence TEXT,
    citations TEXT,
    generated_at TEXT DEFAULT (datetime('now')),
    superseded_by TEXT,
    FOREIGN KEY(superseded_by) REFERENCES findings(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_findings_kind_topic ON findings(kind, topic, generated_at DESC);

CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    trigger TEXT NOT NULL,
    proposed_action TEXT NOT NULL,
    payload TEXT,
    status TEXT NOT NULL,
    decided_at TEXT,
    decided_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, created_at DESC);

CREATE TABLE IF NOT EXISTS corpus_docs (
    id TEXT PRIMARY KEY,
    url TEXT,
    origin TEXT NOT NULL,
    fetched_at TEXT DEFAULT (datetime('now')),
    content_hash TEXT UNIQUE,
    title TEXT,
    text TEXT,
    embedding TEXT,
    source_tier INTEGER,
    metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_corpus_origin ON corpus_docs(origin);

CREATE TABLE IF NOT EXISTS events_log (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    payload TEXT,
    ts TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events_log(ts DESC);

CREATE TABLE IF NOT EXISTS pinned (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL,
    note TEXT,
    pinned_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(finding_id) REFERENCES findings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS query_history (
    id TEXT PRIMARY KEY,
    q TEXT NOT NULL,
    answer TEXT NOT NULL,
    sources TEXT,
    pinned INTEGER DEFAULT 0,
    note TEXT,
    ts TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_query_history_ts ON query_history(ts DESC);

CREATE TABLE IF NOT EXISTS gap_analyses (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    why_a_gap TEXT NOT NULL,
    recommended_agencies TEXT,         -- JSON array of agency keys
    specific_collection TEXT,
    priority TEXT,                     -- HIGH / MEDIUM / LOW
    related_finding_id TEXT,
    generated_at TEXT DEFAULT (datetime('now')),
    resolved INTEGER DEFAULT 0,
    FOREIGN KEY(related_finding_id) REFERENCES findings(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_gaps_priority ON gap_analyses(priority, generated_at DESC);
"""


_MIGRATIONS = [
    # Add outlier_score / outlier_signals columns to messages if upgrading
    # an existing DB. Safe to run repeatedly because we check column
    # existence first.
    """
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM pragma_table_info('messages') WHERE name = 'outlier_score'
    ) THEN RAISE(IGNORE) END
    """,
]


def init_db() -> None:
    """Create the schema idempotently. Safe to call multiple times."""
    conn = _conn or get_db()
    with _lock:
        conn.executescript(_SCHEMA)
        # Add outlier columns to existing messages table if missing.
        cur = conn.execute("PRAGMA table_info(messages)")
        cols = {row[1] for row in cur.fetchall()}
        if "outlier_score" not in cols:
            try:
                conn.execute("ALTER TABLE messages ADD COLUMN outlier_score REAL DEFAULT 0.0")
            except Exception as exc:
                logger.debug("outlier_score migration: %s", exc)
        if "outlier_signals" not in cols:
            try:
                conn.execute("ALTER TABLE messages ADD COLUMN outlier_signals TEXT")
            except Exception as exc:
                logger.debug("outlier_signals migration: %s", exc)


def new_id() -> str:
    """Return a fresh UUID4 string suitable for primary keys."""
    return str(uuid.uuid4())


def insert(table: str, **cols: Any) -> str:
    """Insert a row and return its id.

    If ``id`` is not supplied one is generated. Values that are not
    SQLite-native (dict, list) are JSON-encoded automatically.
    """
    if "id" not in cols or cols["id"] is None:
        cols["id"] = new_id()
    encoded = {k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in cols.items()}
    cols_sql = ", ".join(encoded.keys())
    qs = ", ".join("?" * len(encoded))
    sql = f"INSERT INTO {table} ({cols_sql}) VALUES ({qs})"
    conn = get_db()
    with _lock:
        conn.execute(sql, list(encoded.values()))
    return cols["id"]


def upsert(table: str, conflict_cols: Iterable[str], **cols: Any) -> str:
    """Insert or update on conflict. Returns the id of the affected row.

    ``conflict_cols`` is the set of columns with a UNIQUE constraint
    (e.g. ``('type', 'canonical_name')`` for ``entities``).
    """
    if "id" not in cols or cols["id"] is None:
        cols["id"] = new_id()
    encoded = {k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in cols.items()}
    cols_sql = ", ".join(encoded.keys())
    qs = ", ".join("?" * len(encoded))
    update_sql = ", ".join(
        f"{k}=excluded.{k}" for k in encoded.keys() if k != "id" and k not in conflict_cols
    )
    sql = (
        f"INSERT INTO {table} ({cols_sql}) VALUES ({qs}) "
        f"ON CONFLICT({', '.join(conflict_cols)}) DO UPDATE SET {update_sql} "
        f"RETURNING id"
    )
    conn = get_db()
    with _lock:
        cur = conn.execute(sql, list(encoded.values()))
        row = cur.fetchone()
        return row["id"] if row else cols["id"]


def query(sql: str, *params: Any) -> list[sqlite3.Row]:
    """Run a SELECT and return all rows."""
    conn = get_db()
    return list(conn.execute(sql, params))


def query_one(sql: str, *params: Any) -> sqlite3.Row | None:
    """Run a SELECT and return the first row or None."""
    conn = get_db()
    row = conn.execute(sql, params).fetchone()
    return row


def execute(sql: str, *params: Any) -> None:
    """Run a non-SELECT statement."""
    conn = get_db()
    with _lock:
        conn.execute(sql, params)


@contextlib.contextmanager
def transaction():
    """Context manager for a write transaction."""
    conn = get_db()
    with _lock:
        conn.execute("BEGIN")
        try:
            yield conn
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    """Convert a Row to a plain dict, decoding JSON columns heuristically.

    Columns with names ending in ``_json``, or equal to ``metadata``,
    ``citations``, ``evidence``, ``payload``, ``raw_json``, ``embedding``
    are JSON-decoded if they contain parseable JSON.
    """
    if row is None:
        return None
    d = dict(row)
    JSON_KEYS = {"metadata", "citations", "evidence", "payload", "raw_json", "embedding"}
    for k in list(d.keys()):
        if (k in JSON_KEYS or k.endswith("_json")) and isinstance(d[k], str) and d[k]:
            try:
                d[k] = json.loads(d[k])
            except json.JSONDecodeError:
                pass
    return d
