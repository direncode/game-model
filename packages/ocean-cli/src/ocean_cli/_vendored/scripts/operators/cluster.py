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


# ── Per-module registry ──────────────────────────────────────────────────

_REGISTRY: dict[str, Any] = {
    "cluster.kmeans": KMeansBaseline(),
}


def get(name: str):
    return _REGISTRY.get(name)
