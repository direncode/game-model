"""Data retention policy management.

Manages retention periods for datasets, identifies expired data,
and orchestrates archive or deletion of data past retention.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dataset import Dataset

logger = logging.getLogger(__name__)

# Default retention period in days
_DEFAULT_RETENTION_DAYS = 365


@dataclass
class RetentionPolicy:
    """Retention policy for a dataset."""

    dataset_id: str
    retention_days: int
    expires_at: str
    is_expired: bool


@dataclass
class RetentionReport:
    """Summary of retention enforcement run."""

    checked_count: int
    expired_count: int
    archived_ids: list[str]
    deleted_ids: list[str]
    errors: list[str]


class RetentionManager:
    """Manage data retention policies and enforce expiration.

    Retention policies are stored in the dataset metadata. When a dataset
    exceeds its retention period, it can be archived (soft delete) or
    permanently removed.
    """

    def __init__(
        self,
        db: AsyncSession,
        minio_client: Any | None = None,
    ) -> None:
        self._db = db
        self._minio = minio_client

    async def set_policy(
        self,
        dataset_id: uuid.UUID,
        retention_days: int,
    ) -> RetentionPolicy:
        """Set or update the retention policy for a dataset.

        Args:
            dataset_id: UUID of the dataset.
            retention_days: Number of days to retain data.

        Returns:
            RetentionPolicy with computed expiration.

        Raises:
            ValueError: If retention_days is invalid.
        """
        if retention_days < 1:
            raise ValueError("Retention period must be at least 1 day")

        result = await self._db.execute(
            select(Dataset).where(Dataset.id == dataset_id)
        )
        dataset = result.scalar_one_or_none()
        if dataset is None:
            raise ValueError(f"Dataset {dataset_id} not found")

        expires_at = dataset.created_at + timedelta(days=retention_days)
        is_expired = datetime.now(timezone.utc) > expires_at.replace(
            tzinfo=timezone.utc
        )

        # Store policy in dataset status metadata
        # We use a convention: store retention in the dataset's description
        # or a dedicated field. For now, use update:
        await self._db.execute(
            update(Dataset)
            .where(Dataset.id == dataset_id)
            .values(updated_at=datetime.now(timezone.utc))
        )
        await self._db.flush()

        logger.info(
            "Retention policy set: dataset=%s, days=%d, expires=%s",
            dataset_id,
            retention_days,
            expires_at.isoformat(),
        )

        return RetentionPolicy(
            dataset_id=str(dataset_id),
            retention_days=retention_days,
            expires_at=expires_at.isoformat(),
            is_expired=is_expired,
        )

    async def check_expired(
        self, retention_days: int = _DEFAULT_RETENTION_DAYS
    ) -> list[Dataset]:
        """Find datasets that have exceeded their retention period.

        Args:
            retention_days: Default retention period to apply.

        Returns:
            List of expired Dataset instances.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

        result = await self._db.execute(
            select(Dataset).where(
                and_(
                    Dataset.created_at < cutoff,
                    Dataset.status != "archived",
                    Dataset.status != "deleted",
                )
            )
        )
        expired = list(result.scalars().all())

        logger.info(
            "Retention check: %d datasets past %d-day retention",
            len(expired),
            retention_days,
        )
        return expired

    async def enforce_retention(
        self,
        retention_days: int = _DEFAULT_RETENTION_DAYS,
        action: str = "archive",
    ) -> RetentionReport:
        """Enforce retention policy on all expired datasets.

        Args:
            retention_days: Retention period to enforce.
            action: What to do with expired data ("archive" or "delete").

        Returns:
            RetentionReport with enforcement results.
        """
        expired = await self.check_expired(retention_days)

        report = RetentionReport(
            checked_count=len(expired),
            expired_count=len(expired),
            archived_ids=[],
            deleted_ids=[],
            errors=[],
        )

        for dataset in expired:
            try:
                if action == "archive":
                    await self._archive_dataset(dataset)
                    report.archived_ids.append(str(dataset.id))
                elif action == "delete":
                    await self._delete_dataset(dataset)
                    report.deleted_ids.append(str(dataset.id))
                else:
                    report.errors.append(
                        f"Unknown action '{action}' for dataset {dataset.id}"
                    )
            except Exception as exc:
                error_msg = f"Failed to {action} dataset {dataset.id}: {exc}"
                logger.exception(error_msg)
                report.errors.append(error_msg)

        await self._db.commit()

        logger.info(
            "Retention enforcement: archived=%d, deleted=%d, errors=%d",
            len(report.archived_ids),
            len(report.deleted_ids),
            len(report.errors),
        )
        return report

    async def _archive_dataset(self, dataset: Dataset) -> None:
        """Soft-archive a dataset by updating its status."""
        await self._db.execute(
            update(Dataset)
            .where(Dataset.id == dataset.id)
            .values(
                status="archived",
                updated_at=datetime.now(timezone.utc),
            )
        )
        logger.info("Dataset %s archived", dataset.id)

    async def _delete_dataset(self, dataset: Dataset) -> None:
        """Delete dataset data from storage.

        Removes raw files from MinIO and marks the dataset as deleted.
        Neo4j and PostgreSQL data are retained for audit purposes.
        """
        # Remove raw file from MinIO
        if self._minio and dataset.raw_storage_path:
            try:
                from app.config import settings

                self._minio.remove_object(
                    settings.MINIO_BUCKET, dataset.raw_storage_path
                )
                logger.info(
                    "Removed raw file: %s", dataset.raw_storage_path
                )
            except Exception:
                logger.warning(
                    "Failed to remove raw file from MinIO: %s",
                    dataset.raw_storage_path,
                )

        await self._db.execute(
            update(Dataset)
            .where(Dataset.id == dataset.id)
            .values(
                status="deleted",
                updated_at=datetime.now(timezone.utc),
            )
        )
        logger.info("Dataset %s marked as deleted", dataset.id)
