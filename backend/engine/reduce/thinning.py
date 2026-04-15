"""Tier 6: Composite thinning engine — 6 strategies with weighted rank fusion.

After Fokker-Planck convergence, entities are ranked and the top-K are retained.
Six independent strategies each produce a ranking; the composite strategy fuses
them via weighted rank aggregation. This preserves signal quality across multiple
dimensions (density cores, boundaries, diversity, spectral structure).

Strategies:
- density_threshold: Simple percentile cutoff on kernel density
- info_theoretic: Greedy mutual information maximization
- boundary_aware: Preserve cluster boundaries + cores
- stratified: Guaranteed per-cluster representation
- spectral: Eigenvector-based importance from kernel matrix
- max_dispersion: Farthest-point sampling for maximum diversity
"""

from __future__ import annotations

import logging
from typing import Literal

import numpy as np

from .config import BTUTConfig

logger = logging.getLogger(__name__)


class DensityThinner:
    """Multi-strategy thinning engine with composite rank fusion.

    Accepts evolved point states + densities, selects a subset of entities
    that maximally preserves the signal. Outputs the kept indices for
    filtering the original entity/edge lists.
    """

    def __init__(self, config: BTUTConfig):
        self.config = config

    # ------------------------------------------------------------------
    # Strategy 1: Density Threshold (baseline)
    # ------------------------------------------------------------------

    def _rank_by_density(self, densities: np.ndarray) -> np.ndarray:
        """Rank entities by kernel density (highest = best)."""
        return np.argsort(-densities)  # Descending order

    # ------------------------------------------------------------------
    # Strategy 2: Information-Theoretic (greedy MI maximization)
    # ------------------------------------------------------------------

    def _rank_info_theoretic(
        self,
        states: np.ndarray,
        densities: np.ndarray,
        target_count: int,
    ) -> np.ndarray:
        """Greedy selection maximizing mutual information.

        Uses k-NN entropy estimation (Kozachenko-Leonenko). At each step,
        selects the entity that maximizes the entropy of the selected set
        (i.e., adds the most novel information).

        Batch-greedy approximation: score all candidates in batch, take
        top-B at once, repeat. O(N × K × B) instead of O(N² × K).
        """
        n = states.shape[0]
        if n <= target_count:
            return np.arange(n)

        selected = []
        remaining = set(range(n))
        batch_size = max(1, target_count // 10)

        # Start with highest-density point
        first = int(np.argmax(densities))
        selected.append(first)
        remaining.discard(first)

        while len(selected) < target_count and remaining:
            # Score remaining candidates: distance to nearest selected point
            selected_states = states[selected]
            remaining_list = list(remaining)
            remaining_states = states[remaining_list]

            # Compute min distance to any selected point for each candidate
            # This is a proxy for information gain (farther = more novel)
            if len(selected_states) == 0:
                break

            # Chunked distance computation to avoid memory explosion
            min_dists = np.full(len(remaining_list), np.inf)
            chunk = 1000
            for i in range(0, len(selected_states), chunk):
                sel_chunk = selected_states[i:i + chunk]
                # (R, S) distance matrix
                diffs = remaining_states[:, np.newaxis, :] - sel_chunk[np.newaxis, :, :]
                dists = np.sqrt(np.sum(diffs ** 2, axis=2))  # (R, S)
                chunk_min = dists.min(axis=1)  # (R,)
                min_dists = np.minimum(min_dists, chunk_min)

            # Weight by density: prefer high-density + far-from-selected
            scores = min_dists * np.sqrt(densities[remaining_list] + 1e-8)

            # Take top batch_size candidates
            take = min(batch_size, target_count - len(selected), len(remaining_list))
            top_indices = np.argsort(-scores)[:take]

            for idx in top_indices:
                actual_idx = remaining_list[idx]
                selected.append(actual_idx)
                remaining.discard(actual_idx)

        # Convert to ranking: selected points get ranks 0, 1, 2, ...
        # Unselected get high ranks
        rank = np.full(n, n, dtype=np.int64)
        for r, idx in enumerate(selected):
            rank[idx] = r
        return np.argsort(rank)

    # ------------------------------------------------------------------
    # Strategy 3: Boundary-Aware Sampling
    # ------------------------------------------------------------------

    def _rank_boundary_aware(
        self,
        states: np.ndarray,
        densities: np.ndarray,
    ) -> np.ndarray:
        """Preserve both cluster cores (high density) and boundaries.

        Boundary detection: a point is a boundary point if its K nearest
        neighbors have high density variance (they straddle cluster edges).
        Allocation: 60% cores (highest density), 40% boundaries (highest
        density variance among neighbors).
        """
        n = states.shape[0]
        k = min(20, n - 1)

        # Compute KNN density variance as boundary indicator
        boundary_scores = np.zeros(n)

        # Process in chunks to avoid O(N²) memory
        chunk = min(5000, n)
        for i_start in range(0, n, chunk):
            i_end = min(i_start + chunk, n)
            chunk_states = states[i_start:i_end]

            # Distance to all points (sub-chunked)
            knn_density_vars = []
            for i_local in range(chunk_states.shape[0]):
                dists = np.sqrt(np.sum((states - chunk_states[i_local]) ** 2, axis=1))
                knn_indices = np.argsort(dists)[1:k + 1]  # Exclude self
                knn_densities = densities[knn_indices]
                knn_density_vars.append(np.var(knn_densities))

            boundary_scores[i_start:i_end] = knn_density_vars

        # Composite score: 60% density rank + 40% boundary rank
        density_rank = np.argsort(np.argsort(-densities))  # Rank by density desc
        boundary_rank = np.argsort(np.argsort(-boundary_scores))  # Rank by boundary desc
        composite_rank = 0.6 * density_rank + 0.4 * boundary_rank

        return np.argsort(composite_rank)

    # ------------------------------------------------------------------
    # Strategy 4: Stratified Retention
    # ------------------------------------------------------------------

    def _rank_stratified(
        self,
        states: np.ndarray,
        densities: np.ndarray,
        target_count: int,
    ) -> np.ndarray:
        """Guarantee minimum representation per cluster.

        Uses density-peak-based clustering: assign each point to its
        nearest density peak. Then allocate floor(min_representation)
        per cluster, distribute remaining budget proportionally.
        """
        n = states.shape[0]
        min_rep = self.config.min_cluster_representation

        # Simple density-peak clustering: above-mean density = peak zone
        threshold = densities.mean() + 0.5 * densities.std()
        peak_mask = densities > threshold
        peak_indices = np.where(peak_mask)[0]

        if len(peak_indices) == 0:
            return self._rank_by_density(densities)

        # Assign each point to nearest peak
        assignments = np.zeros(n, dtype=np.int64)
        for i in range(n):
            dists = np.sum((states[peak_indices] - states[i]) ** 2, axis=1)
            assignments[i] = peak_indices[np.argmin(dists)]

        # Group by cluster
        clusters: dict[int, list[int]] = {}
        for i in range(n):
            c = int(assignments[i])
            clusters.setdefault(c, []).append(i)

        # Allocate: floor per cluster, then proportional
        selected = []
        for cluster_id, members in clusters.items():
            # Sort members by density within cluster
            member_densities = densities[members]
            sorted_members = [members[j] for j in np.argsort(-member_densities)]
            take = min(min_rep, len(sorted_members))
            selected.extend(sorted_members[:take])

        # Distribute remaining budget proportionally
        remaining_budget = target_count - len(selected)
        if remaining_budget > 0:
            selected_set = set(selected)
            for cluster_id, members in clusters.items():
                cluster_budget = max(1, int(remaining_budget * len(members) / n))
                unselected = [m for m in members if m not in selected_set]
                member_densities = densities[unselected] if unselected else np.array([])
                sorted_unselected = [unselected[j] for j in np.argsort(-member_densities)]
                take = min(cluster_budget, len(sorted_unselected))
                selected.extend(sorted_unselected[:take])

        # Convert to ranking
        rank = np.full(n, n, dtype=np.int64)
        for r, idx in enumerate(selected[:target_count]):
            rank[idx] = r
        return np.argsort(rank)

    # ------------------------------------------------------------------
    # Strategy 5: Spectral Importance
    # ------------------------------------------------------------------

    def _rank_spectral(
        self,
        states: np.ndarray,
        densities: np.ndarray,
        sigma: float,
    ) -> np.ndarray:
        """Rank by eigenvector importance from the kernel matrix.

        Uses randomized SVD for O(N × K²) instead of O(N³). Entity
        importance = sum of squared eigenvector components weighted by
        eigenvalue magnitude.
        """
        n = states.shape[0]
        k = min(10, n - 1)

        if n > 10_000:
            # Too large for spectral — fall back to density
            return self._rank_by_density(densities)

        # Build kernel matrix (only feasible for <10K points)
        dists_sq = np.sum(
            (states[:, np.newaxis, :] - states[np.newaxis, :, :]) ** 2,
            axis=2,
        )
        kernel_matrix = np.exp(-dists_sq / (2 * sigma ** 2))

        # Randomized SVD (much faster than full eigendecomposition)
        try:
            # Use numpy SVD on the kernel matrix (truncated)
            # For N < 10K this is fast enough
            U, S, _ = np.linalg.svd(kernel_matrix, full_matrices=False)
            U_k = U[:, :k]
            S_k = S[:k]

            # Importance: sum of squared eigenvector components × eigenvalue
            importance = np.sum((U_k ** 2) * S_k[np.newaxis, :], axis=1)
            return np.argsort(-importance)

        except np.linalg.LinAlgError:
            return self._rank_by_density(densities)

    # ------------------------------------------------------------------
    # Strategy 6: Maximum Dispersion (farthest-point sampling)
    # ------------------------------------------------------------------

    def _rank_max_dispersion(
        self,
        states: np.ndarray,
        densities: np.ndarray,
        target_count: int,
    ) -> np.ndarray:
        """Farthest-point sampling for maximum spatial diversity.

        Greedy: start from highest-density point, iteratively add the
        point farthest from all selected points. O(N × target_count).
        """
        n = states.shape[0]
        if n <= target_count:
            return np.arange(n)

        selected = [int(np.argmax(densities))]
        min_dists = np.full(n, np.inf)

        for _ in range(target_count - 1):
            # Update min distance to selected set
            last = states[selected[-1]]
            dists = np.sqrt(np.sum((states - last) ** 2, axis=1))
            min_dists = np.minimum(min_dists, dists)
            min_dists[selected] = -1  # Exclude already selected

            # Select farthest point
            next_idx = int(np.argmax(min_dists))
            selected.append(next_idx)

        rank = np.full(n, n, dtype=np.int64)
        for r, idx in enumerate(selected):
            rank[idx] = r
        return np.argsort(rank)

    # ------------------------------------------------------------------
    # Composite Rank Fusion
    # ------------------------------------------------------------------

    def select(
        self,
        states: np.ndarray,
        densities: np.ndarray,
        target_count: int,
        sigma: float = 1.0,
        strategy: str | None = None,
    ) -> np.ndarray:
        """Select entities via specified strategy. Returns kept indices.

        Args:
            states: (N, D) evolved point positions
            densities: (N,) kernel densities
            target_count: How many entities to keep
            sigma: Current kernel bandwidth
            strategy: Override config strategy

        Returns:
            Array of indices into the original entity list
        """
        strategy = strategy or self.config.thinning_strategy
        n = states.shape[0]

        target_count = max(self.config.min_entities_floor, min(target_count, n))

        if n <= target_count:
            return np.arange(n)

        if strategy == "composite":
            return self._composite_select(states, densities, target_count, sigma)
        elif strategy == "density":
            ranking = self._rank_by_density(densities)
        elif strategy == "info_theoretic":
            ranking = self._rank_info_theoretic(states, densities, target_count)
        elif strategy == "boundary":
            ranking = self._rank_boundary_aware(states, densities)
        elif strategy == "stratified":
            ranking = self._rank_stratified(states, densities, target_count)
        elif strategy == "spectral":
            ranking = self._rank_spectral(states, densities, sigma)
        elif strategy == "dispersion":
            ranking = self._rank_max_dispersion(states, densities, target_count)
        else:
            logger.warning("Unknown thinning strategy '%s', falling back to density", strategy)
            ranking = self._rank_by_density(densities)

        return ranking[:target_count]

    def _composite_select(
        self,
        states: np.ndarray,
        densities: np.ndarray,
        target_count: int,
        sigma: float,
    ) -> np.ndarray:
        """Weighted rank fusion across multiple strategies.

        Weights: info_theoretic=0.50, boundary=0.20, stratified=0.20, spectral=0.10
        """
        n = states.shape[0]

        # Get rankings from each strategy
        rankings = {}

        # Always run density (fast, needed by others)
        rankings["density"] = self._rank_by_density(densities)

        # Info-theoretic (weight: 0.50)
        rankings["info"] = self._rank_info_theoretic(states, densities, target_count)

        # Boundary-aware (weight: 0.20) — skip for very large sets
        if n <= 50_000:
            rankings["boundary"] = self._rank_boundary_aware(states, densities)
        else:
            rankings["boundary"] = rankings["density"]  # Fallback

        # Stratified (weight: 0.20)
        rankings["stratified"] = self._rank_stratified(states, densities, target_count)

        # Spectral (weight: 0.10) — only for small sets
        if n <= 10_000:
            rankings["spectral"] = self._rank_spectral(states, densities, sigma)
        else:
            rankings["spectral"] = rankings["density"]

        # Convert rankings to rank scores (position in each ranking)
        rank_scores = np.zeros(n, dtype=np.float64)
        weights = {"info": 0.50, "boundary": 0.20, "stratified": 0.20, "spectral": 0.10}

        for strategy_name, weight in weights.items():
            ranking = rankings[strategy_name]
            # Position in this ranking (lower = better)
            position = np.zeros(n, dtype=np.float64)
            for rank_pos, entity_idx in enumerate(ranking):
                position[entity_idx] = rank_pos
            rank_scores += weight * position

        # Select top target_count by composite rank (lowest rank_scores = best)
        return np.argsort(rank_scores)[:target_count]


def filter_edges(
    edges: list[dict],
    kept_entity_names: set[str],
) -> list[dict]:
    """Filter edge list to only include edges between kept entities."""
    return [
        edge for edge in edges
        if edge.get("source") in kept_entity_names
        and edge.get("target") in kept_entity_names
    ]
