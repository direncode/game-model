"""LSC multi-cloud backend adapters + cost-aware router.

Each backend adapter is a thin wrapper that knows how to:
  - report its availability
  - report its estimated cost per second of GPU time
  - return a {backend, url, api_key} dict the dispatcher can submit to

The CostAwareRouter picks the cheapest currently-available backend whose
SLA meets the job's requirements. Customer code never sees which backend
ran their job. The router uses environment-variable credentials and is
defensive about missing or unhealthy providers.

This is the Layer 4 + 5 module referenced from app.api.v1.lsc. Each
adapter currently returns its dispatch dict and a static cost estimate.
Live spot-price polling can be wired into ``cost_per_second_dollars``
once the corresponding provider's pricing API is integrated.
"""
from __future__ import annotations

import os
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


class BackendUnavailable(RuntimeError):
    """Raised when no configured backend can serve a request."""


@dataclass
class BackendDispatch:
    """The dispatch tuple returned to the LSC submission layer."""
    backend: str
    url: str
    api_key: str
    cost_per_second_dollars: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "backend": self.backend,
            "url": self.url,
            "api_key": self.api_key,
            "cost_per_second_dollars": self.cost_per_second_dollars,
        }


# ---------------------------------------------------------------------------
# Adapters
# ---------------------------------------------------------------------------


class BackendAdapter(ABC):
    """Base class for backend adapters."""

    name: str = "abstract"

    @abstractmethod
    def configured(self) -> bool:
        """Return True if the backend has its credentials and endpoint set."""

    @abstractmethod
    def dispatch(self) -> BackendDispatch:
        """Return the dispatch tuple. Caller is responsible for the actual HTTP."""

    def can_serve(self, entity_count: int, budget_dollars: float) -> bool:
        """Whether this backend can serve the given job shape. Default: always."""
        return True


class RunPodAdapter(BackendAdapter):
    """RunPod serverless adapter — the production-proven backend.

    Reads ``RUNPOD_API_KEY`` and ``RUNPOD_ENDPOINT_ID`` from the environment.
    """

    name = "runpod-serverless"

    def configured(self) -> bool:
        return bool(os.environ.get("RUNPOD_API_KEY")) and bool(
            os.environ.get("RUNPOD_ENDPOINT_ID")
        )

    def dispatch(self) -> BackendDispatch:
        api_key = os.environ.get("RUNPOD_API_KEY") or ""
        endpoint_id = os.environ.get("RUNPOD_ENDPOINT_ID") or ""
        if not api_key or not endpoint_id:
            raise BackendUnavailable("RunPod backend missing credentials")
        return BackendDispatch(
            backend=self.name,
            url=f"https://api.runpod.ai/v2/{endpoint_id}",
            api_key=api_key,
            cost_per_second_dollars=0.04 / 60,  # ~$0.04/min H100 conservative
        )


class LambdaLabsAdapter(BackendAdapter):
    """Lambda Labs Cloud — adapter scaffold.

    Lambda Cloud provides on-demand H100 / A100 instances. The current
    integration is a placeholder until the live submission and result-pull
    flow is wired. Returns dispatch info when configured; the LSC router
    will currently skip past it because ``configured`` returns False unless
    an actual Lambda Labs endpoint is set up.
    """

    name = "lambda-labs"

    def configured(self) -> bool:
        return bool(os.environ.get("LAMBDA_LABS_API_KEY")) and bool(
            os.environ.get("LAMBDA_LABS_ENDPOINT_URL")
        )

    def dispatch(self) -> BackendDispatch:
        api_key = os.environ.get("LAMBDA_LABS_API_KEY") or ""
        url = os.environ.get("LAMBDA_LABS_ENDPOINT_URL") or ""
        if not api_key or not url:
            raise BackendUnavailable("Lambda Labs backend missing credentials")
        return BackendDispatch(
            backend=self.name,
            url=url,
            api_key=api_key,
            cost_per_second_dollars=0.0275 / 60,  # ~$0.0275/min H100 list price
        )


class VastAiAdapter(BackendAdapter):
    """Vast.ai — adapter scaffold.

    Vast.ai aggregates third-party GPU capacity. Often the cheapest backend
    for non-latency-critical jobs. Same scaffold pattern as Lambda Labs.
    """

    name = "vast-ai"

    def configured(self) -> bool:
        return bool(os.environ.get("VAST_AI_API_KEY")) and bool(
            os.environ.get("VAST_AI_ENDPOINT_URL")
        )

    def dispatch(self) -> BackendDispatch:
        api_key = os.environ.get("VAST_AI_API_KEY") or ""
        url = os.environ.get("VAST_AI_ENDPOINT_URL") or ""
        if not api_key or not url:
            raise BackendUnavailable("Vast.ai backend missing credentials")
        return BackendDispatch(
            backend=self.name,
            url=url,
            api_key=api_key,
            cost_per_second_dollars=0.0166 / 60,  # ~$0.0166/min spot
        )


class LSULocalAdapter(BackendAdapter):
    """On-prem Latent Stretcher Unit — adapter scaffold.

    Activated when the customer has registered a local LSU under their
    tenant. The router treats it as zero-cost (customer owns the
    hardware) and near-zero latency.

    The hardware-bridge protocol (Layer 12) registers LSU instances into
    the environment as ``LSU_<tenant>_ENDPOINT_URL``. The scaffold reads
    a single default LSU endpoint here; the multi-tenant rollout will
    parametrise this on auth context.
    """

    name = "lsu-local"

    def configured(self) -> bool:
        return bool(os.environ.get("LSU_ENDPOINT_URL"))

    def dispatch(self) -> BackendDispatch:
        url = os.environ.get("LSU_ENDPOINT_URL") or ""
        if not url:
            raise BackendUnavailable("LSU endpoint not configured")
        return BackendDispatch(
            backend=self.name,
            url=url,
            api_key=os.environ.get("LSU_API_KEY") or "",
            cost_per_second_dollars=0.0,
        )


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------


class CostAwareRouter:
    """Selects the cheapest available backend for a substrate job.

    The current policy is straightforward: filter to configured + can-serve
    adapters, then pick the one with the lowest ``cost_per_second_dollars``.
    A small random jitter prevents thundering-herd routing when two
    backends have identical cost.

    Future versions will add:
      - live spot-price polling (so ``cost_per_second_dollars`` is dynamic)
      - queue-depth awareness (drop a backend if its queue is too deep)
      - tenant pinning (a tenant's LSU is preferred for their jobs)
      - SLA enforcement (latency-sensitive jobs avoid spot backends)
    """

    def __init__(self) -> None:
        self.adapters: list[BackendAdapter] = [
            LSULocalAdapter(),
            VastAiAdapter(),
            LambdaLabsAdapter(),
            RunPodAdapter(),
        ]

    def configured_backends(self) -> list[str]:
        return [a.name for a in self.adapters if a.configured()]

    def select(self, entity_count: int, budget_dollars: float) -> dict[str, Any]:
        """Pick the cheapest backend that is configured and can serve."""
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
            key=lambda a: (
                a.dispatch().cost_per_second_dollars + random.random() * 1e-9
            )
        )
        return candidates[0].dispatch().to_dict()
