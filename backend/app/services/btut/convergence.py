"""Tier 5: Multi-metric convergence detection + prediction + sigma annealing.

Four simultaneous convergence metrics must ALL be satisfied:
1. Mean displacement below threshold (Nash gap → 0)
2. Density stability (L1 norm of density change → 0)
3. Cluster count unchanged for K steps
4. Energy monotonically decreasing

Plus: exponential fit for predicting remaining steps, and sigma annealing
schedules for simulated-annealing-like explore→exploit behavior.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Literal, Optional

import numpy as np

from .config import BTUTConfig

logger = logging.getLogger(__name__)


@dataclass
class ConvergenceStatus:
    """Snapshot of convergence state at a given step."""

    step: int = 0
    nash_gap: float = float("inf")  # Mean displacement
    density_change: float = float("inf")  # L1 density delta
    cluster_count: int = 0
    energy: float = float("inf")
    converged: bool = False
    predicted_remaining_steps: Optional[int] = None


class ConvergenceDetector:
    """Multi-metric convergence detection with prediction and auto-stop.

    Tracks four independent convergence signals and requires ALL to be
    satisfied simultaneously before declaring convergence. Also predicts
    remaining steps via exponential decay fitting after 3+ observations.
    """

    def __init__(self, config: BTUTConfig):
        self.config = config
        self.epsilon = config.epsilon_nash
        self.patience = config.convergence_patience
        self.min_steps = 2

        # History tracking
        self._nash_gaps: list[float] = []
        self._density_changes: list[float] = []
        self._cluster_counts: list[int] = []
        self._energies: list[float] = []

        self._best_gap = float("inf")
        self._patience_counter = 0

    def update(
        self,
        step: int,
        states: np.ndarray,
        prev_states: np.ndarray | None,
        densities: np.ndarray,
        prev_densities: np.ndarray | None,
        sigma: float,
    ) -> ConvergenceStatus:
        """Update convergence metrics after an evolution step.

        Args:
            step: Current step number
            states: (N, D) current point positions
            prev_states: (N, D) previous positions (None for first step)
            densities: (N,) current densities
            prev_densities: (N,) previous densities (None for first step)
            sigma: Current kernel bandwidth

        Returns:
            ConvergenceStatus with all metrics and convergence decision
        """
        status = ConvergenceStatus(step=step)

        # 1. Nash gap (mean displacement)
        if prev_states is not None:
            displacements = np.linalg.norm(states - prev_states, axis=1)
            status.nash_gap = float(np.mean(displacements))
        else:
            status.nash_gap = float("inf")
        self._nash_gaps.append(status.nash_gap)

        # 2. Density stability
        if prev_densities is not None:
            status.density_change = float(
                np.mean(np.abs(densities - prev_densities))
            )
        else:
            status.density_change = float("inf")
        self._density_changes.append(status.density_change)

        # 3. Cluster count (density peaks)
        status.cluster_count = self._count_density_peaks(densities, sigma)
        self._cluster_counts.append(status.cluster_count)

        # 4. Energy (total potential = -sum of log densities)
        safe_densities = np.maximum(densities, 1e-10)
        status.energy = float(-np.sum(np.log(safe_densities)))
        self._energies.append(status.energy)

        # Convergence decision
        status.converged = self._check_convergence(step, status)

        # Predict remaining steps
        status.predicted_remaining_steps = self._predict_remaining()

        return status

    def _count_density_peaks(self, densities: np.ndarray, sigma: float) -> int:
        """Approximate number of density peaks via threshold counting.

        A simple heuristic: count how many density values exceed
        mean + std (peaks of the density landscape).
        """
        threshold = densities.mean() + densities.std()
        return int(np.sum(densities > threshold))

    def _check_convergence(self, step: int, status: ConvergenceStatus) -> bool:
        """Check if ALL convergence criteria are met."""
        if step < self.min_steps:
            return False

        # Criterion 1: Nash gap below threshold
        gap_ok = status.nash_gap < self.epsilon

        # Criterion 2: Density stabilized
        density_ok = status.density_change < self.epsilon * 10  # Looser threshold

        # Criterion 3: Cluster count stable for last 3 steps
        cluster_stable = (
            len(self._cluster_counts) >= 3
            and self._cluster_counts[-1] == self._cluster_counts[-2] == self._cluster_counts[-3]
        )

        # Criterion 4: Energy non-increasing (last 3 steps)
        energy_ok = True
        if len(self._energies) >= 3:
            for i in range(-2, 0):
                if self._energies[i] > self._energies[i - 1] * 1.01:  # 1% tolerance
                    energy_ok = False
                    break

        # Patience: if gap hasn't improved by 5% in `patience` steps, force stop
        if status.nash_gap < self._best_gap * 0.95:
            self._best_gap = status.nash_gap
            self._patience_counter = 0
        else:
            self._patience_counter += 1

        patience_exhausted = self._patience_counter >= self.patience

        # ALL metrics must pass, OR patience exhausted
        if patience_exhausted:
            logger.info("Convergence: patience exhausted (%d steps no improvement)", self.patience)
            return True

        all_met = gap_ok and density_ok and (cluster_stable or step < 5) and energy_ok
        if all_met:
            logger.info(
                "Convergence: all criteria met at step %d (gap=%.6f, density_Δ=%.6f)",
                step, status.nash_gap, status.density_change,
            )
        return all_met

    def _predict_remaining(self) -> Optional[int]:
        """Predict remaining steps by fitting exponential decay to Nash gaps.

        Fits gap(t) = A·exp(-λt) + C via log-linear regression on the
        last N observations. Extrapolates to find when gap < epsilon.
        Returns None if insufficient data or non-convergent behavior.
        """
        gaps = self._nash_gaps
        if len(gaps) < 3:
            return None

        # Use last 10 observations (or all if fewer)
        recent = np.array(gaps[-10:])
        if recent[-1] <= 0 or recent[0] <= 0:
            return None

        # Log-linear fit: log(gap) ≈ -λt + log(A)
        t = np.arange(len(recent), dtype=np.float64)
        log_gaps = np.log(np.maximum(recent, 1e-10))

        # Simple least-squares
        n = len(t)
        sum_t = t.sum()
        sum_log = log_gaps.sum()
        sum_t2 = (t ** 2).sum()
        sum_t_log = (t * log_gaps).sum()

        denom = n * sum_t2 - sum_t ** 2
        if abs(denom) < 1e-10:
            return None

        slope = (n * sum_t_log - sum_t * sum_log) / denom  # -λ

        if slope >= 0:
            # Not converging
            return None

        # Extrapolate: solve A·exp(-λ·(t_current + Δ)) = epsilon
        # Δ = (log(epsilon) - log_gaps[-1]) / slope
        log_epsilon = math.log(max(self.epsilon, 1e-10))
        delta = (log_epsilon - log_gaps[-1]) / slope

        if delta <= 0:
            return 0  # Already converged
        return min(int(math.ceil(delta)), 1000)  # Cap at 1000

    def should_stop(self, step: int, max_steps: int) -> bool:
        """Quick check: should the evolution loop stop?"""
        if step >= max_steps:
            return True
        if not self._nash_gaps:
            return False
        # Check most recent convergence status
        return (
            (step >= self.min_steps and self._nash_gaps[-1] < self.epsilon)
            or self._patience_counter >= self.patience
        )

    def reset(self):
        """Clear history for a new cascade level."""
        self._nash_gaps.clear()
        self._density_changes.clear()
        self._cluster_counts.clear()
        self._energies.clear()
        self._best_gap = float("inf")
        self._patience_counter = 0

    @property
    def nash_gap_history(self) -> list[float]:
        return list(self._nash_gaps)


# ---------------------------------------------------------------------------
# Sigma Annealing — explore early, exploit late
# ---------------------------------------------------------------------------

def get_annealed_sigma(
    step: int,
    total_steps: int,
    sigma_init: float,
    sigma_final: float,
    schedule: Literal["exponential", "linear", "cosine"] = "exponential",
) -> float:
    """Compute annealed sigma for a given step.

    Sigma starts large (broad exploration) and decays to small (fine exploitation),
    implementing simulated-annealing-like behavior within each cascade level.
    """
    if total_steps <= 1:
        return sigma_init

    t = min(step / max(total_steps - 1, 1), 1.0)  # Normalized [0, 1]

    if schedule == "exponential":
        # σ(t) = σ_init × (σ_final/σ_init)^t
        ratio = max(sigma_final / sigma_init, 1e-10)
        return sigma_init * (ratio ** t)

    elif schedule == "linear":
        # σ(t) = σ_init + (σ_final - σ_init) × t
        return sigma_init + (sigma_final - sigma_init) * t

    elif schedule == "cosine":
        # σ(t) = σ_final + 0.5 × (σ_init - σ_final) × (1 + cos(πt))
        return sigma_final + 0.5 * (sigma_init - sigma_final) * (1 + math.cos(math.pi * t))

    return sigma_init
