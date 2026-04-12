"""Tests for feature matrix construction."""
import numpy as np
import pandas as pd
import pytest


class TestBuildFeatures:
    def test_output_has_12_columns(self):
        from app.services.niv.features import build_base_features
        dates = pd.date_range("2018-01-01", periods=30, freq="MS")
        rng = np.random.RandomState(42)
        frame = pd.DataFrame({
            "niv_raw": np.linspace(-20, 20, 30),
            "thrust": np.tanh(np.linspace(-20, 20, 30) / 50),
            "efficiency_squared": rng.uniform(0.01, 0.10, 30),
            "slack": rng.uniform(0.10, 0.30, 30),
            "drag_total": rng.uniform(0.001, 0.02, 30),
            "drag_spread": rng.uniform(0, 0.01, 30),
            "drag_real_rate": rng.uniform(0, 0.01, 30),
            "drag_vol": rng.uniform(0, 0.005, 30),
            "yield_spread": rng.uniform(-1, 3, 30),
        }, index=dates)
        result = build_base_features(frame, smooth_window=12)
        assert result.shape[1] == 12
        assert len(result) > 0

    def test_standardize_no_lookahead(self):
        from app.services.niv.features import standardize
        X = np.array([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0], [7.0, 8.0]])
        X_train_s, X_test_s, means, stds = standardize(X[:3], X[3:4])
        assert X_test_s.shape == (1, 2)
        expected = (X[3] - X[:3].mean(axis=0)) / X[:3].std(axis=0)
        np.testing.assert_allclose(X_test_s[0], expected, atol=1e-10)

    def test_recession_labels_shifted(self):
        from app.services.niv.features import build_recession_labels
        from app.services.niv.config import NIVConfig
        dates = pd.date_range("2007-06-01", periods=24, freq="MS")
        labels = build_recession_labels(dates, horizon=12, cfg=NIVConfig())
        # 2007-06 + 12 months = 2008-06 → within 2007-12 to 2009-06 recession
        assert labels.iloc[0] == 1

    def test_augmentation_pool_returns_specs(self):
        from app.services.niv.features import build_augmentation_pool
        rng = np.random.RandomState(42)
        dates = pd.date_range("2018-01-01", periods=30, freq="MS")
        frame = pd.DataFrame({
            "niv_raw": np.linspace(-20, 20, 30),
            "smoothed_niv": np.linspace(-20, 20, 30),
            "thrust": rng.uniform(-0.5, 0.5, 30),
            "efficiency_squared": rng.uniform(0.01, 0.10, 30),
            "slack": rng.uniform(0.10, 0.30, 30),
            "drag_total": rng.uniform(0.001, 0.02, 30),
            "drag_spread": rng.uniform(0, 0.01, 30),
            "drag_real_rate": rng.uniform(0, 0.01, 30),
            "drag_vol": rng.uniform(0, 0.005, 30),
            "yield_spread": rng.uniform(-1, 3, 30),
        }, index=dates)
        pool = build_augmentation_pool(frame)
        assert len(pool) > 20  # base 12 + augmented
