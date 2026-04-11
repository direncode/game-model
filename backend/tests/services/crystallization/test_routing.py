import numpy as np
from datetime import datetime

from app.services.crystallization.routing import (
    route_signal,
    score_module,
)
from app.services.crystallization.vertical_types import (
    CrystallizedModule,
    RoutingDecision,
    VerticalPreset,
)


def _mk(name: str, centroid: list[float], purity: float = 0.9) -> CrystallizedModule:
    return CrystallizedModule(
        id=name,
        vertical=VerticalPreset.GENERIC,
        module_type="attractor",
        centroid=np.array(centroid, dtype=np.float32),
        members=[],
        purity=purity,
        quality_score=0.8,
        provenance_job_id="job-x",
        created_at=datetime(2026, 4, 10),
    )


def test_route_empty_registry_returns_sentinel():
    signal = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    decisions = route_signal(signal, [])
    assert len(decisions) == 1
    assert decisions[0].module_id is None
    assert decisions[0].reason == "empty_registry"


def test_route_returns_top_k_sorted():
    signal = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    modules = [
        _mk("close", [0.99, 0.01, 0.0]),
        _mk("medium", [0.5, 0.5, 0.0]),
        _mk("far", [-1.0, 0.0, 0.0]),
    ]
    decisions = route_signal(signal, modules, top_k=2)
    assert len(decisions) == 2
    assert decisions[0].module_id == "close"
    assert decisions[0].score >= decisions[1].score


def test_score_module_nonzero_for_cosine_aligned():
    mod = _mk("a", [1.0, 0.0, 0.0])
    signal = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    assert score_module(signal, mod) > 0.0


def test_score_module_penalizes_orthogonal():
    mod = _mk("a", [1.0, 0.0, 0.0])
    aligned = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    orthogonal = np.array([0.0, 1.0, 0.0], dtype=np.float32)
    assert score_module(aligned, mod) > score_module(orthogonal, mod)


def test_score_module_purity_scales_score():
    high = _mk("h", [1.0, 0.0, 0.0], purity=1.0)
    low = _mk("l", [1.0, 0.0, 0.0], purity=0.5)
    signal = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    assert score_module(signal, high) > score_module(signal, low)
