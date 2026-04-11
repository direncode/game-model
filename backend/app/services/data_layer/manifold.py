"""Manifold projection: 8D unit hypersphere (compute) + 3D S² (display).

Two distinct projection paths for two distinct audiences:

  * ``project_8d_to_unit_sphere`` — always run. The 8D random
    projection from ``btut.pipeline`` already preserves pairwise
    distances (Johnson–Lindenstrauss); L2-normalizing it lets us use
    cosine similarity (== dot product on unit vectors) everywhere
    downstream (cosine linking, NIV manifold search, TCD-JEPA).

  * ``project_8d_to_s2`` — display-only. Projects unit-8D onto the
    2-sphere in R³ via PCA so humans get a variance-maximizing view.
    PCA beats random projection here because the 3D display has so
    few dimensions that preserving variance matters much more than
    distance invariance. Paid once per run; deterministic given seed.
"""
from __future__ import annotations

import logging

import numpy as np

logger = logging.getLogger(__name__)


def project_8d_to_unit_sphere(emb_8d: np.ndarray) -> np.ndarray:
    """L2-normalize each row of an (n, 8) embedding matrix.

    Zero rows are divided by a small epsilon rather than producing
    NaN. The caller is responsible for filtering degenerate rows if
    that matters for their use case.
    """
    emb = np.asarray(emb_8d, dtype=np.float32)
    norms = np.linalg.norm(emb, axis=1, keepdims=True) + 1e-10
    return emb / norms


def project_8d_to_s2(emb_8d_unit: np.ndarray, seed: int = 42) -> np.ndarray:
    """PCA to 3D, then L2-normalize. Display-only projection.

    For ``n < 4`` points, PCA is degenerate — returns zeros and logs a
    warning rather than crashing. For ``n >= 4``, deterministic given
    the seed.
    """
    emb = np.asarray(emb_8d_unit, dtype=np.float32)
    n = emb.shape[0]
    if n < 4:
        logger.warning(
            "project_8d_to_s2: only %d points (<4), PCA degenerate, returning zeros",
            n,
        )
        return np.zeros((n, 3), dtype=np.float32)

    from sklearn.decomposition import PCA  # local import — not all callers need sklearn

    pca = PCA(n_components=3, random_state=seed)
    coords_3d = pca.fit_transform(emb).astype(np.float32)
    norms = np.linalg.norm(coords_3d, axis=1, keepdims=True) + 1e-10
    return coords_3d / norms
