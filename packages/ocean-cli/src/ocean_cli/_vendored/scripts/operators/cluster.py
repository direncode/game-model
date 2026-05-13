"""Free-tier cluster operators.

Premium clusterers (e.g. cluster.tcd_recursive_loop) live only on the
hosted runtime and are NOT shipped here. ocean_cli registers a stub
instance under that name at import time.
"""
from __future__ import annotations

from typing import Any


class KMeansBaseline:
    """sklearn KMeans on Z. Comparison baseline.

    config:
        k: int - number of clusters (default 12)
    """

    kind = "cluster.kmeans"
    stage = "cluster"
    tier = "free"

    def run(self, inputs: dict[str, Any], *, seed: int = 42, config: dict | None = None) -> dict[str, Any]:
        import numpy as np
        from sklearn.cluster import KMeans

        config = config or {}
        Z = inputs["Z"]
        k = int(config.get("k", config.get("max_modules", 12)))
        km = KMeans(n_clusters=k, random_state=seed, n_init=10).fit(Z)

        modules = []
        for i in range(k):
            mask = km.labels_ == i
            if mask.sum() == 0:
                continue
            centroid = Z[mask].mean(axis=0)
            modules.append({
                "module_id":      f"kmeans_{i}",
                "module_class":   "KMeansCluster",
                "centroid_stats": {
                    "norm": round(float(np.linalg.norm(centroid)), 4),
                    "dim":  int(centroid.shape[0]),
                },
                "centroid_vec":   [round(float(v), 5) for v in centroid.tolist()],
                "topology":       None,
            })
        return {
            "modules":              modules,
            "modules_active_final": len(modules),
            "iterations":           int(km.n_iter_),
        }


class HammingClusterer:
    """Bit-vector clustering on uint64 fingerprints. Free-tier.

    Consumes Z_FP48 (fp48s from embed.content_fp48). Greedy assignment
    with a configurable distance threshold; centroid is bitwise majority
    vote across members. Deterministic at seed via input lexsort.

    config:
        threshold:   int — max Hamming distance for cluster (default 12)
        max_modules: int — module budget (default 24)
    """

    kind = "cluster.hamming"
    stage = "cluster"
    tier = "free"

    def run(self, inputs: dict[str, Any], *, seed: int = 42, config: dict | None = None) -> dict[str, Any]:
        import numpy as np

        config = config or {}
        fps = inputs.get("fp48s")
        if fps is None:
            fps = inputs.get("Z")
        if fps is None:
            raise ValueError(
                "cluster.hamming requires 'fp48s' from upstream embed.content_fp48"
            )
        fps = np.asarray(fps, dtype=np.uint64)
        threshold = int(config.get("threshold", 12))
        max_modules = int(config.get("max_modules", 24))

        order = np.lexsort((np.arange(len(fps)), fps))
        centroids: list = []
        members: list[list[int]] = []

        for idx in order:
            fp = fps[idx]
            best_c, best_d = -1, threshold + 1
            for ci, c in enumerate(centroids):
                d = int(bin(int(fp ^ c)).count("1"))
                if d < best_d:
                    best_c, best_d = ci, d
            if best_c >= 0:
                members[best_c].append(int(idx))
            elif len(centroids) < max_modules:
                centroids.append(fp)
                members.append([int(idx)])
            else:
                nearest = min(
                    range(len(centroids)),
                    key=lambda ci: bin(int(fp ^ centroids[ci])).count("1"),
                )
                members[nearest].append(int(idx))

        modules = []
        for mid, member_idxs in enumerate(members):
            cluster_fps = fps[member_idxs]
            bit_columns = np.unpackbits(
                cluster_fps.view(np.uint8).reshape(-1, 8), axis=1
            )
            majority = (bit_columns.mean(axis=0) > 0.5).astype(np.uint8)
            centroid_bytes = np.packbits(majority).view(np.uint64)[0]
            modules.append({
                "module_id":    f"hamming_{mid}",
                "module_class": "HammingCluster",
                "centroid_stats": {
                    "popcount":  int(bin(int(centroid_bytes)).count("1")),
                    "n_members": len(member_idxs),
                },
                "centroid_fp48": int(centroid_bytes),
                "topology":     None,
            })
        return {
            "modules":              modules,
            "modules_active_final": len(modules),
            "iterations":           1,
        }


# ── Per-module registry ──────────────────────────────────────────────────

_REGISTRY: dict[str, Any] = {
    "cluster.kmeans":  KMeansBaseline(),
    "cluster.hamming": HammingClusterer(),
}


def get(name: str):
    return _REGISTRY.get(name)
