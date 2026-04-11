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
from app.services.data_layer.linking import (
    link_by_cosine,
    link_by_foreign_key,
    link_by_semantic_field,
    link_by_url_hierarchy,
)
from app.services.data_layer.verticals import (
    EXPORTERS,
    export_niv,
    export_tcd_jepa,
    export_data,
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


# ── Task 3: causal linking scaffold ─────────────────────────────────────
def test_link_by_cosine_identifies_identical_vectors():
    s_a = [{"entity": {"name": "a0"}}, {"entity": {"name": "a1"}}]
    s_b = [{"entity": {"name": "b0"}}, {"entity": {"name": "b1"}}]
    e_a = np.array(
        [[1, 0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0, 0]], dtype=np.float32
    )
    e_b = np.array(
        [[1, 0, 0, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0, 0]], dtype=np.float32
    )
    links = link_by_cosine(s_a, e_a, s_b, e_b, threshold=0.9)
    names = {(lk.source_a, lk.source_b) for lk in links}
    assert ("a0", "b0") in names
    assert ("a1", "b1") not in names
    for lk in links:
        assert lk.signal == "cosine"
        assert 0.0 <= lk.strength <= 1.0 + 1e-6


def test_link_by_cosine_handles_empty():
    assert link_by_cosine([], np.zeros((0, 8)), [], np.zeros((0, 8))) == []


def test_link_stubs_return_empty():
    s_a = [{"entity": {"name": "x"}}]
    s_b = [{"entity": {"name": "y"}}]
    assert link_by_foreign_key(s_a, s_b) == []
    assert link_by_semantic_field(s_a, s_b) == []
    assert link_by_url_hierarchy(s_a, s_b) == []


# ── Task 4: vertical exporters ──────────────────────────────────────────
def _make_fake_state():
    """Build a namespace-like object mimicking core state for exporter tests."""
    class FakeState:
        pass

    st = FakeState()
    st.ingest_result = IngestResult(
        source_id="edgar",
        entities=[],
        edges=[],
        unique_types=["company"],
        fetch_seconds=1.0,
    )
    st.btut_result = BTUTRunResult(
        summary={"reduction": 10},
        survivors=[],
        embeddings_8d=np.zeros((2, 8), dtype=np.float32),
        wall_seconds=2.0,
    )
    st.manifold = ManifoldCoords(
        coords_8d_unit=np.ones((2, 8), dtype=np.float32) / np.sqrt(8),
        coords_3d_s2=np.ones((2, 3), dtype=np.float32) / np.sqrt(3),
        projection_method="l2_normalize_8d+pca_s2",
    )
    st.survivors = [
        Survivor(
            entity={"name": "AAPL", "type": "company"},
            cluster=0,
            scores={"composite": 0.9},
            fingerprint="0101",
            coord_8d=[1.0] + [0.0] * 7,
            coord_3d=[1.0, 0.0, 0.0],
        ),
        Survivor(
            entity={"name": "MSFT", "type": "company"},
            cluster=1,
            scores={"composite": 0.8},
            fingerprint="1010",
            coord_8d=[0.0, 1.0] + [0.0] * 6,
            coord_3d=[0.0, 1.0, 0.0],
        ),
    ]
    st.quality_metrics = QualityMetrics(
        n_input=20,
        n_survivors=2,
        reduction_ratio=10,
        variance_preservation=0.85,
        wall_seconds=3.0,
        estimated_cost_usd=0.05,
    )
    return st


def test_export_niv_has_expected_keys():
    payload = export_niv(_make_fake_state())
    assert payload["vertical"] == "niv"
    assert payload["dataset_id"] == "edgar"
    assert payload["n_survivors"] == 2
    assert len(payload["survivors"]) == 2
    assert "quality" in payload
    assert "coord_8d" in payload["survivors"][0]


def test_export_tcd_jepa_is_matrix_shaped():
    payload = export_tcd_jepa(_make_fake_state())
    assert payload["vertical"] == "tcd_jepa"
    assert len(payload["embeddings_8d"]) == 2
    assert len(payload["embeddings_8d"][0]) == 8
    assert payload["entity_ids"] == ["AAPL", "MSFT"]
    assert payload["entity_types"] == ["company", "company"]


def test_export_data_contains_everything():
    payload = export_data(_make_fake_state())
    assert payload["vertical"] == "data"
    assert "ingest" in payload
    assert "btut_summary" in payload
    assert "manifold" in payload
    assert "coords_8d_unit" in payload["manifold"]
    assert "coords_3d_s2" in payload["manifold"]


def test_exporters_registry_has_three():
    assert set(EXPORTERS.keys()) == {"niv", "tcd_jepa", "data"}
