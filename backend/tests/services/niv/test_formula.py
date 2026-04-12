"""Tests for the NIV formula layer — parity with niv.rs."""
import math
import numpy as np
import pandas as pd
import pytest


class TestThrust:
    def test_zero_inputs(self):
        from app.services.niv.formula import thrust
        assert thrust(0.0, 0.0, 0.0) == pytest.approx(0.0, abs=1e-10)

    def test_positive_growth(self):
        from app.services.niv.formula import thrust
        result = thrust(dG=5.0, dA=3.0, dr=1.0)
        assert result == pytest.approx(math.tanh(7.3 / 10.0), abs=1e-6)

    def test_strong_rate_hike(self):
        from app.services.niv.formula import thrust
        result = thrust(dG=1.0, dA=1.0, dr=10.0)
        assert result < 0

    def test_tanh_bounds(self):
        from app.services.niv.formula import thrust
        assert -1.0 < thrust(100.0, 100.0, 0.0) <= 1.0
        assert -1.0 <= thrust(0.0, 0.0, 100.0) < 1.0


class TestEfficiencySquared:
    def test_normal(self):
        from app.services.niv.formula import efficiency_squared
        result = efficiency_squared(investment=1000.0, gdp=5000.0)
        assert result == pytest.approx(0.0529, abs=1e-6)

    def test_zero_gdp(self):
        from app.services.niv.formula import efficiency_squared
        assert efficiency_squared(investment=1000.0, gdp=0.0) == 0.0


class TestSlack:
    def test_normal(self):
        from app.services.niv.formula import slack
        assert slack(80.0) == pytest.approx(0.20, abs=1e-10)

    def test_full_capacity(self):
        from app.services.niv.formula import slack
        assert slack(100.0) == pytest.approx(0.0, abs=1e-10)


class TestDrag:
    def test_inverted_curve(self):
        from app.services.niv.formula import drag
        result = drag(yield_spread=-2.0, fed_funds=5.0, cpi_inflation=3.0, sigma_r=1.5)
        assert result.total == pytest.approx(0.008 + 0.008 + 0.003, abs=1e-6)

    def test_positive_spread_no_penalty(self):
        from app.services.niv.formula import drag
        result = drag(yield_spread=2.0, fed_funds=2.0, cpi_inflation=3.0, sigma_r=0.5)
        assert result.spread == 0.0
        assert result.real_rate == 0.0


class TestNIVScore:
    def test_clamp_high(self):
        from app.services.niv.formula import niv_score
        score = niv_score(u=0.5, P_sq=0.04, X=0.2, F=0.01)
        assert score == 100.0

    def test_clamp_low(self):
        from app.services.niv.formula import niv_score
        score = niv_score(u=-0.9, P_sq=0.1, X=0.01, F=0.001)
        assert score == -100.0

    def test_zero_denominator(self):
        from app.services.niv.formula import niv_score
        assert niv_score(u=0.5, P_sq=0.04, X=0.0, F=0.0, eps=0.0) == 0.0


class TestRecessionProbability:
    def test_zero_niv(self):
        from app.services.niv.formula import recession_probability
        assert recession_probability(0.0) == pytest.approx(0.5, abs=1e-10)

    def test_large_positive(self):
        from app.services.niv.formula import recession_probability
        assert recession_probability(50.0) < 0.01

    def test_large_negative(self):
        from app.services.niv.formula import recession_probability
        assert recession_probability(-50.0) > 0.99


class TestSmooth12m:
    def test_passthrough_short(self):
        from app.services.niv.formula import smooth_12m
        s = pd.Series([1.0, 2.0, 3.0])
        result = smooth_12m(s)
        assert list(result) == [1.0, 2.0, 3.0]

    def test_smoothing_kicks_in(self):
        from app.services.niv.formula import smooth_12m
        s = pd.Series(range(1, 25), dtype=float)
        result = smooth_12m(s)
        assert result.iloc[0] == 1.0
        assert result.iloc[10] == 11.0
        assert result.iloc[11] == pytest.approx(6.5, abs=1e-10)
