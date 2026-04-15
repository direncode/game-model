"""Magnitude Table — trajectory parsing, tagging, flashing, and cluster bounds.

Extends the binary lattice threading with continuous magnitude measurements.
Instead of just "did it flip?" (0/1), captures HOW MUCH it flipped across
6 magnitude dimensions per rotation per point.

The magnitude table (N, K*6) is column-normalized, then "flashed" through
the cluster adjacency graph — magnitude profiles propagate between neighbors,
sharpening boundaries where profiles diverge. Iterative refinement splits
bimodal clusters and forms explicit geometric bounds.

Components:
  MagnitudeTable  — Core (N, K, 6) tensor with column normalization
  MagnitudeTag    — Per-entity summary (stability, consistency, class)
  MagnitudeFlasher — Wave propagation across cluster graph
  ClusterBounds   — Explicit min/max/centroid per cluster in magnitude space
  MagnitudeResult — Container for full pipeline output
  MagnitudeParser — Orchestrator: compute → tag → flash → refine → bounds
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from .threading import MicroCluster, ThreadingConfig

logger = logging.getLogger(__name__)

# The 6 magnitude columns computed per rotation per point
MAGNITUDE_NAMES = [
    "displacement",      # ||Rx - x||_2
    "cell_distance",     # Manhattan lattice cell distance
    "angular",           # arccos(dot(x, Rx) / (||x||*||Rx||))
    "density_gradient",  # rho_rotated - rho_base
    "centroid_drift",    # ||Rx - cluster_centroid||_2
    "flip_energy",       # displacement * density
]
N_MAGNITUDES = len(MAGNITUDE_NAMES)


# ---------------------------------------------------------------------------
# 1. MagnitudeTable
# ---------------------------------------------------------------------------

class MagnitudeTable:
    """Core (N, K, 6) magnitude tensor with column normalization.

    Each entry [i, k, m] is the magnitude of type m for point i under
    rotation k. After normalization, the (N, K*6) table has z-scored
    columns so magnitudes are comparable across rotations and types.
    """

    def __init__(self, n_points: int, n_rotations: int):
        self.n_points = n_points
        self.n_rotations = n_rotations
        self._raw = np.zeros((n_points, n_rotations, N_MAGNITUDES), dtype=np.float32)
        self.table: np.ndarray | None = None  # (N, K*6) after normalization
        self._col_means: np.ndarray | None = None
        self._col_stds: np.ndarray | None = None

    def compute(
        self,
        embeddings: np.ndarray,
        rotated_embeddings_list: list[np.ndarray],
        base_cells: np.ndarray,
        rotated_cells_list: list[np.ndarray],
        base_densities: np.ndarray,
        point_to_cluster: np.ndarray,
        cluster_centroids: np.ndarray,
    ) -> None:
        """Compute all 6 magnitude columns for every rotation.

        All operations are vectorized over N points.
        """
        n = self.n_points
        orig_norms = np.linalg.norm(embeddings, axis=1) + 1e-10  # (N,)

        for k in range(self.n_rotations):
            rotated = rotated_embeddings_list[k]  # (N, D)

            # Col 0: displacement magnitude = ||Rx - x||_2
            diff = rotated - embeddings
            displacement = np.linalg.norm(diff, axis=1)  # (N,)
            self._raw[:, k, 0] = displacement

            # Col 1: cell distance = Manhattan distance in lattice coords
            cell_diff = np.abs(rotated_cells_list[k].astype(np.float32) - base_cells.astype(np.float32))
            cell_dist = cell_diff.sum(axis=1)  # (N,)
            self._raw[:, k, 1] = cell_dist

            # Col 2: angular displacement = arccos(dot(x, Rx) / (||x||*||Rx||))
            rot_norms = np.linalg.norm(rotated, axis=1) + 1e-10  # (N,)
            cosine = np.sum(embeddings * rotated, axis=1) / (orig_norms * rot_norms)
            cosine = np.clip(cosine, -1.0, 1.0)
            angular = np.arccos(cosine)  # (N,)
            self._raw[:, k, 2] = angular

            # Col 3: density gradient (approximate via mean-field)
            rot_mean = rotated.mean(axis=0)
            rot_var = rotated.var(axis=0) + 1e-8
            rot_dist_sq = np.sum((rotated - rot_mean) ** 2 / rot_var, axis=1)
            sigma_est = np.std(np.linalg.norm(rotated - rot_mean, axis=1)) + 1e-8
            rot_densities = np.exp(-rot_dist_sq / (2 * sigma_est ** 2))
            self._raw[:, k, 3] = rot_densities - base_densities

            # Col 4: centroid drift = ||Rx - my_cluster_centroid||_2
            my_centroids = cluster_centroids[point_to_cluster]  # (N, D)
            centroid_drift = np.linalg.norm(rotated - my_centroids, axis=1)
            self._raw[:, k, 4] = centroid_drift

            # Col 5: flip energy = displacement * density
            self._raw[:, k, 5] = displacement * base_densities

    def normalize(self) -> None:
        """Z-score normalize per column across the (N, K*6) flattened table."""
        flat = self._raw.reshape(self.n_points, -1)  # (N, K*6)
        self._col_means = flat.mean(axis=0)
        self._col_stds = flat.std(axis=0) + 1e-8
        self.table = (flat - self._col_means) / self._col_stds

    def get_profile(self, idx: int) -> np.ndarray:
        """Get the normalized magnitude profile for a single point."""
        return self.table[idx]

    def get_rotation_magnitudes(self, idx: int) -> np.ndarray:
        """Get raw (K, 6) magnitudes for a single point."""
        return self._raw[idx]

    @property
    def n_columns(self) -> int:
        return self.n_rotations * N_MAGNITUDES


# ---------------------------------------------------------------------------
# 2. MagnitudeTag
# ---------------------------------------------------------------------------

@dataclass
class MagnitudeTag:
    """Per-entity summary distilled from the full magnitude profile."""

    stability: float = 0.0       # Mean |magnitude| — low = structurally stable
    consistency: float = 0.0     # Variance of profile — low = uniform behavior
    peak_rotation: int = 0       # Which rotation caused max displacement
    magnitude_class: str = "low" # Discretized: low / medium / high / extreme

    @classmethod
    def from_profile(cls, profile: np.ndarray, n_rotations: int) -> MagnitudeTag:
        """Compute tag from a single normalized magnitude profile."""
        stability = float(np.mean(np.abs(profile)))
        consistency = float(np.var(profile))

        # Reshape to (K, 6), compute per-rotation L2 norm, find peak
        reshaped = profile.reshape(n_rotations, N_MAGNITUDES)
        rotation_norms = np.linalg.norm(reshaped, axis=1)
        peak_rotation = int(np.argmax(rotation_norms))

        # Classify
        if stability < 0.5:
            magnitude_class = "low"
        elif stability < 1.0:
            magnitude_class = "medium"
        elif stability < 2.0:
            magnitude_class = "high"
        else:
            magnitude_class = "extreme"

        return cls(
            stability=stability,
            consistency=consistency,
            peak_rotation=peak_rotation,
            magnitude_class=magnitude_class,
        )

    @classmethod
    def batch_compute(
        cls,
        table: MagnitudeTable,
    ) -> list[MagnitudeTag]:
        """Vectorized batch computation of tags for all entities."""
        if table.table is None:
            return []

        n = table.n_points
        k = table.n_rotations
        data = table.table  # (N, K*6)

        # Vectorized stability and consistency
        stabilities = np.mean(np.abs(data), axis=1)  # (N,)
        consistencies = np.var(data, axis=1)  # (N,)

        # Peak rotation per entity
        reshaped = data.reshape(n, k, N_MAGNITUDES)
        rotation_norms = np.linalg.norm(reshaped, axis=2)  # (N, K)
        peak_rotations = np.argmax(rotation_norms, axis=1)  # (N,)

        tags = []
        for i in range(n):
            stab = float(stabilities[i])
            if stab < 0.5:
                mag_class = "low"
            elif stab < 1.0:
                mag_class = "medium"
            elif stab < 2.0:
                mag_class = "high"
            else:
                mag_class = "extreme"

            tags.append(cls(
                stability=stab,
                consistency=float(consistencies[i]),
                peak_rotation=int(peak_rotations[i]),
                magnitude_class=mag_class,
            ))

        return tags


# ---------------------------------------------------------------------------
# 3. MagnitudeFlasher
# ---------------------------------------------------------------------------

class MagnitudeFlasher:
    """Wave propagation of magnitude profiles across the cluster graph.

    Each cluster's magnitude profile is a weighted mix of its own profile
    and its neighbors'. Where profiles diverge sharply between adjacent
    clusters, hard boundaries form — these are the natural cluster edges.
    """

    def __init__(
        self,
        n_propagation_steps: int = 3,
        diffusion_rate: float = 0.3,
        boundary_threshold: float = 1.5,
    ):
        self.n_steps = n_propagation_steps
        self.diffusion_rate = diffusion_rate
        self.boundary_threshold = boundary_threshold

    def build_adjacency(
        self,
        clusters: list,
        embeddings: np.ndarray,
        distance_threshold: float | None = None,
    ) -> np.ndarray:
        """Build cluster adjacency matrix from centroid distances."""
        n_clusters = len(clusters)
        if n_clusters <= 1:
            return np.zeros((n_clusters, n_clusters), dtype=bool)

        centroids = []
        for c in clusters:
            if c.centroid is not None:
                centroids.append(c.centroid)
            else:
                centroids.append(np.zeros(embeddings.shape[1]))

        centroids = np.array(centroids)  # (C, D)

        # Pairwise centroid distances
        dists = np.sqrt(np.sum(
            (centroids[:, np.newaxis, :] - centroids[np.newaxis, :, :]) ** 2,
            axis=2,
        ))  # (C, C)

        # Default threshold: median inter-centroid distance
        if distance_threshold is None:
            upper = dists[np.triu_indices(n_clusters, k=1)]
            if len(upper) > 0:
                distance_threshold = float(np.median(upper))
            else:
                distance_threshold = 1.0

        adjacency = (dists < distance_threshold) & (dists > 0)
        return adjacency

    def flash(
        self,
        clusters: list,
        magnitude_table: MagnitudeTable,
    ) -> tuple[np.ndarray, np.ndarray]:
        """Flash magnitude profiles across cluster network.

        Returns:
            profiles: (C, K*6) — sharpened per-cluster magnitude profiles
            boundary_sharpness: (C, C) — pairwise profile distance for adjacent clusters
        """
        n_clusters = len(clusters)
        n_cols = magnitude_table.n_columns
        data = magnitude_table.table  # (N, K*6)

        if n_clusters == 0 or data is None:
            return np.zeros((0, n_cols)), np.zeros((0, 0))

        # Compute initial cluster profiles: mean of member profiles
        profiles = np.zeros((n_clusters, n_cols), dtype=np.float32)
        for ci, c in enumerate(clusters):
            if c.member_indices:
                profiles[ci] = data[c.member_indices].mean(axis=0)

        # Build adjacency
        embeddings_for_adj = np.array([
            c.centroid if c.centroid is not None else np.zeros(1)
            for c in clusters
        ])
        # Use a dummy embeddings array sized correctly
        if len(clusters) > 0 and clusters[0].centroid is not None:
            d = clusters[0].centroid.shape[0]
        else:
            d = 1
        dummy_emb = np.zeros((1, d))
        adjacency = self.build_adjacency(clusters, dummy_emb)

        # Hard boundary set: (i, j) pairs where propagation is blocked
        hard_boundaries: set[tuple[int, int]] = set()

        # Propagation loop
        for step in range(self.n_steps):
            new_profiles = profiles.copy()

            for ci in range(n_clusters):
                neighbors = [
                    j for j in range(n_clusters)
                    if adjacency[ci, j]
                    and (ci, j) not in hard_boundaries
                    and (j, ci) not in hard_boundaries
                ]

                if not neighbors:
                    continue

                w_self = 1.0 - self.diffusion_rate
                w_nbr = self.diffusion_rate / len(neighbors)

                neighbor_contrib = sum(profiles[j] for j in neighbors) * w_nbr
                new_profiles[ci] = w_self * profiles[ci] + neighbor_contrib

            # Compute boundary sharpness between adjacent pairs
            sharpness = self._compute_sharpness(new_profiles, adjacency)

            # Mark hard boundaries where sharpness exceeds threshold
            if sharpness.size > 0:
                nonzero_sharp = sharpness[sharpness > 0]
                if len(nonzero_sharp) > 0:
                    median_sharp = float(np.median(nonzero_sharp))
                    for ci in range(n_clusters):
                        for cj in range(ci + 1, n_clusters):
                            if adjacency[ci, cj] and sharpness[ci, cj] > self.boundary_threshold * median_sharp:
                                hard_boundaries.add((ci, cj))

            profiles = new_profiles

        # Final sharpness
        boundary_sharpness = self._compute_sharpness(profiles, adjacency)

        logger.info(
            "Magnitude flash: %d steps, %d hard boundaries formed, "
            "mean sharpness=%.4f",
            self.n_steps, len(hard_boundaries),
            float(boundary_sharpness[boundary_sharpness > 0].mean())
            if boundary_sharpness[boundary_sharpness > 0].size > 0 else 0,
        )

        return profiles, boundary_sharpness

    def _compute_sharpness(
        self,
        profiles: np.ndarray,
        adjacency: np.ndarray,
    ) -> np.ndarray:
        """L2 distance between adjacent cluster profiles."""
        n = profiles.shape[0]
        sharpness = np.zeros((n, n), dtype=np.float32)
        for i in range(n):
            for j in range(i + 1, n):
                if adjacency[i, j]:
                    dist = float(np.linalg.norm(profiles[i] - profiles[j]))
                    sharpness[i, j] = dist
                    sharpness[j, i] = dist
        return sharpness


# ---------------------------------------------------------------------------
# 4. ClusterBounds
# ---------------------------------------------------------------------------

@dataclass
class ClusterBounds:
    """Explicit geometric bounds for a cluster in magnitude space."""

    cluster_idx: int = 0
    magnitude_centroid: np.ndarray = field(default_factory=lambda: np.zeros(0))
    magnitude_bounds_min: np.ndarray = field(default_factory=lambda: np.zeros(0))
    magnitude_bounds_max: np.ndarray = field(default_factory=lambda: np.zeros(0))
    boundary_sharpness: float = 0.0
    member_count: int = 0
    magnitude_class_distribution: dict[str, int] = field(default_factory=dict)

    @classmethod
    def from_cluster(
        cls,
        cluster_idx: int,
        micro_cluster,
        magnitude_table: MagnitudeTable,
        tags: list[MagnitudeTag],
        boundary_sharpness: float = 0.0,
    ) -> ClusterBounds:
        """Build bounds from a micro-cluster's member magnitude profiles."""
        members = micro_cluster.member_indices
        if not members or magnitude_table.table is None:
            return cls(cluster_idx=cluster_idx)

        member_profiles = magnitude_table.table[members]  # (M, K*6)

        # Class distribution from tags
        class_dist: dict[str, int] = {}
        for idx in members:
            if idx < len(tags):
                mc = tags[idx].magnitude_class
                class_dist[mc] = class_dist.get(mc, 0) + 1

        return cls(
            cluster_idx=cluster_idx,
            magnitude_centroid=member_profiles.mean(axis=0),
            magnitude_bounds_min=member_profiles.min(axis=0),
            magnitude_bounds_max=member_profiles.max(axis=0),
            boundary_sharpness=boundary_sharpness,
            member_count=len(members),
            magnitude_class_distribution=class_dist,
        )

    def contains(self, profile: np.ndarray, tolerance: float = 0.1) -> bool:
        """Check if a magnitude profile falls within this cluster's bounds."""
        if len(self.magnitude_bounds_min) == 0:
            return False
        expanded_min = self.magnitude_bounds_min - tolerance
        expanded_max = self.magnitude_bounds_max + tolerance
        return bool(np.all(profile >= expanded_min) and np.all(profile <= expanded_max))

    def distance_to(self, profile: np.ndarray) -> float:
        """L2 distance from a profile to this cluster's magnitude centroid."""
        if len(self.magnitude_centroid) == 0:
            return float("inf")
        return float(np.linalg.norm(profile - self.magnitude_centroid))

    def to_dict(self) -> dict:
        """Serialize for JSON storage."""
        return {
            "cluster_idx": self.cluster_idx,
            "member_count": self.member_count,
            "boundary_sharpness": round(self.boundary_sharpness, 4),
            "magnitude_class_distribution": self.magnitude_class_distribution,
            "centroid_norm": round(float(np.linalg.norm(self.magnitude_centroid)), 4)
            if len(self.magnitude_centroid) > 0 else 0,
            "bounds_volume": round(float(np.prod(
                np.maximum(self.magnitude_bounds_max - self.magnitude_bounds_min, 1e-8)
            )), 4) if len(self.magnitude_bounds_min) > 0 else 0,
        }


# ---------------------------------------------------------------------------
# 5. MagnitudeResult
# ---------------------------------------------------------------------------

@dataclass
class MagnitudeResult:
    """Container for the full magnitude pipeline output."""

    magnitude_table: MagnitudeTable | None = None
    tags: list[MagnitudeTag] = field(default_factory=list)
    cluster_bounds: list[ClusterBounds] = field(default_factory=list)
    refined_clusters: list = field(default_factory=list)  # list[MicroCluster]
    cluster_profiles: np.ndarray = field(default_factory=lambda: np.zeros((0, 0)))
    boundary_sharpness: np.ndarray = field(default_factory=lambda: np.zeros((0, 0)))
    n_refinement_iterations: int = 0
    final_nash_gap: float = float("inf")
    n_splits: int = 0
    flash_converged: bool = False

    def to_dict(self) -> dict:
        """Serialize for training_log."""
        return {
            "n_refinements": self.n_refinement_iterations,
            "n_splits": self.n_splits,
            "final_nash_gap": round(self.final_nash_gap, 6),
            "flash_converged": self.flash_converged,
            "n_clusters": len(self.refined_clusters),
            "n_bounds": len(self.cluster_bounds),
            "class_distribution": self._aggregate_class_dist(),
            "mean_boundary_sharpness": round(float(
                self.boundary_sharpness[self.boundary_sharpness > 0].mean()
            ), 4) if self.boundary_sharpness.size > 0 and (self.boundary_sharpness > 0).any() else 0,
            "bounds": [b.to_dict() for b in self.cluster_bounds[:20]],  # Cap at 20 for JSON size
        }

    def _aggregate_class_dist(self) -> dict[str, int]:
        agg: dict[str, int] = {}
        for tag in self.tags:
            agg[tag.magnitude_class] = agg.get(tag.magnitude_class, 0) + 1
        return agg


# ---------------------------------------------------------------------------
# 6. MagnitudeParser — Orchestrator
# ---------------------------------------------------------------------------

class MagnitudeParser:
    """Orchestrates the full magnitude pipeline:
    compute table → tag → flash → iterative refinement → bounds.
    """

    def __init__(
        self,
        max_refinement_iterations: int = 3,
        nash_gap_threshold: float = 0.01,
        propagation_steps: int = 3,
        diffusion_rate: float = 0.3,
        boundary_threshold: float = 1.5,
    ):
        self.max_iterations = max_refinement_iterations
        self.nash_threshold = nash_gap_threshold
        self.flasher = MagnitudeFlasher(
            n_propagation_steps=propagation_steps,
            diffusion_rate=diffusion_rate,
            boundary_threshold=boundary_threshold,
        )

    @classmethod
    def from_threading_config(cls, config) -> MagnitudeParser:
        """Build from ThreadingConfig magnitude_* fields."""
        return cls(
            max_refinement_iterations=getattr(config, "magnitude_max_refinements", 3),
            nash_gap_threshold=getattr(config, "magnitude_nash_threshold", 0.01),
            propagation_steps=getattr(config, "magnitude_propagation_steps", 3),
            diffusion_rate=getattr(config, "magnitude_diffusion_rate", 0.3),
            boundary_threshold=getattr(config, "magnitude_boundary_threshold", 1.5),
        )

    def run(
        self,
        embeddings: np.ndarray,
        rotated_embeddings_list: list[np.ndarray],
        base_cells: np.ndarray,
        rotated_cells_list: list[np.ndarray],
        micro_clusters: list,
        base_densities: np.ndarray,
    ) -> MagnitudeResult:
        """Run the full magnitude pipeline.

        Steps:
        1. Build point-to-cluster mapping
        2. Compute magnitude table (N, K, 6)
        3. Normalize columns
        4. Compute tags per entity
        5. Flash magnitudes across cluster graph
        6. Iterative refinement (split bimodal clusters)
        7. Build final cluster bounds
        """
        n = embeddings.shape[0]
        k = len(rotated_embeddings_list)
        result = MagnitudeResult()

        if n == 0 or k == 0 or not micro_clusters:
            return result

        # Step 1: Point-to-cluster mapping
        point_to_cluster = np.zeros(n, dtype=np.int32)
        cluster_centroids_list = []
        for ci, mc in enumerate(micro_clusters):
            for idx in mc.member_indices:
                if idx < n:
                    point_to_cluster[idx] = ci
            if mc.centroid is not None:
                cluster_centroids_list.append(mc.centroid)
            else:
                cluster_centroids_list.append(embeddings[mc.member_indices].mean(axis=0)
                                              if mc.member_indices else np.zeros(embeddings.shape[1]))

        cluster_centroids = np.array(cluster_centroids_list)  # (C, D)

        # Step 2: Compute magnitude table
        mag_table = MagnitudeTable(n, k)
        mag_table.compute(
            embeddings=embeddings,
            rotated_embeddings_list=rotated_embeddings_list,
            base_cells=base_cells,
            rotated_cells_list=rotated_cells_list,
            base_densities=base_densities,
            point_to_cluster=point_to_cluster,
            cluster_centroids=cluster_centroids,
        )

        # Step 3: Normalize
        mag_table.normalize()
        result.magnitude_table = mag_table

        logger.info(
            "Magnitude table computed: (%d, %d, %d) -> normalized (%d, %d)",
            n, k, N_MAGNITUDES, *mag_table.table.shape,
        )

        # Step 4: Compute tags
        tags = MagnitudeTag.batch_compute(mag_table)
        result.tags = tags

        class_counts = {}
        for t in tags:
            class_counts[t.magnitude_class] = class_counts.get(t.magnitude_class, 0) + 1
        logger.info("Magnitude tags: %s", class_counts)

        # Step 5-6: Flash and iterative refinement
        current_clusters = list(micro_clusters)
        n_splits = 0

        for iteration in range(self.max_iterations):
            # Flash
            profiles, sharpness = self.flasher.flash(current_clusters, mag_table)
            result.cluster_profiles = profiles
            result.boundary_sharpness = sharpness

            # Detect bimodal clusters and split
            new_clusters = []
            for ci, mc in enumerate(current_clusters):
                if len(mc.member_indices) < 10:
                    new_clusters.append(mc)
                    continue

                member_profiles = mag_table.table[mc.member_indices]
                spread = np.std(member_profiles, axis=0)
                mean_spread = float(np.mean(spread))
                mean_mag = float(np.mean(np.abs(member_profiles))) + 1e-8

                # Split if internal spread is high relative to magnitude
                if mean_spread > 1.5 * mean_mag:
                    c0, c1 = self._split_cluster(mc, mag_table, embeddings)
                    if c0 is not None and c1 is not None:
                        new_clusters.extend([c0, c1])
                        n_splits += 1
                        continue

                new_clusters.append(mc)

            # Nash gap: fraction of points that changed cluster
            if len(new_clusters) == len(current_clusters):
                nash_gap = 0.0
            else:
                nash_gap = abs(len(new_clusters) - len(current_clusters)) / max(len(current_clusters), 1)

            logger.info(
                "Magnitude refinement iter %d: %d -> %d clusters, %d splits, gap=%.4f",
                iteration, len(current_clusters), len(new_clusters), n_splits, nash_gap,
            )

            current_clusters = new_clusters

            if nash_gap < self.nash_threshold:
                result.flash_converged = True
                break

        result.refined_clusters = current_clusters
        result.n_refinement_iterations = min(iteration + 1, self.max_iterations) if self.max_iterations > 0 else 0
        result.n_splits = n_splits
        result.final_nash_gap = nash_gap if self.max_iterations > 0 else 0.0

        # Step 7: Build cluster bounds
        # Recompute sharpness for final clusters
        final_profiles, final_sharpness = self.flasher.flash(current_clusters, mag_table)

        bounds = []
        for ci, mc in enumerate(current_clusters):
            sharp = 0.0
            if ci < final_sharpness.shape[0]:
                row = final_sharpness[ci]
                sharp = float(row[row > 0].mean()) if (row > 0).any() else 0.0

            cb = ClusterBounds.from_cluster(
                cluster_idx=ci,
                micro_cluster=mc,
                magnitude_table=mag_table,
                tags=tags,
                boundary_sharpness=sharp,
            )
            bounds.append(cb)

            # Attach bounds to the micro-cluster itself
            mc.magnitude_centroid = cb.magnitude_centroid
            mc.magnitude_bounds_min = cb.magnitude_bounds_min
            mc.magnitude_bounds_max = cb.magnitude_bounds_max
            mc.boundary_sharpness = cb.boundary_sharpness

        result.cluster_bounds = bounds

        logger.info(
            "Magnitude bounds: %d clusters bounded, mean sharpness=%.4f, %d splits total",
            len(bounds),
            float(np.mean([b.boundary_sharpness for b in bounds])) if bounds else 0,
            n_splits,
        )

        return result

    def _split_cluster(
        self,
        mc,
        mag_table: MagnitudeTable,
        embeddings: np.ndarray,
    ) -> tuple:
        """Split a bimodal cluster via 2-means on magnitude profiles.

        Returns (cluster_a, cluster_b) or (None, None) if split fails.
        """
        from .threading import MicroCluster

        members = mc.member_indices
        if len(members) < 6:
            return None, None

        profiles = mag_table.table[members]  # (M, K*6)

        # Pick two most distant profiles as seeds
        seed_a = 0
        dists_from_a = np.linalg.norm(profiles - profiles[seed_a], axis=1)
        seed_b = int(np.argmax(dists_from_a))

        if seed_a == seed_b:
            return None, None

        # 2-means: 5 iterations
        center_a = profiles[seed_a].copy()
        center_b = profiles[seed_b].copy()

        for _ in range(5):
            dist_a = np.linalg.norm(profiles - center_a, axis=1)
            dist_b = np.linalg.norm(profiles - center_b, axis=1)
            assignments = (dist_b < dist_a).astype(int)  # 0 = cluster a, 1 = cluster b

            mask_a = assignments == 0
            mask_b = assignments == 1

            if mask_a.sum() == 0 or mask_b.sum() == 0:
                return None, None

            center_a = profiles[mask_a].mean(axis=0)
            center_b = profiles[mask_b].mean(axis=0)

        # Build new micro-clusters
        members_a = [members[i] for i in range(len(members)) if assignments[i] == 0]
        members_b = [members[i] for i in range(len(members)) if assignments[i] == 1]

        if not members_a or not members_b:
            return None, None

        mc_a = MicroCluster(
            fingerprint=mc.fingerprint.copy() if mc.fingerprint is not None else np.zeros(0),
            member_indices=members_a,
            centroid=embeddings[members_a].mean(axis=0),
            stability_score=mc.stability_score,
        )
        mc_b = MicroCluster(
            fingerprint=mc.fingerprint.copy() if mc.fingerprint is not None else np.zeros(0),
            member_indices=members_b,
            centroid=embeddings[members_b].mean(axis=0),
            stability_score=mc.stability_score,
        )

        return mc_a, mc_b
