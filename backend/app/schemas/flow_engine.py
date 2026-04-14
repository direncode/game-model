# backend/app/schemas/flow_engine.py
"""Pydantic v2 schemas for the flow engine API."""
from __future__ import annotations
from typing import List
from pydantic import BaseModel


class WellHealthResponse(BaseModel):
    well_id: str
    label: str
    state: str
    saturation: float
    conversion: float
    impulse: float
    staleness: float
    alert_level: str


class WireResponse(BaseModel):
    source: str
    sink: str
    state: str
    liquidity: float
    friction: float


class SystemMetricsResponse(BaseModel):
    resilience: int
    circulation_rate: float
    saturation_pressure: float
    friction_index: float


class GraphStateResponse(BaseModel):
    wells: List[WellHealthResponse]
    wires: List[WireResponse]
    metrics: SystemMetricsResponse
