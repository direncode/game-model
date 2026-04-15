"""S3 connector — read from any S3-compatible object storage."""
from __future__ import annotations

import io
import logging
import re
from typing import Any

from ..base import BaseDatasetAdapter, DatasetMeta, EntityTypeConfig

logger = logging.getLogger(__name__)


def _singularize(name: str) -> str:
    if not name:
        return name
    lower = name.lower()
    if lower.endswith("ies") and len(lower) > 3:
        return name[:-3] + "y"
    if lower.endswith("s") and not lower.endswith("ss"):
        return name[:-1]
    return name


def _parse_s3_uri(uri: str) -> tuple[str, str]:
    """Parse s3://bucket/key into (bucket, key)."""
    match = re.match(r"s3://([^/]+)/?(.*)", uri)
    if not match:
        raise ValueError(f"Invalid S3 URI: {uri}. Expected format: s3://bucket/path")
    return match.group(1), match.group(2)


class S3Connector(BaseDatasetAdapter):
    """Connect to S3 buckets and read Parquet, CSV, or JSON files.

    Works with: AWS S3, MinIO, Google Cloud Storage (S3-compatible),
    Azure Blob (via S3-compatible endpoint).

    Requires ``boto3``. Install with: ``pip install boto3``

    Usage::

        connector = S3Connector("s3://bucket/path/to/data.parquet")
        connector = S3Connector("s3://bucket/prefix/", pattern="*.csv")
        connector = S3Connector("s3://bucket/data/",
                               aws_access_key="...", aws_secret_key="...")
    """

    def __init__(
        self,
        uri: str,
        pattern: str = "*",
        aws_access_key: str | None = None,
        aws_secret_key: str | None = None,
        endpoint_url: str | None = None,
        region: str | None = None,
        entity_type: str | None = None,
        name_column: str | None = None,
    ) -> None:
        try:
            import boto3  # noqa: F401
            self._boto3 = boto3
        except ImportError:
            raise ImportError(
                "boto3 is required for S3 support. "
                "Install with: pip install boto3"
            )

        self._uri = uri
        self._pattern = pattern
        self._bucket, self._prefix = _parse_s3_uri(uri)
        self._endpoint_url = endpoint_url
        self._region = region
        self._entity_type = entity_type
        self._name_column = name_column

        # Build S3 client
        client_kwargs: dict[str, Any] = {}
        if endpoint_url:
            client_kwargs["endpoint_url"] = endpoint_url
        if region:
            client_kwargs["region_name"] = region
        if aws_access_key and aws_secret_key:
            client_kwargs["aws_access_key_id"] = aws_access_key
            client_kwargs["aws_secret_access_key"] = aws_secret_key

        self._s3 = self._boto3.client("s3", **client_kwargs)

        # Discover files
        self._files: list[str] = []
        self._discover_files()

        # Delegate to sub-connector
        self._delegate: BaseDatasetAdapter | None = None

    def _discover_files(self) -> None:
        """List matching files under the S3 prefix."""
        import fnmatch

        # If the prefix looks like a single file (has extension), use it directly
        if self._prefix and "." in self._prefix.split("/")[-1]:
            self._files = [self._prefix]
            return

        # List objects under prefix
        paginator = self._s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self._bucket, Prefix=self._prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                filename = key.split("/")[-1]
                if fnmatch.fnmatch(filename, self._pattern):
                    self._files.append(key)

        if not self._files:
            logger.warning("No matching files found at s3://%s/%s with pattern %s",
                           self._bucket, self._prefix, self._pattern)

        logger.info("Discovered %d files in s3://%s/%s",
                     len(self._files), self._bucket, self._prefix)

    def _download_file(self, key: str) -> bytes:
        """Download a single file from S3 into memory."""
        response = self._s3.get_object(Bucket=self._bucket, Key=key)
        return response["Body"].read()

    def _get_delegate(self) -> BaseDatasetAdapter:
        """Create an appropriate sub-connector based on file type."""
        if self._delegate is not None:
            return self._delegate

        if not self._files:
            raise ValueError(f"No files found at {self._uri}")

        first_file = self._files[0]
        ext = first_file.rsplit(".", 1)[-1].lower() if "." in first_file else ""

        if ext == "csv" or ext == "tsv":
            from .csv_connector import CSVConnector
            content = self._download_file(first_file).decode("utf-8")
            delimiter = "\t" if ext == "tsv" else ","
            self._delegate = CSVConnector(
                content,
                delimiter=delimiter,
                from_string=True,
                entity_type=self._entity_type,
                name_column=self._name_column,
            )
        elif ext == "json" or ext == "jsonl":
            from .json_connector import JSONConnector
            content = self._download_file(first_file).decode("utf-8")
            self._delegate = JSONConnector(
                content,
                from_string=True,
                format="jsonl" if ext == "jsonl" else None,
                entity_type=self._entity_type,
                name_field=self._name_column,
            )
        elif ext == "parquet":
            self._delegate = self._make_parquet_delegate()
        else:
            raise ValueError(
                f"Unsupported file type '.{ext}' in S3. "
                f"Supported: .csv, .tsv, .json, .jsonl, .parquet"
            )

        return self._delegate

    def _make_parquet_delegate(self) -> BaseDatasetAdapter:
        """Create a Parquet delegate, downloading to temp files."""
        import tempfile
        from pathlib import Path
        from .parquet_connector import ParquetConnector

        temp_paths: list[str] = []
        for key in self._files:
            if not key.endswith(".parquet"):
                continue
            data = self._download_file(key)
            tmp = tempfile.NamedTemporaryFile(suffix=".parquet", delete=False)
            tmp.write(data)
            tmp.close()
            temp_paths.append(tmp.name)

        if not temp_paths:
            raise ValueError("No Parquet files found in S3")

        return ParquetConnector(
            temp_paths if len(temp_paths) > 1 else temp_paths[0],
            entity_type=self._entity_type,
            name_column=self._name_column,
        )

    # ------------------------------------------------------------------ #
    #  BaseDatasetAdapter interface — delegates to sub-connector
    # ------------------------------------------------------------------ #

    def get_meta(self) -> DatasetMeta:
        meta = self._get_delegate().get_meta()
        # Override display to show S3 source
        return DatasetMeta(
            dataset_id=f"s3:{self._bucket}/{self._prefix}",
            display_name=f"S3: {self._bucket}/{self._prefix or ''}",
            description=f"{len(self._files)} file(s) — {meta.description}",
            entity_types=meta.entity_types,
            lookup_field=meta.lookup_field,
            lookup_label=meta.lookup_label,
        )

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        # For multi-file scenarios, aggregate across files
        if len(self._files) <= 1:
            return self._get_delegate().fetch_entities(limit)

        all_entities: list[dict] = []
        remaining = limit
        for key in self._files:
            if remaining <= 0:
                break
            # Reset delegate for each file
            self._delegate = None
            self._files_temp = self._files
            self._files = [key]
            try:
                ents = self._get_delegate().fetch_entities(remaining)
                all_entities.extend(ents)
                remaining -= len(ents)
            except Exception:
                logger.exception("Failed to read %s", key)
            finally:
                self._delegate = None
                self._files = self._files_temp

        logger.info("Produced %d entities from S3", len(all_entities))
        return all_entities

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        return self._get_delegate().fetch_edges(entities)

    def get_anomaly_tags(
        self,
        record: dict,
        scores: dict,
        cluster_size: int,
        flips: int,
    ) -> list[dict]:
        return self._get_delegate().get_anomaly_tags(record, scores, cluster_size, flips)
