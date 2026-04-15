"""Unit tests for LatentOceanEngine and EngineConfig.

These tests use synthetic data and do not require a database connection.
They verify the engine's core computational pipeline: reduce, represent,
and basic configuration logic.
"""
from __future__ import annotations

import numpy as np
import pytest

from engine import EngineConfig, LatentOceanEngine
from engine.types import ManifoldResult, ReductionResult


# ── EngineConfig ──────────────────────────────────────────────────────


class TestEngineConfig:
    """Verify EngineConfig defaults and to_btut_config auto-scaling."""

    def test_defaults(self):
        """EngineConfig() has sensible defaults."""
        cfg = EngineConfig()
        assert cfg.budget_dollars == 50.0
        assert cfg.target_survivors == 300
        assert cfg.chunk_size == 50_000
        assert cfg.thinning_strategy == "composite"
        assert cfg.compute_3d_display is True
        assert cfg.device == "auto"
        assert cfg.use_fp16 is True
        assert cfg.flow_engine_enabled is True
        assert cfg.resolutions == [4, 8, 16]
        assert cfg.n_rotations == 16

    def test_custom_values(self):
        """EngineConfig accepts custom values."""
        cfg = EngineConfig(
            budget_dollars=200.0,
            target_survivors=500,
            chunk_size=100_000,
            device="cpu",
        )
        assert cfg.budget_dollars == 200.0
        assert cfg.target_survivors == 500
        assert cfg.chunk_size == 100_000
        assert cfg.device == "cpu"

    def test_to_btut_config_auto_scale(self):
        """to_btut_config() returns a BTUTConfig with auto-scaled params."""
        cfg = EngineConfig(budget_dollars=100.0)
        btut_cfg = cfg.to_btut_config(entity_count=10_000, edge_count=5000)

        # Should return a BTUTConfig with cascade levels
        assert hasattr(btut_cfg, "cascade_levels")
        assert len(btut_cfg.cascade_levels) > 0
        assert hasattr(btut_cfg, "chunk_size")

    def test_to_btut_config_small_input(self):
        """to_btut_config() handles small entity counts."""
        cfg = EngineConfig(budget_dollars=10.0)
        btut_cfg = cfg.to_btut_config(entity_count=100, edge_count=0)
        assert hasattr(btut_cfg, "cascade_levels")

    def test_to_btut_config_large_input(self):
        """to_btut_config() handles large entity counts."""
        cfg = EngineConfig(budget_dollars=200.0)
        btut_cfg = cfg.to_btut_config(entity_count=1_000_000, edge_count=500_000)
        assert hasattr(btut_cfg, "cascade_levels")


# ── Synthetic data helpers ────────────────────────────────────────────


def _make_entities(n: int, n_types: int = 3) -> list[dict]:
    """Generate n synthetic entities across n_types types."""
    type_names = [f"type_{i}" for i in range(n_types)]
    entities = []
    for i in range(n):
        entities.append({
            "name": f"entity_{i}",
            "type": type_names[i % n_types],
            "attributes": {
                "value": float(i),
                "label": f"label_{i % 10}",
                "score": np.random.random(),
            },
        })
    return entities


def _make_edges(entities: list[dict], n_edges: int = 0) -> list[dict]:
    """Generate simple edges between consecutive entities."""
    edges = []
    for i in range(min(n_edges, len(entities) - 1)):
        edges.append({
            "source": entities[i]["name"],
            "target": entities[i + 1]["name"],
            "type": "sequential",
            "weight": 1.0,
        })
    return edges


def _make_reduction_result(n_survivors: int = 10) -> ReductionResult:
    """Create a synthetic ReductionResult for testing represent()."""
    embeddings = np.random.randn(n_survivors, 8).astype(np.float32)
    survivors = [
        {
            "entity": {"name": f"survivor_{i}", "type": "test", "attributes": {}},
            "cluster": i % 3,
            "scores": {"composite": 0.5, "diversity": 0.3, "reconstruction": 0.8, "anomaly": 0.1},
            "fingerprint_48bit": f"fp_{i:012x}",
        }
        for i in range(n_survivors)
    ]
    return ReductionResult(
        summary={
            "total_entities": n_survivors * 10,
            "survivors": n_survivors,
            "reduction": 10,
            "clusters": 3,
            "unique_48bit_fingerprints": n_survivors,
            "wall_seconds": 1.0,
            "reconstruction": {
                "variance_preservation": 0.95,
                "median_nn": 0.12,
                "coverages": {"1.0": 0.88},
            },
        },
        survivors=survivors,
        embeddings_8d=embeddings,
        wall_seconds=1.0,
        embed_context={"n_input": n_survivors * 10, "n_edges": 0, "n_types": 1, "budget": 50.0},
    )


# ── LatentOceanEngine.represent() ────────────────────────────────────


class TestRepresent:
    """Test the represent() stage (L2 normalization + PCA to S2)."""

    def test_represent_produces_unit_vectors(self):
        """represent() normalizes embeddings to unit sphere."""
        engine = LatentOceanEngine(EngineConfig())
        reduction = _make_reduction_result(20)
        manifold = engine.represent(reduction)

        assert isinstance(manifold, ManifoldResult)
        assert manifold.coords_8d_unit.shape == (20, 8)

        # Check L2 norms are ~1.0
        norms = np.linalg.norm(manifold.coords_8d_unit, axis=1)
        np.testing.assert_allclose(norms, 1.0, atol=1e-5)

    def test_represent_produces_3d_when_enough_points(self):
        """represent() computes 3D coords when n >= 3."""
        engine = LatentOceanEngine(EngineConfig(compute_3d_display=True))
        reduction = _make_reduction_result(10)
        manifold = engine.represent(reduction)

        assert manifold.coords_3d_s2 is not None
        assert manifold.coords_3d_s2.shape == (10, 3)

        # 3D coords should also be unit vectors
        norms_3d = np.linalg.norm(manifold.coords_3d_s2, axis=1)
        np.testing.assert_allclose(norms_3d, 1.0, atol=1e-5)

    def test_represent_skips_3d_when_disabled(self):
        """represent() skips 3D when compute_3d_display is False."""
        engine = LatentOceanEngine(EngineConfig(compute_3d_display=False))
        reduction = _make_reduction_result(10)
        manifold = engine.represent(reduction)

        assert manifold.coords_3d_s2 is None

    def test_represent_skips_3d_with_few_points(self):
        """represent() skips 3D when n < 3."""
        engine = LatentOceanEngine(EngineConfig(compute_3d_display=True))
        reduction = _make_reduction_result(2)
        manifold = engine.represent(reduction)

        assert manifold.coords_3d_s2 is None

    def test_represent_handles_zero_vectors(self):
        """represent() handles zero-norm embeddings without NaN."""
        engine = LatentOceanEngine(EngineConfig())
        reduction = _make_reduction_result(5)
        reduction.embeddings_8d[0] = 0.0  # Zero vector
        manifold = engine.represent(reduction)

        # Zero vector should be normalized to itself (via the norms == 0 -> 1 guard)
        assert not np.any(np.isnan(manifold.coords_8d_unit))

    def test_represent_single_point(self):
        """represent() works with a single survivor."""
        engine = LatentOceanEngine(EngineConfig(compute_3d_display=True))
        reduction = _make_reduction_result(1)
        manifold = engine.represent(reduction)

        assert manifold.coords_8d_unit.shape == (1, 8)
        # 3D should be None since n < 3
        assert manifold.coords_3d_s2 is None


# ── LatentOceanEngine edge cases ─────────────────────────────────────


class TestEngineEdgeCases:
    """Test engine with empty and minimal inputs."""

    def test_represent_empty(self):
        """represent() handles zero-length embedding array."""
        engine = LatentOceanEngine(EngineConfig())
        reduction = ReductionResult(
            summary={},
            survivors=[],
            embeddings_8d=np.zeros((0, 8), dtype=np.float32),
            wall_seconds=0.0,
            embed_context={},
        )
        manifold = engine.represent(reduction)
        assert manifold.coords_8d_unit.shape == (0, 8)

    def test_monitor_empty_wells(self):
        """monitor() handles empty well/wire lists."""
        engine = LatentOceanEngine(EngineConfig())
        result = engine.monitor(wells=[], wires=[])

        assert result.circulation_rate == 0.0
        assert result.friction_index == 0.0
        assert result.saturation_pressure == 0.0
        assert result.resilience == 1.0
        assert result.alerts == []

    def test_monitor_with_alerts(self):
        """monitor() detects critical wells and wires."""
        engine = LatentOceanEngine(EngineConfig())
        wells = [
            {"id": "w0", "active": True, "health": "ok", "pressure": 0.5, "capacity": 1.0},
            {"id": "w1", "active": False, "health": "critical", "pressure": 1.0, "capacity": 1.0},
        ]
        wires = [
            {"id": "wire0", "health": "critical", "resistance": 0.8},
        ]
        result = engine.monitor(wells, wires)

        assert result.circulation_rate == 0.5  # 1 of 2 active
        assert len(result.alerts) == 2  # 1 well + 1 wire critical

    def test_discover_with_no_overlap(self):
        """discover() returns empty list when manifolds don't overlap."""
        engine = LatentOceanEngine(EngineConfig())

        # Create two orthogonal manifolds
        coords_a = np.eye(4, 8, dtype=np.float32)
        norms_a = np.linalg.norm(coords_a, axis=1, keepdims=True)
        norms_a = np.where(norms_a == 0, 1.0, norms_a)
        coords_a = coords_a / norms_a

        coords_b = np.eye(4, 8, k=4, dtype=np.float32)
        norms_b = np.linalg.norm(coords_b, axis=1, keepdims=True)
        norms_b = np.where(norms_b == 0, 1.0, norms_b)
        coords_b = coords_b / norms_b

        ma = ManifoldResult(coords_8d_unit=coords_a, coords_3d_s2=None, projection_method="test")
        mb = ManifoldResult(coords_8d_unit=coords_b, coords_3d_s2=None, projection_method="test")

        links = engine.discover(ma, mb, threshold=0.5)
        assert links == []

    def test_discover_with_identical_manifolds(self):
        """discover() finds links when manifolds are identical."""
        engine = LatentOceanEngine(EngineConfig())

        coords = np.random.randn(5, 8).astype(np.float32)
        norms = np.linalg.norm(coords, axis=1, keepdims=True)
        coords = coords / norms

        ma = ManifoldResult(coords_8d_unit=coords, coords_3d_s2=None, projection_method="test")

        links = engine.discover(ma, ma, threshold=0.99)
        # Self-similarity should find diagonal matches
        assert len(links) >= 5  # At least the diagonal

    def test_quality_computation(self):
        """_compute_quality() produces correct metrics from reduction result."""
        engine = LatentOceanEngine(EngineConfig())
        reduction = _make_reduction_result(10)

        quality = engine._compute_quality(reduction)
        assert quality.n_input == 100  # 10 * 10 from _make_reduction_result
        assert quality.n_survivors == 10
        assert quality.reduction_ratio == 10
        assert quality.variance_ratio == 0.95
        assert quality.coverage_at_1_0 == 0.88

    def test_hydrate_survivors(self):
        """_hydrate_survivors() builds Survivor objects correctly."""
        engine = LatentOceanEngine(EngineConfig())
        reduction = _make_reduction_result(5)
        manifold = engine.represent(reduction)

        survivors = engine._hydrate_survivors(reduction, manifold)
        assert len(survivors) == 5

        for s in survivors:
            assert hasattr(s, "entity")
            assert hasattr(s, "cluster")
            assert hasattr(s, "scores")
            assert hasattr(s, "fingerprint")
            assert hasattr(s, "coord_8d")
            assert len(s.coord_8d) == 8
            if manifold.coords_3d_s2 is not None:
                assert s.coord_3d is not None
                assert len(s.coord_3d) == 3
