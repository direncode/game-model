import json
import numpy as np
from datetime import datetime

from app.services.crystallization.export import (
    to_json,
    to_pytorch_bundle,
    ExportFormat,
)
from app.services.crystallization.vertical_types import (
    CrystallizedModule,
    VerticalPreset,
)


def _mk() -> CrystallizedModule:
    return CrystallizedModule(
        id="mod-1",
        vertical=VerticalPreset.TRADING,
        module_type="attractor",
        centroid=np.array([0.1, 0.2, 0.3], dtype=np.float32),
        members=["a", "b", "c"],
        purity=0.92,
        quality_score=0.81,
        provenance_job_id="job-xyz",
        created_at=datetime(2026, 4, 10),
    )


def test_to_json_roundtrips_fields():
    blob = to_json(_mk())
    payload = json.loads(blob)
    assert payload["id"] == "mod-1"
    assert payload["vertical"] == "trading"
    assert payload["purity"] == 0.92
    assert payload["members"] == ["a", "b", "c"]
    assert payload["centroid"] == [0.1, 0.2, 0.3]
    assert payload["format_version"] == "1"


def test_to_pytorch_bundle_returns_bytes():
    blob = to_pytorch_bundle(_mk())
    assert isinstance(blob, bytes)
    assert len(blob) > 0


def test_export_format_enum():
    assert ExportFormat.JSON.value == "json"
    assert ExportFormat.PYTORCH.value == "pt"
    assert ExportFormat.ONNX.value == "onnx"
