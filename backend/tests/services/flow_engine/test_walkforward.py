"""Tests for walk-forward validation harness."""
import pytest
import numpy as np
from app.services.flow_engine.walkforward import WalkForwardConfig, WalkForwardResult, walk_forward


class _DummyModel:
    def __init__(self):
        self._mean = 0.5

    def fit(self, X, y):
        self._mean = float(np.mean(y)) if len(y) > 0 else 0.5

    def predict_proba(self, X):
        n = X.shape[0] if hasattr(X, "shape") else len(X)
        probs = np.full((n, 2), 0.5)
        probs[:, 1] = self._mean
        probs[:, 0] = 1.0 - self._mean
        return probs


def _make_data(n: int = 100):
    rng = np.random.RandomState(42)
    X = rng.randn(n, 3)
    y = (X[:, 0] > 0).astype(int)
    return X, y


class TestWalkForward:
    def test_returns_result(self):
        X, y = _make_data(100)
        cfg = WalkForwardConfig(warmup_frac=0.3, retrain_every=5, horizons=(1, 3))
        result = walk_forward(X, y, lambda: _DummyModel(), cfg)
        assert isinstance(result, WalkForwardResult)
        assert result.n_folds > 0

    def test_predictions_populated(self):
        X, y = _make_data(100)
        cfg = WalkForwardConfig(warmup_frac=0.3, retrain_every=5, horizons=(1,))
        result = walk_forward(X, y, lambda: _DummyModel(), cfg)
        assert len(result.predictions) > 0

    def test_metrics_per_horizon(self):
        X, y = _make_data(200)
        cfg = WalkForwardConfig(warmup_frac=0.2, retrain_every=5, horizons=(1, 3))
        result = walk_forward(X, y, lambda: _DummyModel(), cfg)
        for h in (1, 3):
            assert h in result.brier_by_horizon

    def test_conformal_bands_present(self):
        X, y = _make_data(100)
        cfg = WalkForwardConfig(warmup_frac=0.3, retrain_every=5, horizons=(1,))
        result = walk_forward(X, y, lambda: _DummyModel(), cfg)
        for pred in result.predictions:
            assert "conformal_lower" in pred
            assert "conformal_upper" in pred
