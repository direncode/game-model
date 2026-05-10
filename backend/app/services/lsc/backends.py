"""LSC multi-cloud backend adapters + cost-aware router.

Each backend adapter is a self-contained protocol implementation:
  - reports availability via ``configured()``
  - reports cost-per-second via ``cost_per_second_dollars()``
  - takes a uniform job payload via ``async submit_and_wait(payload)``
    and returns a uniform raw response dict (the LSC submit layer
    handles dispersion measurement, regime-card check, persistence,
    and metering on top).

The CostAwareRouter picks the cheapest currently-configured backend.
This module is intentionally self-contained: each adapter encodes its
own provider's submission protocol so adding a fourth or fifth provider
is a pure-additive change.
"""
from __future__ import annotations

import asyncio
import os
import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import httpx


class BackendUnavailable(RuntimeError):
    """Raised when no configured backend can serve a request."""


class BackendNotImplemented(RuntimeError):
    """Raised when an adapter is configured but its protocol is not yet wired."""


@dataclass
class BackendDispatch:
    """Lightweight description used by the router for selection."""
    backend: str
    cost_per_second_dollars: float

    def to_dict(self) -> dict[str, Any]:
        return {"backend": self.backend, "cost_per_second_dollars": self.cost_per_second_dollars}


# ---------------------------------------------------------------------------
# Adapter base
# ---------------------------------------------------------------------------


class BackendAdapter(ABC):
    """Base class for backend adapters.

    Subclasses implement ``configured()``, ``cost_per_second_dollars()``,
    and ``submit_and_wait(payload, ...)``. The submission protocol is
    fully encapsulated in the adapter so the LSC submit layer is
    provider-agnostic.
    """

    name: str = "abstract"

    @abstractmethod
    def configured(self) -> bool: ...

    @abstractmethod
    def cost_per_second_dollars(self) -> float: ...

    @abstractmethod
    async def submit_and_wait(
        self,
        payload: dict[str, Any],
        per_job_timeout_seconds: float = 600,
    ) -> dict[str, Any]: ...

    def can_serve(self, entity_count: int, budget_dollars: float) -> bool:
        return True


# ---------------------------------------------------------------------------
# RunPod serverless — production-proven
# ---------------------------------------------------------------------------


class RunPodAdapter(BackendAdapter):
    """RunPod serverless adapter. Reads ``RUNPOD_API_KEY`` + ``RUNPOD_ENDPOINT_ID``."""

    name = "runpod-serverless"

    def configured(self) -> bool:
        return bool(os.environ.get("RUNPOD_API_KEY")) and bool(os.environ.get("RUNPOD_ENDPOINT_ID"))

    def cost_per_second_dollars(self) -> float:
        return 0.04 / 60  # ~$0.04/min H100 conservative

    async def submit_and_wait(
        self,
        payload: dict[str, Any],
        per_job_timeout_seconds: float = 600,
    ) -> dict[str, Any]:
        api_key = os.environ.get("RUNPOD_API_KEY") or ""
        endpoint_id = os.environ.get("RUNPOD_ENDPOINT_ID") or ""
        if not api_key or not endpoint_id:
            raise BackendUnavailable("RunPod backend missing credentials")
        url = f"https://api.runpod.ai/v2/{endpoint_id}"
        headers = {"Authorization": f"Bearer {api_key}"}
        t0 = time.time()
        async with httpx.AsyncClient(timeout=per_job_timeout_seconds) as client:
            sub = await client.post(f"{url}/run", headers=headers, json=payload)
            if sub.status_code != 200:
                raise BackendUnavailable(f"runpod submit failed: HTTP {sub.status_code}")
            data = sub.json()
            runpod_id = data.get("id")
            if not runpod_id:
                raise BackendUnavailable("runpod returned no job id")
            while True:
                if time.time() - t0 > per_job_timeout_seconds:
                    try:
                        await client.post(f"{url}/cancel/{runpod_id}", headers=headers, json={})
                    except Exception:
                        pass
                    raise BackendUnavailable("runpod per-job timeout")
                status = await client.get(f"{url}/status/{runpod_id}", headers=headers)
                if status.status_code != 200:
                    await asyncio.sleep(2)
                    continue
                body = status.json()
                if body.get("status") in ("COMPLETED", "FAILED", "CANCELLED"):
                    body["_lsc_backend"] = self.name
                    return body
                await asyncio.sleep(2)


# ---------------------------------------------------------------------------
# Generic HTTP-RunPod-shape adapter — for second RunPod accounts, OpenRouter-
# style aggregators, or custom self-hosted serverless that mirrors the
# RunPod API shape.
# ---------------------------------------------------------------------------


class GenericRunPodShapeAdapter(BackendAdapter):
    """Adapter for any endpoint that speaks the RunPod /run /status /cancel
    protocol. Configured via ``LSC_GENERIC_<NAME>_URL`` + ``LSC_GENERIC_<NAME>_KEY``.
    """

    name = "generic-runpod-shape"

    def configured(self) -> bool:
        return bool(os.environ.get("LSC_GENERIC_URL")) and bool(os.environ.get("LSC_GENERIC_KEY"))

    def cost_per_second_dollars(self) -> float:
        try:
            return float(os.environ.get("LSC_GENERIC_COST_PER_SEC", "0.0005"))
        except Exception:
            return 0.0005

    async def submit_and_wait(
        self,
        payload: dict[str, Any],
        per_job_timeout_seconds: float = 600,
    ) -> dict[str, Any]:
        url = os.environ.get("LSC_GENERIC_URL") or ""
        api_key = os.environ.get("LSC_GENERIC_KEY") or ""
        if not url or not api_key:
            raise BackendUnavailable("generic-runpod-shape backend not configured")
        headers = {"Authorization": f"Bearer {api_key}"}
        t0 = time.time()
        async with httpx.AsyncClient(timeout=per_job_timeout_seconds) as client:
            sub = await client.post(f"{url}/run", headers=headers, json=payload)
            if sub.status_code != 200:
                raise BackendUnavailable(f"generic submit failed: HTTP {sub.status_code}")
            data = sub.json()
            job_id = data.get("id")
            if not job_id:
                raise BackendUnavailable("generic backend returned no job id")
            while True:
                if time.time() - t0 > per_job_timeout_seconds:
                    raise BackendUnavailable("generic backend per-job timeout")
                status = await client.get(f"{url}/status/{job_id}", headers=headers)
                if status.status_code != 200:
                    await asyncio.sleep(2)
                    continue
                body = status.json()
                if body.get("status") in ("COMPLETED", "FAILED", "CANCELLED"):
                    body["_lsc_backend"] = self.name
                    return body
                await asyncio.sleep(2)


# ---------------------------------------------------------------------------
# Lambda Labs Cloud — pod-style backend, scaffold
# ---------------------------------------------------------------------------


class LambdaLabsAdapter(BackendAdapter):
    """Lambda Labs on-demand H100 / A100 instance adapter.

    Lambda Cloud uses an instance-provisioning protocol distinct from
    serverless: spin up an instance, SSH (or HTTPS) submit, teardown.
    The full implementation lives behind ``LSC_LAMBDA_LABS_URL`` and
    speaks a pod-management API. The scaffold here returns
    ``BackendNotImplemented`` until the live integration ships.
    """

    name = "lambda-labs"

    def configured(self) -> bool:
        return bool(os.environ.get("LAMBDA_LABS_API_KEY")) and bool(
            os.environ.get("LAMBDA_LABS_ENDPOINT_URL")
        )

    def cost_per_second_dollars(self) -> float:
        return 0.0275 / 60  # ~$0.0275/min H100 list price

    async def submit_and_wait(
        self,
        payload: dict[str, Any],
        per_job_timeout_seconds: float = 600,
    ) -> dict[str, Any]:
        raise BackendNotImplemented(
            "Lambda Labs submission protocol not yet wired; remove "
            "LAMBDA_LABS_API_KEY to disable this adapter"
        )


# ---------------------------------------------------------------------------
# Vast.ai — same protocol gap as Lambda Labs; scaffold
# ---------------------------------------------------------------------------


class VastAiAdapter(BackendAdapter):
    """Vast.ai aggregator adapter — scaffold. Vast.ai requires
    bidding + instance-claim flow; ship when the bid-aware scheduler lands.
    """

    name = "vast-ai"

    def configured(self) -> bool:
        return bool(os.environ.get("VAST_AI_API_KEY")) and bool(
            os.environ.get("VAST_AI_ENDPOINT_URL")
        )

    def cost_per_second_dollars(self) -> float:
        return 0.0166 / 60  # ~$0.0166/min spot

    async def submit_and_wait(
        self,
        payload: dict[str, Any],
        per_job_timeout_seconds: float = 600,
    ) -> dict[str, Any]:
        raise BackendNotImplemented(
            "Vast.ai submission protocol not yet wired; remove VAST_AI_API_KEY to disable"
        )


# ---------------------------------------------------------------------------
# On-prem LSU — registers with the control plane and accepts jobs at its
# own endpoint. The endpoint speaks the RunPod-shape protocol so the
# generic adapter loop applies.
# ---------------------------------------------------------------------------


class LSULocalAdapter(BackendAdapter):
    """On-prem Latent Stretcher Unit. Reads ``LSU_ENDPOINT_URL`` for the
    single-tenant rollout; the multi-tenant rollout reads from the LSU
    registry keyed on the authenticated request's org.
    """

    name = "lsu-local"

    def configured(self) -> bool:
        return bool(os.environ.get("LSU_ENDPOINT_URL"))

    def cost_per_second_dollars(self) -> float:
        return 0.0  # customer owns the hardware

    async def submit_and_wait(
        self,
        payload: dict[str, Any],
        per_job_timeout_seconds: float = 600,
    ) -> dict[str, Any]:
        url = os.environ.get("LSU_ENDPOINT_URL") or ""
        api_key = os.environ.get("LSU_API_KEY") or ""
        if not url:
            raise BackendUnavailable("LSU endpoint not configured")
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        t0 = time.time()
        async with httpx.AsyncClient(timeout=per_job_timeout_seconds) as client:
            sub = await client.post(f"{url}/run", headers=headers, json=payload)
            if sub.status_code != 200:
                raise BackendUnavailable(f"LSU submit failed: HTTP {sub.status_code}")
            data = sub.json()
            job_id = data.get("id")
            if not job_id:
                # LSUs may return the result synchronously for small jobs
                if "output" in data:
                    data["_lsc_backend"] = self.name
                    data.setdefault("status", "COMPLETED")
                    return data
                raise BackendUnavailable("LSU returned no job id or output")
            while True:
                if time.time() - t0 > per_job_timeout_seconds:
                    raise BackendUnavailable("LSU per-job timeout")
                status = await client.get(f"{url}/status/{job_id}", headers=headers)
                if status.status_code != 200:
                    await asyncio.sleep(2)
                    continue
                body = status.json()
                if body.get("status") in ("COMPLETED", "FAILED", "CANCELLED"):
                    body["_lsc_backend"] = self.name
                    return body
                await asyncio.sleep(2)


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------


class CostAwareRouter:
    """Selects the cheapest available backend for a substrate job."""

    def __init__(self) -> None:
        self.adapters: list[BackendAdapter] = [
            LSULocalAdapter(),
            VastAiAdapter(),
            LambdaLabsAdapter(),
            GenericRunPodShapeAdapter(),
            RunPodAdapter(),
        ]

    def configured_backends(self) -> list[str]:
        return [a.name for a in self.adapters if a.configured()]

    def select_adapter(self, entity_count: int, budget_dollars: float) -> BackendAdapter:
        """Return the cheapest configured + can-serve adapter."""
        candidates: list[BackendAdapter] = []
        for adapter in self.adapters:
            try:
                if adapter.configured() and adapter.can_serve(entity_count, budget_dollars):
                    candidates.append(adapter)
            except Exception:
                continue
        if not candidates:
            raise BackendUnavailable(
                "no LSC backend is configured; set RUNPOD_API_KEY + RUNPOD_ENDPOINT_ID "
                "or another provider's credentials"
            )
        candidates.sort(
            key=lambda a: (a.cost_per_second_dollars() + random.random() * 1e-9)
        )
        return candidates[0]

    def select(self, entity_count: int, budget_dollars: float) -> dict[str, Any]:
        """Back-compat select() returning a dict description.

        Prefer ``select_adapter`` which returns the live adapter object.
        """
        adapter = self.select_adapter(entity_count, budget_dollars)
        return {
            "backend": adapter.name,
            "cost_per_second_dollars": adapter.cost_per_second_dollars(),
        }
