"""Module type purity calculation.

Computes how homogeneous each module is with respect to entity types,
identifying dominant types and generating distribution summaries.
"""

from __future__ import annotations

import logging
from collections import Counter
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.module import Module, ModuleEntity

logger = logging.getLogger(__name__)


@dataclass
class PurityResult:
    """Type purity metrics for a single module."""

    module_id: str
    module_index: int
    score: float  # 0.0 to 1.0
    dominant_type: str | None
    dominant_count: int
    total_count: int
    distribution: dict[str, int]  # type -> count
    distribution_percentages: dict[str, float]  # type -> percentage


class PurityCalculator:
    """Calculate type purity for crystallized modules."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def calculate(self, module: Module) -> PurityResult:
        """Calculate type purity for a single module.

        Purity = max_type_count / total_count. A score of 1.0 means
        all entities share the same type; lower scores indicate
        more heterogeneous composition.

        Args:
            module: Module ORM instance.

        Returns:
            PurityResult with purity score and type distribution.
        """
        result = await self._db.execute(
            select(ModuleEntity).where(ModuleEntity.module_id == module.id)
        )
        entities = result.scalars().all()

        type_counts: Counter[str] = Counter()
        for entity in entities:
            etype = entity.entity_type or "unknown"
            type_counts[etype] += 1

        total = sum(type_counts.values())

        if total == 0:
            logger.warning(
                "Module %d (id=%s) has no entities for purity calculation",
                module.module_index,
                module.id,
            )
            return PurityResult(
                module_id=str(module.id),
                module_index=module.module_index,
                score=0.0,
                dominant_type=None,
                dominant_count=0,
                total_count=0,
                distribution={},
                distribution_percentages={},
            )

        dominant_type = type_counts.most_common(1)[0][0]
        dominant_count = type_counts[dominant_type]
        score = dominant_count / total

        distribution = dict(type_counts.most_common())
        percentages = {
            t: round(c / total * 100, 1) for t, c in type_counts.items()
        }

        logger.debug(
            "Module %d purity: %.2f (dominant=%s, %d/%d)",
            module.module_index,
            score,
            dominant_type,
            dominant_count,
            total,
        )

        return PurityResult(
            module_id=str(module.id),
            module_index=module.module_index,
            score=round(score, 4),
            dominant_type=dominant_type,
            dominant_count=dominant_count,
            total_count=total,
            distribution=distribution,
            distribution_percentages=percentages,
        )

    async def calculate_batch(
        self, modules: list[Module]
    ) -> list[PurityResult]:
        """Calculate purity for multiple modules.

        Args:
            modules: List of Module ORM instances.

        Returns:
            List of PurityResult, one per module.
        """
        results = []
        for module in modules:
            purity = await self.calculate(module)
            results.append(purity)

        avg_purity = (
            sum(r.score for r in results) / len(results) if results else 0.0
        )
        logger.info(
            "Batch purity calculation: %d modules, avg=%.3f",
            len(results),
            avg_purity,
        )
        return results
