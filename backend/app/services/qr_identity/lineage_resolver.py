"""Tier-gated lineage resolution for QR identities."""

from __future__ import annotations

import uuid
from typing import Any

from app.services.governance.lineage_tracker import LineageTracker


class QRLineageResolver:
    def __init__(self, lineage_tracker: LineageTracker) -> None:
        self._tracker = lineage_tracker

    async def resolve(
        self,
        subject_type: str,
        subject_id: uuid.UUID,
        tier: str,
    ) -> dict[str, Any]:
        """Resolve lineage for an entity, gated by access tier."""
        if tier == "public":
            return await self._public_lineage(subject_id)
        elif tier == "org":
            return await self._org_lineage(subject_id)
        else:
            return await self._admin_lineage(subject_id)

    async def _public_lineage(self, subject_id: uuid.UUID) -> dict[str, Any]:
        events = await self._tracker.get_lineage(subject_id, max_depth=2)
        return {
            "summary": {
                "event_count": len(events),
                "latest_event": events[0] if events else None,
                "depth": "shallow",
            }
        }

    async def _org_lineage(self, subject_id: uuid.UUID) -> dict[str, Any]:
        events = await self._tracker.get_lineage(subject_id, max_depth=50)
        graph = await self._tracker.get_lineage_graph(subject_id)
        return {
            "summary": {
                "event_count": len(events),
                "latest_event": events[0] if events else None,
                "depth": "full",
            },
            "events": events,
            "graph": graph,
        }

    async def _admin_lineage(self, subject_id: uuid.UUID) -> dict[str, Any]:
        result = await self._org_lineage(subject_id)
        return result
