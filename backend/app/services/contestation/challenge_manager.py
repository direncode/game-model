"""Challenge CRUD operations and impact analysis.

Manages the lifecycle of challenges against crystallization results,
including creation, listing, resolution, and impact assessment.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.challenge import Challenge, ChallengeComment
from app.models.module import Module, ModuleEntity, ModuleRelationship

logger = logging.getLogger(__name__)


class ChallengeManager:
    """CRUD operations and business logic for challenges."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create_challenge(
        self,
        data: dict,
        user_id: uuid.UUID,
    ) -> Challenge:
        """Create a new challenge against a crystallization result.

        Validates that the target entity (module, connection, etc.) exists
        before creating the challenge record.

        Args:
            data: Challenge data with keys: dataset_id, job_id, challenge_type,
                target_type, target_id, title, reasoning, evidence,
                proposed_resolution.
            user_id: UUID of the challenging user.

        Returns:
            Created Challenge instance.

        Raises:
            ValueError: If target does not exist or data is invalid.
        """
        # Validate target exists
        target_type = data["target_type"]
        target_id = uuid.UUID(data["target_id"])

        exists = await self._validate_target(target_type, target_id)
        if not exists:
            raise ValueError(
                f"Target {target_type} with id {target_id} does not exist"
            )

        challenge = Challenge(
            dataset_id=uuid.UUID(data["dataset_id"]),
            job_id=uuid.UUID(data["job_id"]),
            challenge_type=data["challenge_type"],
            target_type=target_type,
            target_id=target_id,
            challenger_id=user_id,
            title=data["title"],
            reasoning=data["reasoning"],
            evidence=data.get("evidence"),
            proposed_resolution=data.get("proposed_resolution"),
            status="open",
        )

        self._db.add(challenge)
        await self._db.flush()

        logger.info(
            "Challenge created: id=%s, type=%s, target=%s/%s, by user=%s",
            challenge.id,
            challenge.challenge_type,
            target_type,
            target_id,
            user_id,
        )
        return challenge

    async def list_challenges(
        self,
        dataset_id: uuid.UUID,
        *,
        status: str | None = None,
        challenge_type: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """List challenges with pagination and filtering.

        Args:
            dataset_id: Filter by dataset.
            status: Optional status filter.
            challenge_type: Optional type filter.
            page: Page number (1-indexed).
            page_size: Items per page.

        Returns:
            Dict with items, total, page, page_size.
        """
        conditions = [Challenge.dataset_id == dataset_id]
        if status:
            conditions.append(Challenge.status == status)
        if challenge_type:
            conditions.append(Challenge.challenge_type == challenge_type)

        # Count total
        count_query = select(func.count()).select_from(Challenge).where(
            and_(*conditions)
        )
        total = (await self._db.execute(count_query)).scalar() or 0

        # Fetch page
        offset = (page - 1) * page_size
        query = (
            select(Challenge)
            .where(and_(*conditions))
            .order_by(Challenge.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        result = await self._db.execute(query)
        challenges = result.scalars().all()

        logger.debug(
            "Listed %d/%d challenges for dataset=%s (page=%d)",
            len(challenges),
            total,
            dataset_id,
            page,
        )

        return {
            "items": challenges,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_challenge(self, challenge_id: uuid.UUID) -> Challenge | None:
        """Get a single challenge with comments.

        Args:
            challenge_id: UUID of the challenge.

        Returns:
            Challenge with loaded comments, or None if not found.
        """
        result = await self._db.execute(
            select(Challenge)
            .where(Challenge.id == challenge_id)
            .options(selectinload(Challenge.comments))
        )
        return result.scalar_one_or_none()

    async def resolve_challenge(
        self,
        challenge_id: uuid.UUID,
        resolution: str,
        reasoning: str,
        user_id: uuid.UUID,
    ) -> Challenge:
        """Resolve a challenge and compute impact analysis.

        Args:
            challenge_id: UUID of the challenge to resolve.
            resolution: Resolution status (accepted/rejected/deferred).
            reasoning: Explanation for the resolution.
            user_id: UUID of the resolving user.

        Returns:
            Updated Challenge instance.

        Raises:
            ValueError: If challenge not found or already resolved.
        """
        challenge = await self.get_challenge(challenge_id)
        if challenge is None:
            raise ValueError(f"Challenge {challenge_id} not found")

        if challenge.status not in ("open", "under_review"):
            raise ValueError(
                f"Challenge {challenge_id} is already resolved "
                f"(status={challenge.status})"
            )

        # Compute impact analysis
        impact = await self._compute_impact(challenge)

        await self._db.execute(
            update(Challenge)
            .where(Challenge.id == challenge_id)
            .values(
                status=resolution,
                resolved_by=user_id,
                resolution_reasoning=reasoning,
                resolved_at=datetime.now(timezone.utc),
                impact_analysis=impact,
            )
        )
        await self._db.flush()

        logger.info(
            "Challenge resolved: id=%s, resolution=%s, by user=%s",
            challenge_id,
            resolution,
            user_id,
        )

        # Refresh
        return await self.get_challenge(challenge_id)

    async def add_comment(
        self,
        challenge_id: uuid.UUID,
        content: str,
        user_id: uuid.UUID,
    ) -> ChallengeComment:
        """Add a comment to a challenge.

        Args:
            challenge_id: UUID of the challenge.
            content: Comment text.
            user_id: UUID of the commenting user.

        Returns:
            Created ChallengeComment instance.
        """
        comment = ChallengeComment(
            challenge_id=challenge_id,
            author_id=user_id,
            content=content,
        )
        self._db.add(comment)
        await self._db.flush()

        logger.info(
            "Comment added to challenge %s by user %s",
            challenge_id,
            user_id,
        )
        return comment

    async def _validate_target(
        self, target_type: str, target_id: uuid.UUID
    ) -> bool:
        """Check if a challenge target exists."""
        model_map = {
            "module": Module,
            "module_entity": ModuleEntity,
            "module_relationship": ModuleRelationship,
        }

        model = model_map.get(target_type)
        if model is None:
            raise ValueError(f"Unknown target type: {target_type}")

        result = await self._db.execute(
            select(func.count()).select_from(model).where(model.id == target_id)
        )
        count = result.scalar() or 0
        return count > 0

    async def _compute_impact(self, challenge: Challenge) -> dict:
        """Compute impact analysis for a challenge resolution.

        Determines what other modules and connections would be affected.
        """
        impact: dict[str, Any] = {
            "affected_modules": [],
            "affected_connections": 0,
            "affected_entities": 0,
        }

        if challenge.target_type == "module":
            # Find connected modules
            result = await self._db.execute(
                select(ModuleRelationship).where(
                    (ModuleRelationship.source_module_id == challenge.target_id)
                    | (ModuleRelationship.target_module_id == challenge.target_id)
                )
            )
            relationships = result.scalars().all()

            affected_module_ids = set()
            for rel in relationships:
                affected_module_ids.add(str(rel.source_module_id))
                affected_module_ids.add(str(rel.target_module_id))

            # Count entities in target module
            entity_result = await self._db.execute(
                select(func.count())
                .select_from(ModuleEntity)
                .where(ModuleEntity.module_id == challenge.target_id)
            )
            entity_count = entity_result.scalar() or 0

            impact["affected_modules"] = list(affected_module_ids)
            impact["affected_connections"] = len(relationships)
            impact["affected_entities"] = entity_count

        elif challenge.target_type == "module_entity":
            # Find which module this entity belongs to
            result = await self._db.execute(
                select(ModuleEntity).where(
                    ModuleEntity.id == challenge.target_id
                )
            )
            entity = result.scalar_one_or_none()
            if entity:
                impact["affected_modules"] = [str(entity.module_id)]
                impact["affected_entities"] = 1

        logger.debug(
            "Impact analysis for challenge %s: %s",
            challenge.id,
            impact,
        )
        return impact
