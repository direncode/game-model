"""RunPod Serverless API client for offloading TCD-JEPA training to GPU."""

from __future__ import annotations

import logging
import time
from typing import Any, Callable

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

RUNPOD_API_BASE = "https://api.runpod.ai/v2"


class RunPodClient:
    """Client for RunPod Serverless endpoints."""

    def __init__(self):
        self.api_key = settings.RUNPOD_API_KEY
        self.endpoint_id = settings.RUNPOD_ENDPOINT_ID
        if not self.api_key or not self.endpoint_id:
            raise ValueError("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID must be set")

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    @property
    def _base_url(self) -> str:
        return f"{RUNPOD_API_BASE}/{self.endpoint_id}"

    async def submit_job(
        self,
        entities: list[dict],
        edges: list[dict],
        config: dict,
        dataset_id: str,
        job_id: str,
    ) -> str:
        """Submit a crystallization job to RunPod. Returns RunPod job ID."""
        payload = {
            "input": {
                "entities": entities,
                "edges": edges,
                "config": config,
                "dataset_id": dataset_id,
                "job_id": job_id,
            },
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self._base_url}/run",
                json=payload,
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()

        runpod_id = data.get("id")
        logger.info("RunPod job submitted: runpod_id=%s, job_id=%s", runpod_id, job_id)
        return runpod_id

    async def poll_status(self, runpod_id: str) -> dict[str, Any]:
        """Poll RunPod job status. Returns status dict."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self._base_url}/status/{runpod_id}",
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def cancel_job(self, runpod_id: str) -> None:
        """Cancel a running RunPod job."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self._base_url}/cancel/{runpod_id}",
                headers=self._headers,
            )
            resp.raise_for_status()
        logger.info("RunPod job cancelled: %s", runpod_id)

    async def run_and_poll(
        self,
        entities: list[dict],
        edges: list[dict],
        config: dict,
        dataset_id: str,
        job_id: str,
        progress_callback: Callable[[dict], None] | None = None,
        poll_interval: float = 2.0,
        timeout: float = 3600,
    ) -> dict[str, Any]:
        """Submit job, poll for completion, and return results.

        Calls progress_callback with streaming updates as they arrive.
        """
        runpod_id = await self.submit_job(entities, edges, config, dataset_id, job_id)

        start = time.time()
        last_stream_index = 0

        while time.time() - start < timeout:
            status = await self.poll_status(runpod_id)
            runpod_status = status.get("status")

            # Process streaming output (progress updates)
            stream = status.get("stream", [])
            if stream and progress_callback:
                for item in stream[last_stream_index:]:
                    output = item.get("output", item)
                    if isinstance(output, dict):
                        progress_callback(output)
                last_stream_index = len(stream)

            if runpod_status == "COMPLETED":
                output = status.get("output", {})
                logger.info("RunPod job completed: %s", runpod_id)
                return output

            if runpod_status == "FAILED":
                error = status.get("error", "Unknown RunPod error")
                logger.error("RunPod job failed: %s — %s", runpod_id, error)
                raise RuntimeError(f"RunPod job failed: {error}")

            if runpod_status == "CANCELLED":
                raise RuntimeError("RunPod job was cancelled")

            # Still running — wait and poll again
            import asyncio
            await asyncio.sleep(poll_interval)

        raise TimeoutError(f"RunPod job timed out after {timeout}s")


def is_runpod_configured() -> bool:
    """Check if RunPod credentials are configured."""
    return bool(settings.RUNPOD_API_KEY and settings.RUNPOD_ENDPOINT_ID)
