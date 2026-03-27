"""Convert resolved challenges into crystallization constraints.

Translates human feedback on module assignments into constraint sets
that can be fed back into the TCD-JEPA re-crystallization process.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.challenge import Challenge, FeedbackConstraint
from app.models.module import ModuleEntity

logger = logging.getLogger(__name__)


class FeedbackIntegrator:
    """Convert resolved challenges into re-crystallization constraints."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def process_resolution(
        self, challenge: Challenge
    ) -> FeedbackConstraint | None:
        """Convert a resolved challenge into a feedback constraint.

        Mapping:
        - Module assignment accepted -> "keep_together" constraint.
        - Module assignment rejected -> "separate" constraint.
        - Module merge accepted -> "merge" constraint.
        - Entity re-assignment -> "reassign" constraint.

        Args:
            challenge: Resolved Challenge instance.

        Returns:
            Created FeedbackConstraint, or None if no constraint applies.
        """
        if challenge.status not in ("accepted", "rejected"):
            logger.debug(
                "Challenge %s has status '%s'; no constraint generated",
                challenge.id,
                challenge.status,
            )
            return None

        constraint_type, entities = await self._map_to_constraint(challenge)
        if constraint_type is None:
            return None

        # Determine weight from challenge evidence
        weight = self._compute_weight(challenge)

        constraint = FeedbackConstraint(
            dataset_id=challenge.dataset_id,
            constraint_type=constraint_type,
            entities=entities,
            weight=weight,
            source_challenge_id=challenge.id,
            active=True,
        )

        self._db.add(constraint)
        await self._db.flush()

        logger.info(
            "Generated constraint: type=%s, weight=%.2f, from challenge=%s",
            constraint_type,
            weight,
            challenge.id,
        )
        return constraint

    async def get_constraints(
        self, dataset_id: uuid.UUID, active_only: bool = True
    ) -> list[FeedbackConstraint]:
        """Get all feedback constraints for a dataset.

        Args:
            dataset_id: UUID of the dataset.
            active_only: If True, only return active constraints.

        Returns:
            List of FeedbackConstraint instances.
        """
        conditions = [FeedbackConstraint.dataset_id == dataset_id]
        if active_only:
            conditions.append(FeedbackConstraint.active == True)  # noqa: E712

        result = await self._db.execute(
            select(FeedbackConstraint).where(and_(*conditions))
        )
        constraints = list(result.scalars().all())

        logger.debug(
            "Loaded %d constraints for dataset=%s", len(constraints), dataset_id
        )
        return constraints

    async def build_constraint_config(
        self, dataset_id: uuid.UUID
    ) -> dict[str, Any]:
        """Build a constraint configuration dict for re-crystallization.

        Aggregates all active constraints into a format compatible
        with TCD-JEPA's constraint-aware training.

        Args:
            dataset_id: UUID of the dataset.

        Returns:
            Configuration dict with keep_together, separate, merge lists.
        """
        constraints = await self.get_constraints(dataset_id)

        config: dict[str, list] = {
            "keep_together": [],
            "separate": [],
            "merge": [],
            "reassign": [],
        }

        for c in constraints:
            if c.constraint_type in config:
                config[c.constraint_type].append({
                    "entities": c.entities,
                    "weight": c.weight,
                    "source_challenge_id": str(c.source_challenge_id),
                })

        logger.info(
            "Built constraint config for dataset=%s: %s",
            dataset_id,
            {k: len(v) for k, v in config.items()},
        )
        return config

    async def _map_to_constraint(
        self, challenge: Challenge
    ) -> tuple[str | None, dict | None]:
        """Map a challenge resolution to a constraint type and entity set."""
        ctype = challenge.challenge_type
        status = challenge.status
        proposed = challenge.proposed_resolution or {}

        if ctype == "module_assignment":
            if status == "accepted":
                # The challenge was correct: entity should be reassigned
                entity_names = await self._get_module_entities(
                    challenge.target_id
                )
                return "separate", {
                    "entity_names": entity_names,
                    "from_module": str(challenge.target_id),
                }
            else:
                # Keep as is
                entity_names = await self._get_module_entities(
                    challenge.target_id
                )
                return "keep_together", {
                    "entity_names": entity_names,
                    "module": str(challenge.target_id),
                }

        if ctype == "module_merge":
            if status == "accepted":
                source = proposed.get("source_module_id")
                target = proposed.get("target_module_id")
                if source and target:
                    return "merge", {
                        "source_module": source,
                        "target_module": target,
                    }

        if ctype == "entity_reassignment":
            if status == "accepted":
                return "reassign", {
                    "entity_id": str(challenge.target_id),
                    "proposed_module": proposed.get("target_module_id"),
                }

        if ctype == "hidden_connection":
            if status == "accepted":
                return "keep_together", {
                    "entities": proposed.get("entities", []),
                    "reason": "validated_hidden_connection",
                }

        return None, None

    async def _get_module_entities(
        self, module_id: uuid.UUID
    ) -> list[str]:
        """Get entity names for a module."""
        result = await self._db.execute(
            select(ModuleEntity.entity_name).where(
                ModuleEntity.module_id == module_id
            )
        )
        return [row[0] for row in result.all()]

    @staticmethod
    def _compute_weight(challenge: Challenge) -> float:
        """Compute constraint weight based on challenge evidence quality."""
        base_weight = 1.0

        # Boost weight if evidence is provided
        if challenge.evidence:
            evidence_keys = len(challenge.evidence)
            base_weight += min(evidence_keys * 0.1, 0.5)

        # Boost for proposed resolution with details
        if challenge.proposed_resolution:
            base_weight += 0.2

        return min(base_weight, 2.0)
