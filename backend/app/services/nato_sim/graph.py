"""Knowledge graph CRUD for the NATO Simulation.

Property-graph semantics on top of SQLite:

    Node types:   actor | place | event | claim | system | region
    Edge kinds:   mentions | relates-to | contradicts | supports | same-as

All mutating operations are idempotent on their natural unique constraints
so repeated ingest of the same text doesn't bloat the graph.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Literal

from app.services.nato_sim import db

NodeType = Literal["actor", "place", "event", "claim", "system", "region"]
EdgeKind = Literal["mentions", "relates-to", "contradicts", "supports", "same-as"]


@dataclass(frozen=True)
class Entity:
    id: str
    type: NodeType
    canonical_name: str
    metadata: dict[str, Any]


def _row_to_entity(row: Any) -> Entity:
    d = db.row_to_dict(row) or {}
    meta = d.get("metadata")
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except json.JSONDecodeError:
            meta = {}
    return Entity(
        id=d["id"],
        type=d["type"],
        canonical_name=d["canonical_name"],
        metadata=meta if isinstance(meta, dict) else {},
    )


def upsert_entity(
    *,
    type: NodeType,
    canonical_name: str,
    metadata: dict[str, Any] | None = None,
) -> Entity:
    """Idempotently upsert an entity. Returns the canonical row."""
    entity_id = db.upsert(
        "entities",
        ("type", "canonical_name"),
        type=type,
        canonical_name=canonical_name,
        metadata=metadata or {},
    )
    row = db.query_one("SELECT * FROM entities WHERE id = ?", entity_id)
    assert row is not None
    return _row_to_entity(row)


def get_entity_by_name(type: NodeType, canonical_name: str) -> Entity | None:
    row = db.query_one(
        "SELECT * FROM entities WHERE type = ? AND canonical_name = ?",
        type,
        canonical_name,
    )
    return _row_to_entity(row) if row else None


def get_entity(entity_id: str) -> Entity | None:
    row = db.query_one("SELECT * FROM entities WHERE id = ?", entity_id)
    return _row_to_entity(row) if row else None


def add_edge(
    *,
    from_entity: str,
    to_entity: str,
    kind: EdgeKind,
    weight: float = 1.0,
    evidence_message: str | None = None,
) -> str:
    """Idempotent upsert of an edge.

    If ``evidence_message`` is given it's appended to the edge's evidence
    list (stored as JSON) so we can audit which messages support which
    links without duplicating the edge itself.
    """
    existing = db.query_one(
        "SELECT * FROM edges WHERE from_entity = ? AND to_entity = ? AND kind = ?",
        from_entity,
        to_entity,
        kind,
    )
    evidence: list[str] = []
    if existing:
        raw = existing["evidence"]
        if isinstance(raw, str) and raw:
            try:
                evidence = list(json.loads(raw))
            except json.JSONDecodeError:
                evidence = []
    if evidence_message and evidence_message not in evidence:
        evidence.append(evidence_message)
    edge_id = db.upsert(
        "edges",
        ("from_entity", "to_entity", "kind"),
        from_entity=from_entity,
        to_entity=to_entity,
        kind=kind,
        weight=weight,
        evidence=evidence,
    )
    return edge_id


def neighbors(entity_id: str) -> list[Entity]:
    """Return entities reachable in one outbound hop."""
    rows = db.query(
        """
        SELECT e.* FROM edges ed
        JOIN entities e ON e.id = ed.to_entity
        WHERE ed.from_entity = ?
        """,
        entity_id,
    )
    return [_row_to_entity(r) for r in rows]


def degree(entity_id: str) -> int:
    row = db.query_one(
        "SELECT COUNT(*) AS n FROM edges WHERE from_entity = ? OR to_entity = ?",
        entity_id,
        entity_id,
    )
    return int(row["n"]) if row else 0


def top_entities_by_degree(limit: int = 50) -> list[tuple[Entity, int]]:
    """Return the most connected entities, descending by degree."""
    rows = db.query(
        """
        SELECT e.*,
               (SELECT COUNT(*) FROM edges WHERE from_entity = e.id OR to_entity = e.id) AS deg
        FROM entities e
        ORDER BY deg DESC
        LIMIT ?
        """,
        limit,
    )
    out: list[tuple[Entity, int]] = []
    for r in rows:
        d = db.row_to_dict(r) or {}
        deg = int(d.pop("deg", 0))
        out.append((_row_to_entity(r), deg))
    return out


def edges_among(entity_ids: list[str]) -> list[dict[str, Any]]:
    """Return all edges both of whose endpoints are in the given id set.

    Intended for the Network page — takes the top-N entities and returns
    only the edges that run between them, so d3 can render a subgraph.
    """
    if not entity_ids:
        return []
    placeholders = ", ".join("?" * len(entity_ids))
    rows = db.query(
        f"""
        SELECT from_entity, to_entity, kind, weight
        FROM edges
        WHERE from_entity IN ({placeholders})
          AND to_entity IN ({placeholders})
        """,
        *entity_ids,
        *entity_ids,
    )
    return [dict(r) for r in rows]
