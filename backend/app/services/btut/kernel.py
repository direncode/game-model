"""Tier 2 Core: Forward-only Fokker-Planck mean-field game kernel.

Implements the governing PDE in discrete point-cloud form:
    ∂ρ/∂t = -∇·(v[ρ]ρ) + σ²/2 Δρ

The kernel evolves a point cloud (N, D) under drift toward density-weighted
centroids (exploitation) and Gaussian noise (exploration/diffusion), with
momentum decay and anti-crowding corrections for forward-only stability.

All operations are O(N·D) via mean-field approximation for the coarse pass,
with optional sub-chunked exact pairwise (O(C²·D) per chunk) for fine passes.

GPU-accelerated via PyTorch with FP16 support. CPU fallback automatic.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field

import numpy as np

from .config import BTUTConfig

logger = logging.getLogger(__name__)

# Attempt torch import; gracefully degrade to CPU-only numpy if unavailable
try:
    import torch
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


@dataclass
class FPEvolutionResult:
    """Result of a Fokker-Planck evolution run."""

    states: np.ndarray  # (N, D) final evolved point positions
    densities: np.ndarray  # (N,) final kernel density per point
    steps_taken: int = 0
    nash_gaps: list[float] = field(default_factory=list)
    converged: bool = False
    final_nash_gap: float = float("inf")


class FokkerPlanckKernel:
    """Forward-only Fokker-Planck PDE solver on a point cloud.

    Evolves N points in D-dimensional space under:
    - Drift: attraction toward kernel-weighted density centroid
    - Anti-crowding: repulsion from over-saturated density peaks
    - Diffusion: Gaussian noise for exploration
    - Momentum: velocity smoothing to prevent oscillatory herd dynamics

    The BTUT innovation: no backward HJB pass. Stability comes from
    momentum decay + anti-crowding, achieving ε-Nash convergence.
    """

    def __init__(self, config: BTUTConfig, device: str | None = None):
        self.config = config
        self.device_str = device or config.resolve_device()
        self.use_fp16 = config.use_fp16 and self.device_str == "cuda"

        if HAS_TORCH:
            self.device = torch.device(self.device_str)
        else:
            self.device = None

        self._sub_chunk_size = 1024  # For pairwise distance sub-chunking

    # ------------------------------------------------------------------
    # Core: Mean-Field Approximation (O(N·D))
    # ------------------------------------------------------------------

    def _mean_field_density_torch(
        self, states: torch.Tensor, sigma: float
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """Mean-field approximation: each point senses the global mean + variance.

        Returns (densities, mean_field_mean, mean_field_var).
        Cost: O(N·D).
        """
        mf_mean = states.mean(dim=0, keepdim=True)  # (1, D)
        mf_var = states.var(dim=0, keepdim=True) + 1e-8  # (1, D)

        # Mahalanobis-like distance to the mean field
        diff = states - mf_mean  # (N, D)
        dist_sq = (diff ** 2 / mf_var).sum(dim=1)  # (N,)

        # Gaussian RBF kernel density: K(x, μ) = exp(-d²/(2σ²))
        log_densities = -dist_sq / (2 * sigma ** 2)
        densities = torch.exp(log_densities)

        return densities, mf_mean.squeeze(0), mf_var.squeeze(0)

    # ------------------------------------------------------------------
    # Core: Sub-Chunked Exact Pairwise (O(C²·D) per chunk pair)
    # ------------------------------------------------------------------

    def _exact_density_torch(
        self, states: torch.Tensor, sigma: float
    ) -> torch.Tensor:
        """Exact pairwise kernel density via sub-chunked cdist.

        For small populations (<10K), computes exact pairwise distances
        in 1024×1024 blocks to control memory. Each block uses ~2MB (FP16).
        """
        n = states.shape[0]
        densities = torch.zeros(n, device=states.device, dtype=states.dtype)
        chunk = self._sub_chunk_size

        for i_start in range(0, n, chunk):
            i_end = min(i_start + chunk, n)
            chunk_i = states[i_start:i_end]

            for j_start in range(0, n, chunk):
                j_end = min(j_start + chunk, n)
                chunk_j = states[j_start:j_end]

                # Pairwise squared distances: (Ci, Cj)
                dists_sq = torch.cdist(chunk_i, chunk_j, p=2.0).pow(2)

                # Kernel values
                kernel_vals = torch.exp(-dists_sq / (2 * sigma ** 2))

                # Accumulate density for chunk_i rows
                densities[i_start:i_end] += kernel_vals.sum(dim=1)

        # Normalize to get proper density
        densities /= n
        return densities

    # ------------------------------------------------------------------
    # Drift Computation
    # ------------------------------------------------------------------

    def _compute_drift_mean_field(
        self,
        states: torch.Tensor,
        densities: torch.Tensor,
        mf_mean: torch.Tensor,
        mf_var: torch.Tensor,
        sigma: float,
    ) -> torch.Tensor:
        """Drift velocity v[ρ] via mean-field approximation.

        Two components:
        1. Attraction: weighted pull toward the density-weighted centroid
        2. Anti-crowding: repulsion proportional to local density excess

        At equilibrium, these balance and drift → 0 (Nash convergence).
        """
        diff = mf_mean.unsqueeze(0) - states  # (N, D) — direction to centroid

        # Normalize densities for weighting
        density_weights = densities / (densities.sum() + 1e-8)  # (N,)

        # 1. Attraction: move toward centroid, weighted by density
        attraction = diff * density_weights.unsqueeze(1)  # (N, D)

        # 2. Anti-crowding: repel from centroid proportional to local density
        # High-density points get pushed away; low-density points are unaffected
        mean_density = densities.mean()
        crowding_excess = (densities - mean_density) / (mean_density + 1e-8)  # (N,)
        crowding_excess = crowding_excess.clamp(min=0)  # Only push over-dense points

        anti_crowding = -diff * crowding_excess.unsqueeze(1) * self.config.anti_crowding_strength

        return attraction + anti_crowding

    # ------------------------------------------------------------------
    # Single Evolution Step
    # ------------------------------------------------------------------

    def step_torch(
        self,
        states: torch.Tensor,
        velocities: torch.Tensor,
        sigma: float,
        use_exact: bool = False,
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """One forward Fokker-Planck evolution step.

        Returns (new_states, new_velocities, densities).
        """
        dt = self.config.dt
        momentum = self.config.momentum_decay
        diffusion = self.config.diffusion_coeff

        with torch.no_grad():
            # 1. Compute density field
            if use_exact and states.shape[0] <= 10_000:
                densities = self._exact_density_torch(states, sigma)
                mf_mean = states.mean(dim=0)
                mf_var = states.var(dim=0) + 1e-8
            else:
                densities, mf_mean, mf_var = self._mean_field_density_torch(states, sigma)

            # 2. Compute drift velocity v[ρ]
            drift = self._compute_drift_mean_field(
                states, densities, mf_mean, mf_var, sigma,
            )

            # 3. Momentum update: v_new = γ·v_old + (1-γ)·drift
            new_velocities = momentum * velocities + (1 - momentum) * drift

            # 4. State update: x_new = x + dt·v
            new_states = states + dt * new_velocities

            # 5. Diffusion (exploration noise): x += √(dt·D)·ε
            noise_scale = math.sqrt(dt * diffusion) * sigma
            noise = torch.randn_like(states) * noise_scale
            new_states = new_states + noise

            # 6. Numerical stability: clamp and NaN guard
            new_states = new_states.clamp(-100, 100)

            if torch.isnan(new_states).any():
                logger.warning("NaN detected in FP evolution — reverting step")
                return states, velocities, densities

        return new_states, new_velocities, densities

    # ------------------------------------------------------------------
    # NumPy Fallback (no torch)
    # ------------------------------------------------------------------

    def step_numpy(
        self,
        states: np.ndarray,
        velocities: np.ndarray,
        sigma: float,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """CPU-only NumPy fallback for the evolution step."""
        dt = self.config.dt
        momentum = self.config.momentum_decay
        diffusion = self.config.diffusion_coeff

        n, d = states.shape

        # Mean-field density
        mf_mean = states.mean(axis=0)
        mf_var = states.var(axis=0) + 1e-8
        diff = states - mf_mean
        dist_sq = np.sum(diff ** 2 / mf_var, axis=1)
        densities = np.exp(-dist_sq / (2 * sigma ** 2))

        # Drift
        density_weights = densities / (densities.sum() + 1e-8)
        attraction = (mf_mean - states) * density_weights[:, np.newaxis]

        mean_density = densities.mean()
        crowding_excess = np.maximum((densities - mean_density) / (mean_density + 1e-8), 0)
        anti_crowding = -(mf_mean - states) * crowding_excess[:, np.newaxis] * self.config.anti_crowding_strength

        drift_vec = attraction + anti_crowding

        # Momentum update
        new_velocities = momentum * velocities + (1 - momentum) * drift_vec

        # State update + diffusion
        noise_scale = math.sqrt(dt * diffusion) * sigma
        noise = np.random.randn(n, d).astype(np.float32) * noise_scale
        new_states = states + dt * new_velocities + noise

        # Clamp
        new_states = np.clip(new_states, -100, 100)

        return new_states, new_velocities, densities

    # ------------------------------------------------------------------
    # Full Evolution Loop
    # ------------------------------------------------------------------

    def evolve(
        self,
        points: np.ndarray,
        sigma: float,
        max_steps: int = 50,
        convergence_threshold: float = 1e-4,
        min_steps: int = 2,
        use_exact: bool = False,
        progress_callback=None,
    ) -> FPEvolutionResult:
        """Run full Fokker-Planck evolution until convergence or max_steps.

        Args:
            points: (N, D) initial point positions
            sigma: Gaussian RBF bandwidth for this cascade level
            max_steps: Hard cap on evolution iterations
            convergence_threshold: Stop when mean displacement < this
            min_steps: Minimum iterations before auto-stop
            use_exact: Use exact pairwise distances (slower, more accurate)
            progress_callback: Optional function(step, nash_gap) for monitoring

        Returns:
            FPEvolutionResult with final states, densities, convergence info
        """
        n, d = points.shape
        nash_gaps = []

        if HAS_TORCH and self.device is not None:
            return self._evolve_torch(
                points, sigma, max_steps, convergence_threshold,
                min_steps, use_exact, progress_callback,
            )
        else:
            return self._evolve_numpy(
                points, sigma, max_steps, convergence_threshold,
                min_steps, progress_callback,
            )

    def _evolve_torch(
        self, points, sigma, max_steps, threshold, min_steps, use_exact, callback,
    ) -> FPEvolutionResult:
        """GPU-accelerated evolution loop."""
        dtype = torch.float16 if self.use_fp16 else torch.float32

        states = torch.tensor(points, device=self.device, dtype=dtype)
        velocities = torch.zeros_like(states)
        nash_gaps = []
        densities = None

        for step in range(max_steps):
            prev_states = states.clone()

            states, velocities, densities = self.step_torch(
                states, velocities, sigma, use_exact=use_exact,
            )

            # Nash gap = mean displacement (at equilibrium, this → 0)
            displacement = torch.norm(states - prev_states, dim=1).mean().item()
            nash_gaps.append(displacement)

            if callback:
                callback(step, displacement)

            # Convergence check (after min_steps)
            if step >= min_steps and displacement < threshold:
                logger.info(
                    "FP converged at step %d: displacement=%.6f < %.6f",
                    step, displacement, threshold,
                )
                return FPEvolutionResult(
                    states=states.float().cpu().numpy(),
                    densities=densities.float().cpu().numpy(),
                    steps_taken=step + 1,
                    nash_gaps=nash_gaps,
                    converged=True,
                    final_nash_gap=displacement,
                )

        final_gap = nash_gaps[-1] if nash_gaps else float("inf")
        logger.info("FP reached max_steps=%d: final_gap=%.6f", max_steps, final_gap)

        return FPEvolutionResult(
            states=states.float().cpu().numpy(),
            densities=densities.float().cpu().numpy() if densities is not None else np.ones(points.shape[0]),
            steps_taken=max_steps,
            nash_gaps=nash_gaps,
            converged=False,
            final_nash_gap=final_gap,
        )

    def _evolve_numpy(
        self, points, sigma, max_steps, threshold, min_steps, callback,
    ) -> FPEvolutionResult:
        """CPU-only NumPy evolution loop."""
        states = points.copy().astype(np.float32)
        velocities = np.zeros_like(states)
        nash_gaps = []
        densities = None

        for step in range(max_steps):
            prev_states = states.copy()

            states, velocities, densities = self.step_numpy(states, velocities, sigma)

            displacement = np.mean(np.linalg.norm(states - prev_states, axis=1))
            nash_gaps.append(float(displacement))

            if callback:
                callback(step, float(displacement))

            if step >= min_steps and displacement < threshold:
                return FPEvolutionResult(
                    states=states,
                    densities=densities,
                    steps_taken=step + 1,
                    nash_gaps=nash_gaps,
                    converged=True,
                    final_nash_gap=float(displacement),
                )

        return FPEvolutionResult(
            states=states,
            densities=densities if densities is not None else np.ones(points.shape[0]),
            steps_taken=max_steps,
            nash_gaps=nash_gaps,
            converged=False,
            final_nash_gap=nash_gaps[-1] if nash_gaps else float("inf"),
        )

    # ------------------------------------------------------------------
    # Utility: Compute density only (no evolution)
    # ------------------------------------------------------------------

    def compute_density(self, points: np.ndarray, sigma: float) -> np.ndarray:
        """Compute kernel density for each point. Used by thinning strategies."""
        if HAS_TORCH and self.device is not None:
            dtype = torch.float16 if self.use_fp16 else torch.float32
            states = torch.tensor(points, device=self.device, dtype=dtype)
            if points.shape[0] <= 10_000:
                densities = self._exact_density_torch(states, sigma)
            else:
                densities, _, _ = self._mean_field_density_torch(states, sigma)
            return densities.float().cpu().numpy()
        else:
            mf_mean = points.mean(axis=0)
            mf_var = points.var(axis=0) + 1e-8
            dist_sq = np.sum((points - mf_mean) ** 2 / mf_var, axis=1)
            return np.exp(-dist_sq / (2 * sigma ** 2))
