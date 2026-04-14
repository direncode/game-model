"""Tests for Wire — directed connection with liquidity and friction."""
import pytest
from app.services.flow_engine.wire import Wire, WireState


class TestWire:
    def test_create_wire(self):
        w = Wire(source="btut", sink="tcd_jepa")
        assert w.source == "btut"
        assert w.sink == "tcd_jepa"
        assert w.state == WireState.DORMANT

    def test_update_metrics(self):
        w = Wire(source="btut", sink="tcd_jepa")
        w.update_metrics(throughput=500.0, readiness=0.95, error_rate=0.01, retry_count=2, backpressure=0.05)
        assert w.state == WireState.FLOWING

    def test_liquidity_is_throughput_times_readiness(self):
        w = Wire(source="btut", sink="tcd_jepa")
        w.update_metrics(throughput=100.0, readiness=0.8, error_rate=0.0, retry_count=0, backpressure=0.0)
        assert abs(w.liquidity - 80.0) < 1e-9

    def test_friction_from_errors(self):
        w = Wire(source="a", sink="b")
        w.update_metrics(throughput=100.0, readiness=0.9, error_rate=0.2, retry_count=10, backpressure=0.3)
        assert w.friction > 0.0
        assert w.state == WireState.THROTTLED

    def test_blocked_state(self):
        w = Wire(source="a", sink="b")
        w.update_metrics(throughput=0.0, readiness=0.0, error_rate=0.9, retry_count=50, backpressure=1.0)
        assert w.state == WireState.BLOCKED

    def test_metrics_history_records(self):
        w = Wire(source="a", sink="b")
        w.update_metrics(throughput=100.0, readiness=0.9, error_rate=0.01, retry_count=0, backpressure=0.0)
        w.update_metrics(throughput=80.0, readiness=0.85, error_rate=0.05, retry_count=1, backpressure=0.1)
        assert len(w.metrics_history) == 2
