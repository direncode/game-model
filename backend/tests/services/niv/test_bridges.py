"""Tests for integration bridges and implemented hooks."""
import pytest


class TestBTUTBridge:
    def test_disabled_returns_none(self):
        from app.services.niv.btut_bridge import thin_features
        from app.services.niv.config import NIVConfig
        cfg = NIVConfig(btut_thinning=False)
        result = thin_features([], None, cfg=cfg)
        assert result is None

    def test_enabled_empty_pool_returns_none(self):
        from app.services.niv.btut_bridge import thin_features
        from app.services.niv.config import NIVConfig
        cfg = NIVConfig(btut_thinning=True)
        result = thin_features([], None, cfg=cfg)
        assert result is None


class TestSovereignHook:
    def test_uae_sandbox_overrides_series(self):
        from app.services.niv.sovereign import UAELiquiditySandbox, UAE_SERIES
        from app.services.niv.config import NIVConfig
        sandbox = UAELiquiditySandbox(NIVConfig())
        # Verify UAE series mapping is applied
        assert sandbox.cfg.series["investment"] == UAE_SERIES["investment"]
        assert sandbox.cfg.series["cpi"] == UAE_SERIES["cpi"]

    def test_uae_requires_api_key(self):
        from app.services.niv.sovereign import UAELiquiditySandbox
        from app.services.niv.config import NIVConfig
        sandbox = UAELiquiditySandbox(NIVConfig(fred_api_key=""))
        with pytest.raises(ValueError, match="FRED API key required"):
            import asyncio
            asyncio.run(sandbox.ingest("2020-01", "2024-01"))


class TestTearsheetHook:
    def test_thesis_paragraph_returns_string(self):
        from app.services.niv.tearsheet import investment_thesis_paragraph
        # None input returns fallback message
        result = investment_thesis_paragraph(None, None, 0.4, None)
        assert isinstance(result, str)
        assert "unavailable" in result.lower()

    def test_thesis_paragraph_with_result(self):
        from app.services.niv.tearsheet import investment_thesis_paragraph
        from app.services.niv.formula import NIVResult, NIVComponents, DragBreakdown, AlertEnvelope
        result = NIVResult(
            date="2024-01-01", niv_score=-15.0, recession_probability=0.65,
            components=NIVComponents(
                thrust=-0.3, efficiency=0.16, efficiency_squared=0.026,
                slack=0.18, drag=DragBreakdown(total=0.015, spread=0.008, real_rate=0.005, vol=0.002),
            ),
            alert=AlertEnvelope(level="warning", action="reduce equity to 30%", dollar_stakes=0.3, invalidation_prob=0.35),
        )
        thesis = investment_thesis_paragraph(result, None, 0.42, ["US 2007-Q2", "US 2019-Q3"])
        assert isinstance(thesis, str)
        assert len(thesis) > 50  # substantial paragraph
        assert "warning" in thesis.lower() or "65%" in thesis or "recession" in thesis.lower()


class TestCrystallizationBridge:
    def test_descriptor_returns_dict(self):
        from app.services.niv.crystallization_bridge import to_module_descriptor
        result = to_module_descriptor({"year": "2020", "predictions": [
            {"date": "2020-01", "prob": 0.45}, {"date": "2020-02", "prob": 0.55},
        ]})
        assert isinstance(result, dict)
        assert result["source"] == "niv_walkforward"
        assert result["config"]["n_predictions"] == 2
        assert result["config"]["mean_recession_prob"] == pytest.approx(0.50, abs=0.01)

    def test_descriptor_empty_input(self):
        from app.services.niv.crystallization_bridge import to_module_descriptor
        result = to_module_descriptor(None)
        assert result == {}


class TestFeatureAugmentationPool:
    def test_pool_generates_candidates(self):
        import numpy as np
        import pandas as pd
        from app.services.niv.features import build_augmentation_pool, FEATURE_NAMES
        dates = pd.date_range("2018-01-01", periods=30, freq="MS")
        rng = np.random.RandomState(42)
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
        # Should have base 12 + augmented candidates
        assert len(pool) > 20
        names = [f.name for f in pool]
        assert "drag_thrust_ratio" in names
        assert "yield_inverted" in names
        assert "niv_smooth_6m" in names


class TestAlertHysteresis:
    def test_hysteresis_prevents_downgrade(self):
        from app.services.niv.formula import alert_level_from_probability, AlertEnvelope
        # Currently at "warning" level
        current = AlertEnvelope(level="warning", action="reduce", dollar_stakes=0.3, invalidation_prob=0.35)
        # Prob drops to 0.45 (below 0.50 trigger but within hysteresis band of 0.40)
        result = alert_level_from_probability(0.45, current)
        # Should STAY at warning due to hysteresis
        assert result.level == "warning"

    def test_clear_drop_triggers_downgrade(self):
        from app.services.niv.formula import alert_level_from_probability, AlertEnvelope
        current = AlertEnvelope(level="warning", action="reduce", dollar_stakes=0.3, invalidation_prob=0.35)
        # Prob drops to 0.25 (well below hysteresis band)
        result = alert_level_from_probability(0.25, current)
        assert result.level == "normal"
