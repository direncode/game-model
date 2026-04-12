"""Sync bridge for recording lineage events from the data layer pipeline.

The ``LineageTracker`` in ``app.services.governance.lineage_tracker`` is
async (requires ``AsyncSession``). The data layer facade is sync. This
bridge queues events during a pipeline run and provides an ``async flush()``
that persists them in a single batch.

Usage:
    bridge = DataLayerLineageBridge()
    layer = LatentOceanDataLayer(lineage=bridge)
    layer.run("edgar")
    # Later, in an async context:
    await bridge.flush(tracker, subject_id=..., actor_id=...)
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    pass  # LineageTracker imported only at flush time


@dataclass
class PendingLineageEvent:
    """A lineage event waiting to be flushed."""

    action: str  # "ingest", "btut_reduce", "manifold_project", "export", "cross_link"
    inputs: dict | None = None
    outputs: dict | None = None
    parameters: dict | None = None


class DataLayerLineageBridge:
    """Collects lineage events synchronously; flush via async later.

    Each call to ``record()`` appends an event to an internal list.
    Events are ordered and form a chain: when flushed, each event's
    ``parent_event_id`` is set to the previous event's id, creating
    a DAG that traces the full pipeline run.

    If ``flush()`` is never called, the events are simply garbage
    collected — no side effects.
    """

    def __init__(self, run_id: uuid.UUID | None = None) -> None:
        self.run_id = run_id or uuid.uuid4()
        self.events: list[PendingLineageEvent] = []

    def record(
        self,
        action: str,
        inputs: dict | None = None,
        outputs: dict | None = None,
        parameters: dict | None = None,
    ) -> None:
        """Queue a lineage event. Called from LatentOceanDataLayer stages."""
        self.events.append(
            PendingLineageEvent(
                action=action,
                inputs=inputs,
                outputs=outputs,
                parameters=parameters,
            )
        )

    async def flush(
        self,
        tracker: Any,
        subject_id: uuid.UUID,
        actor_id: uuid.UUID,
    ) -> list[Any]:
        """Flush all queued events to the real LineageTracker.

        Events are chained: each event's ``parent_event_id`` is set to
        the previous event's ``id``, producing a linear DAG.

        Args:
            tracker: A ``LineageTracker`` instance (imported at call time
                to avoid circular/env dependencies).
            subject_id: UUID of the ocean run / dataset being processed.
            actor_id: UUID of the user / system that triggered the run.

        Returns:
            List of created ``LineageEvent`` objects.
        """
        created: list[Any] = []
        parent_id: uuid.UUID | None = None
        for pe in self.events:
            event = await tracker.record_event(
                event_type="data_layer",
                subject_type="ocean_run",
                subject_id=subject_id,
                actor_type="system",
                actor_id=actor_id,
                action=pe.action,
                inputs=pe.inputs,
                outputs=pe.outputs,
                parameters=pe.parameters,
                parent_event_id=parent_id,
            )
            parent_id = event.id
            created.append(event)
        return created

    def summary(self) -> list[dict]:
        """Return a plain-dict summary of queued events (for debugging/logging)."""
        return [
            {
                "action": e.action,
                "inputs": e.inputs,
                "outputs": e.outputs,
            }
            for e in self.events
        ]
