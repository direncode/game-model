"""Latent Ocean API client."""

from __future__ import annotations

import httpx
from typing import Any

from .auth import APIKeyAuth
from .exceptions import (
    AuthenticationError,
    LatentOceanError,
    NotFoundError,
    RateLimitError,
    ServerError,
    ValidationError,
)
from .types import (
    ExportResult,
    QueryResult,
    ReduceResult,
    StatusResult,
    SurvivorList,
)


class Client:
    """Latent Ocean API client.

    Usage::

        import latentocean as lo

        client = lo.Client(api_key="lo_sk_...", base_url="https://api.acme.latentocean.io")
        result = client.reduce(limit=50000)
        survivors = client.query("companies with revenue anomalies")
    """

    DEFAULT_BASE_URL = "https://api.latentocean.io"
    DEFAULT_TIMEOUT = 300

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        self._auth = APIKeyAuth(api_key)
        self._base_url = base_url.rstrip("/")
        self._client = httpx.Client(
            base_url=self._base_url,
            headers=self._auth.headers(),
            timeout=timeout,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _handle_response(self, resp: httpx.Response) -> dict:
        """Check status and raise appropriate SDK exceptions."""
        if resp.status_code == 401:
            raise AuthenticationError("Invalid or expired API key", status_code=401)
        if resp.status_code == 404:
            raise NotFoundError("Resource not found", status_code=404)
        if resp.status_code == 422:
            body = resp.json() if resp.content else {}
            raise ValidationError("Validation error", status_code=422, body=body)
        if resp.status_code == 429:
            retry = resp.headers.get("Retry-After")
            raise RateLimitError(
                retry_after=float(retry) if retry else None,
                status_code=429,
            )
        if resp.status_code >= 500:
            raise ServerError(f"Server error: {resp.status_code}", status_code=resp.status_code)
        if resp.status_code >= 400:
            raise LatentOceanError(f"HTTP {resp.status_code}", status_code=resp.status_code)

        return resp.json() if resp.content else {}

    def _get(self, path: str, params: dict | None = None) -> dict:
        resp = self._client.get(path, params=params)
        return self._handle_response(resp)

    def _post(self, path: str, json: dict | None = None) -> dict:
        resp = self._client.post(path, json=json)
        return self._handle_response(resp)

    # ------------------------------------------------------------------
    # Reduction
    # ------------------------------------------------------------------

    def reduce(
        self,
        limit: int = 10_000,
        budget: float = 50.0,
        profile: str = "standard",
    ) -> ReduceResult:
        """Start a reduction job.

        Args:
            limit: Maximum entity count to ingest.
            budget: Dollar budget for the reduction.
            profile: Reduction profile (standard, fast, thorough).
        """
        data = self._post("/api/v1/btut/reduce", json={
            "limit": limit,
            "budget": budget,
            "profile": profile,
        })
        return ReduceResult(
            job_id=data.get("job_id", ""),
            status=data.get("status", ""),
            entity_count=data.get("entity_count", 0),
            survivor_count=data.get("survivor_count", 0),
            reduction_ratio=data.get("reduction_ratio", 0),
            wall_seconds=data.get("wall_seconds", 0.0),
            cost_usd=data.get("cost_usd", 0.0),
        )

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    def query(self, question: str, limit: int = 20) -> QueryResult:
        """Query survivors using natural language.

        Args:
            question: Natural-language question.
            limit: Max results to return.
        """
        data = self._post("/api/v1/query", json={
            "question": question,
            "limit": limit,
        })
        return QueryResult(
            survivors=data.get("survivors", []),
            connections=data.get("connections", []),
            narratives=data.get("narratives", []),
            total_matches=data.get("total_matches", 0),
        )

    # ------------------------------------------------------------------
    # Survivors
    # ------------------------------------------------------------------

    def survivors(
        self,
        sort_by: str = "composite_score",
        limit: int = 100,
        page: int = 1,
    ) -> SurvivorList:
        """List survivors with pagination.

        Args:
            sort_by: Field to sort by.
            limit: Results per page.
            page: Page number (1-indexed).
        """
        data = self._get("/api/v1/btut/survivors", params={
            "sort_by": sort_by,
            "per_page": limit,
            "page": page,
        })
        return SurvivorList(
            survivors=data.get("survivors", data.get("items", [])),
            total=data.get("total", 0),
            page=data.get("page", page),
            per_page=data.get("per_page", limit),
        )

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    def status(self) -> StatusResult:
        """Get current fork status and health."""
        data = self._get("/api/v1/status")
        return StatusResult(
            fork_id=data.get("fork_id", ""),
            status=data.get("status", "unknown"),
            entity_count=data.get("entity_count", 0),
            last_reduction_at=data.get("last_reduction_at", ""),
            enabled_modules=data.get("enabled_modules", []),
            health=data.get("health", {}),
        )

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------

    def export(self, format: str = "csv", path: str | None = None) -> ExportResult:
        """Export survivors to a file.

        Args:
            format: Export format (csv, json, parquet).
            path: Local path to write the file (server-side if None).
        """
        data = self._post("/api/v1/btut/export", json={
            "format": format,
            "path": path,
        })
        return ExportResult(
            format=data.get("format", format),
            path=data.get("path"),
            size_bytes=data.get("size_bytes", 0),
            row_count=data.get("row_count", 0),
        )

    # ------------------------------------------------------------------
    # Modules
    # ------------------------------------------------------------------

    def modules(self) -> list[dict]:
        """List all available modules."""
        return self._get("/api/v1/modules/")

    def enable_module(self, module_id: str) -> dict:
        """Enable a module for the current fork."""
        return self._post(f"/api/v1/modules/{module_id}/enable")

    def disable_module(self, module_id: str) -> dict:
        """Disable a module for the current fork."""
        return self._post(f"/api/v1/modules/{module_id}/disable")

    # ------------------------------------------------------------------
    # Async variant
    # ------------------------------------------------------------------

    @classmethod
    def async_client(
        cls,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> "AsyncClient":
        """Create an async version of the client."""
        return AsyncClient(api_key=api_key, base_url=base_url, timeout=timeout)

    # ------------------------------------------------------------------
    # Context manager
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._client.close()

    def __enter__(self) -> "Client":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()


class AsyncClient:
    """Async variant of the Latent Ocean API client.

    Usage::

        import latentocean as lo

        async with lo.Client.async_client(api_key="lo_sk_...") as client:
            result = await client.reduce(limit=50000)
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = Client.DEFAULT_BASE_URL,
        timeout: float = Client.DEFAULT_TIMEOUT,
    ) -> None:
        self._auth = APIKeyAuth(api_key)
        self._base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers=self._auth.headers(),
            timeout=timeout,
        )

    async def _handle_response(self, resp: httpx.Response) -> dict:
        if resp.status_code == 401:
            raise AuthenticationError("Invalid or expired API key", status_code=401)
        if resp.status_code == 404:
            raise NotFoundError("Resource not found", status_code=404)
        if resp.status_code == 422:
            body = resp.json() if resp.content else {}
            raise ValidationError("Validation error", status_code=422, body=body)
        if resp.status_code == 429:
            retry = resp.headers.get("Retry-After")
            raise RateLimitError(
                retry_after=float(retry) if retry else None,
                status_code=429,
            )
        if resp.status_code >= 500:
            raise ServerError(f"Server error: {resp.status_code}", status_code=resp.status_code)
        if resp.status_code >= 400:
            raise LatentOceanError(f"HTTP {resp.status_code}", status_code=resp.status_code)
        return resp.json() if resp.content else {}

    async def _get(self, path: str, params: dict | None = None) -> dict:
        resp = await self._client.get(path, params=params)
        return await self._handle_response(resp)

    async def _post(self, path: str, json: dict | None = None) -> dict:
        resp = await self._client.post(path, json=json)
        return await self._handle_response(resp)

    async def reduce(self, limit: int = 10_000, budget: float = 50.0, profile: str = "standard") -> ReduceResult:
        data = await self._post("/api/v1/btut/reduce", json={"limit": limit, "budget": budget, "profile": profile})
        return ReduceResult(
            job_id=data.get("job_id", ""), status=data.get("status", ""),
            entity_count=data.get("entity_count", 0), survivor_count=data.get("survivor_count", 0),
            reduction_ratio=data.get("reduction_ratio", 0), wall_seconds=data.get("wall_seconds", 0.0),
            cost_usd=data.get("cost_usd", 0.0),
        )

    async def query(self, question: str, limit: int = 20) -> QueryResult:
        data = await self._post("/api/v1/query", json={"question": question, "limit": limit})
        return QueryResult(
            survivors=data.get("survivors", []), connections=data.get("connections", []),
            narratives=data.get("narratives", []), total_matches=data.get("total_matches", 0),
        )

    async def survivors(self, sort_by: str = "composite_score", limit: int = 100, page: int = 1) -> SurvivorList:
        data = await self._get("/api/v1/btut/survivors", params={"sort_by": sort_by, "per_page": limit, "page": page})
        return SurvivorList(
            survivors=data.get("survivors", data.get("items", [])),
            total=data.get("total", 0), page=data.get("page", page), per_page=data.get("per_page", limit),
        )

    async def status(self) -> StatusResult:
        data = await self._get("/api/v1/status")
        return StatusResult(
            fork_id=data.get("fork_id", ""), status=data.get("status", "unknown"),
            entity_count=data.get("entity_count", 0), last_reduction_at=data.get("last_reduction_at", ""),
            enabled_modules=data.get("enabled_modules", []), health=data.get("health", {}),
        )

    async def export(self, format: str = "csv", path: str | None = None) -> ExportResult:
        data = await self._post("/api/v1/btut/export", json={"format": format, "path": path})
        return ExportResult(
            format=data.get("format", format), path=data.get("path"),
            size_bytes=data.get("size_bytes", 0), row_count=data.get("row_count", 0),
        )

    async def modules(self) -> list[dict]:
        return await self._get("/api/v1/modules/")

    async def enable_module(self, module_id: str) -> dict:
        return await self._post(f"/api/v1/modules/{module_id}/enable")

    async def disable_module(self, module_id: str) -> dict:
        return await self._post(f"/api/v1/modules/{module_id}/disable")

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "AsyncClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()
