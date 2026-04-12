"""Split-conformal prediction for uncertainty bands on recession probabilities.

Port of oosTests.ts ConformalPredictor(0.1) with 100-score rolling window.
"""
from __future__ import annotations

from collections import deque

import numpy as np


class SplitConformal:
    """Online conformal predictor with rolling nonconformity scores."""

    def __init__(self, alpha: float = 0.1, window: int = 100):
        self.alpha = alpha
        self.window = window
        self._scores: deque[float] = deque(maxlen=window)
        self._correct: deque[bool] = deque(maxlen=window)

    def update(self, pred: float, actual: int) -> None:
        nonconformity = abs(pred - actual)
        self._scores.append(nonconformity)
        lo, hi = self.bands(pred)
        self._correct.append(lo <= actual <= hi)

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
