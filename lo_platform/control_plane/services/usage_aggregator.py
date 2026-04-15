"""Usage aggregator — rolls up raw events into billing summaries.

Bridges the gap between fine-grained MeteringService events and the
PricingEngine's invoice computation. Aggregates raw usage_events
into per-fork, per-period summaries suitable for billing.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class UsageSummary:
    """Aggregated usage for a single fork over one billing period."""

    fork_id: str
    period_start: datetime
    period_end: datetime
    total_entities_processed: int = 0
    total_queries_served: int = 0
    peak_storage_gb: float = 0.0
    reduction_cycles: int = 0
    enabled_modules: list[str] = field(default_factory=list)
    total_compute_cost_usd: float = 0.0  # From engine's QualityMetrics

    def to_dict(self) -> dict:
        return {
            "fork_id": self.fork_id,
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "total_entities_processed": self.total_entities_processed,
            "total_queries_served": self.total_queries_served,
            "peak_storage_gb": round(self.peak_storage_gb, 4),
            "reduction_cycles": self.reduction_cycles,
            "enabled_modules": self.enabled_modules,
            "total_compute_cost_usd": round(self.total_compute_cost_usd, 4),
        }


class UsageAggregator:
    """Aggregates raw metering events into billing-ready summaries.

    Uses the MeteringService for raw event queries and enriches
    with fork metadata (enabled modules, storage) from the database.

    Args:
        metering: MeteringService instance for querying raw events.
        db_session_factory: Async SQLAlchemy session factory for
            fork metadata lookups.
    """

    def __init__(
        self,
        metering: Any = None,
        db_session_factory: Any = None,
    ) -> None:
        self._metering = metering
        self._db_factory = db_session_factory

    async def aggregate_period(
        self,
        fork_id: str,
        start: datetime,
        end: datetime,
    ) -> UsageSummary:
        """Aggregate usage events for a single fork over a time period.

        Pulls raw event counts from MeteringService, then enriches
        with fork-level metadata (modules, storage) from the database.
        """
        summary = UsageSummary(
            fork_id=fork_id,
            period_start=start,
            period_end=end,
        )

        # Pull raw event aggregates from metering
        if self._metering is not None:
            raw = await self._metering.get_usage(fork_id, start, end)
            summary.total_entities_processed = raw.get("reductions", 0)
            summary.total_queries_served = raw.get("queries", 0)
            summary.reduction_cycles = raw.get("reductions", 0)
        else:
            logger.debug(
                "[usage-agg] no metering service — returning empty summary "
                "for fork=%s", fork_id,
            )

        # Enrich with fork metadata from the database
        if self._db_factory is not None:
            fork_data = await self._fetch_fork_metadata(fork_id)
            if fork_data:
                summary.enabled_modules = fork_data.get("enabled_modules", [])
                storage_bytes = fork_data.get("storage_used_bytes", 0)
                summary.peak_storage_gb = storage_bytes / (1024 ** 3)
                # Entity count from the fork's entity_count field
                entity_count = fork_data.get("entity_count", 0)
                if entity_count > summary.total_entities_processed:
                    summary.total_entities_processed = entity_count

        # Compute cost from engine metrics if available
        summary.total_compute_cost_usd = await self._fetch_compute_cost(
            fork_id, start, end,
        )

        return summary

    async def aggregate_all_forks(
        self,
        start: datetime,
        end: datetime,
    ) -> list[UsageSummary]:
        """Aggregate usage for ALL forks over a time period.

        Used for monthly billing runs across the entire fleet.
        """
        if self._metering is not None:
            raw_list = await self._metering.get_all_usage(start, end)
        else:
            raw_list = []

        summaries: list[UsageSummary] = []
        for raw in raw_list:
            fork_id = raw.get("fork_id", "")
            summary = UsageSummary(
                fork_id=fork_id,
                period_start=start,
                period_end=end,
                total_entities_processed=raw.get("reductions", 0),
                total_queries_served=raw.get("queries", 0),
                reduction_cycles=raw.get("reductions", 0),
            )

            # Enrich each fork
            if self._db_factory is not None:
                fork_data = await self._fetch_fork_metadata(fork_id)
                if fork_data:
                    summary.enabled_modules = fork_data.get(
                        "enabled_modules", [],
                    )
                    storage_bytes = fork_data.get("storage_used_bytes", 0)
                    summary.peak_storage_gb = storage_bytes / (1024 ** 3)
                    entity_count = fork_data.get("entity_count", 0)
                    if entity_count > summary.total_entities_processed:
                        summary.total_entities_processed = entity_count

            summary.total_compute_cost_usd = await self._fetch_compute_cost(
                fork_id, start, end,
            )

            summaries.append(summary)

        # Also include forks that had no metering events but exist in the DB
        if self._db_factory is not None:
            known_ids = {s.fork_id for s in summaries}
            all_forks = await self._fetch_all_fork_ids()
            for fid in all_forks:
                if fid not in known_ids:
                    summaries.append(
                        await self.aggregate_period(fid, start, end)
                    )

        return summaries

    async def get_current_month(self, fork_id: str) -> UsageSummary:
        """Get usage summary for the current calendar month.

        Convenience method for dashboards and real-time cost estimates.
        """
        now = datetime.now(timezone.utc)
        month_start = now.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0,
        )
        return await self.aggregate_period(fork_id, month_start, now)

    # ── Private helpers ──────────────────────────────────────────────

    async def _fetch_fork_metadata(self, fork_id: str) -> dict | None:
        """Load fork metadata from the database."""
        if self._db_factory is None:
            return None

        import uuid as _uuid
        from sqlalchemy import select
        from ..models.fork import Fork

        try:
            async with self._db_factory() as session:
                stmt = select(Fork).where(Fork.id == _uuid.UUID(fork_id))
                result = await session.execute(stmt)
                fork = result.scalar_one_or_none()
                if fork is None:
                    return None
                return {
                    "enabled_modules": fork.enabled_modules or [],
                    "storage_used_bytes": fork.storage_used_bytes or 0,
                    "entity_count": fork.entity_count or 0,
                }
        except Exception as exc:
            logger.error(
                "[usage-agg] fork metadata fetch failed for %s: %s",
                fork_id, exc,
            )
            return None

    async def _fetch_all_fork_ids(self) -> list[str]:
        """Get all active fork IDs from the database."""
        if self._db_factory is None:
            return []

        from sqlalchemy import select
        from ..models.fork import Fork

        try:
            async with self._db_factory() as session:
                stmt = select(Fork.id).where(Fork.status == "active")
                result = await session.execute(stmt)
                return [str(row[0]) for row in result.all()]
        except Exception as exc:
            logger.error("[usage-agg] fetch_all_fork_ids failed: %s", exc)
            return []

    async def _fetch_compute_cost(
        self,
        fork_id: str,
        start: datetime,
        end: datetime,
    ) -> float:
        """Sum estimated_cost_usd from engine QualityMetrics for the period.

        Falls back to 0.0 if no metrics data is available.
        """
        if self._db_factory is None:
            return 0.0

        # QualityMetrics are stored in usage_event metadata when the engine
        # completes a reduction cycle. Sum them up.
        import uuid as _uuid
        from sqlalchemy import select, func
        from ..models.customer import UsageEvent

        try:
            async with self._db_factory() as session:
                stmt = (
                    select(
                        func.sum(
                            func.cast(
                                UsageEvent.event_metadata["estimated_cost_usd"].as_string(),
                                type_=func.numeric,
                            )
                        )
                    )
                    .where(
                        UsageEvent.fork_id == _uuid.UUID(fork_id),
                        UsageEvent.event_type == "reduction",
                        UsageEvent.timestamp >= start,
                        UsageEvent.timestamp < end,
                    )
                )
                result = await session.execute(stmt)
                total = result.scalar()
                return float(total) if total else 0.0
        except Exception:
            # Cost extraction from JSON metadata may fail depending on
            # database backend; degrade gracefully.
            return 0.0
