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
from unittest.mock import MagicMock, patch

from app.services.data_layer import LatentOceanDataLayer


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


# ── Tasks 5-10: facade integration tests ────────────────────────────────
def _fake_adapter(entities=None, edges=None, dataset_id="fake"):
    adapter = MagicMock()
    adapter.fetch_entities.return_value = entities or [
        {"name": "AAPL", "type": "company", "attributes": {"ticker": "AAPL"}},
        {"name": "MSFT", "type": "company", "attributes": {"ticker": "MSFT"}},
    ]
    adapter.fetch_edges.return_value = edges or []
    adapter.get_meta.return_value = MagicMock(dataset_id=dataset_id)
    return adapter


def _fake_btut_return():
    """Return shape mirroring run_btut_pipeline's actual output."""
    return {
        "summary": {
            "total_entities": 2,
            "survivors": 2,
            "reduction": 1,
            "wall_seconds": 0.1,
            "reconstruction": {"variance_preservation": 0.95},
        },
        "survivors": [
            {
                "entity": {"name": "AAPL", "type": "company", "attributes": {}},
                "cluster": 0,
                "fingerprint_48bit": "000",
                "flips": 0,
                "scores": {"composite": 0.5},
            },
            {
                "entity": {"name": "MSFT", "type": "company", "attributes": {}},
                "cluster": 1,
                "fingerprint_48bit": "111",
                "flips": 3,
                "scores": {"composite": 0.7},
            },
        ],
        # Two survivors × 8 dims, flattened. Row 0 = e_0, Row 1 = e_1.
        "embeddings_8d": [1.0, 0, 0, 0, 0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 0],
    }


def _prime_layer_through_btut(layer):
    """Helper: drive layer.ingest + layer.apply_btut_tuner with mocks."""
    adapter = _fake_adapter()
    with patch("app.services.data_layer.core.get_adapter", return_value=adapter):
        layer.ingest("fake", limit=50)
    with patch(
        "app.services.data_layer.core.run_btut_pipeline",
        return_value=_fake_btut_return(),
    ):
        layer.apply_btut_tuner()


# ── Task 5: constructor + ingest ────────────────────────────────────────
def test_facade_initial_state_is_empty():
    layer = LatentOceanDataLayer()
    assert layer.ingest_result is None
    assert layer.btut_result is None
    assert layer.manifold is None
    assert layer.survivors is None
    assert layer.quality_metrics is None


def test_ingest_with_adapter_instance_populates_state():
    layer = LatentOceanDataLayer()
    adapter = _fake_adapter()
    result = layer.ingest(adapter)
    assert result.source_id == "fake"
    assert len(result.entities) == 2
    assert layer.ingest_result is result


def test_ingest_with_string_source_uses_adapter_registry():
    layer = LatentOceanDataLayer()
    adapter = _fake_adapter()
    with patch(
        "app.services.data_layer.core.get_adapter", return_value=adapter
    ) as m:
        result = layer.ingest("fake", limit=50)
        m.assert_called_once_with("fake")
        adapter.fetch_entities.assert_called_once_with(limit=50)
    assert result.source_id == "fake"


def test_ingest_with_unknown_source_raises_unknown_source():
    layer = LatentOceanDataLayer()
    with patch(
        "app.services.data_layer.core.get_adapter",
        side_effect=ValueError("Unknown dataset 'nope'."),
    ):
        with pytest.raises(UnknownSourceError):
            layer.ingest("nope")


def test_apply_btut_before_ingest_raises():
    layer = LatentOceanDataLayer()
    with pytest.raises(NoIngestError):
        layer.apply_btut_tuner()


# ── Task 6: apply_btut_tuner ────────────────────────────────────────────
def test_apply_btut_calls_run_pipeline_and_stores_result():
    layer = LatentOceanDataLayer(target_survivors=50, budget_dollars=10.0)
    adapter = _fake_adapter()
    with patch("app.services.data_layer.core.get_adapter", return_value=adapter):
        layer.ingest("fake", limit=50)

    with patch(
        "app.services.data_layer.core.run_btut_pipeline",
        return_value=_fake_btut_return(),
    ) as m:
        result = layer.apply_btut_tuner()
        m.assert_called_once()
        call_kwargs = m.call_args.kwargs
        assert call_kwargs["target_survivors"] == 50
        assert call_kwargs["budget_dollars"] == 10.0

    assert layer.btut_result is result
    assert result.summary["survivors"] == 2
    assert result.embeddings_8d.shape == (2, 8)
    assert len(result.survivors) == 2


# ── Task 7: project_to_manifold + survivors + quality ──────────────────
def test_project_to_manifold_produces_8d_and_3d_coords():
    layer = LatentOceanDataLayer(compute_3d_display=True)
    _prime_layer_through_btut(layer)
    coords = layer.project_to_manifold()
    assert coords.coords_8d_unit.shape == (2, 8)
    assert np.allclose(np.linalg.norm(coords.coords_8d_unit, axis=1), 1.0, atol=1e-5)
    # Only 2 survivors → PCA is degenerate → zeros returned.
    assert coords.coords_3d_s2 is not None
    assert coords.coords_3d_s2.shape == (2, 3)


def test_project_to_manifold_skips_3d_when_disabled():
    layer = LatentOceanDataLayer(compute_3d_display=False)
    _prime_layer_through_btut(layer)
    coords = layer.project_to_manifold()
    assert coords.coords_3d_s2 is None


def test_project_to_manifold_before_btut_raises():
    layer = LatentOceanDataLayer()
    with pytest.raises(NoBTUTResultError):
        layer.project_to_manifold()


def test_get_survivors_returns_typed_survivors_with_coords():
    layer = LatentOceanDataLayer()
    _prime_layer_through_btut(layer)
    layer.project_to_manifold()
    survs = layer.get_survivors()
    assert len(survs) == 2
    assert survs[0].entity["name"] == "AAPL"
    assert len(survs[0].coord_8d) == 8
    assert survs[0].coord_3d is not None and len(survs[0].coord_3d) == 3


def test_get_quality_metrics_populates_fields():
    layer = LatentOceanDataLayer()
    _prime_layer_through_btut(layer)
    layer.project_to_manifold()
    q = layer.get_quality_metrics()
    assert q.n_survivors == 2
    assert q.reduction_ratio == 1
    assert q.variance_preservation == 0.95


def test_get_survivors_before_manifold_raises():
    layer = LatentOceanDataLayer()
    with pytest.raises(NoManifoldError):
        layer.get_survivors()


# ── Task 8: export_for_vertical ─────────────────────────────────────────
def test_export_for_vertical_returns_dict():
    layer = LatentOceanDataLayer()
    _prime_layer_through_btut(layer)
    layer.project_to_manifold()
    payload = layer.export_for_vertical("niv")
    assert payload["vertical"] == "niv"
    assert payload["n_survivors"] == 2


def test_export_for_vertical_writes_file_when_path_given(tmp_path):
    layer = LatentOceanDataLayer()
    _prime_layer_through_btut(layer)
    layer.project_to_manifold()
    out = tmp_path / "niv.json"
    payload = layer.export_for_vertical("niv", write_path=out)
    assert out.exists()
    loaded = _json.loads(out.read_text())
    assert loaded["vertical"] == "niv"
    assert loaded == payload


def test_export_for_vertical_unknown_raises():
    layer = LatentOceanDataLayer()
    _prime_layer_through_btut(layer)
    layer.project_to_manifold()
    with pytest.raises(UnknownVerticalError):
        layer.export_for_vertical("bogus")


def test_export_for_vertical_before_manifold_raises():
    layer = LatentOceanDataLayer()
    with pytest.raises(NoManifoldError):
        layer.export_for_vertical("niv")


# ── Task 9: link_causally ───────────────────────────────────────────────
def test_link_causally_between_two_layers():
    layer_a = LatentOceanDataLayer(compute_3d_display=False)
    _prime_layer_through_btut(layer_a)
    layer_a.project_to_manifold()

    layer_b = LatentOceanDataLayer(compute_3d_display=False)
    _prime_layer_through_btut(layer_b)
    layer_b.project_to_manifold()

    links = layer_a.link_causally(layer_b, threshold=0.9)
    # AAPL↔AAPL and MSFT↔MSFT both hit at 1.0 (identical unit vectors).
    assert len(links) >= 2
    assert all(
        lk.signal in {"cosine", "foreign_key", "semantic_field", "url_hierarchy"}
        for lk in links
    )


def test_link_causally_before_manifold_raises():
    layer_a = LatentOceanDataLayer()
    layer_b = LatentOceanDataLayer()
    with pytest.raises(NoManifoldError):
        layer_a.link_causally(layer_b)


# ── Task 10: run() + double-ingest regression ───────────────────────────
def test_run_one_shot_full_pipeline():
    layer = LatentOceanDataLayer(target_survivors=50)
    adapter = _fake_adapter()
    with patch(
        "app.services.data_layer.core.get_adapter", return_value=adapter
    ), patch(
        "app.services.data_layer.core.run_btut_pipeline",
        return_value=_fake_btut_return(),
    ):
        payload = layer.run("fake", vertical="niv", limit=50)
    assert payload["vertical"] == "niv"
    assert payload["n_survivors"] == 2
    assert layer.manifold is not None
    assert layer.quality_metrics is not None


def test_run_without_vertical_returns_quality_dict():
    layer = LatentOceanDataLayer()
    adapter = _fake_adapter()
    with patch(
        "app.services.data_layer.core.get_adapter", return_value=adapter
    ), patch(
        "app.services.data_layer.core.run_btut_pipeline",
        return_value=_fake_btut_return(),
    ):
        result = layer.run("fake", limit=50)
    assert "n_survivors" in result
    assert result["n_survivors"] == 2
    assert result["dataset_id"] == "fake"


def test_double_ingest_resets_state_cleanly():
    layer = LatentOceanDataLayer()
    adapter = _fake_adapter()
    with patch("app.services.data_layer.core.get_adapter", return_value=adapter):
        layer.ingest("fake", limit=10)
        # Inject stale downstream state that must be wiped.
        layer.btut_result = "stale"  # type: ignore[assignment]
        layer.manifold = "stale"  # type: ignore[assignment]
        layer.survivors = ["stale"]  # type: ignore[assignment]
        layer.quality_metrics = "stale"  # type: ignore[assignment]
        layer.ingest("fake", limit=10)
    assert layer.btut_result is None
    assert layer.manifold is None
    assert layer.survivors is None
    assert layer.quality_metrics is None
