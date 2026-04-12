"""Tests for split-conformal prediction layer."""
import numpy as np
import pytest


class TestSplitConformal:
    def test_coverage_synthetic(self):
        from app.services.niv.conformal import SplitConformal
        rng = np.random.RandomState(42)
        cf = SplitConformal(alpha=0.1, window=100)
        preds = rng.uniform(0, 1, 200)
        actuals = (preds > 0.5).astype(int)
        for p, a in zip(preds, actuals):
            cf.update(p, a)
        assert cf.coverage() >= 0.80

    def test_bands_valid(self):
        from app.services.niv.conformal import SplitConformal
        cf = SplitConformal(alpha=0.1, window=50)
        for _ in range(60):
            cf.update(0.5, 0)
        lower, upper = cf.bands(0.6)
        assert lower <= 0.6 <= upper
        assert 0 <= lower and upper <= 1

    def test_empty_returns_wide_band(self):
        from app.services.niv.conformal import SplitConformal
        cf = SplitConformal(alpha=0.1)
        lower, upper = cf.bands(0.5)
        assert lower == 0.0 and upper == 1.0
