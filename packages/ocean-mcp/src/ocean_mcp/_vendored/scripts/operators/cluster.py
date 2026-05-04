# ─────────────────────────────────────────────────────────
# This file ships in ocean-mcp on PyPI / npm.
# Premium operator implementations have been stripped from
# this build and replaced with stubs in ocean_mcp._premium_stubs.
# Premium operators run only on api.latentocean.com.
# Stripped classes from this file: TCDRecursiveLoop
# ─────────────────────────────────────────────────────────

"""Cluster operators — Z (matrix) → modules (with topology + centroid).

Includes:
  - TCD recursive loop (System-2 Langevin + System-3 persistent-homology)
  - Sklearn baselines (KMeans, IsolationForest, LocalOutlierFactor) for
    apples-to-apples comparison
"""
from __future__ import annotations
from collections import Counter
from typing import Any
from . import Operator, register

@register
class KMeansBaseline(Operator):
    """sklearn KMeans on Z. Comparison baseline.

    config:
        k: int — number of clusters
    """
    kind = 'cluster.kmeans'
    stage = 'cluster'

    def run(self, inputs, *, seed, config):
        import numpy as np
        from sklearn.cluster import KMeans
        Z = inputs['Z']
        k = config.get('k', 12)
        km = KMeans(n_clusters=k, random_state=seed, n_init=10).fit(Z)
        modules = []
        for i in range(k):
            mask = km.labels_ == i
            if mask.sum() == 0:
                continue
            centroid = Z[mask].mean(axis=0)
            modules.append({'module_id': f'kmeans_{i}', 'module_class': 'KMeansCluster', 'centroid_stats': {'norm': round(float(np.linalg.norm(centroid)), 4), 'dim': int(centroid.shape[0])}, 'centroid_vec': [round(float(v), 5) for v in centroid.tolist()], 'topology': None})
        return {'modules': modules, 'modules_active_final': len(modules), 'iterations': km.n_iter_}