"""Module dispatcher — score signals against registered modules.

route_signal() is the stable framework: empty-registry sentinel, top-k,
sort order. score_module() is the learning-mode contribution point —
auto-filled with cosine × purity (balanced default).
"""
from __future__ import annotations

import numpy as np

from .vertical_types import CrystallizedModule, RoutingDecision


def score_module(signal: np.ndarray, module: CrystallizedModule) -> float:
    """Score how well `signal` matches `module`. Higher = better.

    Learning-mode #2 default: cosine × purity.

    - Direction match dominates (cosine on unit-normalized vectors).
    - Purity scales the score linearly so noisy modules are
      downweighted even when they happen to align.
    - Bounded in [-1, 1] → easy to compare across modules and log.
    - O(D) per call — safe for per-request routing.
    """
    sig_norm = float(np.linalg.norm(signal))
    cen_norm = float(np.linalg.norm(module.centroid))
    if sig_norm == 0.0 or cen_norm == 0.0:
        return 0.0
    cosine = float(np.dot(signal, module.centroid) / (sig_norm * cen_norm))
    return cosine * float(module.purity)


def route_signal(
    signal: np.ndarray,
    modules: list[CrystallizedModule],
    *,
    top_k: int = 1,
) -> list[RoutingDecision]:
    """Route a signal embedding against the module registry.

    Returns top-k RoutingDecisions sorted by score descending. Always
    returns at least 1 decision; empty registry returns a sentinel.
    """
    if not modules:
        return [RoutingDecision(module_id=None, score=0.0, reason="empty_registry")]

    scored = [
        RoutingDecision(
            module_id=m.id,
            score=float(score_module(signal, m)),
            reason="scored",
        )
        for m in modules
    ]
    scored.sort(key=lambda d: d.score, reverse=True)
    return scored[: max(1, top_k)]
