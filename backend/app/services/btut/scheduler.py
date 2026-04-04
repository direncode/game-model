"""Tier 5: Budget-aware scheduler — compute cost estimation and replanning.

Pre-computes whether the cascade fits within the dollar budget, then monitors
actual spend between levels and adjusts thinning ratios if overspending.

Cost model:
- A100 FP16: ~312 TFLOPS, ~$1.44/hr
- Per chunk pair: C² × D FLOPs for pairwise kernel density
- Mean-field mode: C × D FLOPs per step (much cheaper)
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

from .config import BTUTConfig, CascadeLevel

logger = logging.getLogger(__name__)

# Hardware constants
A100_TFLOPS_FP16 = 312e12  # FLOPs per second
A100_COST_PER_HOUR = 1.44  # USD
A100_COST_PER_SECOND = A100_COST_PER_HOUR / 3600


@dataclass
class ExecutionPlan:
    """Pre-computed execution plan with budget allocation per level."""

    levels: list[LevelPlan] = field(default_factory=list)
    total_estimated_seconds: float = 0.0
    total_estimated_cost: float = 0.0
    budget_dollars: float = 0.0
    fits_budget: bool = True
    warnings: list[str] = field(default_factory=list)


@dataclass
class LevelPlan:
    """Budget allocation for a single cascade level."""

    level: int = 0
    estimated_input_count: int = 0
    estimated_output_count: int = 0
    estimated_seconds: float = 0.0
    estimated_cost: float = 0.0
    sigma: float = 1.0
    thinning_ratio: float = 10.0
    max_iterations: int = 5
    use_exact_pairwise: bool = False  # True only for small populations


@dataclass
class BudgetStatus:
    """Current budget status during execution."""

    elapsed_seconds: float = 0.0
    estimated_total_seconds: float = 0.0
    cost_so_far: float = 0.0
    budget_remaining: float = 0.0
    percent_used: float = 0.0
    recommendation: str = "continue"  # continue | reduce_quality | stop


class BudgetScheduler:
    """Plans and monitors compute budget for BTUT cascade execution.

    Pre-computes an ExecutionPlan from entity count + budget, then
    tracks actual GPU time between levels and replans if needed.
    """

    def __init__(self, config: BTUTConfig):
        self.config = config
        self.budget_seconds = (config.budget_dollars / A100_COST_PER_HOUR) * 3600
        self._start_time: float = 0.0
        self._level_times: list[float] = []

    def plan(
        self,
        entity_count: int,
        embedding_dim: int,
    ) -> ExecutionPlan:
        """Pre-compute execution plan and verify budget feasibility.

        Estimates compute cost for each cascade level based on:
        - Input count (after previous level's thinning)
        - Chunk size and pairwise vs mean-field mode
        - Number of iterations
        """
        plan = ExecutionPlan(budget_dollars=self.config.budget_dollars)
        current_count = entity_count

        for i, level in enumerate(self.config.cascade_levels):
            level_plan = self._plan_level(
                level_idx=i,
                level=level,
                input_count=current_count,
                embedding_dim=embedding_dim,
            )
            plan.levels.append(level_plan)
            plan.total_estimated_seconds += level_plan.estimated_seconds
            plan.total_estimated_cost += level_plan.estimated_cost
            current_count = level_plan.estimated_output_count

        plan.fits_budget = plan.total_estimated_cost <= self.config.budget_dollars

        if not plan.fits_budget:
            plan.warnings.append(
                f"Estimated cost ${plan.total_estimated_cost:.2f} exceeds budget "
                f"${self.config.budget_dollars:.2f}. Will auto-reduce quality."
            )
            logger.warning(
                "BTUT budget warning: estimated $%.2f > budget $%.2f",
                plan.total_estimated_cost, self.config.budget_dollars,
            )

        return plan

    def _plan_level(
        self,
        level_idx: int,
        level: CascadeLevel,
        input_count: int,
        embedding_dim: int,
    ) -> LevelPlan:
        """Estimate compute for a single cascade level."""
        chunk_size = self.config.chunk_size
        output_count = max(
            self.config.min_entities_floor,
            int(input_count / level.thinning_ratio),
        )

        # Determine mode: exact pairwise for small populations, mean-field for large
        use_exact = input_count <= 10_000

        if use_exact:
            # O(N² × D) per step
            flops_per_step = input_count * input_count * embedding_dim
        else:
            # Mean-field: O(N × D) per step, plus O(C² × D) per chunk for density
            num_chunks = max(1, (input_count + chunk_size - 1) // chunk_size)
            flops_per_step = (
                input_count * embedding_dim  # Mean-field update
                + num_chunks * chunk_size * chunk_size * embedding_dim * 0.01  # Sub-chunked density (amortized)
            )

        total_flops = flops_per_step * level.max_iterations
        estimated_seconds = total_flops / A100_TFLOPS_FP16
        estimated_cost = estimated_seconds * A100_COST_PER_SECOND

        return LevelPlan(
            level=level_idx,
            estimated_input_count=input_count,
            estimated_output_count=output_count,
            estimated_seconds=estimated_seconds,
            estimated_cost=estimated_cost,
            sigma=level.sigma,
            thinning_ratio=level.thinning_ratio,
            max_iterations=level.max_iterations,
            use_exact_pairwise=use_exact,
        )

    def start_tracking(self):
        """Start budget time tracking."""
        self._start_time = time.perf_counter()

    def check_budget(self) -> BudgetStatus:
        """Check current budget status. Call between cascade levels."""
        elapsed = time.perf_counter() - self._start_time if self._start_time else 0
        cost = elapsed * A100_COST_PER_SECOND
        remaining = self.config.budget_dollars - cost
        percent = (cost / max(self.config.budget_dollars, 0.01)) * 100

        if remaining < 0:
            recommendation = "stop"
        elif percent > 80:
            recommendation = "reduce_quality"
        else:
            recommendation = "continue"

        return BudgetStatus(
            elapsed_seconds=elapsed,
            estimated_total_seconds=self.budget_seconds,
            cost_so_far=cost,
            budget_remaining=remaining,
            percent_used=percent,
            recommendation=recommendation,
        )

    def replan_level(
        self,
        remaining_entities: int,
        remaining_levels: list[CascadeLevel],
        embedding_dim: int,
    ) -> list[CascadeLevel]:
        """Replan remaining cascade levels if budget is tight.

        If we've overspent, increase thinning ratios for remaining levels
        to fit within the remaining budget.
        """
        status = self.check_budget()

        if status.recommendation == "continue":
            return remaining_levels  # No adjustment needed

        if status.recommendation == "stop":
            logger.warning("Budget exhausted — skipping remaining cascade levels")
            return []  # Skip all remaining levels

        # "reduce_quality": increase thinning ratios to fit remaining budget
        remaining_budget_seconds = max(0, self.budget_seconds - status.elapsed_seconds)

        adjusted = []
        current_count = remaining_entities

        for level in remaining_levels:
            # Estimate cost at current thinning ratio
            flops = current_count * embedding_dim * level.max_iterations
            level_seconds = flops / A100_TFLOPS_FP16

            if level_seconds > remaining_budget_seconds * 0.8:
                # Too expensive — increase thinning ratio
                affordable_count = int(
                    (remaining_budget_seconds * 0.5 * A100_TFLOPS_FP16)
                    / (embedding_dim * level.max_iterations)
                )
                new_ratio = max(level.thinning_ratio, current_count / max(affordable_count, 1))
                adjusted_level = CascadeLevel(
                    sigma=level.sigma,
                    thinning_ratio=new_ratio,
                    max_iterations=max(1, level.max_iterations // 2),
                    min_iterations=level.min_iterations,
                )
                logger.info(
                    "Budget replan: level sigma=%.1f thinning %.0f→%.0f, iters %d→%d",
                    level.sigma, level.thinning_ratio, new_ratio,
                    level.max_iterations, adjusted_level.max_iterations,
                )
                adjusted.append(adjusted_level)
            else:
                adjusted.append(level)

            current_count = int(current_count / (adjusted[-1].thinning_ratio))

        return adjusted

    def record_level_time(self, seconds: float):
        """Record actual time for a completed cascade level."""
        self._level_times.append(seconds)

    @property
    def total_elapsed(self) -> float:
        return time.perf_counter() - self._start_time if self._start_time else 0

    @property
    def total_cost(self) -> float:
        return self.total_elapsed * A100_COST_PER_SECOND
