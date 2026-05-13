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
class TCDRecursiveLoop(Operator):
    """TCD-JEPA recursive loop on a normalized Z matrix.

    Validated on NSL-KDD (15 modules from 299 BTUT survivors) and TNA
    (12-14 modules from 400-2169 records).

    config:
        iters:            int — recursive-loop iterations (default 16)
        max_modules:      int — module budget (default 24)
        crystallize_every: int — frequency of crystallization (default 2)
        langevin_steps:   int — System-2 exploration steps per iter (default 30)
        energy:           str — 'corpus_mean' | 'normal_centroid' (default corpus_mean)
        normal_label:     str — for energy=normal_centroid, the label value
                                marking 'normal'/'baseline' records
    """
    kind = "cluster.tcd_recursive_loop"
    stage = "cluster"

    def run(self, inputs, *, seed, config):
        import numpy as np
        import torch
        import sys
        from pathlib import Path

        REPO_ROOT = Path(__file__).resolve().parent.parent.parent
        if str(REPO_ROOT) not in sys.path:
            sys.path.insert(0, str(REPO_ROOT))
        from tcd_jepa.core.recursive_loop import RecursiveLoop

        Z = inputs["Z"]
        records = inputs.get("records")
        embed_dim = Z.shape[1]
        z = torch.from_numpy(Z).float()

        # Energy function selection
        energy_kind = config.get("energy", "corpus_mean")
        if energy_kind == "corpus_mean":
            centroid = z.mean(dim=0).detach()
        elif energy_kind == "normal_centroid":
            label_field = inputs.get("label_field", "archive")
            normal_label = config["normal_label"]
            mask = [r.get(label_field) == normal_label for r in records]
            mask_t = torch.tensor(mask, dtype=torch.bool)
            if mask_t.any():
                centroid = z[mask_t].mean(dim=0).detach()
            else:
                centroid = z.mean(dim=0).detach()
        else:
            raise ValueError(f"unknown energy kind: {energy_kind}")

        def energy_fn(zq):
            return (zq - centroid).pow(2).sum(dim=-1)

        torch.manual_seed(seed)
        loop = RecursiveLoop(
            embed_dim=embed_dim,
            explore_every=1,
            crystallize_every=config.get("crystallize_every", 2),
            langevin_steps=config.get("langevin_steps", 30),
            max_modules=config.get("max_modules", 24),
            device=torch.device("cpu"),
        )

        all_modules = []
        iters = config.get("iters", 16)
        for ep in range(iters):
            r = loop.step(z, energy_fn, epoch=ep)
            if r.get("crystallized"):
                for mid, mod, fts in r.get("new_module_objects", []):
                    rec = loop.crystallizer.registry._modules.get(mid)
                    feat = rec.feature if rec else None
                    info = {
                        "iteration":    r["iteration"],
                        "module_id":    str(mid),
                        "module_class": mod.__class__.__name__,
                        "module_type":  str(fts),
                        "topology": {
                            "homology_dim": int(feat.dim) if feat else None,
                            "birth":        round(float(feat.birth), 4) if feat else None,
                            "death":        round(float(feat.death), 4) if feat else None,
                            "persistence":  round(float(feat.persistence), 4) if feat else None,
                        } if feat else None,
                    }
                    if hasattr(mod, "centroid"):
                        c = mod.centroid.detach().numpy()
                        info["centroid_stats"] = {
                            "mean": round(float(np.mean(c)), 4),
                            "std":  round(float(np.std(c)), 4),
                            "norm": round(float(np.linalg.norm(c)), 4),
                            "dim":  int(c.shape[0]),
                        }
                        info["centroid_vec"] = [round(float(v), 5) for v in c.tolist()]
                    all_modules.append(info)

        return {
            "modules": all_modules,
            "modules_active_final": loop.num_modules,
            "iterations": iters,
            "embed_dim": embed_dim,
        }


@register
class KMeansBaseline(Operator):
    """sklearn KMeans on Z. Comparison baseline.

    config:
        k: int — number of clusters
    """
    kind = "cluster.kmeans"
    stage = "cluster"

    def run(self, inputs, *, seed, config):
        import numpy as np
        from sklearn.cluster import KMeans

        Z = inputs["Z"]
        k = config.get("k", 12)
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
                "topology":       None,  # KMeans has no persistent homology
            })
        return {"modules": modules, "modules_active_final": len(modules), "iterations": km.n_iter_}


@register
class HammingClusterer(Operator):
    """Bit-vector clustering for ``embed.content_fp48`` output.

    Consumes uint64 Bloom-style fingerprints (``Z_FP48``) and groups
    records by Hamming distance — bitwise XOR + popcount. The natural
    downstream of ``embed.content_fp48``; the typecheck system refuses
    to chain content_fp48 into Euclidean clusterers (kmeans / TCD) so
    this operator is the only path that closes the program.

    Free-tier, no trade-secret. Generic technique (Bloom-filter-style
    Hamming clustering predates this codebase by decades).

    config:
        threshold:   int — max Hamming distance for cluster membership
                           out of 48 bits (default 12, ~25%)
        max_modules: int — module budget (default 24)
    """
    kind = "cluster.hamming"
    stage = "cluster"

    def run(self, inputs, *, seed, config):
        import numpy as np

        fps = inputs.get("fp48s")
        if fps is None:
            fps = inputs.get("Z")
        if fps is None:
            raise ValueError(
                "cluster.hamming requires 'fp48s' (uint64 fingerprints) "
                "from upstream embed.content_fp48"
            )
        fps = np.asarray(fps, dtype=np.uint64)
        threshold = int(config.get("threshold", 12))
        max_modules = int(config.get("max_modules", 24))

        # Deterministic order: process records by fingerprint then index
        # so the same (fps, seed) produces the same cluster assignments.
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
