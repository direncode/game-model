"""Tests for the bundle-to-disk serializer."""
import os
import tempfile

import numpy as np
import yaml

from app.services.crystallization.bundle_serializer import serialize_bundle
from app.services.crystallization.presets import get_preset
from app.services.crystallization.vertical_types import (
    BTUTSurvivorBundle,
    VerticalPreset,
)


def _bundle() -> BTUTSurvivorBundle:
    return BTUTSurvivorBundle(
        embeddings=np.random.RandomState(0).randn(10, 8).astype(np.float32),
        ids=[f"ent_{i}" for i in range(10)],
        edges=[(0, 1, 0.9), (1, 2, 0.5)],
        metadata={"provenance_job_id": "job-test"},
    )


def test_serialize_creates_expected_files():
    preset = get_preset(VerticalPreset.GENERIC)
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path, data_dir = serialize_bundle(_bundle(), preset, output_dir=tmpdir)
        assert os.path.isfile(config_path)
        assert os.path.isfile(os.path.join(data_dir, "features.npy"))
        assert os.path.isfile(os.path.join(data_dir, "edges.npy"))
        assert os.path.isfile(os.path.join(data_dir, "entity_ids.txt"))
        assert os.path.isfile(os.path.join(data_dir, "metadata.json"))


def test_serialize_config_yaml_contains_preset_values():
    preset = get_preset(VerticalPreset.TRADING)
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path, _ = serialize_bundle(_bundle(), preset, output_dir=tmpdir)
        with open(config_path) as f:
            cfg = yaml.safe_load(f)
        assert cfg["langevin_temperature"] == preset.langevin_temperature
        assert cfg["langevin_steps"] == preset.langevin_steps
        assert cfg["homology_max_dim"] == preset.homology_max_dim
        assert cfg["prune_threshold"] == preset.prune_threshold
        assert cfg["max_modules"] == preset.max_modules
        assert cfg["tcd"] is True
        assert cfg["num_nodes"] == 10
        assert cfg["feature_dim"] == 8


def test_serialize_features_roundtrip():
    bundle = _bundle()
    preset = get_preset(VerticalPreset.GENERIC)
    with tempfile.TemporaryDirectory() as tmpdir:
        _, data_dir = serialize_bundle(bundle, preset, output_dir=tmpdir)
        loaded = np.load(os.path.join(data_dir, "features.npy"))
        np.testing.assert_array_equal(loaded, bundle.embeddings)


def test_serialize_edges_roundtrip():
    bundle = _bundle()
    preset = get_preset(VerticalPreset.GENERIC)
    with tempfile.TemporaryDirectory() as tmpdir:
        _, data_dir = serialize_bundle(bundle, preset, output_dir=tmpdir)
        edges = np.load(os.path.join(data_dir, "edges.npy"))
        assert edges.shape == (3, 2)  # 3 rows (src, dst, weight) x 2 edges
        assert list(edges[0]) == [0.0, 1.0]  # src
        assert list(edges[1]) == [1.0, 2.0]  # dst
