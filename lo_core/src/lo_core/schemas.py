"""Typed schemas for findings + validation outputs.

Uses stdlib dataclasses — no pydantic dep required at core level.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ParadigmHypothesis:
    corpus: str
    forgotten: int
    mainstream: int
    control: int
    sample_size: int
    ratio_forgotten_to_competitors: float
    confirmed: bool
    sample_size_warning: bool


@dataclass
class ConvergentCluster:
    cluster: int
    hot_count: int
    total: int
    hot_fraction: float
    dominant_paradigm: str
    dominant_paradigm_share: int


@dataclass
class CrossEraAnchor:
    name: str
    era_class: str
    cluster_majority_era: str
    cluster_majority_count: int
    cluster_size_named: int
    cluster: int
    corpus: str
    subcorpus: str
    anomaly: float


@dataclass
class ConvergenceEntry:
    name: str
    type: str
    convergence: float
    dimensions: dict[str, float]


@dataclass
class SurvivorRank:
    cluster: int
    rank: int
    total_in_cluster: int
    percentile: float


@dataclass
class BridgeSample:
    fp: str
    a_name: str
    b_name: str
    global_count: int
    weight: float


@dataclass
class PairwiseBridge:
    a: str
    b: str
    shared_count: int
    weighted_score: float
    samples: list[BridgeSample] = field(default_factory=list)


@dataclass
class TripleBridge:
    fingerprint: str
    legend_count: int
    legends: list[str]
    entities: list[dict[str, str]]


@dataclass
class Findings:
    """Per-corpus analysis output. Top-level document a customer consumes."""

    corpus_id: str
    survivor_count: int
    cluster_count: int
    paradigm_distribution: dict[str, Any]
    convergent_clusters: list[ConvergentCluster]
    cross_era_anchors: list[CrossEraAnchor]
    convergence_index: list[ConvergenceEntry]
    within_cluster_rank: dict[str, SurvivorRank]


@dataclass
class NullTestResult:
    metric: str
    true_value: float | bool
    null_mean: float | None = None
    null_std: float | None = None
    null_p05: float | None = None
    null_p95: float | None = None
    null_proportion_true: float | None = None
    significant_at_0_05: bool = False


@dataclass
class HoldoutResult:
    held_out: list[str]
    train_bridge_count: int
    full_bridge_count: int
    bridges_involving_heldout: int
    top_heldout_bridge: dict[str, Any] | None


@dataclass
class ValidationReport:
    n_iterations: int
    seed: int
    null_tests: list[NullTestResult]
    holdout: HoldoutResult | None = None
    notes: list[str] = field(default_factory=list)
