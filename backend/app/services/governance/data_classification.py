"""Data sensitivity classification management.

Manages classification labels for datasets and enforces
classification-based access restrictions.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.governance import DataClassification as DataClassificationModel

logger = logging.getLogger(__name__)

# Valid classification levels in ascending order of sensitivity
CLASSIFICATION_LEVELS = ("public", "internal", "confidential", "restricted")


@dataclass
class ClassificationInfo:
    """Current classification status of a dataset."""

    dataset_id: str
    classification: str
    classified_by: str
    reasoning: str | None
    classified_at: str


class DataClassificationService:
    """Manage data sensitivity classifications for datasets."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def classify_dataset(
        self,
        dataset_id: uuid.UUID,
        classification: str,
        user_id: uuid.UUID,
        reasoning: str | None = None,
    ) -> DataClassificationModel:
        """Set or update the classification for a dataset.

        Creates a new classification record (append-only history).

        Args:
            dataset_id: UUID of the dataset.
            classification: Classification level (public/internal/confidential/restricted).
            user_id: UUID of the classifying user.
            reasoning: Optional explanation for the classification.

        Returns:
            Created DataClassification instance.

        Raises:
            ValueError: If classification level is invalid.
        """
        if classification not in CLASSIFICATION_LEVELS:
            raise ValueError(
                f"Invalid classification: {classification}. "
                f"Valid levels: {', '.join(CLASSIFICATION_LEVELS)}"
            )

        record = DataClassificationModel(
            dataset_id=dataset_id,
            classification=classification,
            classified_by=user_id,
            reasoning=reasoning,
        )

        self._db.add(record)
        await self._db.flush()

        logger.info(
            "Dataset %s classified as '%s' by user %s",
            dataset_id,
            classification,
            user_id,
        )
        return record

    async def get_classification(
        self, dataset_id: uuid.UUID
    ) -> ClassificationInfo | None:
        """Get the current classification for a dataset.

        Returns the most recent classification record.

        Args:
            dataset_id: UUID of the dataset.

        Returns:
            ClassificationInfo or None if unclassified.
        """
        result = await self._db.execute(
            select(DataClassificationModel)
            .where(DataClassificationModel.dataset_id == dataset_id)
            .order_by(DataClassificationModel.classified_at.desc())
            .limit(1)
        )
        record = result.scalar_one_or_none()

        if record is None:
            return None

        return ClassificationInfo(
            dataset_id=str(record.dataset_id),
            classification=record.classification,
            classified_by=str(record.classified_by),
            reasoning=record.reasoning,
            classified_at=(
                record.classified_at.isoformat()
                if record.classified_at
                else ""
            ),
        )

    async def get_classification_history(
        self, dataset_id: uuid.UUID
    ) -> list[ClassificationInfo]:
        """Get full classification history for a dataset.

        Args:
            dataset_id: UUID of the dataset.

        Returns:
            List of ClassificationInfo in reverse chronological order.
        """
        result = await self._db.execute(
            select(DataClassificationModel)
            .where(DataClassificationModel.dataset_id == dataset_id)
            .order_by(DataClassificationModel.classified_at.desc())
        )
        records = result.scalars().all()

        return [
            ClassificationInfo(
                dataset_id=str(r.dataset_id),
                classification=r.classification,
                classified_by=str(r.classified_by),
                reasoning=r.reasoning,
                classified_at=(
                    r.classified_at.isoformat() if r.classified_at else ""
                ),
            )
            for r in records
        ]

    async def is_more_restrictive(
        self, dataset_id: uuid.UUID, new_classification: str
    ) -> bool:
        """Check if a new classification is more restrictive than current.

        Args:
            dataset_id: UUID of the dataset.
            new_classification: Proposed new classification level.

        Returns:
            True if the new classification is more restrictive.
        """
        current = await self.get_classification(dataset_id)
        if current is None:
            return True

        current_level = CLASSIFICATION_LEVELS.index(current.classification)
        new_level = CLASSIFICATION_LEVELS.index(new_classification)
        return new_level > current_level
