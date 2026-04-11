"""Tests for LatentOceanDataLayer facade."""
from __future__ import annotations

import json as _json

import numpy as np
import pytest

from app.services.data_layer.types import (
    IngestResult,
    BTUTRunResult,
    ManifoldCoords,
    Survivor,
    QualityMetrics,
    CausalLink,
)
from app.services.data_layer.errors import (
    NoIngestError,
    NoBTUTResultError,
    NoManifoldError,
    UnknownSourceError,
    UnknownVerticalError,
)


# ── Task 1: types + errors ──────────────────────────────────────────────
def test_types_are_importable_dataclasses():
    ir = IngestResult(
        source_id="test", entities=[], edges=[], unique_types=[], fetch_seconds=0.0
    )
    assert ir.source_id == "test"
    ql = QualityMetrics(
        n_input=100,
        n_survivors=10,
        reduction_ratio=10,
        variance_preservation=0.9,
        wall_seconds=1.0,
        estimated_cost_usd=0.01,
    )
    assert ql.reduction_ratio == 10


def test_errors_are_exceptions():
    assert issubclass(NoIngestError, Exception)
    assert issubclass(NoBTUTResultError, Exception)
    assert issubclass(UnknownVerticalError, Exception)
    assert issubclass(NoManifoldError, Exception)
    assert issubclass(UnknownSourceError, Exception)
