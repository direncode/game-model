"""Ensemble aggregation with disagreement detection.

Extracted from NIV's log-odds averaging combiner. Domain-agnostic:
accepts any callables that return a [0, 1] score.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict

import numpy as np


def _logit(p: float) -> float:
    clamped = max(1e-7, min(1 - 1e-7, p))
    return float(np.log(clamped / (1 - clamped)))


def _sigmoid(z: float) -> float:
    z = max(-500, min(500, z))
    return float(1.0 / (1.0 + np.exp(-z)))


@dataclass
class EnsembleResult:
    per_estimator: Dict[str, float]
    combined: float
    disagreement: float


class EnsembleAggregator:
    """Run multiple estimators and combine via log-odds averaging."""

    def __init__(self, estimators: Dict[str, Callable[[Any], float]]):
        self._estimators = estimators

    def evaluate(self, data: Any) -> EnsembleResult:
        scores: Dict[str, float] = {}
        for name, fn in self._estimators.items():
            scores[name] = fn(data)

        values = list(scores.values())
        if len(values) == 1:
            return EnsembleResult(per_estimator=scores, combined=values[0], disagreement=0.0)

        logits = [_logit(v) for v in values]
        combined = _sigmoid(sum(logits) / len(logits))
        disagreement = float(np.std(values))

        return EnsembleResult(per_estimator=scores, combined=combined, disagreement=disagreement)
