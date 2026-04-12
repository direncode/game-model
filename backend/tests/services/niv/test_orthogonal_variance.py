"""Tests for orthogonal variance decomposition."""
import numpy as np
import pandas as pd
import pytest


class TestOrthogonalVariance:
    def test_perfectly_orthogonal(self):
        from app.services.niv.orthogonal_variance import orthogonal_variance
        rng = np.random.RandomState(42)
        niv = pd.Series(rng.randn(200))
        benchmark = pd.Series(rng.randn(200))
        result = orthogonal_variance(niv, benchmark, lags=3, bootstrap_iters=50)
        assert result.fraction > 0.80

    def test_perfectly_correlated(self):
        from app.services.niv.orthogonal_variance import orthogonal_variance
        niv = pd.Series(np.arange(200, dtype=float))
        benchmark = niv * 2 + 1
        result = orthogonal_variance(niv, benchmark, lags=0, bootstrap_iters=50)
        assert result.fraction < 0.05

    def test_ci_contains_point_estimate(self):
        from app.services.niv.orthogonal_variance import orthogonal_variance
        rng = np.random.RandomState(42)
        niv = pd.Series(rng.randn(100))
        benchmark = pd.Series(rng.randn(100))
        result = orthogonal_variance(niv, benchmark, lags=2, bootstrap_iters=100)
        assert result.ci_95[0] <= result.fraction <= result.ci_95[1]
