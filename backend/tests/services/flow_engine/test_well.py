"""Tests for Well — self-diagnosing data reservoir."""
import pytest
from app.services.flow_engine.well import Well, WellState, HealthVector


class TestHealthVector:
    def test_normalized_clamps_to_unit(self):
        hv = HealthVector(saturation=1.5, conversion=-0.2, impulse=0.5, staleness=0.8)
        assert hv.saturation == 1.0
        assert hv.conversion == 0.0
        assert hv.impulse == 0.5
        assert hv.staleness == 0.8

    def test_as_tuple(self):
        hv = HealthVector(saturation=0.3, conversion=0.7, impulse=0.1, staleness=0.9)
        assert hv.as_tuple() == (0.3, 0.7, 0.1, 0.9)

    def test_mean_health(self):
        hv = HealthVector(saturation=0.4, conversion=0.6, impulse=0.8, staleness=0.2)
        assert abs(hv.mean() - 0.5) < 1e-9


class TestWell:
    def test_create_well(self):
        w = Well(well_id="btut", label="BTUT Engine")
        assert w.well_id == "btut"
        assert w.state == WellState.DORMANT

    def test_update_sensors(self):
        w = Well(well_id="btut", label="BTUT Engine")
        w.update_sensors(saturation=0.3, conversion=0.8, impulse=0.5, staleness=0.1)
        assert w.health.saturation == 0.3
        assert w.state == WellState.ACTIVE

    def test_saturated_state(self):
        w = Well(well_id="btut", label="BTUT Engine")
        w.update_sensors(saturation=0.95, conversion=0.5, impulse=0.5, staleness=0.1)
        assert w.state == WellState.SATURATED

    def test_starved_state(self):
        w = Well(well_id="btut", label="BTUT Engine")
        w.update_sensors(saturation=0.01, conversion=0.5, impulse=0.02, staleness=0.9)
        assert w.state == WellState.STARVED

    def test_health_history_records(self):
        w = Well(well_id="btut", label="BTUT Engine")
        w.update_sensors(saturation=0.3, conversion=0.8, impulse=0.5, staleness=0.1)
        w.update_sensors(saturation=0.5, conversion=0.7, impulse=0.4, staleness=0.2)
        assert len(w.health_history) == 2
