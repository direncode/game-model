"""Tests for NIVVertical facade."""
import pytest


class TestNIVVertical:
    def test_instantiation_defaults(self):
        from app.services.niv.vertical import NIVVertical
        from app.services.niv.config import NIVConfig
        v = NIVVertical(NIVConfig())
        assert v.config is not None
        assert v.config.eta == 1.5

    def test_compute_scores_single_month(self):
        from app.services.niv.vertical import NIVVertical
        from app.services.niv.config import NIVConfig
        v = NIVVertical(NIVConfig())
        result = v.compute_single(
            date="2020-03-01",
            investment=3000.0, m2_growth_12m=6.0, fedfunds=1.5,
            gdp=21000.0, tcu=75.0, yield_spread=-0.5,
            cpi_inflation=2.3, investment_growth_monthly=0.5,
            fedfunds_change_monthly=-0.25, fedfunds_sigma_12m=0.8,
        )
        assert result.niv_score != 0.0
        assert 0.0 <= result.recession_probability <= 1.0
        assert result.alert.level in ("normal", "elevated", "warning", "critical")
