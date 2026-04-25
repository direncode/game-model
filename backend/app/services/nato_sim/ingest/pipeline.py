"""Unified ingest pipeline.

Every inbound message — Discord, webhook, paste, RSS item, harvested
doc chunk — flows through ``ingest_message``. The pipeline:

    1. Inserts the raw message into ``messages`` (so we keep a full audit
       trail even if downstream processing fails).
    2. Runs the resolver to extract entities + claims.
    3. Upserts entities into the graph.
    4. Adds ``mentions`` edges between every pair of co-mentioned entities
       in the message, tagged with the message id as evidence.
    5. Scores priority via the operator judgment function and updates the
       message row.
    6. Returns the message id.

The pipeline is intentionally synchronous-feeling but awaits on the LLM
call inside the resolver. It does not regenerate affected cards here —
that's a post-MVP feature that rides on top of the event log.
"""

from __future__ import annotations

import logging
from typing import Any

from app.services.nato_sim import db
from app.services.nato_sim.graph import add_edge, upsert_entity
from app.services.nato_sim.judgment import score_priority
from app.services.nato_sim.resolver import resolve

logger = logging.getLogger(__name__)


async def ingest_message(
    *,
    source: str,
    content: str,
    channel: str | None = None,
    author: str | None = None,
    raw_json: dict[str, Any] | None = None,
) -> str:
    """Ingest one message end-to-end. Returns the new message id."""
    # 1. Insert raw row first so we never lose the message on a downstream
    # failure.
    message_id = db.insert(
        "messages",
        source=source,
        channel=channel,
        author=author,
        content=content,
        raw_json=raw_json or {},
    )

    # 2. Resolve entities + claims.
    try:
        resolved = await resolve(content)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ingest: resolver failed for msg=%s: %s", message_id, exc)
        resolved = None

    # 3. Upsert entities.
    entity_ids: list[str] = []
    canonical_names: list[str] = []
    if resolved is not None:
        for e in resolved.entities:
            try:
                ent = upsert_entity(
                    type=e.type,
                    canonical_name=e.canonical_name,
                    metadata={"aliases": list(e.aliases)} if e.aliases else {},
                )
                entity_ids.append(ent.id)
                canonical_names.append(ent.canonical_name)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "ingest: upsert failed for entity %s: %s", e.canonical_name, exc
                )

    # 4. Link co-mentioned entities with weak 'mentions' edges.
    for i in range(len(entity_ids)):
        for j in range(i + 1, len(entity_ids)):
            try:
                add_edge(
                    from_entity=entity_ids[i],
                    to_entity=entity_ids[j],
                    kind="mentions",
                    weight=0.3,
                    evidence_message=message_id,
                )
            except Exception as exc:  # noqa: BLE001
                logger.debug("ingest: edge add failed: %s", exc)

    # 5. Score priority and update message row.
    try:
        priority = score_priority(content=content, mentioned_entities=canonical_names)
        db.execute(
            "UPDATE messages SET priority = ?, processed_at = datetime('now') WHERE id = ?",
            priority,
            message_id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("ingest: priority scoring failed for msg=%s: %s", message_id, exc)

    # 6. Emit a structured event for downstream SSE consumers.
    db.insert(
        "events_log",
        kind="message.ingested",
        payload={
            "message_id": message_id,
            "source": source,
            "entity_count": len(entity_ids),
        },
    )

    return message_id
