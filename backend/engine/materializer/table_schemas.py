"""Table schemas for materialized intelligence tables.

Defines the SQL DDL for all lo_* tables that the materializer writes to
customer databases. Each table definition includes column specs, indexes,
and foreign key constraints.

These schemas are database-agnostic at the definition level — the actual
SQL generation is handled by ``writer.SQLWriter`` which adapts types and
syntax for each target database.

Tables:
    lo_survivors     — surviving entities with scores and coordinates
    lo_connections   — causal links between entities (4 signal types)
    lo_anomalies     — anomaly detections with severity and tags
    lo_clusters      — cluster summaries with member counts
    lo_magnitude     — flow/magnitude metrics from the monitor stage
    lo_quality       — quality metrics per reduction run
    lo_lineage       — provenance and lineage event log
"""
from __future__ import annotations

MATERIALIZED_TABLES: dict[str, dict] = {
    # ── Survivors ─────────────────────────────────────────────────────
    "lo_survivors": {
        "description": "Surviving entities with scores, fingerprints, and manifold coordinates.",
        "columns": [
            ("entity_id", "TEXT PRIMARY KEY"),
            ("entity_name", "TEXT"),
            ("entity_type", "TEXT"),
            ("cluster_id", "INTEGER"),
            ("composite_score", "DOUBLE PRECISION"),
            ("diversity_score", "DOUBLE PRECISION"),
            ("reconstruction_score", "DOUBLE PRECISION"),
            ("anomaly_score", "DOUBLE PRECISION"),
            ("fingerprint_48bit", "TEXT"),
            ("coord_8d", "JSONB"),
            ("coord_3d", "JSONB"),
            ("attributes", "JSONB"),
            ("narrative", "TEXT"),
            ("updated_at", "TIMESTAMP DEFAULT NOW()"),
        ],
        "primary_key": "entity_id",
        "indexes": [
            "CREATE INDEX IF NOT EXISTS idx_lo_surv_type ON {schema}.lo_survivors(entity_type)",
            "CREATE INDEX IF NOT EXISTS idx_lo_surv_cluster ON {schema}.lo_survivors(cluster_id)",
            "CREATE INDEX IF NOT EXISTS idx_lo_surv_score ON {schema}.lo_survivors(composite_score DESC)",
            "CREATE INDEX IF NOT EXISTS idx_lo_surv_fingerprint ON {schema}.lo_survivors(fingerprint_48bit)",
        ],
        "foreign_keys": [],
    },
    # ── Connections ───────────────────────────────────────────────────
    "lo_connections": {
        "description": "Causal links between entities discovered by the four-signal linker.",
        "columns": [
            ("connection_id", "TEXT PRIMARY KEY"),
            ("source_entity_id", "TEXT NOT NULL"),
            ("target_entity_id", "TEXT NOT NULL"),
            ("signal_type", "TEXT NOT NULL"),
            ("strength", "DOUBLE PRECISION NOT NULL"),
            ("metadata", "JSONB"),
            ("discovered_at", "TIMESTAMP DEFAULT NOW()"),
        ],
        "primary_key": "connection_id",
        "indexes": [
            "CREATE INDEX IF NOT EXISTS idx_lo_conn_source ON {schema}.lo_connections(source_entity_id)",
            "CREATE INDEX IF NOT EXISTS idx_lo_conn_target ON {schema}.lo_connections(target_entity_id)",
            "CREATE INDEX IF NOT EXISTS idx_lo_conn_signal ON {schema}.lo_connections(signal_type)",
            "CREATE INDEX IF NOT EXISTS idx_lo_conn_strength ON {schema}.lo_connections(strength DESC)",
        ],
        "foreign_keys": [
            "FOREIGN KEY (source_entity_id) REFERENCES {schema}.lo_survivors(entity_id) ON DELETE CASCADE",
            "FOREIGN KEY (target_entity_id) REFERENCES {schema}.lo_survivors(entity_id) ON DELETE CASCADE",
        ],
    },
    # ── Anomalies ─────────────────────────────────────────────────────
    "lo_anomalies": {
        "description": "Anomaly detections with severity classification and tags.",
        "columns": [
            ("anomaly_id", "TEXT PRIMARY KEY"),
            ("entity_id", "TEXT NOT NULL"),
            ("entity_type", "TEXT"),
            ("anomaly_score", "DOUBLE PRECISION NOT NULL"),
            ("severity", "TEXT NOT NULL"),
            ("tags", "JSONB"),
            ("description", "TEXT"),
            ("detected_at", "TIMESTAMP DEFAULT NOW()"),
            ("run_id", "TEXT"),
        ],
        "primary_key": "anomaly_id",
        "indexes": [
            "CREATE INDEX IF NOT EXISTS idx_lo_anom_entity ON {schema}.lo_anomalies(entity_id)",
            "CREATE INDEX IF NOT EXISTS idx_lo_anom_severity ON {schema}.lo_anomalies(severity)",
            "CREATE INDEX IF NOT EXISTS idx_lo_anom_score ON {schema}.lo_anomalies(anomaly_score DESC)",
            "CREATE INDEX IF NOT EXISTS idx_lo_anom_run ON {schema}.lo_anomalies(run_id)",
        ],
        "foreign_keys": [
            "FOREIGN KEY (entity_id) REFERENCES {schema}.lo_survivors(entity_id) ON DELETE CASCADE",
        ],
    },
    # ── Clusters ──────────────────────────────────────────────────────
    "lo_clusters": {
        "description": "Cluster summaries with member counts, centroids, and top entities.",
        "columns": [
            ("cluster_id", "INTEGER PRIMARY KEY"),
            ("label", "TEXT"),
            ("member_count", "INTEGER NOT NULL DEFAULT 0"),
            ("centroid_8d", "JSONB"),
            ("centroid_3d", "JSONB"),
            ("top_entities", "JSONB"),
            ("coherence_score", "DOUBLE PRECISION"),
            ("metadata", "JSONB"),
            ("updated_at", "TIMESTAMP DEFAULT NOW()"),
        ],
        "primary_key": "cluster_id",
        "indexes": [
            "CREATE INDEX IF NOT EXISTS idx_lo_clust_members ON {schema}.lo_clusters(member_count DESC)",
            "CREATE INDEX IF NOT EXISTS idx_lo_clust_coherence ON {schema}.lo_clusters(coherence_score DESC)",
        ],
        "foreign_keys": [],
    },
    # ── Magnitude ─────────────────────────────────────────────────────
    "lo_magnitude": {
        "description": "Flow and magnitude metrics from the monitor stage.",
        "columns": [
            ("magnitude_id", "TEXT PRIMARY KEY"),
            ("entity_id", "TEXT"),
            ("metric_name", "TEXT NOT NULL"),
            ("value", "DOUBLE PRECISION NOT NULL"),
            ("unit", "TEXT"),
            ("dimensions", "JSONB"),
            ("measured_at", "TIMESTAMP DEFAULT NOW()"),
            ("run_id", "TEXT"),
        ],
        "primary_key": "magnitude_id",
        "indexes": [
            "CREATE INDEX IF NOT EXISTS idx_lo_mag_entity ON {schema}.lo_magnitude(entity_id)",
            "CREATE INDEX IF NOT EXISTS idx_lo_mag_metric ON {schema}.lo_magnitude(metric_name)",
            "CREATE INDEX IF NOT EXISTS idx_lo_mag_time ON {schema}.lo_magnitude(measured_at DESC)",
        ],
        "foreign_keys": [],
    },
    # ── Quality ───────────────────────────────────────────────────────
    "lo_quality": {
        "description": "Quality metrics per reduction run.",
        "columns": [
            ("run_id", "TEXT PRIMARY KEY"),
            ("n_input", "INTEGER NOT NULL"),
            ("n_survivors", "INTEGER NOT NULL"),
            ("reduction_ratio", "INTEGER"),
            ("variance_ratio", "DOUBLE PRECISION"),
            ("coverage_at_1_0", "DOUBLE PRECISION"),
            ("reconstruction_median_nn", "DOUBLE PRECISION"),
            ("n_clusters", "INTEGER"),
            ("unique_fingerprints", "INTEGER"),
            ("wall_seconds", "DOUBLE PRECISION"),
            ("estimated_cost_usd", "DOUBLE PRECISION"),
            ("cost_breakdown", "JSONB"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ],
        "primary_key": "run_id",
        "indexes": [
            "CREATE INDEX IF NOT EXISTS idx_lo_qual_time ON {schema}.lo_quality(created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_lo_qual_ratio ON {schema}.lo_quality(reduction_ratio DESC)",
        ],
        "foreign_keys": [],
    },
    # ── Lineage ───────────────────────────────────────────────────────
    "lo_lineage": {
        "description": "Provenance and lineage event log for audit trails.",
        "columns": [
            ("event_id", "TEXT PRIMARY KEY"),
            ("event_type", "TEXT NOT NULL"),
            ("entity_id", "TEXT"),
            ("source", "TEXT"),
            ("target", "TEXT"),
            ("action", "TEXT"),
            ("metadata", "JSONB"),
            ("timestamp", "TIMESTAMP DEFAULT NOW()"),
            ("run_id", "TEXT"),
        ],
        "primary_key": "event_id",
        "indexes": [
            "CREATE INDEX IF NOT EXISTS idx_lo_lin_entity ON {schema}.lo_lineage(entity_id)",
            "CREATE INDEX IF NOT EXISTS idx_lo_lin_type ON {schema}.lo_lineage(event_type)",
            "CREATE INDEX IF NOT EXISTS idx_lo_lin_time ON {schema}.lo_lineage(timestamp DESC)",
            "CREATE INDEX IF NOT EXISTS idx_lo_lin_run ON {schema}.lo_lineage(run_id)",
        ],
        "foreign_keys": [],
    },
}


def get_table_names() -> list[str]:
    """Return sorted list of all materialized table names."""
    return sorted(MATERIALIZED_TABLES.keys())


def get_column_names(table_name: str) -> list[str]:
    """Return column names for a given table (excludes type info)."""
    table = MATERIALIZED_TABLES.get(table_name)
    if not table:
        raise KeyError(f"Unknown table: {table_name}")
    return [col[0] for col in table["columns"]]


def get_insertable_columns(table_name: str) -> list[str]:
    """Return column names suitable for INSERT (excludes DEFAULT-only columns)."""
    table = MATERIALIZED_TABLES.get(table_name)
    if not table:
        raise KeyError(f"Unknown table: {table_name}")
    # Include all columns; callers provide values (or NULL) for DEFAULT cols
    return [col[0] for col in table["columns"]]
