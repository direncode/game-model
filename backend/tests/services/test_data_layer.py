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
from app.services.data_layer.manifold import (
    project_8d_to_unit_sphere,
    project_8d_to_s2,
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


# ── Task 2: manifold projection ─────────────────────────────────────────
def test_project_8d_to_unit_sphere_produces_unit_norms():
    rng = np.random.RandomState(0)
    pts = rng.randn(50, 8).astype(np.float32) * 10.0
    unit = project_8d_to_unit_sphere(pts)
    norms = np.linalg.norm(unit, axis=1)
    assert unit.shape == (50, 8)
    assert np.allclose(norms, 1.0, atol=1e-5)


def test_project_8d_to_unit_sphere_handles_zero_row():
    pts = np.zeros((3, 8), dtype=np.float32)
    unit = project_8d_to_unit_sphere(pts)
    assert np.all(np.isfinite(unit))


def test_project_8d_to_s2_returns_unit_sphere_3d():
    rng = np.random.RandomState(1)
    pts = rng.randn(30, 8).astype(np.float32)
    unit_8 = project_8d_to_unit_sphere(pts)
    coords_3d = project_8d_to_s2(unit_8)
    assert coords_3d.shape == (30, 3)
    assert np.allclose(np.linalg.norm(coords_3d, axis=1), 1.0, atol=1e-5)


def test_project_8d_to_s2_is_deterministic_with_seed():
    rng = np.random.RandomState(2)
    pts = rng.randn(20, 8).astype(np.float32)
    a = project_8d_to_s2(pts, seed=42)
    b = project_8d_to_s2(pts, seed=42)
    assert np.allclose(a, b)


def test_project_8d_to_s2_degenerate_small_sample():
    pts = np.array([[1.0] * 8, [2.0] * 8], dtype=np.float32)
    coords = project_8d_to_s2(pts)
    assert coords.shape == (2, 3)
    assert np.all(np.isfinite(coords))
