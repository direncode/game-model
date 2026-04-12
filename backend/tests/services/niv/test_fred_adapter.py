"""Tests for FRED/ALFRED data adapter."""
import numpy as np
import pandas as pd
import pytest


class TestAlignSeriesNN:
    def test_fills_gaps(self):
        from app.services.niv.fred_adapter import align_series_nn
        s1 = pd.Series([100, 200, 300], index=pd.to_datetime(["2020-01-01", "2020-02-01", "2020-03-01"]))
        s2 = pd.Series([10, 20], index=pd.to_datetime(["2020-01-15", "2020-03-15"]))
        result = align_series_nn({"a": s1, "b": s2}, freq="MS", max_gap_days=90)
        assert len(result) >= 2
        assert "a" in result.columns and "b" in result.columns

    def test_drops_wide_gaps(self):
        from app.services.niv.fred_adapter import align_series_nn
        s1 = pd.Series([100], index=pd.to_datetime(["2020-01-01"]))
        s2 = pd.Series([10], index=pd.to_datetime(["2021-01-01"]))
        result = align_series_nn({"a": s1, "b": s2}, freq="MS", max_gap_days=90)
        assert len(result) == 0


class TestComputeDerived:
    def test_derived_fields_exist(self):
        from app.services.niv.fred_adapter import compute_derived
        dates = pd.date_range("2019-01-01", periods=24, freq="MS")
        df = pd.DataFrame({
            "investment": [1000 + i * 10 for i in range(24)],
            "m2": [15000 + i * 100 for i in range(24)],
            "fedfunds": [2.0 + i * 0.05 for i in range(24)],
            "gdp": [20000 + i * 50 for i in range(24)],
            "tcu": [75.0 + i * 0.5 for i in range(24)],
            "yield_spread": [1.5 - i * 0.1 for i in range(24)],
            "cpi": [250 + i * 0.5 for i in range(24)],
        }, index=dates)
        result = compute_derived(df)
        for col in ["investment_growth_monthly", "m2_growth_12m",
                     "fedfunds_change_monthly", "fedfunds_sigma_12m", "cpi_inflation_yoy"]:
            assert col in result.columns
        assert len(result) > 0
