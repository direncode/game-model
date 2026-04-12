"""Insight — the atomic unit of tactical intelligence the engine emits.

Each insight is a single "something interesting just happened" event with a
natural-language title, a templated summary, the actors involved, numeric
evidence, and which audience roles should see it (manager vs technical_staff).
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Iterable, Literal

InsightKind = Literal[
    "under_run",
    "pressing_shift",
    "convergence",
    "transition",
    "info",
]
Severity = Literal["info", "notable", "critical"]
Audience = Literal["manager", "technical_staff"]


@dataclass
class Insight:
    id: str
    t: float
    kind: InsightKind
    severity: Severity
    title: str
    summary: str
    actors: list[str] = field(default_factory=list)
    evidence: dict[str, float | int | str] = field(default_factory=dict)
    audience: list[Audience] = field(default_factory=lambda: ["manager", "technical_staff"])

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "t": self.t,
            "kind": self.kind,
            "severity": self.severity,
            "title": self.title,
            "summary": self.summary,
            "actors": list(self.actors),
            "evidence": dict(self.evidence),
            "audience": list(self.audience),
        }


class InsightStream:
    """Thin buffer for insights. Keeps the most recent N for replay.

    The WS frame serializer reads `drain_new()` to get insights produced
    during the current tick; the REST endpoints read `recent()` for lobby
    replays when a late-joining client connects.
    """

    def __init__(self, max_recent: int = 256) -> None:
        self._all: deque[Insight] = deque(maxlen=max_recent)
        self._unflushed: list[Insight] = []

    def push(self, insight: Insight) -> None:
        self._all.append(insight)
        self._unflushed.append(insight)

    def drain_new(self) -> list[Insight]:
        out = self._unflushed
        self._unflushed = []
        return out

    def recent(self, n: int = 50) -> list[Insight]:
        return list(self._all)[-n:]

    def extend(self, items: Iterable[Insight]) -> None:
        for it in items:
            self.push(it)
