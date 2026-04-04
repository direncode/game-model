"""BTUT output metrics — comprehensive result container for the full reduction pipeline.

Captures per-tier stats, quality scores, budget spend, timing, and cluster assignments.
Serializable to JSON for storage in CrystallizationJob.training_log JSONB column.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass
class PreFilterStats:
    """Stats from Tier 1 pre-filtering."""

    original_count: int = 0
    entropy_rejected: int = 0
    bloom_dedup_count: int = 0
    lsh_near_dedup_count: int = 0
    survivors: int = 0
    elapsed_seconds: float = 0.0

    @property
    def reduction_ratio(self) -> float:
        return self.original_count / max(self.survivors, 1)


@dataclass
class CascadeLevelStats:
    """Stats from a single cascade level."""

    level: int = 0
    sigma: float = 0.0
    input_count: int = 0
    output_count: int = 0
    iterations_run: int = 0
    final_nash_gap: float = 0.0
    converged: bool = False
    elapsed_seconds: float = 0.0
    clusters_found: int = 0

    @property
    def reduction_ratio(self) -> float:
        return self.input_count / max(self.output_count, 1)


@dataclass
class QualityScores:
    """Quality assurance scores from Tier 8."""

    signal_quality: float = 0.0  # Mean log-density of survivors [0, 1]
    reconstruction_error: float = 0.0  # Mean NN distance to survivor [0, 1]
    coverage: float = 0.0  # Variance preservation ratio [0, 1]
    cluster_stability: float = 0.0  # Bootstrap co-assignment frequency [0, 1]
    downstream_compatibility: float = 0.0  # Heuristic TCD-JEPA quality prediction [0, 1]


@dataclass
class BTUTResult:
    """Complete output from the BTUT extreme data reduction engine.

    Contains the reduced entity/edge lists plus comprehensive metrics
    across all 8 tiers. Serializable to CrystallizationJob.training_log.
    """

    # ── Core output ─────────────────────────────────────────────────────
    survivors: list[dict] = field(default_factory=list)
    survivor_edges: list[dict] = field(default_factory=list)
    survivor_count: int = 0
    original_count: int = 0
    original_edge_count: int = 0
    survivor_edge_count: int = 0

    # ── Per-tier stats ──────────────────────────────────────────────────
    prefilter_stats: PreFilterStats = field(default_factory=PreFilterStats)
    cascade_stats: list[CascadeLevelStats] = field(default_factory=list)
    quality_scores: QualityScores = field(default_factory=QualityScores)

    # ── Budget ──────────────────────────────────────────────────────────
    gpu_seconds_used: float = 0.0
    gpu_cost_dollars: float = 0.0
    budget_remaining_dollars: float = 0.0

    # ── Timing ──────────────────────────────────────────────────────────
    wall_clock_seconds: float = 0.0
    prefilter_seconds: float = 0.0
    embedding_seconds: float = 0.0
    cascade_seconds: float = 0.0
    thinning_seconds: float = 0.0
    quality_check_seconds: float = 0.0

    # ── Cluster info ────────────────────────────────────────────────────
    cluster_count: int = 0
    cluster_summaries: list[dict] = field(default_factory=list)

    # ── Meta ────────────────────────────────────────────────────────────
    config_fingerprint: str = ""
    device_used: str = "cpu"
    dim_schedule_used: list[int] = field(default_factory=list)

    @property
    def total_reduction_ratio(self) -> float:
        return self.original_count / max(self.survivor_count, 1)

    @property
    def edge_reduction_ratio(self) -> float:
        return self.original_edge_count / max(self.survivor_edge_count, 1)

    @property
    def quality_score(self) -> float:
        """Composite quality score across all dimensions."""
        q = self.quality_scores
        return (
            0.30 * q.coverage
            + 0.25 * (1.0 - min(q.reconstruction_error, 1.0))
            + 0.20 * q.signal_quality
            + 0.15 * q.cluster_stability
            + 0.10 * q.downstream_compatibility
        )

    def to_training_log_entry(self) -> dict:
        """Serialize for CrystallizationJob.training_log JSONB column."""
        return {
            "btut": {
                "original_count": self.original_count,
                "survivor_count": self.survivor_count,
                "total_reduction_ratio": round(self.total_reduction_ratio, 1),
                "original_edge_count": self.original_edge_count,
                "survivor_edge_count": self.survivor_edge_count,
                "edge_reduction_ratio": round(self.edge_reduction_ratio, 1),
                "prefilter": {
                    "original": self.prefilter_stats.original_count,
                    "entropy_rejected": self.prefilter_stats.entropy_rejected,
                    "bloom_dedup": self.prefilter_stats.bloom_dedup_count,
                    "lsh_near_dedup": self.prefilter_stats.lsh_near_dedup_count,
                    "survivors": self.prefilter_stats.survivors,
                    "seconds": round(self.prefilter_stats.elapsed_seconds, 2),
                },
                "cascade": [
                    {
                        "level": s.level,
                        "sigma": s.sigma,
                        "input": s.input_count,
                        "output": s.output_count,
                        "iterations": s.iterations_run,
                        "nash_gap": round(s.final_nash_gap, 6),
                        "converged": s.converged,
                        "clusters": s.clusters_found,
                        "seconds": round(s.elapsed_seconds, 2),
                    }
                    for s in self.cascade_stats
                ],
                "quality": {
                    "signal_quality": round(self.quality_scores.signal_quality, 4),
                    "reconstruction_error": round(self.quality_scores.reconstruction_error, 4),
                    "coverage": round(self.quality_scores.coverage, 4),
                    "cluster_stability": round(self.quality_scores.cluster_stability, 4),
                    "downstream_compatibility": round(self.quality_scores.downstream_compatibility, 4),
                    "composite": round(self.quality_score, 4),
                },
                "budget": {
                    "gpu_seconds": round(self.gpu_seconds_used, 1),
                    "gpu_cost_dollars": round(self.gpu_cost_dollars, 4),
                    "remaining_dollars": round(self.budget_remaining_dollars, 2),
                },
                "timing": {
                    "wall_clock": round(self.wall_clock_seconds, 2),
                    "prefilter": round(self.prefilter_seconds, 2),
                    "embedding": round(self.embedding_seconds, 2),
                    "cascade": round(self.cascade_seconds, 2),
                    "thinning": round(self.thinning_seconds, 2),
                    "quality_check": round(self.quality_check_seconds, 2),
                },
                "clusters": self.cluster_count,
                "device": self.device_used,
                "dim_schedule": self.dim_schedule_used,
            }
        }


class Timer:
    """Simple context manager for timing blocks."""

    def __init__(self):
        self.elapsed: float = 0.0
        self._start: float = 0.0

    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, *args):
        self.elapsed = time.perf_counter() - self._start
