"""Split-conformal prediction for uncertainty bands on any [0,1] metric.

Extracted from NIV's conformal.py. Domain-agnostic.
"""
from __future__ import annotations

from collections import deque
from typing import Sequence

import numpy as np


class ConformalPredictor:
    """Online conformal predictor with rolling nonconformity scores."""

    def __init__(self, alpha: float = 0.1, window: int = 100):
        self.alpha = alpha
        self.window = window
        self._scores: deque[float] = deque(maxlen=window)
        self._correct: deque[bool] = deque(maxlen=window)

    def update(self, pred: float, actual: float) -> None:
        nonconformity = abs(pred - actual)
        self._scores.append(nonconformity)
        lo, hi = self.bands(pred)
        self._correct.append(lo <= actual <= hi)

    def update_batch(self, preds: Sequence[float], actuals: Sequence[float]) -> None:
        for p, a in zip(preds, actuals):
            self.update(p, a)

    def bands(self, pred: float) -> tuple[float, float]:
        if len(self._scores) < 2:
            return (0.0, 1.0)
        scores = np.array(self._scores)
        q = float(np.quantile(scores, 1 - self.alpha))
        lower = max(0.0, pred - q)
        upper = min(1.0, pred + q)
        return (float(lower), float(upper))

    def coverage(self) -> float:
        if not self._correct:
            return 0.0
        return sum(self._correct) / len(self._correct)
