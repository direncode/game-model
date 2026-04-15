"""SDK response types."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ReduceResult:
    """Result of a reduction job."""

    job_id: str
    status: str
    entity_count: int
    survivor_count: int
    reduction_ratio: int
    wall_seconds: float
    cost_usd: float


@dataclass
class QueryResult:
    """Result of a natural-language query against survivors."""

    survivors: list[dict] = field(default_factory=list)
    connections: list[dict] = field(default_factory=list)
    narratives: list[str] = field(default_factory=list)
    total_matches: int = 0


@dataclass
class SurvivorList:
    """Paginated list of survivors."""

    survivors: list[dict] = field(default_factory=list)
    total: int = 0
    page: int = 1
    per_page: int = 100


@dataclass
class StatusResult:
    """Fork status and health information."""

    fork_id: str = ""
    status: str = "unknown"
    entity_count: int = 0
    last_reduction_at: str = ""
    enabled_modules: list[str] = field(default_factory=list)
    health: dict = field(default_factory=dict)


@dataclass
class ExportResult:
    """Result of an export operation."""

    format: str = "csv"
    path: str | None = None
    size_bytes: int = 0
    row_count: int = 0
