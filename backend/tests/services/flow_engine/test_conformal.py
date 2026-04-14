"""Tests for conformal uncertainty bands, extracted from NIV."""
import pytest
from app.services.flow_engine.conformal import ConformalPredictor


class TestConformalPredictor:
    def test_wide_bands_with_no_history(self):
        cp = ConformalPredictor(alpha=0.1, window=100)
        lo, hi = cp.bands(0.5)
        assert lo == 0.0
        assert hi == 1.0

    def test_bands_narrow_with_accurate_history(self):
        cp = ConformalPredictor(alpha=0.1, window=100)
        for _ in range(50):
            cp.update(pred=0.5, actual=0.5)
        lo, hi = cp.bands(0.5)
        assert hi - lo < 0.1

    def test_bands_widen_with_noisy_history(self):
        cp = ConformalPredictor(alpha=0.1, window=100)
        import random
        random.seed(42)
        for _ in range(50):
            cp.update(pred=0.5, actual=random.random())
        lo, hi = cp.bands(0.5)
        assert hi - lo > 0.3

    def test_coverage_tracks_accuracy(self):
        cp = ConformalPredictor(alpha=0.1, window=100)
        for _ in range(100):
            cp.update(pred=0.5, actual=0.5)
        assert cp.coverage() > 0.8

    def test_bands_clamped_to_unit(self):
        cp = ConformalPredictor(alpha=0.1, window=100)
        for _ in range(10):
            cp.update(pred=0.9, actual=0.1)
        lo, hi = cp.bands(0.9)
        assert lo >= 0.0
        assert hi <= 1.0

    def test_batch_update(self):
        cp = ConformalPredictor(alpha=0.1, window=100)
        preds = [0.5] * 20
        actuals = [0.5] * 20
        cp.update_batch(preds, actuals)
        assert cp.coverage() > 0.0
