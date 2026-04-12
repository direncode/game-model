"""Tests for the NIV ensemble."""
import numpy as np
import pytest


def _make_data(n=200, seed=42):
    rng = np.random.RandomState(seed)
    X = rng.randn(n, 5)
    y = (X[:, 0] + 0.5 * X[:, 1] - 0.3 * X[:, 2] + rng.randn(n) * 0.5 > 1.5).astype(int)
    return X, y


class TestNIVEnsemble:
    def test_fit_predict_shape(self):
        from app.services.niv.ensemble import NIVEnsemble
        X, y = _make_data()
        ens = NIVEnsemble()
        ens.fit(X[:150], y[:150])
        probs = ens.predict_proba(X[150:])
        assert probs.shape == (50,)
        assert np.all((probs >= 0) & (probs <= 1))

    def test_log_odds_combiner(self):
        from app.services.niv.ensemble import log_odds_average, sigmoid, logit
        p1, p2, p3 = 0.7, 0.3, 0.8
        result = log_odds_average(p1, p2, p3)
        expected = sigmoid((logit(p1) + logit(p2) + logit(p3)) / 3)
        assert result == pytest.approx(expected, abs=1e-10)

    def test_per_learner_predictions(self):
        from app.services.niv.ensemble import NIVEnsemble
        X, y = _make_data()
        ens = NIVEnsemble()
        ens.fit(X[:150], y[:150])
        per_learner = ens.predict_per_learner(X[150:])
        assert "lr" in per_learner and "ada" in per_learner and "mlp" in per_learner

    def test_isotonic_calibration(self):
        from app.services.niv.ensemble import NIVEnsemble
        X, y = _make_data(n=300)
        ens = NIVEnsemble(calibrate="last_30pct")
        ens.fit(X[:250], y[:250])
        probs = ens.predict_proba(X[250:])
        assert np.all((probs >= 0) & (probs <= 1))

    def test_stacking_combiner(self):
        from app.services.niv.ensemble import NIVEnsemble
        X, y = _make_data(n=300)
        ens = NIVEnsemble(combiner="stacking")
        ens.fit(X[:250], y[:250])
        probs = ens.predict_proba(X[250:])
        assert probs.shape == (50,)
