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


@register
class HammingClusterer(Operator):
    """Bit-vector clustering on uint64 fingerprints (Hamming distance).

    Consumes Z_FP48 from upstream embed.content_fp48. Deterministic at
    seed via input lexsort; greedy assignment with configurable
    distance threshold; centroid is bitwise majority vote.
    """
    kind = 'cluster.hamming'
    stage = 'cluster'

    def run(self, inputs, *, seed, config):
        import numpy as np
        fps = inputs.get('fp48s')
        if fps is None:
            fps = inputs.get('Z')
        if fps is None:
            raise ValueError("cluster.hamming requires 'fp48s' from upstream embed.content_fp48")
        fps = np.asarray(fps, dtype=np.uint64)
        threshold = int(config.get('threshold', 12))
        max_modules = int(config.get('max_modules', 24))

        order = np.lexsort((np.arange(len(fps)), fps))
        centroids: list = []
        members: list[list[int]] = []
        for idx in order:
            fp = fps[idx]
            best_c, best_d = -1, threshold + 1
            for ci, c in enumerate(centroids):
                d = int(bin(int(fp ^ c)).count('1'))
                if d < best_d:
                    best_c, best_d = ci, d
            if best_c >= 0:
                members[best_c].append(int(idx))
            elif len(centroids) < max_modules:
                centroids.append(fp)
                members.append([int(idx)])
            else:
                nearest = min(range(len(centroids)),
                              key=lambda ci: bin(int(fp ^ centroids[ci])).count('1'))
                members[nearest].append(int(idx))

        modules = []
        for mid, member_idxs in enumerate(members):
            cluster_fps = fps[member_idxs]
            bit_columns = np.unpackbits(cluster_fps.view(np.uint8).reshape(-1, 8), axis=1)
            majority = (bit_columns.mean(axis=0) > 0.5).astype(np.uint8)
            centroid_bytes = np.packbits(majority).view(np.uint64)[0]
            modules.append({
                'module_id': f'hamming_{mid}',
                'module_class': 'HammingCluster',
                'centroid_stats': {
                    'popcount':  int(bin(int(centroid_bytes)).count('1')),
                    'n_members': len(member_idxs),
                },
                'centroid_fp48': int(centroid_bytes),
                'topology': None,
            })
        return {'modules': modules, 'modules_active_final': len(modules), 'iterations': 1}