"""Usage metering — track entity counts, queries, storage per fork.

Records fine-grained usage events and aggregates them for billing periods.
Each event has a type (reduction, query, storage, api_call), a count,
and optional metadata. Events are persisted to the usage_events table
and aggregated by MeteringService for billing and reporting.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class MeteringService:
    """Track and aggregate usage metrics per fork.

    Provides methods to record individual usage events and query
    aggregated usage for billing periods.

    Args:
        db_session_factory: Async SQLAlchemy session factory.
    """

    def __init__(self, db_session_factory: Any = None) -> None:
        self._db_factory = db_session_factory
        # In-memory buffer for batch flushing
        self._buffer: list[dict] = []
        self._buffer_max = 100

    async def record_event(
        self,
        fork_id: str,
        event_type: str,
        count: int = 1,
        metadata: dict | None = None,
    ) -> str:
        """Record a single usage event.

        Args:
            fork_id: UUID of the fork generating the event.
            event_type: Type of event — one of:
                "reduction"  — engine reduction cycle
                "query"      — API query served
                "storage"    — storage change (count = bytes delta)
                "api_call"   — generic API call
            count: Number of units for this event.
            metadata: Optional dict with extra event details.

        Returns:
            UUID of the created event.
        """
        event_id = str(uuid.uuid4())
        event = {
            "id": event_id,
            "fork_id": fork_id,
            "event_type": event_type,
            "count": count,
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc),
        }

        self._buffer.append(event)

        if len(self._buffer) >= self._buffer_max:
            await self._flush_buffer()

        logger.debug(
            "[metering] recorded event: fork=%s type=%s count=%d",
            fork_id,
            event_type,
            count,
        )
        return event_id

    async def _flush_buffer(self) -> None:
        """Flush buffered events to the database."""
        if not self._buffer:
            return

        events = self._buffer[:]
        self._buffer.clear()

        if self._db_factory is None:
            logger.debug(
                "[metering] no db_factory — %d events discarded",
                len(events),
            )
            return

        from ..models.customer import UsageEvent

        try:
            async with self._db_factory() as session:
                for e in events:
                    session.add(
                        UsageEvent(
                            id=uuid.UUID(e["id"]),
                            fork_id=uuid.UUID(e["fork_id"]),
                            customer_id=uuid.UUID(
                                e["metadata"].get("customer_id", str(uuid.uuid4()))
                            ),
                            event_type=e["event_type"],
                            count=e["count"],
                            metadata=e["metadata"],
                            timestamp=e["timestamp"],
                        )
                    )
                await session.commit()

            logger.info("[metering] flushed %d events", len(events))
        except Exception as exc:
            logger.error("[metering] flush failed: %s", exc)
            # Re-buffer failed events
            self._buffer.extend(events)

    async def get_usage(
        self,
        fork_id: str,
        period_start: datetime,
        period_end: datetime,
    ) -> dict:
        """Get aggregated usage for a single fork over a time period.

        Args:
            fork_id: UUID of the fork.
            period_start: Start of the billing period (inclusive).
            period_end: End of the billing period (exclusive).

        Returns:
            Dict with aggregated counts by event type:
            {
                "fork_id": "...",
                "period_start": "...",
                "period_end": "...",
                "reductions": 12,
                "queries": 4500,
                "api_calls": 8200,
                "storage_delta_bytes": 1048576,
                "total_events": 12714,
            }
        """
        # Flush any pending events first
        await self._flush_buffer()

        if self._db_factory is None:
            return self._empty_usage(fork_id, period_start, period_end)

        from sqlalchemy import select, func
        from ..models.customer import UsageEvent

        try:
            async with self._db_factory() as session:
                stmt = (
                    select(
                        UsageEvent.event_type,
                        func.sum(UsageEvent.count).label("total"),
                        func.count(UsageEvent.id).label("event_count"),
                    )
                    .where(
                        UsageEvent.fork_id == uuid.UUID(fork_id),
                        UsageEvent.timestamp >= period_start,
                        UsageEvent.timestamp < period_end,
                    )
                    .group_by(UsageEvent.event_type)
                )
                result = await session.execute(stmt)
                rows = result.all()

            usage = self._empty_usage(fork_id, period_start, period_end)
            total_events = 0
            for event_type, total, event_count in rows:
                total_events += event_count
                if event_type == "reduction":
                    usage["reductions"] = total
                elif event_type == "query":
                    usage["queries"] = total
                elif event_type == "api_call":
                    usage["api_calls"] = total
                elif event_type == "storage":
                    usage["storage_delta_bytes"] = total
            usage["total_events"] = total_events
            return usage

        except Exception as exc:
            logger.error("[metering] get_usage failed: %s", exc)
            return self._empty_usage(fork_id, period_start, period_end)

    async def get_all_usage(
        self,
        period_start: datetime,
        period_end: datetime,
    ) -> list[dict]:
        """Get aggregated usage for ALL forks over a time period.

        Used for billing runs and fleet-wide reporting.

        Args:
            period_start: Start of the billing period (inclusive).
            period_end: End of the billing period (exclusive).

        Returns:
            List of per-fork usage dicts (same shape as get_usage output).
        """
        await self._flush_buffer()

        if self._db_factory is None:
            return []

        from sqlalchemy import select, func
        from ..models.customer import UsageEvent

        try:
            async with self._db_factory() as session:
                stmt = (
                    select(
                        UsageEvent.fork_id,
                        UsageEvent.event_type,
                        func.sum(UsageEvent.count).label("total"),
                        func.count(UsageEvent.id).label("event_count"),
                    )
                    .where(
                        UsageEvent.timestamp >= period_start,
                        UsageEvent.timestamp < period_end,
                    )
                    .group_by(UsageEvent.fork_id, UsageEvent.event_type)
                )
                result = await session.execute(stmt)
                rows = result.all()

            # Group by fork_id
            fork_map: dict[str, dict] = {}
            for fork_id, event_type, total, event_count in rows:
                fid = str(fork_id)
                if fid not in fork_map:
                    fork_map[fid] = self._empty_usage(
                        fid, period_start, period_end
                    )
                usage = fork_map[fid]
                usage["total_events"] = (
                    usage.get("total_events", 0) + event_count
                )
                if event_type == "reduction":
                    usage["reductions"] = total
                elif event_type == "query":
                    usage["queries"] = total
                elif event_type == "api_call":
                    usage["api_calls"] = total
                elif event_type == "storage":
                    usage["storage_delta_bytes"] = total

            return list(fork_map.values())

        except Exception as exc:
            logger.error("[metering] get_all_usage failed: %s", exc)
            return []

    async def get_fork_summary(self, fork_id: str) -> dict:
        """Get a quick summary of a fork's all-time usage.

        Returns:
            Dict with total reductions, queries, and storage.
        """
        from datetime import datetime as dt

        return await self.get_usage(
            fork_id,
            period_start=dt(2020, 1, 1, tzinfo=timezone.utc),
            period_end=datetime.now(timezone.utc),
        )

    @staticmethod
    def _empty_usage(
        fork_id: str,
        period_start: datetime,
        period_end: datetime,
    ) -> dict:
        return {
            "fork_id": fork_id,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "reductions": 0,
            "queries": 0,
            "api_calls": 0,
            "storage_delta_bytes": 0,
            "total_events": 0,
        }
