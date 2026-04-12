"""Module export formats for the TCD-JEPA vertical.

JSON is the portable format (always works).
PYTORCH is the rich format — centroid tensor + full routing metadata
so a downstream consumer can route independently of the registry DB.
ONNX is a stub that raises NotImplementedError until a consumer asks.
"""
from __future__ import annotations

import io
import json
from enum import Enum

from .vertical_types import CrystallizedModule


class ExportFormat(str, Enum):
    JSON = "json"
    PYTORCH = "pt"
    ONNX = "onnx"


def _manifest(module: CrystallizedModule) -> dict:
    """Canonical manifest used by both JSON and PYTORCH exports."""
    return {
        "id": module.id,
        "vertical": module.vertical.value,
        "module_type": module.module_type,
        "centroid": [round(float(x), 6) for x in module.centroid.tolist()],
        "members": list(module.members),
        "purity": float(module.purity),
        "quality_score": float(module.quality_score),
        "provenance_job_id": module.provenance_job_id,
        "created_at": module.created_at.isoformat(),
        "format_version": "1",
    }


def to_json(module: CrystallizedModule) -> bytes:
    """Export a module as a portable JSON manifest."""
    return json.dumps(_manifest(module), sort_keys=True).encode("utf-8")


def to_pytorch_bundle(module: CrystallizedModule) -> bytes:
    """Export a module as a PyTorch bundle (tensor + full manifest).

    Learning-mode #4: metadata-rich. The bundle carries:
      - `centroid`: torch tensor (float32) — ready for routing at load time
      - `manifest`: dict with every CrystallizedModule field
      - `_format`: version marker for future migrations

    Consumers only need `torch.load(path)` — no registry DB round-trip,
    no re-computing from JSON. This is the format the AI monetization
    vertical will ship to hyperscalers / MCP servers / downstream buyers.
    """
    try:
        import torch
    except ImportError:
        # Test envs without torch: emit JSON wrapped in a marker so the
        # "returns bytes" contract still holds.
        return b"TCD-JEPA-MODULE-JSON:" + to_json(module)

    buf = io.BytesIO()
    torch.save(
        {
            "centroid": torch.tensor(
                [float(x) for x in module.centroid.tolist()],
                dtype=torch.float32,
            ),
            "manifest": _manifest(module),
            "_format": "tcd-jepa-module-v1",
        },
        buf,
    )
    return buf.getvalue()


def to_onnx(module: CrystallizedModule) -> bytes:
    raise NotImplementedError("ONNX export deferred until a consumer requests it")
