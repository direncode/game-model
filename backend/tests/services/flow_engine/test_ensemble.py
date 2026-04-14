"""Tests for ensemble disagreement detection."""
import pytest
from app.services.flow_engine.ensemble import EnsembleAggregator


def estimator_high(_data) -> float:
    return 0.9

def estimator_low(_data) -> float:
    return 0.1

def estimator_mid(_data) -> float:
    return 0.5


class TestEnsembleAggregator:
    def test_agreement_low_disagreement(self):
        agg = EnsembleAggregator(estimators={"a": estimator_mid, "b": estimator_mid})
        result = agg.evaluate(None)
        assert result.disagreement < 0.01

    def test_disagreement_high(self):
        agg = EnsembleAggregator(estimators={"high": estimator_high, "low": estimator_low})
        result = agg.evaluate(None)
        assert result.disagreement > 0.3

    def test_combined_via_log_odds(self):
        agg = EnsembleAggregator(estimators={"a": estimator_high, "b": estimator_low, "c": estimator_mid})
        result = agg.evaluate(None)
        assert 0.0 < result.combined < 1.0

    def test_per_estimator_values(self):
        agg = EnsembleAggregator(estimators={"high": estimator_high, "low": estimator_low})
        result = agg.evaluate(None)
        assert abs(result.per_estimator["high"] - 0.9) < 1e-6
        assert abs(result.per_estimator["low"] - 0.1) < 1e-6

    def test_single_estimator(self):
        agg = EnsembleAggregator(estimators={"solo": estimator_mid})
        result = agg.evaluate(None)
        assert abs(result.combined - 0.5) < 1e-6
        assert result.disagreement == 0.0
