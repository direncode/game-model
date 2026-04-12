"""Tests for OceanOrchestrator and export_formats."""
from __future__ import annotations

from unittest.mock import patch, MagicMock
import numpy as np
import pytest
from pathlib import Path
import csv
import tempfile

from app.services.data_layer.types import (
    Survivor,
    QualityMetrics,
    ManifoldCoords,
    IngestResult,
    BTUTRunResult,
)
from app.services.data_layer.export_formats import to_csv
from app.services.data_layer.orchestrator import OceanOrchestrator
from app.services.data_layer import LatentOceanDataLayer
from app.services.data_layer.lineage_bridge import DataLayerLineageBridge


# ── Helpers ────────────────────────────────────────────────────────────────

def _fake_adapter(dataset_id="fake"):
    """Return a MagicMock adapter with get_meta, fetch_entities, fetch_edges."""
    adapter = MagicMock()
    adapter.fetch_entities.return_value = [
        {"name": "AAPL", "type": "company", "attributes": {"ticker": "AAPL"}},
        {"name": "MSFT", "type": "company", "attributes": {"ticker": "MSFT"}},
    ]
    adapter.fetch_edges.return_value = []
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
        "embeddings_8d": [1.0, 0, 0, 0, 0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 0],
    }


def _make_survivors(n=2):
    """Create n fake Survivor dataclass instances."""
    survivors = []
    for i in range(n):
        coord_8d = [0.0] * 8
        coord_8d[i % 8] = 1.0
        survivors.append(Survivor(
            entity={"name": f"ent_{i}", "type": "company", "attributes": {"ticker": f"T{i}"}},
            cluster=i % 3,
            scores={"composite": 0.5 + i * 0.1, "diversity": 0.3, "reconstruction": 0.2, "anomaly": 0.1},
            fingerprint=f"fp_{i:04d}",
            coord_8d=coord_8d,
            coord_3d=[float(i), 0.0, 0.0],
            display_name=f"Entity {i}",
        ))
    return survivors


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


# ── Export formats ─────────────────────────────────────────────────────────

def test_csv_export_roundtrip():
    """Write survivors to CSV, read back, verify columns."""
    survivors = _make_survivors(2)
    with tempfile.TemporaryDirectory() as tmpdir:
        path = Path(tmpdir) / "test.csv"
        to_csv(survivors, path)

        assert path.exists()
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        assert len(rows) == 2
        assert rows[0]["name"] == "ent_0"
        assert rows[1]["name"] == "ent_1"
        # Check coordinate columns exist.
        assert "coord_8d_0" in rows[0]
        assert "coord_8d_7" in rows[0]
        assert "coord_3d_0" in rows[0]
        assert "coord_3d_2" in rows[0]
        # Check fingerprint round-trips.
        assert rows[0]["fingerprint"] == "fp_0000"


def test_csv_export_empty():
    """Empty survivor list produces empty file."""
    with tempfile.TemporaryDirectory() as tmpdir:
        path = Path(tmpdir) / "empty.csv"
        to_csv([], path)
        assert path.exists()
        content = path.read_text(encoding="utf-8")
        assert content == ""


# ── Orchestrator ───────────────────────────────────────────────────────────

def _mock_run_source(orch, source_id, limit):
    """Simulate _run_source by creating a fully-primed LatentOceanDataLayer."""
    layer = LatentOceanDataLayer(
        target_survivors=orch.target_survivors,
        compute_3d_display=False,
    )
    _prime_layer_through_btut(layer)
    layer.project_to_manifold()

    from app.services.data_layer.orchestrator import SourceResult
    survivors = layer.get_survivors()
    quality = layer.get_quality_metrics()
    return SourceResult(
        source_id=source_id,
        layer=layer,
        quality=quality,
        survivors=survivors,
        n_survivors=len(survivors),
        wall_seconds=0.1,
    )


def _mock_run_source_fail(orch, source_id, limit):
    """Simulate _run_source for a source that fails during ingest."""
    from app.services.data_layer.orchestrator import SourceResult
    layer = LatentOceanDataLayer(
        target_survivors=orch.target_survivors,
        compute_3d_display=False,
    )
    return SourceResult(
        source_id=source_id,
        layer=layer,
        quality=QualityMetrics(
            n_input=0, n_survivors=0, reduction_ratio=0,
            variance_ratio=0, coverage_at_1_0=0,
            reconstruction_median_nn=0, n_clusters=0,
            unique_fingerprints=0, wall_seconds=0,
            estimated_cost_usd=0,
            cost_breakdown={"adapter_usd": 0, "compute_usd": 0, "storage_usd": 0, "total_usd": 0},
        ),
        survivors=[],
        n_survivors=0,
        wall_seconds=0.01,
    )


def test_orchestrator_single_source_mock():
    """Build ocean with one source (mock BTUT), verify manifest shape."""
    orch = OceanOrchestrator(target_survivors=100)

    with patch.object(orch, "_run_source", side_effect=lambda sid, lim: _mock_run_source(orch, sid, lim)):
        manifest = orch.build_ocean(sources=["fake"], default_limit=50)

    assert "fake" in manifest.sources
    assert len(manifest.sources) == 1
    assert manifest.sources["fake"].n_survivors > 0
    assert len(manifest.unified_survivors) > 0
    # Only 1 source => no cross-links.
    assert manifest.cross_links == []
    assert manifest.benchmark is not None
    assert len(manifest.benchmark) == 1


def test_orchestrator_two_sources_mock():
    """Build ocean with two sources, verify cross-links exist."""
    orch = OceanOrchestrator(target_survivors=100, cosine_threshold=0.5)

    with patch.object(orch, "_run_source", side_effect=lambda sid, lim: _mock_run_source(orch, sid, lim)):
        manifest = orch.build_ocean(sources=["alpha", "beta"], default_limit=50)

    assert len(manifest.sources) == 2
    assert "alpha" in manifest.sources
    assert "beta" in manifest.sources
    assert len(manifest.unified_survivors) > 0
    # 2 sources => 1 pair in cross_links.
    assert len(manifest.cross_links) == 1
    assert set(manifest.cross_links[0].pair) == {"alpha", "beta"}
    # link_matrix is 2x2.
    assert "alpha" in manifest.link_matrix
    assert "beta" in manifest.link_matrix
    assert "beta" in manifest.link_matrix["alpha"]
    assert "alpha" in manifest.link_matrix["beta"]


def test_orchestrator_link_matrix_symmetric():
    """link_matrix[a][b] == link_matrix[b][a]."""
    orch = OceanOrchestrator(target_survivors=100, cosine_threshold=0.5)

    with patch.object(orch, "_run_source", side_effect=lambda sid, lim: _mock_run_source(orch, sid, lim)):
        manifest = orch.build_ocean(sources=["src_a", "src_b"], default_limit=50)

    mat = manifest.link_matrix
    assert mat["src_a"]["src_b"] == mat["src_b"]["src_a"]


def test_orchestrator_handles_failed_source():
    """If one adapter raises, that source gets empty results, others continue."""
    orch = OceanOrchestrator(target_survivors=100)

    def side_effect(sid, lim):
        if sid == "broken":
            return _mock_run_source_fail(orch, sid, lim)
        return _mock_run_source(orch, sid, lim)

    with patch.object(orch, "_run_source", side_effect=side_effect):
        manifest = orch.build_ocean(sources=["broken", "good"], default_limit=50)

    assert len(manifest.sources) == 2
    assert manifest.sources["broken"].n_survivors == 0
    assert manifest.sources["good"].n_survivors > 0
    # Unified survivors come only from the good source.
    assert len(manifest.unified_survivors) > 0
    for s in manifest.unified_survivors:
        assert s["source_id"] == "good"


def test_orchestrator_benchmark_has_all_sources():
    """benchmark list has one row per source."""
    orch = OceanOrchestrator(target_survivors=100)

    def side_effect(sid, lim):
        if sid == "broken":
            return _mock_run_source_fail(orch, sid, lim)
        return _mock_run_source(orch, sid, lim)

    with patch.object(orch, "_run_source", side_effect=side_effect):
        manifest = orch.build_ocean(sources=["broken", "good", "also_good"], default_limit=50)

    assert len(manifest.benchmark) == 3
    bench_sources = {row["source"] for row in manifest.benchmark}
    assert bench_sources == {"broken", "good", "also_good"}


# ── Lineage bridge ─────────────────────────────────────────────────────────

def test_lineage_bridge_queues_events():
    """After a full mock pipeline run with lineage=bridge, verify events."""
    bridge = DataLayerLineageBridge()
    layer = LatentOceanDataLayer(lineage=bridge)

    _prime_layer_through_btut(layer)
    layer.project_to_manifold()

    # Bridge should have recorded at least 3 events: ingest, btut, manifold.
    assert len(bridge.events) >= 3
    actions = [e.action for e in bridge.events]
    assert "ingest" in actions
    assert "btut_reduce" in actions
    assert "manifold_project" in actions
