"""Tier 8: Quality assurance — reconstruction error, coverage, stability.

Runs between and after cascade levels to ensure signal preservation.
Five metrics, each with a target threshold. Quality gates can stop
the cascade early if too much signal is being lost.

Metrics:
- Signal quality: Mean log-density of survivors (are we keeping dense regions?)
- Reconstruction error: Mean NN distance from sample to nearest survivor
- Coverage: Variance preservation ratio
- Cluster stability: Bootstrap cascade consistency
- Downstream compatibility: Heuristic TCD-JEPA quality prediction
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

from .config import BTUTConfig
from .metrics import QualityScores

logger = logging.getLogger(__name__)


class QualityAssurance:
    """Multi-metric quality assurance for BTUT output.

    Validates that the thinning process preserved sufficient signal
    for downstream TCD-JEPA crystallization.
    """

    def __init__(self, config: BTUTConfig):
        self.config = config

    def _align_dimensions(self, a: np.ndarray, b: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Align two arrays to the same dimensionality via projection or truncation."""
        if a.shape[1] == b.shape[1]:
            return a, b
        # Project the higher-dim array down to match the lower-dim array
        target_dim = min(a.shape[1], b.shape[1])
        if a.shape[1] > target_dim:
            from .streaming import random_project
            a = random_project(a, target_dim, seed=99)
        if b.shape[1] > target_dim:
            from .streaming import random_project
            b = random_project(b, target_dim, seed=99)
        return a, b

    def full_audit(
        self,
        original_embeddings: np.ndarray,
        survivor_embeddings: np.ndarray,
        survivor_densities: np.ndarray,
        cluster_count: int = 0,
        cluster_purities: list[float] | None = None,
    ) -> QualityScores:
        """Run all quality checks and return composite scores.

        Args:
            original_embeddings: (N_orig, D) — sample from original (up to 10K)
            survivor_embeddings: (N_surv, D) — final survivors
            survivor_densities: (N_surv,) — final densities
            cluster_count: Number of discovered clusters
            cluster_purities: Per-cluster purity scores (if available)

        Returns:
            QualityScores with all metrics populated
        """
        scores = QualityScores()

        # Align dimensions (cascade may have reduced survivor dims)
        orig_aligned, surv_aligned = self._align_dimensions(
            original_embeddings, survivor_embeddings,
        )

        # 1. Signal quality: are survivors in high-density regions?
        scores.signal_quality = self._signal_quality(survivor_densities)

        # 2. Reconstruction error: how well do survivors represent the original?
        scores.reconstruction_error = self._reconstruction_error(
            orig_aligned, surv_aligned,
        )

        # 3. Coverage: variance preservation
        scores.coverage = self._coverage(orig_aligned, surv_aligned)

        # 4. Cluster stability (simplified — full bootstrap is in the tuner)
        scores.cluster_stability = self._stability_estimate(survivor_embeddings)

        # 5. Downstream compatibility heuristic
        scores.downstream_compatibility = self._downstream_compatibility(
            cluster_count, cluster_purities, scores.coverage, scores.reconstruction_error,
        )

        logger.info(
            "Quality audit: signal=%.3f recon_err=%.3f coverage=%.3f "
            "stability=%.3f downstream=%.3f",
            scores.signal_quality, scores.reconstruction_error,
            scores.coverage, scores.cluster_stability,
            scores.downstream_compatibility,
        )

        return scores

    def quality_gate(
        self,
        survivor_embeddings: np.ndarray,
        original_sample: np.ndarray,
    ) -> bool:
        """Quick quality gate for between-level checks.

        Returns True if quality is acceptable (cascade should continue).
        Returns False if too much signal has been lost (stop early).
        """
        orig_aligned, surv_aligned = self._align_dimensions(original_sample, survivor_embeddings)
        coverage = self._coverage(orig_aligned, surv_aligned)
        if coverage < self.config.min_coverage:
            logger.warning(
                "Quality gate FAILED: coverage %.3f < threshold %.3f",
                coverage, self.config.min_coverage,
            )
            return False

        recon = self._reconstruction_error(orig_aligned, surv_aligned)
        if recon > self.config.max_recon_error:
            logger.warning(
                "Quality gate FAILED: reconstruction error %.3f > threshold %.3f",
                recon, self.config.max_recon_error,
            )
            return False

        return True

    # ------------------------------------------------------------------
    # Individual Metrics
    # ------------------------------------------------------------------

    def _signal_quality(self, densities: np.ndarray) -> float:
        """Mean log-density of survivors, sigmoid-normalized to [0, 1].

        High score = survivors are in high-density (signal-rich) regions.
        """
        if len(densities) == 0:
            return 0.0

        safe_densities = np.maximum(densities, 1e-10)
        mean_log_density = float(np.mean(np.log(safe_densities)))

        # Sigmoid normalization: map (-inf, inf) → (0, 1)
        # Center at 0 (log-density of uniform)
        return float(1.0 / (1.0 + np.exp(-mean_log_density)))

    def _reconstruction_error(
        self,
        original: np.ndarray,
        survivors: np.ndarray,
    ) -> float:
        """Mean nearest-neighbor distance from original sample to survivors.

        Lower = better. Normalized by mean pairwise distance in the original.
        Target: < 0.15.
        """
        if len(original) == 0 or len(survivors) == 0:
            return 1.0

        # Sample original if too large (max 10K for speed)
        if len(original) > 10_000:
            rng = np.random.RandomState(42)
            sample_idx = rng.choice(len(original), 10_000, replace=False)
            original = original[sample_idx]

        # Compute NN distances from original to survivors (chunked)
        nn_dists = np.full(len(original), np.inf)
        chunk = 1000

        for i in range(0, len(survivors), chunk):
            surv_chunk = survivors[i:i + chunk]
            # (N_orig, C) distance matrix
            diffs = original[:, np.newaxis, :] - surv_chunk[np.newaxis, :, :]
            dists = np.sqrt(np.sum(diffs ** 2, axis=2))
            chunk_min = dists.min(axis=1)
            nn_dists = np.minimum(nn_dists, chunk_min)

        mean_nn_dist = float(np.mean(nn_dists))

        # Normalize by mean pairwise distance in a small sample of original
        sample_size = min(500, len(original))
        rng = np.random.RandomState(42)
        sample = original[rng.choice(len(original), sample_size, replace=False)]
        pairwise_dists = np.sqrt(np.sum(
            (sample[:, np.newaxis, :] - sample[np.newaxis, :, :]) ** 2, axis=2,
        ))
        # Exclude diagonal
        np.fill_diagonal(pairwise_dists, np.inf)
        mean_pairwise = float(np.mean(pairwise_dists[pairwise_dists < np.inf]))

        if mean_pairwise <= 0:
            return 1.0

        return min(mean_nn_dist / mean_pairwise, 1.0)

    def _coverage(
        self,
        original: np.ndarray,
        survivors: np.ndarray,
    ) -> float:
        """Variance preservation: trace(cov_survivors) / trace(cov_original).

        Measures what fraction of the original data's spread is preserved.
        Target: > 0.85.
        """
        if len(original) < 2 or len(survivors) < 2:
            return 0.0

        # Sample if too large
        if len(original) > 10_000:
            rng = np.random.RandomState(42)
            original = original[rng.choice(len(original), 10_000, replace=False)]

        # Trace of covariance = sum of variances across dimensions
        orig_var = np.var(original, axis=0).sum()
        surv_var = np.var(survivors, axis=0).sum()

        if orig_var <= 0:
            return 1.0

        return min(float(surv_var / orig_var), 1.0)

    def _stability_estimate(self, survivors: np.ndarray) -> float:
        """Quick stability estimate without full bootstrap.

        Uses coefficient of variation of inter-point distances as a proxy.
        Low CV = stable, well-separated clusters. High CV = noisy/unstable.
        """
        if len(survivors) < 10:
            return 0.5

        # Sample pairs for speed
        rng = np.random.RandomState(42)
        n = len(survivors)
        n_pairs = min(5000, n * (n - 1) // 2)
        idx_a = rng.randint(0, n, n_pairs)
        idx_b = rng.randint(0, n, n_pairs)

        dists = np.sqrt(np.sum((survivors[idx_a] - survivors[idx_b]) ** 2, axis=1))
        dists = dists[dists > 0]  # Remove self-distances

        if len(dists) == 0:
            return 0.5

        cv = float(np.std(dists) / (np.mean(dists) + 1e-8))

        # Map CV to stability: low CV (< 0.3) → high stability (1.0)
        # High CV (> 2.0) → low stability (0.0)
        stability = max(0.0, min(1.0, 1.0 - (cv - 0.3) / 1.7))
        return stability

    def _downstream_compatibility(
        self,
        cluster_count: int,
        cluster_purities: list[float] | None,
        coverage: float,
        recon_error: float,
    ) -> float:
        """Heuristic prediction of TCD-JEPA training quality.

        Combines multiple signals into a 0-1 score:
        - Cluster count in sweet spot (5-50): 0.30
        - Mean purity > 0.7: 0.30
        - Coverage > 0.85: 0.20
        - Reconstruction error < 0.15: 0.20
        """
        score = 0.0

        # Cluster count in sweet spot
        if 5 <= cluster_count <= 50:
            score += 0.30
        elif 2 <= cluster_count <= 100:
            score += 0.15

        # Mean purity
        if cluster_purities:
            mean_purity = sum(cluster_purities) / len(cluster_purities)
            if mean_purity > 0.7:
                score += 0.30
            elif mean_purity > 0.5:
                score += 0.15

        # Coverage
        if coverage > 0.85:
            score += 0.20
        elif coverage > 0.7:
            score += 0.10

        # Reconstruction error
        if recon_error < 0.15:
            score += 0.20
        elif recon_error < 0.25:
            score += 0.10

        return score
