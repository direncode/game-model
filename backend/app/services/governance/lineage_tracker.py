"""W3C PROV-compatible data lineage tracking.

Provides append-only lineage event recording and graph traversal
for full provenance chain reconstruction.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.governance import LineageEvent

logger = logging.getLogger(__name__)


@dataclass
class LineageNode:
    """A node in the lineage graph."""

    event_id: str
    event_type: str
    subject_type: str
    subject_id: str
    action: str
    created_at: str
    children: list[LineageNode] = field(default_factory=list)


class LineageTracker:
    """W3C PROV-compatible lineage tracking with append-only semantics.

    All lineage events are immutable once recorded. Events form a
    directed acyclic graph via parent_event_id references.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def record_event(
        self,
        event_type: str,
        subject_type: str,
        subject_id: uuid.UUID,
        actor_type: str,
        actor_id: uuid.UUID,
        action: str,
        inputs: dict | None = None,
        outputs: dict | None = None,
        parameters: dict | None = None,
        parent_event_id: uuid.UUID | None = None,
    ) -> LineageEvent:
        """Record an immutable lineage event.

        Args:
            event_type: Category of event (ingestion, crystallization, etc.).
            subject_type: Type of the primary subject (dataset, module, etc.).
            subject_id: UUID of the subject.
            actor_type: Type of actor (user, system, job).
            actor_id: UUID of the actor.
            action: Human-readable action description.
            inputs: Optional input artifacts/parameters.
            outputs: Optional output artifacts.
            parameters: Optional processing parameters.
            parent_event_id: Optional parent event for lineage chaining.

        Returns:
            Created LineageEvent instance.
        """
        event = LineageEvent(
            event_type=event_type,
            subject_type=subject_type,
            subject_id=subject_id,
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            inputs=inputs,
            outputs=outputs,
            parameters=parameters,
            parent_event_id=parent_event_id,
        )

        self._db.add(event)
        await self._db.flush()

        logger.info(
            "Lineage event recorded: type=%s, subject=%s/%s, action=%s",
            event_type,
            subject_type,
            subject_id,
            action,
        )
        return event

    async def get_lineage(
        self, subject_id: uuid.UUID, max_depth: int = 50
    ) -> list[LineageEvent]:
        """Walk the parent chain for a subject.

        Traverses from the most recent event for the subject up through
        parent events, building a chronological lineage chain.

        Args:
            subject_id: UUID of the subject to trace.
            max_depth: Maximum chain depth to prevent infinite loops.

        Returns:
            List of LineageEvent from newest to oldest.
        """
        # Get all events for this subject
        result = await self._db.execute(
            select(LineageEvent)
            .where(LineageEvent.subject_id == subject_id)
            .order_by(LineageEvent.created_at.desc())
        )
        subject_events = list(result.scalars().all())

        if not subject_events:
            return []

        # Walk parent chain from the latest event
        chain: list[LineageEvent] = []
        visited: set[uuid.UUID] = set()
        current = subject_events[0]

        depth = 0
        while current and depth < max_depth:
            if current.id in visited:
                logger.warning(
                    "Cycle detected in lineage chain at event %s", current.id
                )
                break

            visited.add(current.id)
            chain.append(current)
            depth += 1

            if current.parent_event_id is None:
                break

            parent_result = await self._db.execute(
                select(LineageEvent).where(
                    LineageEvent.id == current.parent_event_id
                )
            )
            current = parent_result.scalar_one_or_none()

        logger.debug(
            "Lineage chain for subject %s: %d events, depth=%d",
            subject_id,
            len(chain),
            depth,
        )
        return chain

    async def get_lineage_graph(
        self, subject_id: uuid.UUID
    ) -> LineageNode | None:
        """Build a full provenance graph for a subject.

        Returns a tree structure with the root event and all descendant
        events that reference it via parent_event_id.

        Args:
            subject_id: UUID of the root subject.

        Returns:
            Root LineageNode with children, or None if no events found.
        """
        # Get all events related to this subject
        result = await self._db.execute(
            select(LineageEvent)
            .where(LineageEvent.subject_id == subject_id)
            .order_by(LineageEvent.created_at.asc())
        )
        all_events = list(result.scalars().all())

        if not all_events:
            return None

        # Also get descendant events (events whose parent is in our set)
        event_ids = {e.id for e in all_events}
        descendants = await self._fetch_descendants(event_ids)
        all_events.extend(descendants)

        # Build tree
        nodes: dict[uuid.UUID, LineageNode] = {}
        for event in all_events:
            nodes[event.id] = LineageNode(
                event_id=str(event.id),
                event_type=event.event_type,
                subject_type=event.subject_type,
                subject_id=str(event.subject_id),
                action=event.action,
                created_at=event.created_at.isoformat() if event.created_at else "",
            )

        # Link children
        root: LineageNode | None = None
        for event in all_events:
            node = nodes[event.id]
            if event.parent_event_id and event.parent_event_id in nodes:
                nodes[event.parent_event_id].children.append(node)
            elif root is None or (
                event.created_at and (root.created_at == "" or event.created_at.isoformat() < root.created_at)
            ):
                root = node

        return root

    async def _fetch_descendants(
        self, parent_ids: set[uuid.UUID], max_depth: int = 10
    ) -> list[LineageEvent]:
        """Recursively fetch descendant events."""
        descendants: list[LineageEvent] = []
        current_ids = parent_ids

        for _ in range(max_depth):
            if not current_ids:
                break

            result = await self._db.execute(
                select(LineageEvent).where(
                    LineageEvent.parent_event_id.in_(current_ids)
                )
            )
            children = list(result.scalars().all())
            if not children:
                break

            descendants.extend(children)
            current_ids = {c.id for c in children}

        return descendants

    async def get_events_by_type(
        self,
        event_type: str,
        subject_id: uuid.UUID | None = None,
        limit: int = 100,
    ) -> list[LineageEvent]:
        """Query lineage events by type.

        Args:
            event_type: Event type filter.
            subject_id: Optional subject filter.
            limit: Maximum results.

        Returns:
            List of matching LineageEvent instances.
        """
        conditions = [LineageEvent.event_type == event_type]
        if subject_id:
            conditions.append(LineageEvent.subject_id == subject_id)

        result = await self._db.execute(
            select(LineageEvent)
            .where(and_(*conditions))
            .order_by(LineageEvent.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
