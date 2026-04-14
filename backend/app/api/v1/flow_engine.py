# backend/app/api/v1/flow_engine.py
"""Flow Engine API — graph state, well health, system metrics."""
from __future__ import annotations

from fastapi import APIRouter

from app.schemas.flow_engine import (
    GraphStateResponse,
    SystemMetricsResponse,
    WellHealthResponse,
    WireResponse,
)
from app.services.flow_engine.graph import FlowGraph
from app.services.flow_engine.well import Well
from app.services.flow_engine.wire import Wire
from app.services.flow_engine.alerts import alert_from_metric

router = APIRouter(prefix="/flow-engine", tags=["flow-engine"])

_graph: FlowGraph | None = None


def get_graph() -> FlowGraph:
    global _graph
    if _graph is None:
        _graph = FlowGraph()
    return _graph


def set_graph(g: FlowGraph) -> None:
    global _graph
    _graph = g


@router.get("/graph", response_model=GraphStateResponse)
def graph_state():
    g = get_graph()
    wells = []
    for w in g.wells.values():
        alert = alert_from_metric(w.health.saturation)
        wells.append(WellHealthResponse(
            well_id=w.well_id, label=w.label, state=w.state.value,
            saturation=w.health.saturation, conversion=w.health.conversion,
            impulse=w.health.impulse, staleness=w.health.staleness,
            alert_level=alert.level.value,
        ))
    wires = [
        WireResponse(source=w.source, sink=w.sink, state=w.state.value,
                     liquidity=w.liquidity, friction=w.friction)
        for w in g.wires
    ]
    metrics = SystemMetricsResponse(
        resilience=g.resilience(), circulation_rate=g.circulation_rate(),
        saturation_pressure=g.saturation_pressure(), friction_index=g.friction_index(),
    )
    return GraphStateResponse(wells=wells, wires=wires, metrics=metrics)


@router.get("/wells", response_model=list[WellHealthResponse])
def list_wells():
    g = get_graph()
    result = []
    for w in g.wells.values():
        alert = alert_from_metric(w.health.saturation)
        result.append(WellHealthResponse(
            well_id=w.well_id, label=w.label, state=w.state.value,
            saturation=w.health.saturation, conversion=w.health.conversion,
            impulse=w.health.impulse, staleness=w.health.staleness,
            alert_level=alert.level.value,
        ))
    return result


@router.get("/metrics", response_model=SystemMetricsResponse)
def system_metrics():
    g = get_graph()
    return SystemMetricsResponse(
        resilience=g.resilience(), circulation_rate=g.circulation_rate(),
        saturation_pressure=g.saturation_pressure(), friction_index=g.friction_index(),
    )
