"""Model checkpoint management with MinIO storage.

Handles saving, loading, versioning, and retention of TCD-JEPA
model checkpoints in S3-compatible object storage.
"""

from __future__ import annotations

import io
import logging
from datetime import datetime, timezone
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


class CheckpointManager:
    """Manage TCD-JEPA model checkpoints in MinIO object storage."""

    def __init__(self, minio_client: Any | None = None) -> None:
        self._minio = minio_client
        self._bucket = settings.MINIO_BUCKET

    def _ensure_minio(self) -> Any:
        """Ensure MinIO client is available."""
        if self._minio is None:
            raise RuntimeError(
                "MinIO client not configured. Cannot manage checkpoints."
            )
        return self._minio

    async def save(
        self,
        dataset_id: str,
        job_id: str,
        checkpoint_data: bytes,
        version: int | None = None,
        metadata: dict | None = None,
    ) -> str:
        """Save a model checkpoint to MinIO.

        Args:
            dataset_id: Dataset UUID string.
            job_id: Crystallization job UUID string.
            checkpoint_data: Serialized checkpoint bytes.
            version: Explicit version number (auto-incremented if None).
            metadata: Optional metadata to attach to the object.

        Returns:
            Object storage path of the saved checkpoint.
        """
        client = self._ensure_minio()

        if version is None:
            existing = await self.list_versions(dataset_id)
            version = len(existing) + 1

        object_path = self._build_path(dataset_id, job_id, version)

        try:
            obj_metadata = {
                "x-amz-meta-dataset-id": dataset_id,
                "x-amz-meta-job-id": job_id,
                "x-amz-meta-version": str(version),
                "x-amz-meta-created-at": datetime.now(timezone.utc).isoformat(),
            }
            if metadata:
                for k, v in metadata.items():
                    obj_metadata[f"x-amz-meta-{k}"] = str(v)

            data_stream = io.BytesIO(checkpoint_data)
            client.put_object(
                self._bucket,
                object_path,
                data_stream,
                len(checkpoint_data),
                content_type="application/octet-stream",
                metadata=obj_metadata,
            )

            logger.info(
                "Saved checkpoint v%d: %s/%s (%d bytes)",
                version,
                self._bucket,
                object_path,
                len(checkpoint_data),
            )
            return object_path

        except Exception:
            logger.exception("Failed to save checkpoint to MinIO")
            raise

    async def load(
        self,
        dataset_id: str,
        job_id: str,
        version: int | None = None,
    ) -> bytes:
        """Load a model checkpoint from MinIO.

        Args:
            dataset_id: Dataset UUID string.
            job_id: Crystallization job UUID string.
            version: Version to load (latest if None).

        Returns:
            Raw checkpoint bytes.
        """
        client = self._ensure_minio()

        if version is None:
            versions = await self.list_versions(dataset_id)
            if not versions:
                raise FileNotFoundError(
                    f"No checkpoints found for dataset={dataset_id}"
                )
            version = versions[-1]["version"]

        object_path = self._build_path(dataset_id, job_id, version)

        try:
            response = client.get_object(self._bucket, object_path)
            data = response.read()
            response.close()
            response.release_conn()

            logger.info(
                "Loaded checkpoint v%d: %s (%d bytes)",
                version,
                object_path,
                len(data),
            )
            return data

        except Exception:
            logger.exception(
                "Failed to load checkpoint: %s", object_path
            )
            raise

    async def list_versions(self, dataset_id: str) -> list[dict]:
        """List all checkpoint versions for a dataset.

        Args:
            dataset_id: Dataset UUID string.

        Returns:
            List of version info dicts sorted by version number.
        """
        client = self._ensure_minio()
        prefix = f"checkpoints/{dataset_id}/"

        try:
            objects = client.list_objects(
                self._bucket, prefix=prefix, recursive=True
            )

            versions = []
            for obj in objects:
                if obj.object_name.endswith(".pt"):
                    # Parse version from path
                    parts = obj.object_name.split("/")
                    try:
                        ver_str = parts[-1].replace("checkpoint_v", "").replace(".pt", "")
                        ver = int(ver_str)
                    except (ValueError, IndexError):
                        continue

                    versions.append({
                        "version": ver,
                        "path": obj.object_name,
                        "size": obj.size,
                        "last_modified": (
                            obj.last_modified.isoformat()
                            if obj.last_modified
                            else None
                        ),
                    })

            versions.sort(key=lambda v: v["version"])
            return versions

        except Exception:
            logger.exception(
                "Failed to list checkpoint versions for dataset=%s",
                dataset_id,
            )
            return []

    async def delete_old_versions(
        self, dataset_id: str, keep_latest: int = 3
    ) -> int:
        """Delete old checkpoint versions, keeping the most recent N.

        Args:
            dataset_id: Dataset UUID string.
            keep_latest: Number of recent versions to retain.

        Returns:
            Number of versions deleted.
        """
        client = self._ensure_minio()
        versions = await self.list_versions(dataset_id)

        if len(versions) <= keep_latest:
            logger.info(
                "Only %d versions exist for dataset=%s; nothing to delete",
                len(versions),
                dataset_id,
            )
            return 0

        to_delete = versions[:-keep_latest]
        deleted = 0

        for ver in to_delete:
            try:
                client.remove_object(self._bucket, ver["path"])
                deleted += 1
                logger.info(
                    "Deleted checkpoint v%d: %s", ver["version"], ver["path"]
                )
            except Exception:
                logger.exception(
                    "Failed to delete checkpoint: %s", ver["path"]
                )

        logger.info(
            "Retention cleanup: deleted %d/%d old checkpoints for dataset=%s",
            deleted,
            len(to_delete),
            dataset_id,
        )
        return deleted

    @staticmethod
    def _build_path(dataset_id: str, job_id: str, version: int) -> str:
        """Construct the MinIO object path for a checkpoint."""
        return f"checkpoints/{dataset_id}/{job_id}/checkpoint_v{version:04d}.pt"
