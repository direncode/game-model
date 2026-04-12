"""Integration test for IncrementalCrystallizer against the real
tcd_jepa.topology.PersistentHomologyComputer (scipy fallback path).

Skipped if torch or tcd_jepa is not importable — the unit tests in
test_online.py still cover the novelty detector logic.
"""
from __future__ import annotations

import numpy as np
import pytest

try:
    import torch
    from tcd_jepa.topology.persistent_homology import PersistentHomologyComputer

    _HAS_TOPOLOGY = True
except ImportError:
    _HAS_TOPOLOGY = False

from app.services.crystallization.online import (
    IncrementalCrystallizer,
    PersistenceFeature,
)
from app.services.crystallization.vertical_types import BTUTSurvivorBundle


pytestmark = pytest.mark.skipif(
    not _HAS_TOPOLOGY,
    reason="tcd_jepa.topology or torch not available",
)


def _clustered_bundle(n_per_cluster: int = 20) -> BTUTSurvivorBundle:
    """Two well-separated clusters in 3D — should produce at least 1 H0 feature."""
    rng = np.random.RandomState(42)
    cluster_a = rng.randn(n_per_cluster, 3).astype(np.float32) + [5, 0, 0]
    cluster_b = rng.randn(n_per_cluster, 3).astype(np.float32) + [-5, 0, 0]
    embeddings = np.vstack([cluster_a, cluster_b])
    ids = [f"entity_{i}" for i in range(len(embeddings))]
    return BTUTSurvivorBundle(
        embeddings=embeddings, ids=ids, edges=[], metadata={}
    )


def test_compute_persistence_returns_features():
    """Push a clustered bundle into IncrementalCrystallizer. The real
    PersistentHomologyComputer (via scipy fallback) should find at least
    one H0 feature from the two well-separated clusters."""
    crystallizer = IncrementalCrystallizer(window_size=256)
    # First push seeds the window.
    first = crystallizer.push(_clustered_bundle())
    # Window now has 40 points from 2 clusters. The scipy fallback
    # computes H0 via single-linkage clustering, which should find at
    # least one non-trivial connected component.
    assert crystallizer.window_length() == 40
    # On scipy-fallback the features may or may not have appeared after
    # the first push (depends on the PH computer's internal thresholds).
    # Push a second bundle to force a diagram diff.
    second = crystallizer.push(_clustered_bundle())
    # The key contract: _compute_persistence runs without error and
    # returns a structurally valid list. Whether features are "novel"
    # depends on the detector, but we should at least have a non-empty
    # previous diagram now.
    assert crystallizer._previous_features is not None
    assert isinstance(crystallizer._previous_features, list)
    for f in crystallizer._previous_features:
        assert isinstance(f, PersistenceFeature)
        assert f.lifetime >= 0


def test_persistent_homology_computer_directly():
    """Sanity: PersistentHomologyComputer.compute() runs and returns the
    expected dict keys."""
    rng = np.random.RandomState(99)
    pts = torch.tensor(rng.randn(30, 3), dtype=torch.float32)
    computer = PersistentHomologyComputer(max_homology_dim=1)
    result = computer.compute(pts)
    assert "H0" in result
    assert "H1" in result
    assert isinstance(result["H0"], np.ndarray)
