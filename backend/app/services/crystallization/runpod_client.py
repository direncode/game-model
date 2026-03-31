"""RunPod Serverless API client with spend protection.

Offloads TCD-JEPA training to RunPod GPUs. Includes:
- Monthly budget cap ($50 default)
- Per-job duration limit (30 min)
- Cooldown between submissions (30s)
- All spend tracked in Redis
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Callable

import httpx
import redis

from app.config import settings

logger = logging.getLogger(__name__)

RUNPOD_API_BASE = "https://api.runpod.ai/v2"

# Cost per second for common GPUs (approximate, in cents)
GPU_COST_PER_SEC_CENTS = 0.04  # ~$1.44/hr for A100, conservative estimate


def _get_redis() -> redis.Redis:
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


class SpendTracker:
    """Track RunPod GPU spend in Redis with monthly budget enforcement."""

    KEY_PREFIX = "runpod:spend"

    def _month_key(self) -> str:
        from datetime import datetime
        now = datetime.utcnow()
        return f"{self.KEY_PREFIX}:{now.year}:{now.month}"

    def get_month_spend_cents(self) -> float:
        """Get current month's total spend in cents."""
        try:
            r = _get_redis()
            val = r.get(self._month_key())
            return float(val) if val else 0.0
        except Exception:
            return 0.0

    def add_spend(self, cents: float) -> None:
        """Add spend amount and set key to expire at end of month."""
        try:
            r = _get_redis()
            key = self._month_key()
            r.incrbyfloat(key, cents)
            # Expire after 35 days (covers any month)
            r.expire(key, 35 * 86400)
        except Exception:
            logger.warning("Failed to track RunPod spend")

    def check_budget(self) -> None:
        """Raise if monthly budget exceeded."""
        spent = self.get_month_spend_cents()
        budget = settings.RUNPOD_MONTHLY_BUDGET_CENTS
        if spent >= budget:
            raise BudgetExceededError(
                f"Monthly GPU budget exhausted: ${spent / 100:.2f} / ${budget / 100:.2f}. "
                f"Resets next month."
            )
        remaining = budget - spent
        if remaining < 50:  # Less than $0.50 remaining
            logger.warning(
                "RunPod budget almost exhausted: $%.2f remaining",
                remaining / 100,
            )

    def get_last_job_time(self) -> float:
        """Get timestamp of last job submission."""
        try:
            r = _get_redis()
            val = r.get(f"{self.KEY_PREFIX}:last_job")
            return float(val) if val else 0.0
        except Exception:
            return 0.0

    def set_last_job_time(self) -> None:
        """Record current time as last job submission."""
        try:
            r = _get_redis()
            r.set(f"{self.KEY_PREFIX}:last_job", str(time.time()), ex=86400)
        except Exception:
            pass

    def check_cooldown(self) -> None:
        """Raise if submitting too soon after last job."""
        last = self.get_last_job_time()
        if last:
            elapsed = time.time() - last
            cooldown = settings.RUNPOD_COOLDOWN_SECONDS
            if elapsed < cooldown:
                wait = int(cooldown - elapsed)
                raise CooldownError(
                    f"Please wait {wait}s before submitting another job."
                )


class BudgetExceededError(Exception):
    pass


class CooldownError(Exception):
    pass


class RunPodClient:
    """Client for RunPod Serverless endpoints with spend protection."""

    def __init__(self):
        self.api_key = settings.RUNPOD_API_KEY
        self.endpoint_id = settings.RUNPOD_ENDPOINT_ID
        if not self.api_key or not self.endpoint_id:
            raise ValueError("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID must be set")
        self.spend = SpendTracker()

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
        """Submit a crystallization job to RunPod. Returns RunPod job ID.

        Enforces budget cap and cooldown before submission.
        """
        # Safety checks
        self.spend.check_budget()
        self.spend.check_cooldown()

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
        self.spend.set_last_job_time()
        logger.info("RunPod job submitted: runpod_id=%s, job_id=%s", runpod_id, job_id)
        return runpod_id

    async def poll_status(self, runpod_id: str) -> dict[str, Any]:
        """Poll RunPod job status."""
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
        timeout: float | None = None,
    ) -> dict[str, Any]:
        """Submit job, poll for completion, return results.

        Enforces per-job duration limit and tracks GPU spend.
        """
        timeout = timeout or settings.RUNPOD_MAX_JOB_SECONDS
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
                # Generator handlers return output as a list of all yielded + returned values.
                # Extract the final result dict (last item with status="completed", else last item).
                if isinstance(output, list):
                    output = next(
                        (item for item in reversed(output)
                         if isinstance(item, dict) and item.get("status") == "completed"),
                        output[-1] if output else {},
                    )
                # Track spend based on actual execution time
                elapsed = time.time() - start
                cost_cents = elapsed * GPU_COST_PER_SEC_CENTS
                self.spend.add_spend(cost_cents)
                logger.info(
                    "RunPod job completed: %s (%.0fs, $%.2f)",
                    runpod_id, elapsed, cost_cents / 100,
                )
                return output

            if runpod_status == "FAILED":
                error = status.get("error", "Unknown RunPod error")
                # Still track partial spend
                elapsed = time.time() - start
                self.spend.add_spend(elapsed * GPU_COST_PER_SEC_CENTS)
                logger.error("RunPod job failed: %s — %s", runpod_id, error)
                raise RuntimeError(f"RunPod job failed: {error}")

            if runpod_status == "CANCELLED":
                raise RuntimeError("RunPod job was cancelled")

            import asyncio
            await asyncio.sleep(poll_interval)

        # Timed out — cancel the job and track spend
        logger.warning("RunPod job timed out after %ds, cancelling: %s", timeout, runpod_id)
        await self.cancel_job(runpod_id)
        elapsed = time.time() - start
        self.spend.add_spend(elapsed * GPU_COST_PER_SEC_CENTS)
        raise TimeoutError(
            f"Job exceeded {timeout}s limit and was cancelled. "
            f"Cost: ${elapsed * GPU_COST_PER_SEC_CENTS / 100:.2f}"
        )


def is_runpod_configured() -> bool:
    """Check if RunPod credentials are configured."""
    return bool(settings.RUNPOD_API_KEY and settings.RUNPOD_ENDPOINT_ID)
