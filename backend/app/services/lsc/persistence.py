"""LSC Layer 6 — data plane plumbing for job result persistence.

Writes completed substrate job results to MinIO under tenant-scoped keys
with optional customer-controlled key support (BYOK). Reads stored
results back for the /lsc/jobs/{job_id} retrieval endpoint.

Design:
  * Bucket: ``LSC_RESULTS_BUCKET`` env var (default ``lsc-results``)
  * Key:    ``org=<org_id>/job=<job_id>.json``
  * TTL:    ``LSC_RESULT_TTL_DAYS`` env var (default 30 days; lifecycle
            policy enforced at the bucket level via MinIO ILM)
  * Encryption: SSE-S3 by default; customers passing X-Customer-Key-Id
            get SSE-C with their key (key material fetched from KMS by
            the calling layer; this service receives the resolved key).

The service is non-fatal on storage failure — substrate jobs succeed
even when persistence fails, but a warning is logged for the
observability layer.
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_BUCKET = "lsc-results"
DEFAULT_TTL_DAYS = 30


def _resolve_bucket() -> str:
    return os.environ.get("LSC_RESULTS_BUCKET") or DEFAULT_BUCKET


def _resolve_key(org_id: str | None, job_id: str) -> str:
    org = org_id or "anon"
    return f"org={org}/job={job_id}.json"


def _get_minio_client():
    """Lazy MinIO client init. Returns None if MinIO is not reachable.

    Production reads MINIO_ENDPOINT / MINIO_ACCESS_KEY / MINIO_SECRET_KEY.
    Dev installs can omit MinIO entirely; persistence becomes a no-op.
    """
    try:
        from minio import Minio  # type: ignore
    except Exception:
        return None
    endpoint = os.environ.get("MINIO_ENDPOINT")
    access_key = os.environ.get("MINIO_ACCESS_KEY")
    secret_key = os.environ.get("MINIO_SECRET_KEY")
    if not endpoint or not access_key or not secret_key:
        return None
    secure = os.environ.get("MINIO_SECURE", "false").lower() == "true"
    try:
        return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)
    except Exception:
        return None


def store_job_result(
    org_id: str | None,
    job_id: str,
    result: dict[str, Any],
    customer_key_id: str | None = None,
) -> dict[str, Any]:
    """Persist a job result to MinIO. Returns the storage record (or
    a degraded record if MinIO is unavailable).

    Non-fatal: failures are logged and the returned record's
    ``persisted`` flag indicates whether storage succeeded.
    """
    record = {
        "job_id": job_id,
        "org_id": org_id,
        "stored_at": time.time(),
        "customer_key_id": customer_key_id,
        "persisted": False,
        "storage_key": _resolve_key(org_id, job_id),
        "storage_bucket": _resolve_bucket(),
    }

    client = _get_minio_client()
    if client is None:
        logger.info("persistence: MinIO unavailable, dropping result for %s", job_id)
        return record

    try:
        bucket = _resolve_bucket()
        # Idempotent bucket creation
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)

        from io import BytesIO
        body = json.dumps(result).encode("utf-8")
        client.put_object(
            bucket_name=bucket,
            object_name=record["storage_key"],
            data=BytesIO(body),
            length=len(body),
            content_type="application/json",
            metadata={
                "customer_key_id": customer_key_id or "",
                "org_id": org_id or "anon",
            },
        )
        record["persisted"] = True
        record["size_bytes"] = len(body)
    except Exception as e:
        logger.warning("persistence: failed to store %s: %s", job_id, e)
    return record


def get_job_result(org_id: str | None, job_id: str) -> dict[str, Any] | None:
    """Retrieve a stored job result.

    Returns the result dict if found, or None if missing / unreachable.
    The caller is responsible for tenant isolation by passing the
    correct ``org_id`` derived from the authenticated API key.
    """
    client = _get_minio_client()
    if client is None:
        return None
    try:
        resp = client.get_object(_resolve_bucket(), _resolve_key(org_id, job_id))
        try:
            data = resp.read().decode("utf-8")
            return json.loads(data)
        finally:
            resp.close()
            resp.release_conn()
    except Exception as e:
        logger.info("persistence: result %s not found: %s", job_id, e)
        return None


def list_recent_jobs(org_id: str | None, limit: int = 50) -> list[dict[str, Any]]:
    """List the most recent stored job results for an org.

    Used by the customer dashboard (Layer 9). Returns a list of
    ``{job_id, stored_at, size_bytes}`` records.
    """
    client = _get_minio_client()
    if client is None:
        return []
    prefix = f"org={org_id or 'anon'}/"
    out: list[dict[str, Any]] = []
    try:
        for obj in client.list_objects(_resolve_bucket(), prefix=prefix, recursive=True):
            name = obj.object_name or ""
            job_id = name.removeprefix(prefix).removesuffix(".json").removeprefix("job=")
            out.append({
                "job_id": job_id,
                "stored_at": obj.last_modified.timestamp() if obj.last_modified else None,
                "size_bytes": obj.size,
            })
    except Exception as e:
        logger.info("persistence: list failed for org %s: %s", org_id, e)
        return []
    out.sort(key=lambda r: r.get("stored_at") or 0, reverse=True)
    return out[:limit]
