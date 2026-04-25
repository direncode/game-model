"""Hidden-connection finder — BFS over the knowledge graph.

Given a starting entity, returns paths of length ≥2 that were not
explicitly stated in any single source. A path here is ``[(entity, via_kind), ...]``
where ``via_kind`` is the edge kind that brought us to that entity from
the previous one.

This is the analytical surface that produces the "these two actors are
linked through X" insights the Daily Read surfaces. The value is in the
paths that surprise the analyst — the ones where A and C don't co-occur
in any source but both touch B, so the pipeline finds the link.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services.nato_sim import db
from app.services.nato_sim.graph import Entity, _row_to_entity


@dataclass(frozen=True)
class PathStep:
    entity: Entity
    via: str  # the edge kind that connects the previous node to this one


Path = list[PathStep]


def find_hidden_connections(
    *,
    start_id: str,
    max_hops: int = 3,
    limit: int = 50,
    min_hops: int = 2,
) -> list[Path]:
    """BFS outward from ``start_id`` returning non-direct paths.

    Paths of length < ``min_hops`` are discarded (those are direct edges,
    not hidden connections). The search halts when ``limit`` paths have
    been accumulated, to keep latency bounded.
    """
    if max_hops < min_hops:
        return []

    visited: set[str] = {start_id}
    # queue holds (current_node_id, path_taken)
    queue: list[tuple[str, Path]] = [(start_id, [])]
    out: list[Path] = []

    while queue and len(out) < limit:
        node_id, path = queue.pop(0)
        if len(path) >= max_hops:
            continue

        rows = db.query(
            """
            SELECT e.*, ed.kind AS via_kind
            FROM edges ed
            JOIN entities e ON e.id = ed.to_entity
            WHERE ed.from_entity = ?
            LIMIT 20
            """,
            node_id,
        )
        for r in rows:
            to_id = r["id"]
            if to_id in visited:
                continue
            visited.add(to_id)
            step = PathStep(entity=_row_to_entity(r), via=r["via_kind"])
            extended = path + [step]
            if len(extended) >= min_hops:
                out.append(extended)
                if len(out) >= limit:
                    break
            queue.append((to_id, extended))

    return out


def summarize_path(path: Path) -> str:
    """Render a path as a one-line human-readable chain.

    Example: 'Russia --(mentions)--> Belarus --(relates-to)--> Suwałki corridor'
    """
    if not path:
        return ""
    parts: list[str] = []
    for step in path:
        parts.append(f"--({step.via})--> {step.entity.canonical_name}")
    return " ".join(parts)
