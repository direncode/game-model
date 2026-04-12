import numpy as np
import pytest
from datetime import datetime

from app.services.crystallization.vertical_types import (
    BTUTSurvivorBundle,
    CrystallizedModule,
    RoutingDecision,
    VerticalPreset,
    TCDVerticalError,
)


def test_vertical_preset_values():
    assert VerticalPreset.TRADING.value == "trading"
    assert VerticalPreset.INFERENCE.value == "inference"
    assert VerticalPreset.SOVEREIGN.value == "sovereign"
    assert VerticalPreset.GENERIC.value == "generic"


def test_btut_survivor_bundle_shapes():
    emb = np.zeros((3, 8), dtype=np.float32)
    bundle = BTUTSurvivorBundle(
        embeddings=emb,
        ids=["a", "b", "c"],
        edges=[(0, 1, 0.9), (1, 2, 0.4)],
        metadata={"quality": 0.87},
    )
    assert bundle.embeddings.shape == (3, 8)
    assert len(bundle.ids) == 3
    assert len(bundle.edges) == 2


def test_btut_survivor_bundle_validates_length_mismatch():
    with pytest.raises(ValueError, match="ids length"):
        BTUTSurvivorBundle(
            embeddings=np.zeros((3, 8)),
            ids=["a", "b"],  # mismatch
            edges=[],
            metadata={},
        )


def test_crystallized_module_dataclass():
    m = CrystallizedModule(
        id="mod-1",
        vertical=VerticalPreset.TRADING,
        module_type="attractor",
        centroid=np.zeros(8),
        members=["a", "b"],
        purity=0.91,
        quality_score=0.8,
        provenance_job_id="job-xyz",
        created_at=datetime(2026, 4, 10),
    )
    assert m.module_type == "attractor"


def test_routing_decision_empty_sentinel():
    d = RoutingDecision(module_id=None, score=0.0, reason="empty_registry")
    assert d.module_id is None
    assert d.reason == "empty_registry"


def test_tcd_vertical_error_carries_stage():
    err = TCDVerticalError("boom", stage="crystallize")
    assert err.stage == "crystallize"
    assert str(err) == "boom"
