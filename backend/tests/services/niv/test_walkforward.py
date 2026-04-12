"""Tests for walk-forward OOS harness and Protocol D."""
import numpy as np
import pandas as pd
import pytest


def _make_frame(n=200, seed=42):
    rng = np.random.RandomState(seed)
    dates = pd.date_range("2000-01-01", periods=n, freq="MS")
    X = rng.randn(n, 12)
    y = (X[:, 0] + 0.5 * X[:, 1] + rng.randn(n) * 0.5 > 1.0).astype(int)
    cols = [f"f{i}" for i in range(12)]
    df = pd.DataFrame(X, columns=cols, index=dates)
    df["recession"] = y
    return df


class TestWalkForward:
    def test_basic_run(self):
        from app.services.niv.walkforward import walkforward, WalkForwardConfig
        from app.services.niv.ensemble import NIVEnsemble
        df = _make_frame()
        config = WalkForwardConfig(warmup_frac=0.3, retrain_every=10, horizons=(3,))
        result = walkforward(df, lambda: NIVEnsemble(), config)
        assert result.horizons == (3,)
        assert len(result.predictions) > 0
        assert 0.0 <= result.auc_by_horizon[3] <= 1.0

    def test_deterministic_seed(self):
        from app.services.niv.walkforward import walkforward, WalkForwardConfig
        from app.services.niv.ensemble import NIVEnsemble
        df = _make_frame()
        config = WalkForwardConfig(warmup_frac=0.3, retrain_every=10, horizons=(3,))
        r1 = walkforward(df, lambda: NIVEnsemble(), config)
        r2 = walkforward(df, lambda: NIVEnsemble(), config)
        assert r1.auc_by_horizon[3] == pytest.approx(r2.auc_by_horizon[3], abs=1e-6)


class TestProtocolD:
    def test_freeze_no_retrain(self):
        from app.services.niv.protocol_d import protocol_d
        from app.services.niv.ensemble import NIVEnsemble
        df = _make_frame(n=100)
        freeze = "2005-01-01"
        result = protocol_d(df, freeze_date=freeze, ensemble=NIVEnsemble(), horizons=(3,))
        for p in result.predictions:
            assert p["date"] >= freeze
        assert result.n_retrain == 0
