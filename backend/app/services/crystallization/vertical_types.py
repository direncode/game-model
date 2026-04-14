"""Core types for the TCD-JEPA vertical.

Pure data + enums + a typed exception. No I/O, no ML.
Everything else in the vertical composes these.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Literal, Any

import numpy as np


class VerticalPreset(str, Enum):
    TRADING = "trading"
    INFERENCE = "inference"
    SOVEREIGN = "sovereign"
    GENERIC = "generic"
    DATA_ESTATE = "data_estate"


@dataclass
class BTUTSurvivorBundle:
    """Normalized BTUT output consumed by TCDJEPAVertical.

    BTUT's two emit shapes (BTUTTuner.result and run_btut_pipeline() dict)
    are both converted into this single type by btut_bridge.py.
    """
    embeddings: np.ndarray                        # (N, D) float32
    ids: list[str]                                # length N
    edges: list[tuple[int, int, float]]           # (src_idx, dst_idx, weight)
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        n = self.embeddings.shape[0]
        if len(self.ids) != n:
            raise ValueError(
                f"ids length ({len(self.ids)}) must match embeddings rows ({n})"
            )


ModuleType = Literal["attractor", "cycle", "boundary"]


@dataclass
class CrystallizedModule:
    """A single crystallized, interpretable, routable module."""
    id: str
    vertical: VerticalPreset
    module_type: ModuleType
    centroid: np.ndarray
    members: list[str]
    purity: float
    quality_score: float
    provenance_job_id: str | None
    created_at: datetime


@dataclass
class RoutingDecision:
    """Result of routing a signal embedding against the ModuleRegistry."""
    module_id: str | None
    score: float
    reason: str


class TCDVerticalError(Exception):
    """Stage-tagged error raised by any TCDJEPAVertical method."""

    def __init__(self, message: str, stage: str) -> None:
        super().__init__(message)
        self.stage = stage
