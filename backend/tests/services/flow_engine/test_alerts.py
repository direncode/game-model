"""Tests for alert hysteresis state machine, generalized from NIV."""
import pytest
from app.services.flow_engine.alerts import AlertLevel, AlertEnvelope, alert_from_metric, AlertThresholds


class TestAlertEscalation:
    def test_normal_below_threshold(self):
        env = alert_from_metric(0.1)
        assert env.level == AlertLevel.NORMAL

    def test_elevated(self):
        env = alert_from_metric(0.35)
        assert env.level == AlertLevel.ELEVATED

    def test_warning(self):
        env = alert_from_metric(0.55)
        assert env.level == AlertLevel.WARNING

    def test_critical(self):
        env = alert_from_metric(0.75)
        assert env.level == AlertLevel.CRITICAL


class TestAlertHysteresis:
    def test_stays_critical_with_small_drop(self):
        critical = AlertEnvelope(level=AlertLevel.CRITICAL, severity=0.75)
        env = alert_from_metric(0.65, current=critical)
        assert env.level == AlertLevel.CRITICAL

    def test_de_escalates_with_large_drop(self):
        critical = AlertEnvelope(level=AlertLevel.CRITICAL, severity=0.75)
        env = alert_from_metric(0.55, current=critical)
        assert env.level == AlertLevel.WARNING

    def test_elevated_hysteresis(self):
        elevated = AlertEnvelope(level=AlertLevel.ELEVATED, severity=0.35)
        env = alert_from_metric(0.25, current=elevated)
        assert env.level == AlertLevel.ELEVATED

    def test_custom_thresholds(self):
        custom = AlertThresholds(elevated=0.4, warning=0.6, critical=0.8, hysteresis_band=0.15)
        env = alert_from_metric(0.45, thresholds=custom)
        assert env.level == AlertLevel.ELEVATED
