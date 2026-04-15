"""Base materializer interface.

The materializer writes engine output (survivors, connections, anomalies,
clusters, quality metrics, lineage events) back to a customer's database
as native tables (lo_survivors, lo_connections, etc.) so their existing
BI tools, dashboards, and SQL queries work without any special drivers.

Subclasses implement the actual database writes for each supported driver
(PostgreSQL, MySQL, Snowflake, etc.).
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class MaterializerConfig:
    """Configuration for a materializer instance.

    Attributes:
        connection_string: Database connection URI (e.g. postgresql://...).
        schema_name: Target schema for lo_* tables. Created if missing.
        table_prefix: Prefix for all materialized tables (default "lo_").
        create_schema: Whether to CREATE SCHEMA IF NOT EXISTS on init.
        incremental: If True, use UPSERT (INSERT ON CONFLICT UPDATE);
            if False, TRUNCATE + INSERT on each materialize call.
        batch_size: Number of rows per INSERT batch for bulk writes.
    """

    connection_string: str
    schema_name: str = "latent_ocean"
    table_prefix: str = "lo_"
    create_schema: bool = True
    incremental: bool = True
    batch_size: int = 500
    dry_run: bool = False  # Generate SQL but don't execute


@dataclass
class MaterializeResult:
    """Summary of a materialize_all() run."""

    survivors_count: int = 0
    connections_count: int = 0
    anomalies_count: int = 0
    clusters_count: int = 0
    quality_written: bool = False
    lineage_count: int = 0
    magnitude_count: int = 0
    errors: list[str] = field(default_factory=list)
    wall_seconds: float = 0.0


class BaseMaterializer(ABC):
    """Abstract base class for writing engine results to customer databases.

    Lifecycle:
        1. ``__init__(config)`` — store config, do NOT connect yet.
        2. ``initialize()`` — create schema and tables.
        3. ``materialize_all(result)`` — write a complete FullResult.
        4. Or call individual ``materialize_*`` methods for partial writes.

    All abstract methods raise on failure; callers should wrap in
    try/except and inspect ``MaterializeResult.errors``.
    """

    def __init__(self, config: MaterializerConfig) -> None:
        self.config = config
        self._initialized = False

    # ── Schema setup ──────────────────────────────────────────────────

    @abstractmethod
    def initialize(self) -> None:
        """Create the target schema and all lo_* tables.

        Idempotent: uses IF NOT EXISTS for both schema and tables.
        Must be called before any materialize_* method.
        """
        ...

    # ── Individual materialization methods ────────────────────────────

    @abstractmethod
    def materialize_survivors(
        self,
        survivors: list[dict],
        summary: dict,
    ) -> int:
        """Write survivor entities to lo_survivors.

        Args:
            survivors: List of Survivor-like dicts with entity, scores,
                cluster, fingerprint, coord_8d, coord_3d fields.
            summary: Reduction summary dict for metadata enrichment.

        Returns:
            Number of rows written/upserted.
        """
        ...

    @abstractmethod
    def materialize_connections(self, connections: list[dict]) -> int:
        """Write causal links to lo_connections.

        Args:
            connections: List of CausalLink-like dicts with source_a,
                source_b, signal, strength fields.

        Returns:
            Number of rows written/upserted.
        """
        ...

    @abstractmethod
    def materialize_anomalies(self, anomalies: list[dict]) -> int:
        """Write anomaly detections to lo_anomalies.

        Args:
            anomalies: List of anomaly dicts with entity_id, tag,
                severity, description, scores.

        Returns:
            Number of rows written/upserted.
        """
        ...

    @abstractmethod
    def materialize_clusters(self, clusters: list[dict]) -> int:
        """Write cluster summaries to lo_clusters.

        Args:
            clusters: List of cluster dicts with cluster_id, label,
                member_count, centroid, top_entities.

        Returns:
            Number of rows written/upserted.
        """
        ...

    @abstractmethod
    def materialize_quality(self, quality: dict, run_id: str) -> int:
        """Write quality metrics to lo_quality.

        Args:
            quality: QualityMetrics as a dict.
            run_id: Unique identifier for this reduction run.

        Returns:
            Number of rows written (typically 1).
        """
        ...

    @abstractmethod
    def materialize_lineage(self, events: list[dict]) -> int:
        """Write lineage/provenance events to lo_lineage.

        Args:
            events: List of lineage event dicts with event_type,
                entity_id, source, timestamp, metadata.

        Returns:
            Number of rows written.
        """
        ...

    @abstractmethod
    def materialize_magnitude(self, magnitude: list[dict]) -> int:
        """Write magnitude/flow metrics to lo_magnitude.

        Args:
            magnitude: List of magnitude dicts with entity_id,
                metric_name, value, timestamp.

        Returns:
            Number of rows written.
        """
        ...

    # ── Composite method ──────────────────────────────────────────────

    def materialize_all(self, result: Any) -> MaterializeResult:
        """Materialize a complete FullResult to the target database.

        Calls each individual materialize_* method, collecting counts
        and errors. Does NOT stop on first error — writes as much as
        possible and reports all failures.

        Args:
            result: A ``FullResult`` from ``LatentOceanEngine.run()``.

        Returns:
            A ``MaterializeResult`` with counts and any errors.
        """
        import time

        if not self._initialized:
            self.initialize()

        t0 = time.time()
        out = MaterializeResult()

        # -- Survivors --
        try:
            survivor_dicts = _survivors_to_dicts(result.survivors)
            summary = (
                result.reduction.summary if hasattr(result, "reduction") else {}
            )
            out.survivors_count = self.materialize_survivors(
                survivor_dicts, summary
            )
        except Exception as exc:
            logger.error("materialize_survivors failed: %s", exc)
            out.errors.append(f"survivors: {exc}")

        # -- Connections (if discover results are attached) --
        try:
            connections = getattr(result, "connections", None) or []
            if connections:
                conn_dicts = [
                    {
                        "source_a": c.source_a if hasattr(c, "source_a") else c.get("source_a", ""),
                        "source_b": c.source_b if hasattr(c, "source_b") else c.get("source_b", ""),
                        "signal": c.signal if hasattr(c, "signal") else c.get("signal", ""),
                        "strength": c.strength if hasattr(c, "strength") else c.get("strength", 0.0),
                    }
                    for c in connections
                ]
                out.connections_count = self.materialize_connections(conn_dicts)
        except Exception as exc:
            logger.error("materialize_connections failed: %s", exc)
            out.errors.append(f"connections: {exc}")

        # -- Anomalies --
        try:
            anomalies = _extract_anomalies(result.survivors)
            if anomalies:
                out.anomalies_count = self.materialize_anomalies(anomalies)
        except Exception as exc:
            logger.error("materialize_anomalies failed: %s", exc)
            out.errors.append(f"anomalies: {exc}")

        # -- Clusters --
        try:
            clusters = _extract_clusters(result.survivors)
            if clusters:
                out.clusters_count = self.materialize_clusters(clusters)
        except Exception as exc:
            logger.error("materialize_clusters failed: %s", exc)
            out.errors.append(f"clusters: {exc}")

        # -- Quality --
        try:
            if hasattr(result, "quality") and result.quality is not None:
                q = result.quality
                quality_dict = {
                    "n_input": q.n_input,
                    "n_survivors": q.n_survivors,
                    "reduction_ratio": q.reduction_ratio,
                    "variance_ratio": q.variance_ratio,
                    "coverage_at_1_0": q.coverage_at_1_0,
                    "reconstruction_median_nn": q.reconstruction_median_nn,
                    "n_clusters": q.n_clusters,
                    "unique_fingerprints": q.unique_fingerprints,
                    "wall_seconds": q.wall_seconds,
                    "estimated_cost_usd": q.estimated_cost_usd,
                    "cost_breakdown": q.cost_breakdown,
                }
                run_id = f"run_{int(t0)}"
                out.quality_written = self.materialize_quality(
                    quality_dict, run_id
                ) > 0
        except Exception as exc:
            logger.error("materialize_quality failed: %s", exc)
            out.errors.append(f"quality: {exc}")

        # -- Lineage --
        try:
            lineage = getattr(result, "lineage_events", None) or []
            if lineage:
                out.lineage_count = self.materialize_lineage(lineage)
        except Exception as exc:
            logger.error("materialize_lineage failed: %s", exc)
            out.errors.append(f"lineage: {exc}")

        # -- Magnitude (monitor flow metrics) --
        try:
            if hasattr(result, "monitor") and result.monitor is not None:
                magnitude = _extract_magnitude(result.monitor)
                if magnitude:
                    out.magnitude_count = self.materialize_magnitude(magnitude)
        except Exception as exc:
            logger.error("materialize_magnitude failed: %s", exc)
            out.errors.append(f"magnitude: {exc}")

        out.wall_seconds = time.time() - t0
        logger.info(
            "[materializer] materialize_all complete: "
            "survivors=%d connections=%d anomalies=%d clusters=%d "
            "lineage=%d magnitude=%d errors=%d (%.1fs)",
            out.survivors_count,
            out.connections_count,
            out.anomalies_count,
            out.clusters_count,
            out.lineage_count,
            out.magnitude_count,
            len(out.errors),
            out.wall_seconds,
        )
        return out


# ── Helpers ───────────────────────────────────────────────────────────


def _survivors_to_dicts(survivors: list) -> list[dict]:
    """Convert Survivor dataclass instances to plain dicts."""
    out = []
    for s in survivors:
        if isinstance(s, dict):
            out.append(s)
        else:
            out.append({
                "entity": s.entity,
                "cluster": s.cluster,
                "scores": s.scores,
                "fingerprint": s.fingerprint,
                "coord_8d": s.coord_8d,
                "coord_3d": s.coord_3d,
                "display_name": getattr(s, "display_name", ""),
            })
    return out


def _extract_anomalies(survivors: list) -> list[dict]:
    """Extract anomaly records from survivors with high anomaly scores."""
    anomalies = []
    for s in survivors:
        scores = s.scores if hasattr(s, "scores") else s.get("scores", {})
        anomaly_score = scores.get("anomaly", 0.0)
        if anomaly_score > 0.7:
            entity = s.entity if hasattr(s, "entity") else s.get("entity", {})
            anomalies.append({
                "entity_id": entity.get("name", ""),
                "entity_type": entity.get("type", ""),
                "anomaly_score": anomaly_score,
                "severity": (
                    "critical" if anomaly_score > 0.95
                    else "high" if anomaly_score > 0.85
                    else "medium"
                ),
                "tags": scores.get("anomaly_tags", []),
                "description": f"Anomaly score {anomaly_score:.3f}",
            })
    return anomalies


def _extract_clusters(survivors: list) -> list[dict]:
    """Build cluster summary records from survivors."""
    cluster_map: dict[int, list] = {}
    for s in survivors:
        cluster_id = s.cluster if hasattr(s, "cluster") else s.get("cluster", 0)
        cluster_map.setdefault(cluster_id, []).append(s)

    clusters = []
    for cid, members in cluster_map.items():
        top = []
        for m in members[:10]:
            entity = m.entity if hasattr(m, "entity") else m.get("entity", {})
            top.append(entity.get("name", ""))
        clusters.append({
            "cluster_id": cid,
            "label": f"cluster_{cid}",
            "member_count": len(members),
            "top_entities": top,
        })
    return clusters


def _extract_magnitude(monitor) -> list[dict]:
    """Extract magnitude records from MonitorResult."""
    records = []
    if hasattr(monitor, "well_states"):
        for w in monitor.well_states:
            records.append({
                "entity_id": w.get("id", ""),
                "metric_name": "pressure",
                "value": w.get("pressure", 0.0),
            })
    return records
