"""Tests for FlowGraph — directed graph with system-level metrics."""
import pytest
from app.services.flow_engine.well import Well
from app.services.flow_engine.wire import Wire
from app.services.flow_engine.graph import FlowGraph


def _make_graph() -> FlowGraph:
    """Helper: 3-well linear chain btut -> tcd -> estate."""
    g = FlowGraph()
    g.add_well(Well("btut", "BTUT Engine"))
    g.add_well(Well("tcd", "TCD-JEPA"))
    g.add_well(Well("estate", "Data Estate"))
    g.add_wire(Wire("btut", "tcd"))
    g.add_wire(Wire("tcd", "estate"))
    return g


def _activate_graph(g: FlowGraph) -> None:
    """Push sensor readings and wire metrics to make graph active."""
    for wid in ["btut", "tcd", "estate"]:
        g.wells[wid].update_sensors(saturation=0.4, conversion=0.7, impulse=0.5, staleness=0.1)
    for w in g.wires:
        w.update_metrics(throughput=100.0, readiness=0.9, error_rate=0.02, retry_count=1, backpressure=0.05)


class TestFlowGraphStructure:
    def test_add_well(self):
        g = FlowGraph()
        g.add_well(Well("btut", "BTUT"))
        assert "btut" in g.wells

    def test_add_wire_validates_endpoints(self):
        g = FlowGraph()
        g.add_well(Well("btut"))
        with pytest.raises(ValueError, match="unknown well"):
            g.add_wire(Wire("btut", "nonexistent"))

    def test_neighbors(self):
        g = _make_graph()
        assert g.downstream("btut") == ["tcd"]
        assert g.upstream("estate") == ["tcd"]

    def test_well_count(self):
        g = _make_graph()
        assert len(g.wells) == 3
        assert len(g.wires) == 2


class TestFlowGraphMetrics:
    def test_circulation_rate(self):
        g = _make_graph()
        _activate_graph(g)
        circ = g.circulation_rate()
        assert abs(circ - 180.0) < 1e-6

    def test_friction_index(self):
        g = _make_graph()
        _activate_graph(g)
        fi = g.friction_index()
        assert fi > 0.0
        assert fi < 1.0

    def test_saturation_pressure(self):
        g = _make_graph()
        _activate_graph(g)
        sp = g.saturation_pressure()
        assert sp == 0.0

    def test_saturation_pressure_under_load(self):
        g = _make_graph()
        g.wells["btut"].update_sensors(saturation=0.95, conversion=0.5, impulse=0.8, staleness=0.1)
        g.wells["tcd"].update_sensors(saturation=0.7, conversion=0.5, impulse=0.6, staleness=0.1)
        g.wells["estate"].update_sensors(saturation=0.5, conversion=0.5, impulse=0.4, staleness=0.1)
        sp = g.saturation_pressure()
        assert sp > 0.0

    def test_cascade_depth(self):
        g = _make_graph()
        _activate_graph(g)
        g.wells["btut"].update_sensors(saturation=0.95, conversion=0.5, impulse=0.8, staleness=0.1)
        depth = g.cascade_depth("btut")
        assert depth == 2

    def test_resilience_linear_chain(self):
        g = _make_graph()
        _activate_graph(g)
        r = g.resilience()
        assert r == 1
