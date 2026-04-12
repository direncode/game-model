import json
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import numpy as np
import pytest

from app.services.crystallization.vertical import TCDJEPAVertical
from app.services.crystallization.vertical_types import (
    BTUTSurvivorBundle,
    CrystallizedModule,
    TCDVerticalError,
    VerticalPreset,
)


def _bundle(n: int = 5, d: int = 8) -> BTUTSurvivorBundle:
    return BTUTSurvivorBundle(
        embeddings=np.random.RandomState(0).randn(n, d).astype(np.float32),
        ids=[f"id_{i}" for i in range(n)],
        edges=[],
        metadata={"provenance_job_id": "job-1"},
    )


def _mk_mod(name: str = "m1") -> CrystallizedModule:
    return CrystallizedModule(
        id=name,
        vertical=VerticalPreset.GENERIC,
        module_type="attractor",
        centroid=np.array([1.0, 0.0], dtype=np.float32),
        members=["a"],
        purity=0.9,
        quality_score=0.8,
        provenance_job_id="job-1",
        created_at=datetime(2026, 4, 10),
    )


# ─────────────────── stage 1: init + ingest ───────────────────


def test_vertical_init_defaults():
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    assert v.preset == VerticalPreset.GENERIC
    assert v.current_bundle is None


def test_ingest_btut_stores_bundle():
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    b = _bundle()
    v.ingest_btut(b)
    assert v.current_bundle is b


def test_ingest_btut_rejects_empty_bundle():
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    empty = BTUTSurvivorBundle(
        embeddings=np.zeros((0, 8), dtype=np.float32),
        ids=[],
        edges=[],
        metadata={},
    )
    with pytest.raises(TCDVerticalError) as exc_info:
        v.ingest_btut(empty)
    assert exc_info.value.stage == "ingest"


# ─────────────────── stages 2-3: crystallize + interpret ───────────────────


async def test_crystallize_requires_ingest_first():
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    with pytest.raises(TCDVerticalError) as exc_info:
        await v.crystallize()
    assert exc_info.value.stage == "crystallize"


async def test_crystallize_delegates_to_wrapper():
    wrapper = MagicMock()
    wrapper.run_training = AsyncMock(
        return_value={"checkpoint_path": "/tmp/ckpt.pt", "final_loss": 0.02}
    )
    wrapper.extract_modules = AsyncMock(
        return_value=[
            {
                "id": "m1",
                "module_type": "attractor",
                "centroid": [0.1, 0.2],
                "members": ["id_0", "id_1"],
                "purity": 0.9,
                "quality_score": 0.8,
            }
        ]
    )
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC, wrapper=wrapper)
    v.ingest_btut(_bundle())
    result = await v.crystallize()
    assert len(result) == 1
    assert result[0].module_type == "attractor"
    assert result[0].vertical == VerticalPreset.GENERIC
    wrapper.run_training.assert_awaited_once()


async def test_interpret_delegates_to_interpretation_fn():
    interpretation_fn = AsyncMock(
        return_value=[{"id": "m1", "description": "shadow supplier cluster"}]
    )
    v = TCDJEPAVertical(
        preset=VerticalPreset.GENERIC,
        interpretation_fn=interpretation_fn,
    )
    annotated = await v.interpret(
        [
            {
                "id": "m1",
                "module_type": "attractor",
                "centroid": [0.1],
                "members": [],
                "purity": 0.9,
                "quality_score": 0.8,
            }
        ]
    )
    assert annotated[0]["description"] == "shadow supplier cluster"
    interpretation_fn.assert_awaited_once()


# ─────────────────── stages 4-5: register / route / export ───────────────────


async def test_register_delegates_to_registry_service():
    registry = MagicMock()
    registry.register_many = AsyncMock(return_value=["row1"])
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC, registry_service=registry)
    out = await v.register([_mk_mod()])
    assert out == ["row1"]
    registry.register_many.assert_awaited_once()


def test_route_returns_sentinel_for_empty_known_modules():
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    signal = np.array([1.0, 0.0], dtype=np.float32)
    decisions = v.route(signal, known_modules=[])
    assert decisions[0].module_id is None


def test_route_returns_best_match():
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    signal = np.array([1.0, 0.0], dtype=np.float32)
    mods = [_mk_mod("close"), _mk_mod("far")]
    mods[1].centroid = np.array([-1.0, 0.0], dtype=np.float32)
    decisions = v.route(signal, known_modules=mods, top_k=1)
    assert decisions[0].module_id == "close"


def test_export_json_roundtrip():
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    blob = v.export(_mk_mod(), format="json")
    payload = json.loads(blob)
    assert payload["id"] == "m1"


def test_export_unknown_format_raises_tcd_vertical_error():
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    with pytest.raises(TCDVerticalError) as exc_info:
        v.export(_mk_mod(), format="bogus")
    assert exc_info.value.stage == "export"
