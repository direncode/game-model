"""End-to-end integration test for the NIV vertical (no live FRED)."""
import numpy as np
import pandas as pd
import pytest


class TestNIVEndToEnd:
    def _make_synthetic_frame(self, n=200):
        dates = pd.date_range("2000-01-01", periods=n, freq="MS")
        rng = np.random.RandomState(42)
        return pd.DataFrame({
            "investment": 3000 + rng.randn(n).cumsum() * 50,
            "m2": 15000 + rng.randn(n).cumsum() * 100,
            "fedfunds": np.clip(3.0 + rng.randn(n).cumsum() * 0.3, 0.01, 20),
            "gdp": 20000 + rng.randn(n).cumsum() * 100,
            "tcu": np.clip(78 + rng.randn(n) * 3, 60, 100),
            "yield_spread": rng.randn(n) * 2,
            "cpi": 250 + np.arange(n) * 0.3 + rng.randn(n) * 0.5,
        }, index=dates)

    def test_full_pipeline_synthetic(self):
        from app.services.niv.config import NIVConfig
        from app.services.niv.vertical import NIVVertical
        from app.services.niv.fred_adapter import compute_derived
        from app.services.niv.features import build_base_features, build_recession_labels

        cfg = NIVConfig()
        v = NIVVertical(cfg)
        raw = self._make_synthetic_frame()
        frame = compute_derived(raw)
        assert len(frame) > 0

        results = v.compute_frame(frame)
        assert len(results) > 0
        assert all(r.niv_score is not None for r in results)

        niv_frame = pd.DataFrame({
            "niv_raw": [r.niv_score for r in results],
            "thrust": [r.components.thrust for r in results],
            "efficiency_squared": [r.components.efficiency_squared for r in results],
            "slack": [r.components.slack for r in results],
            "drag_total": [r.components.drag.total for r in results],
            "drag_spread": [r.components.drag.spread for r in results],
            "drag_real_rate": [r.components.drag.real_rate for r in results],
            "drag_vol": [r.components.drag.vol for r in results],
            "yield_spread": frame["yield_spread"].values[:len(results)],
        }, index=frame.index[:len(results)])

        features = build_base_features(niv_frame)
        assert features.shape[1] == 12

        labels = build_recession_labels(features.index, horizon=12, cfg=cfg)
        features["recession"] = labels.reindex(features.index).fillna(0).astype(int)

        wf_result = v.fit_walkforward(features)
        assert wf_result.n_folds > 0
        for h in cfg.horizons:
            assert h in wf_result.auc_by_horizon

    def test_vertical_degrades_without_btut(self):
        from app.services.niv.config import NIVConfig
        from app.services.niv.vertical import NIVVertical
        cfg = NIVConfig(btut_thinning=False, crystallization_enabled=False)
        v = NIVVertical(cfg)
        result = v.compute_single(
            date="2024-01-01", investment=3000, m2_growth_12m=5.0,
            fedfunds=5.0, gdp=25000, tcu=80, yield_spread=0.5,
            cpi_inflation=3.2, investment_growth_monthly=0.3,
            fedfunds_change_monthly=0.0, fedfunds_sigma_12m=0.5,
        )
        assert result.niv_score != 0.0
