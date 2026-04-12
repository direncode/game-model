"""Incremental / online crystallization path.

The batch path (TCDJEPAWrapper) re-runs train_graph.py on every call.
That's fine for full datasets but pointless for small deltas. This
module keeps a sliding window of recent embeddings, runs persistent
homology on the window, and surfaces features novel against the
previous diagram.

detect_novel_features() is the learning-mode contribution point —
auto-filled with a combined lifetime + bottleneck-distance detector.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Any

import numpy as np

from .vertical_types import BTUTSurvivorBundle


@dataclass
class PersistenceFeature:
    """One feature from a persistence diagram."""
    dim: int
    birth: float
    death: float

    @property
    def lifetime(self) -> float:
        return self.death - self.birth


# Tunables for the auto novelty detector. Kept module-level so a future
# preset can override them per vertical without re-implementing the body.
_MIN_LIFETIME = 0.05
_MATCH_EPSILON = 0.05


def detect_novel_features(
    *,
    previous: list[PersistenceFeature],
    current: list[PersistenceFeature],
) -> list[PersistenceFeature]:
    """Return the subset of `current` that should spawn new modules.

    Learning-mode #1 default: lifetime threshold + approximate
    bottleneck matching.

    1. Drop features with lifetime < _MIN_LIFETIME (persistence noise).
    2. For each survivor, keep it only if NO previous feature is within
       _MATCH_EPSILON in both birth and death AND same homology dim.
       This is an O(|prev| * |cur|) approximation of bottleneck
       distance — good enough for the expected diagram sizes
       (low-hundreds of features per window).

    Empty `previous` → returns everything that passes the lifetime
    filter. Deterministic for the same inputs.
    """
    long_lived = [f for f in current if f.lifetime >= _MIN_LIFETIME]
    if not previous:
        return long_lived

    def _matches(feat: PersistenceFeature) -> bool:
        for prev in previous:
            if prev.dim != feat.dim:
                continue
            if (
                abs(prev.birth - feat.birth) <= _MATCH_EPSILON
                and abs(prev.death - feat.death) <= _MATCH_EPSILON
            ):
                return True
        return False

    return [f for f in long_lived if not _matches(f)]


class IncrementalCrystallizer:
    """Maintains a sliding window of embeddings for online crystallization."""

    def __init__(self, window_size: int = 1024) -> None:
        self._window: deque[np.ndarray] = deque(maxlen=window_size)
        self._previous_features: list[PersistenceFeature] = []

    def window_length(self) -> int:
        return len(self._window)

    def push(self, bundle: BTUTSurvivorBundle) -> list[PersistenceFeature]:
        """Ingest a delta bundle and return novel features (empty on warmup)."""
        for row in bundle.embeddings:
            self._window.append(np.asarray(row, dtype=np.float32))

        if len(self._window) < 4:
            return []

        current_features = self._compute_persistence()
        novel = detect_novel_features(
            previous=self._previous_features,
            current=current_features,
        )
        self._previous_features = current_features
        return novel

    def _compute_persistence(self) -> list[PersistenceFeature]:
        """Run persistent homology over the current window.

        Uses tcd_jepa.topology if available; falls back to an empty
        list if not. This is plumbing around the existing ML code —
        not a learning-mode spot.
        """
        try:
            from tcd_jepa.topology.persistent_homology import (
                compute_persistent_homology,
            )
        except ImportError:
            return []

        pts = np.stack(list(self._window))
        try:
            diagram = compute_persistent_homology(pts, max_dim=1)
        except Exception:
            return []

        features: list[PersistenceFeature] = []
        for dim, bars in enumerate(diagram):
            for birth, death in bars:
                if np.isfinite(death):
                    features.append(
                        PersistenceFeature(
                            dim=dim, birth=float(birth), death=float(death)
                        )
                    )
        return features
