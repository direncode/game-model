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
        variance_ratio=0.9,
        coverage_at_1_0=0.85,
        reconstruction_median_nn=0.4,
        n_clusters=5,
        unique_fingerprints=42,
        wall_seconds=1.0,
        estimated_cost_usd=0.01,
        cost_breakdown={"adapter_usd": 0.0, "compute_usd": 0.01, "storage_usd": 0.0, "total_usd": 0.01},
    )
    assert ql.reduction_ratio == 10
    assert ql.coverage_at_1_0 == 0.85


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


def test_link_stubs_return_empty_without_shared_attrs():
    """Survivors with no attributes at all produce no links."""
    s_a = [{"entity": {"name": "x"}}]
    s_b = [{"entity": {"name": "y"}}]
    assert link_by_foreign_key(s_a, s_b) == []
    assert link_by_semantic_field(s_a, s_b) == []
    assert link_by_url_hierarchy(s_a, s_b) == []


def test_link_by_foreign_key_matches_known_identifier():
    s_a = [
        {"entity": {"name": "AAPL", "attributes": {"cik": "0000320193", "ticker": "AAPL"}}},
        {"entity": {"name": "MSFT", "attributes": {"cik": "0000789019", "ticker": "MSFT"}}},
    ]
    s_b = [
        {"entity": {"name": "10-K-AAPL-2024", "attributes": {"company_cik": "0000320193"}}},
        {"entity": {"name": "unrelated", "attributes": {"cik": "9999999999"}}},
    ]
    links = link_by_foreign_key(s_a, s_b)
    # Note: company_cik is a separate field from cik — both are in FOREIGN_KEY_FIELDS,
    # but they only link when the KEY matches. So 10-K-AAPL-2024's company_cik
    # does NOT match AAPL's cik under this exact-match rule. That's correct:
    # the linker is conservative. The test verifies the conservative behavior.
    # "unrelated" has cik=9999999999 which nobody in A has → no link.
    assert links == []

    # Now test a genuine match: both sides use the SAME key.
    s_a2 = [{"entity": {"name": "AAPL", "attributes": {"cik": "0000320193"}}}]
    s_b2 = [{"entity": {"name": "AAPL-filing", "attributes": {"cik": "0000320193"}}}]
    links2 = link_by_foreign_key(s_a2, s_b2)
    assert len(links2) == 1
    assert links2[0].source_a == "AAPL"
    assert links2[0].source_b == "AAPL-filing"
    assert links2[0].signal == "foreign_key"
    assert links2[0].strength == 1.0


def test_link_by_foreign_key_ignores_trivial_values():
    """Empty, zero, and None values must not create spurious links."""
    s_a = [{"entity": {"name": "a", "attributes": {"cik": "0", "ticker": ""}}}]
    s_b = [{"entity": {"name": "b", "attributes": {"cik": "0", "ticker": ""}}}]
    assert link_by_foreign_key(s_a, s_b) == []


def test_link_by_foreign_key_parses_json_string_attributes():
    """Regression: every shipped BTUT adapter serializes attributes as a
    json.dumps(...) string, not a dict. The linker must transparently
    parse that string or it silently drops every real-world attribute.
    This caught a bug where link_by_foreign_key returned [] on live EDGAR
    data despite passing all unit tests with dict-valued attributes.
    """
    import json as _j
    s_a = [
        {"entity": {"name": "AAPL", "attributes": _j.dumps({"cik": "0000320193"})}},
    ]
    s_b = [
        {"entity": {"name": "AAPL-filing", "attributes": _j.dumps({"cik": "0000320193"})}},
    ]
    links = link_by_foreign_key(s_a, s_b)
    assert len(links) == 1
    assert links[0].strength == 1.0


def test_link_by_semantic_field_parses_json_string_attributes():
    import json as _j
    s_a = [
        {"entity": {"name": "paper", "attributes": _j.dumps({"author_name": "Jane Doe"})}},
    ]
    s_b = [
        {"entity": {"name": "author", "attributes": _j.dumps({"author_name": "jane doe"})}},
    ]
    assert len(link_by_semantic_field(s_a, s_b)) == 1


def test_link_by_url_hierarchy_parses_json_string_attributes():
    import json as _j
    s_a = [{"entity": {"name": "a", "attributes": _j.dumps(
        {"url": "https://www.sec.gov/Archives/edgar/data/1/foo.htm"}
    )}}]
    s_b = [{"entity": {"name": "b", "attributes": _j.dumps(
        {"url": "https://www.sec.gov/Archives/edgar/data/2/bar.htm"}
    )}}]
    assert len(link_by_url_hierarchy(s_a, s_b)) == 1


def test_link_by_semantic_field_matches_company_name_across_types():
    """Author name shared across a paper entity and an author entity → link."""
    s_a = [
        {"entity": {"name": "paper-123", "attributes": {"author_name": "Jane Doe"}}},
        {"entity": {"name": "paper-456", "attributes": {"author_name": "John Smith"}}},
    ]
    s_b = [
        {"entity": {"name": "author-jd", "attributes": {"author_name": "jane doe"}}},  # diff case
    ]
    links = link_by_semantic_field(s_a, s_b)
    assert len(links) == 1
    assert links[0].source_a == "paper-123"
    assert links[0].source_b == "author-jd"
    assert links[0].signal == "semantic_field"
    assert links[0].strength == 0.8


def test_link_by_url_hierarchy_matches_same_host_and_section():
    s_a = [
        {"entity": {"name": "filing-1", "attributes": {
            "url": "https://www.sec.gov/Archives/edgar/data/320193/000032019324000123/aapl-20240928.htm",
        }}},
    ]
    s_b = [
        {"entity": {"name": "filing-2", "attributes": {
            "url": "https://www.sec.gov/Archives/edgar/data/789019/000078901924000100/msft-20240630.htm",
        }}},
        {"entity": {"name": "unrelated", "attributes": {
            "url": "https://pubmed.ncbi.nlm.nih.gov/12345/",
        }}},
    ]
    links = link_by_url_hierarchy(s_a, s_b)
    # Both filing-1 and filing-2 share scheme=https, host=www.sec.gov, first seg=archives.
    assert len(links) == 1
    assert links[0].source_a == "filing-1"
    assert links[0].source_b == "filing-2"
    assert links[0].signal == "url_hierarchy"
    assert links[0].strength == 0.7


def test_link_by_url_hierarchy_ignores_non_url_strings():
    s_a = [{"entity": {"name": "a", "attributes": {"ticker": "AAPL", "desc": "not a url"}}}]
    s_b = [{"entity": {"name": "b", "attributes": {"ticker": "AAPL", "desc": "also not"}}}]
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
        variance_ratio=0.85,
        coverage_at_1_0=0.75,
        reconstruction_median_nn=0.3,
        n_clusters=3,
        unique_fingerprints=17,
        wall_seconds=3.0,
        estimated_cost_usd=0.05,
        cost_breakdown={"adapter_usd": 0.01, "compute_usd": 0.03, "storage_usd": 0.01, "total_usd": 0.05},
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
    """Return shape mirroring run_btut_pipeline's actual output.

    Matches the current BTUT summary contract: total_entities,
    survivors, reduction, wall_seconds, clusters, unique_48bit_fingerprints,
    and a reconstruction dict with variance_preservation + coverages.
    """
    return {
        "summary": {
            "total_entities": 2,
            "survivors": 2,
            "reduction": 1,
            "wall_seconds": 0.1,
            "clusters": 2,
            "unique_48bit_fingerprints": 2,
            "reconstruction": {
                "variance_preservation": 0.95,
                "median_nn": 0.4,
                "coverages": {"0.5": 0.5, "1.0": 0.85, "1.5": 0.95, "2.0": 1.0},
            },
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
    assert q.variance_ratio == 0.95
    assert q.coverage_at_1_0 == 0.85  # from fake reconstruction.coverages
    assert q.reconstruction_median_nn == 0.4
    assert q.n_clusters == 2
    assert q.unique_fingerprints == 2
    # Cost model should run and produce a real breakdown with 4 keys.
    assert set(q.cost_breakdown.keys()) == {
        "adapter_usd", "compute_usd", "storage_usd", "total_usd",
    }
    assert q.estimated_cost_usd == q.cost_breakdown["total_usd"]


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


def test_ingest_retries_on_exception_then_succeeds():
    """Adapter.fetch_entities raises twice, then succeeds on attempt 3.
    Layer should retry with exp backoff and return the successful result.
    """
    layer = LatentOceanDataLayer(
        ingest_max_retries=3, ingest_backoff_seconds=0.01
    )
    adapter = MagicMock()
    adapter.get_meta.return_value = MagicMock(dataset_id="flaky")
    # Fail twice, then succeed.
    call_log = []

    def flaky_fetch(limit):
        call_log.append("fetch")
        if len(call_log) < 3:
            raise ConnectionError("transient network error")
        return [{"name": "X", "type": "t", "attributes": {}}]

    adapter.fetch_entities.side_effect = flaky_fetch
    adapter.fetch_edges.return_value = []
    result = layer.ingest(adapter)
    assert result.source_id == "flaky"
    assert len(call_log) == 3  # two failures + one success
    assert len(result.entities) == 1


def test_ingest_raises_after_all_retries_exhausted():
    layer = LatentOceanDataLayer(
        ingest_max_retries=2, ingest_backoff_seconds=0.01
    )
    adapter = MagicMock()
    adapter.get_meta.return_value = MagicMock(dataset_id="broken")
    adapter.fetch_entities.side_effect = ConnectionError("always broken")
    with pytest.raises(ConnectionError):
        layer.ingest(adapter)


def test_display_name_resolves_from_adapter_primary_field():
    """After project_to_manifold, Survivor.display_name should come from
    the adapter's primary_field (e.g. ticker for EDGAR), not the
    auto-generated entity.name."""
    layer = LatentOceanDataLayer()
    # Real-shaped adapter with meta + EntityTypeConfig
    from app.services.btut.adapters.base import DatasetMeta, EntityTypeConfig

    adapter = MagicMock()
    adapter.get_meta.return_value = DatasetMeta(
        dataset_id="fake",
        display_name="Fake",
        description="",
        entity_types=[
            EntityTypeConfig(
                name="company",
                color="#fff",
                primary_field="ticker",
            ),
        ],
    )
    adapter.fetch_entities.return_value = [
        # Real adapters serialize attributes as JSON strings.
        {"name": "company_1013871", "type": "company",
         "attributes": '{"ticker": "AAPL", "cik": "0000320193"}'},
        {"name": "company_789019", "type": "company",
         "attributes": '{"ticker": "MSFT", "cik": "0000789019"}'},
    ]
    adapter.fetch_edges.return_value = []

    with patch(
        "app.services.data_layer.core.run_btut_pipeline",
        return_value={
            "summary": {
                "total_entities": 2, "survivors": 2, "reduction": 1,
                "wall_seconds": 0.1, "clusters": 2,
                "unique_48bit_fingerprints": 2,
                "reconstruction": {
                    "variance_preservation": 0.9,
                    "median_nn": 0.3,
                    "coverages": {"1.0": 0.9},
                },
            },
            "survivors": [
                {"entity": {"name": "company_1013871", "type": "company",
                            "attributes": '{"ticker": "AAPL"}'},
                 "cluster": 0, "fingerprint_48bit": "", "flips": 0, "scores": {}},
                {"entity": {"name": "company_789019", "type": "company",
                            "attributes": '{"ticker": "MSFT"}'},
                 "cluster": 0, "fingerprint_48bit": "", "flips": 0, "scores": {}},
            ],
            "embeddings_8d": [1.0] + [0.0] * 7 + [0.0, 1.0] + [0.0] * 6,
        },
    ):
        layer.ingest(adapter)
        layer.apply_btut_tuner()
        layer.project_to_manifold()

    survs = layer.get_survivors()
    # display_name resolves from primary_field=ticker, NOT entity.name
    display = {s.display_name for s in survs}
    assert "AAPL" in display
    assert "MSFT" in display
    assert "company_1013871" not in display


def test_chunked_run_splits_and_reduces():
    """run_chunked() should call run_btut_pipeline once per chunk plus
    once for the final pass, and the reported n_input should reflect
    the ORIGINAL total (not the union-survivor count)."""
    layer = LatentOceanDataLayer(target_survivors=10)
    entities = [
        {"name": f"e{i}", "type": "x", "attributes": {}}
        for i in range(50)
    ]
    adapter = MagicMock()
    adapter.get_meta.return_value = MagicMock(dataset_id="fake")
    adapter.fetch_entities.return_value = entities
    adapter.fetch_edges.return_value = []

    # Fake BTUT: echo 5 of the input back as survivors each call.
    call_count = {"n": 0}

    def fake_btut(entities, edges, unique_types, target_survivors, **kw):
        call_count["n"] += 1
        n_out = min(target_survivors, max(1, len(entities) // 2))
        return {
            "summary": {
                "total_entities": len(entities),
                "survivors": n_out,
                "reduction": max(len(entities) // max(n_out, 1), 1),
                "wall_seconds": 0.01,
                "clusters": 1,
                "unique_48bit_fingerprints": n_out,
                "reconstruction": {
                    "variance_preservation": 1.0,
                    "median_nn": 0.1,
                    "coverages": {"1.0": 1.0},
                },
            },
            "survivors": [
                {"entity": entities[i], "cluster": 0,
                 "fingerprint_48bit": "", "flips": 0, "scores": {}}
                for i in range(n_out)
            ],
            "embeddings_8d": [1.0, 0, 0, 0, 0, 0, 0, 0] * n_out,
        }

    with patch(
        "app.services.data_layer.core.get_adapter", return_value=adapter
    ), patch(
        "app.services.data_layer.core.run_btut_pipeline", side_effect=fake_btut
    ):
        result = layer.run_chunked("fake", limit=50, chunk_size=25)

    # 50 / 25 = 2 chunks → 2 chunk calls + 1 final call = 3 total
    assert call_count["n"] == 3
    # n_input in quality should be the original total (50), not the
    # union-survivor count that the second pass actually received.
    assert result["n_input"] == 50
    assert result["n_chunks"] == 2
    assert result["chunk_size"] == 25


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


# ── REST endpoint tests (TestClient, no HTTP) ───────────────────────────
def test_rest_endpoints_register_and_return_expected_shapes():
    """Smoke test for the data-layer REST router.

    We import the FastAPI app and use ``TestClient`` so we don't need
    a running server. The endpoints are patched at the adapter +
    pipeline layer, so this test never touches real network.
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.v1.data_layer import router as dl_router

    app = FastAPI()
    app.include_router(dl_router)
    client = TestClient(app)

    # GET /data-layer/sources — should work without mocking (real registry).
    r = client.get("/data-layer/sources")
    assert r.status_code == 200
    src_ids = {s["id"] for s in r.json()}
    assert "edgar" in src_ids

    # POST /data-layer/run — patch the adapter + pipeline.
    adapter = _fake_adapter()
    with patch(
        "app.services.data_layer.core.get_adapter", return_value=adapter
    ), patch(
        "app.services.data_layer.core.run_btut_pipeline",
        return_value=_fake_btut_return(),
    ):
        r = client.post(
            "/data-layer/run",
            json={
                "source": "fake",
                "limit": 50,
                "target_survivors": 2,
                "vertical": "niv",
            },
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["dataset_id"] == "fake"
    assert data["vertical"] == "niv"
    assert data["payload"]["vertical"] == "niv"
    assert data["quality"]["n_survivors"] == 2


def test_rest_run_unknown_source_returns_404():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.v1.data_layer import router as dl_router

    app = FastAPI()
    app.include_router(dl_router)
    client = TestClient(app)

    with patch(
        "app.services.data_layer.core.get_adapter",
        side_effect=ValueError("Unknown dataset 'nope'."),
    ):
        r = client.post(
            "/data-layer/run",
            json={"source": "nope"},
        )
    assert r.status_code == 404


def test_rest_link_endpoint_returns_link_counts():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.v1.data_layer import router as dl_router

    app = FastAPI()
    app.include_router(dl_router)
    client = TestClient(app)

    # Both sources use the same fake data, so cosine will fire on
    # identical unit-vectors → non-zero links.
    adapter = _fake_adapter()
    with patch(
        "app.services.data_layer.core.get_adapter", return_value=adapter
    ), patch(
        "app.services.data_layer.core.run_btut_pipeline",
        return_value=_fake_btut_return(),
    ):
        r = client.post(
            "/data-layer/link",
            json={
                "source_a": "fake",
                "source_b": "fake",
                "limit": 50,
                "target_survivors": 2,
                "cosine_threshold": 0.9,
            },
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["dataset_a"] == "fake"
    assert data["dataset_b"] == "fake"
    assert data["n_links"] >= 2  # AAPL↔AAPL and MSFT↔MSFT
    assert "cosine" in data["links_by_signal"]
