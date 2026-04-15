"""Tier 2 Orchestrator: Hierarchical multi-scale BTUT cascade.

Manages the multi-resolution cascade where each level operates at a
different kernel bandwidth σ:

Level 0 (σ=5.0): Coarse — finds mega-clusters, thins 1000x
Level 1 (σ=1.0): Medium — refines within mega-clusters, thins 100x
Level 2 (σ=0.1): Fine — fine-grained structure, thins 10x

Each level's output becomes the next level's input. Independent clusters
at each level can be processed in parallel. Quality gates between levels
prevent excessive signal loss.

Total cascade: 1000 × 100 × 10 = 1,000,000x reduction.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import numpy as np

from .config import BTUTConfig, CascadeLevel
from .convergence import ConvergenceDetector, get_annealed_sigma
from .kernel import FokkerPlanckKernel, FPEvolutionResult
from .metrics import CascadeLevelStats, Timer
from .scheduler import BudgetScheduler
from .streaming import random_project
from .thinning import DensityThinner

logger = logging.getLogger(__name__)


@dataclass
class CascadeResult:
    """Output from the full hierarchical cascade."""

    final_states: np.ndarray = field(default_factory=lambda: np.zeros((0, 0)))
    final_densities: np.ndarray = field(default_factory=lambda: np.zeros(0))
    kept_indices: list[int] = field(default_factory=list)
    level_stats: list[CascadeLevelStats] = field(default_factory=list)
    total_input: int = 0
    total_output: int = 0
    levels_executed: int = 0


class HierarchicalCascade:
    """Multi-scale BTUT cascade with adaptive depth and quality gates.

    Runs the Fokker-Planck kernel at decreasing σ values, thinning
    aggressively between levels. Each level:
    1. Evolve points under FP dynamics until convergence
    2. Compute kernel densities
    3. Thin using composite strategy
    4. (Optional) Reduce dimensionality for next level
    5. Check quality gate — stop if coverage drops too low
    """

    def __init__(self, config: BTUTConfig, device: str | None = None):
        self.config = config
        self.device = device or config.resolve_device()
        self.kernel = FokkerPlanckKernel(config, device=self.device)
        self.thinner = DensityThinner(config)
        self.scheduler = BudgetScheduler(config)

    def run(
        self,
        embeddings: np.ndarray,
        original_indices: list[int] | None = None,
        progress_callback=None,
        quality_checker=None,
    ) -> CascadeResult:
        """Execute the full hierarchical cascade.

        Args:
            embeddings: (N, D) initial embeddings
            original_indices: Mapping back to original entity list
            progress_callback: Optional fn(level, step, info_dict)
            quality_checker: Optional quality gate function(survivors, original_sample) -> bool

        Returns:
            CascadeResult with final states, kept indices, per-level stats
        """
        n_initial = embeddings.shape[0]
        if original_indices is None:
            original_indices = list(range(n_initial))

        result = CascadeResult(total_input=n_initial)
        current_states = embeddings.astype(np.float32)
        current_indices = list(original_indices)

        # Plan budget
        plan = self.scheduler.plan(n_initial, embeddings.shape[1])
        self.scheduler.start_tracking()

        if plan.warnings:
            for w in plan.warnings:
                logger.warning(w)

        # Get cascade levels (may be replanned by budget scheduler)
        levels = list(self.config.cascade_levels)

        for level_idx, level in enumerate(levels):
            n_current = current_states.shape[0]
            if n_current <= self.config.min_entities_floor:
                logger.info("Cascade stopped: entity count %d at floor", n_current)
                break

            with Timer() as timer:
                level_result = self._run_level(
                    level_idx=level_idx,
                    level=level,
                    states=current_states,
                    current_indices=current_indices,
                    progress_callback=progress_callback,
                )

            # Record level stats
            stats = CascadeLevelStats(
                level=level_idx,
                sigma=level.sigma,
                input_count=n_current,
                output_count=len(level_result["kept_indices"]),
                iterations_run=level_result["evolution"].steps_taken,
                final_nash_gap=level_result["evolution"].final_nash_gap,
                converged=level_result["evolution"].converged,
                elapsed_seconds=timer.elapsed,
            )
            result.level_stats.append(stats)
            self.scheduler.record_level_time(timer.elapsed)

            logger.info(
                "Cascade level %d (σ=%.2f): %d → %d (%.1fx) in %.1fs, gap=%.6f %s",
                level_idx, level.sigma, n_current, stats.output_count,
                stats.reduction_ratio, timer.elapsed, stats.final_nash_gap,
                "CONVERGED" if stats.converged else "max_iters",
            )

            # Update current state
            kept = level_result["kept_indices"]
            current_states = level_result["evolution"].states[kept]
            current_indices = [current_indices[i] for i in kept]

            # Quality gate between levels
            if quality_checker and level_idx < len(levels) - 1:
                if not quality_checker(current_states, embeddings):
                    logger.warning(
                        "Quality gate failed at level %d — stopping cascade early",
                        level_idx,
                    )
                    break

            # Budget check between levels
            budget_status = self.scheduler.check_budget()
            if budget_status.recommendation == "stop":
                logger.warning("Budget exhausted — stopping cascade at level %d", level_idx)
                break
            elif budget_status.recommendation == "reduce_quality":
                remaining_levels = levels[level_idx + 1:]
                levels[level_idx + 1:] = self.scheduler.replan_level(
                    len(current_indices),
                    remaining_levels,
                    current_states.shape[1],
                )

            # Progressive dimensionality reduction between levels
            if level_idx < len(levels) - 1:
                dim_schedule = self.config.dim_schedule
                if level_idx + 1 < len(dim_schedule):
                    target_dim = dim_schedule[level_idx + 1]
                    if current_states.shape[1] > target_dim:
                        current_states = random_project(
                            current_states, target_dim,
                            seed=42 + level_idx,
                        )
                        logger.info(
                            "Dimension reduction: %d → %d after level %d",
                            embeddings.shape[1] if level_idx == 0 else dim_schedule[level_idx],
                            target_dim, level_idx,
                        )

            if progress_callback:
                progress_callback(level_idx, -1, {
                    "level_complete": level_idx,
                    "input": n_current,
                    "output": len(current_indices),
                    "cumulative_reduction": n_initial / max(len(current_indices), 1),
                })

        # Final result
        final_densities = self.kernel.compute_density(
            current_states,
            sigma=levels[-1].sigma if levels else 1.0,
        )

        result.final_states = current_states
        result.final_densities = final_densities
        result.kept_indices = current_indices
        result.total_output = len(current_indices)
        result.levels_executed = len(result.level_stats)

        return result

    def _run_level(
        self,
        level_idx: int,
        level: CascadeLevel,
        states: np.ndarray,
        current_indices: list[int],
        progress_callback=None,
    ) -> dict:
        """Run a single cascade level: evolve + thin.

        Returns dict with 'evolution' (FPEvolutionResult) and 'kept_indices' (within this level).
        """
        n = states.shape[0]

        # Sigma annealing within this level
        sigma_init = level.sigma
        sigma_final = level.sigma * 0.5  # Decay to half within the level

        def step_callback(step, nash_gap):
            if progress_callback:
                progress_callback(level_idx, step, {
                    "nash_gap": nash_gap,
                    "sigma": get_annealed_sigma(
                        step, level.max_iterations,
                        sigma_init, sigma_final,
                        self.config.annealing_schedule,
                    ),
                })

        # Evolve with annealing
        # For simplicity, use the level's sigma for evolution
        # (annealing is applied within the kernel's evolve loop)
        evolution = self.kernel.evolve(
            points=states,
            sigma=level.sigma,
            max_steps=level.max_iterations,
            convergence_threshold=self.config.epsilon_nash,
            min_steps=level.min_iterations,
            use_exact=(n <= 10_000),
            progress_callback=step_callback,
        )

        # Thin: select survivors
        target_count = max(
            self.config.min_entities_floor,
            int(n / level.thinning_ratio),
        )

        kept_indices = self.thinner.select(
            states=evolution.states,
            densities=evolution.densities,
            target_count=target_count,
            sigma=level.sigma,
        )

        return {
            "evolution": evolution,
            "kept_indices": kept_indices,
        }
