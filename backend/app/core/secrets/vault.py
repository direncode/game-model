"""HashiCorp Vault integration for secrets management.

Uses ``httpx`` for async communication with the Vault HTTP API.
Caches secrets locally with a configurable TTL and falls back
gracefully when Vault is unreachable.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)


@dataclass
class VaultConfig:
    """Connection parameters for HashiCorp Vault."""

    url: str = "http://localhost:8200"
    token: str = ""
    mount_path: str = "secret"
    namespace: str = ""
    verify_ssl: bool = True
    timeout: int = 30


class VaultClient:
    """Read secrets from HashiCorp Vault.

    Falls back gracefully when Vault is unavailable.
    Caches secrets with a configurable TTL.
    """

    def __init__(self, config: VaultConfig) -> None:
        self._config = config
        self._cache: dict[str, tuple[str, float]] = {}  # cache_key -> (value, expires_at)
        self._cache_ttl: int = 300  # 5 minutes
        self._available: bool = False
        self._client: httpx.AsyncClient | None = None

    # ── Lifecycle ────────────────────────────────────────────────

    def _get_client(self) -> httpx.AsyncClient:
        """Lazily create the HTTP client."""
        if self._client is None:
            headers: dict[str, str] = {}
            if self._config.token:
                headers["X-Vault-Token"] = self._config.token
            if self._config.namespace:
                headers["X-Vault-Namespace"] = self._config.namespace
            self._client = httpx.AsyncClient(
                base_url=self._config.url.rstrip("/"),
                headers=headers,
                verify=self._config.verify_ssl,
                timeout=self._config.timeout,
            )
        return self._client

    async def initialize(self) -> bool:
        """Test Vault connectivity.

        Returns:
            True if Vault is reachable and authenticated.
        """
        try:
            client = self._get_client()
            resp = await client.get("/v1/sys/health")
            if resp.status_code in (200, 429, 472, 473):
                self._available = True
                logger.info("Vault connected: %s (status %d)", self._config.url, resp.status_code)
            else:
                self._available = False
                logger.warning("Vault health check returned %d", resp.status_code)
        except Exception as exc:
            self._available = False
            logger.warning("Vault unavailable: %s — secrets will use fallback", exc)
        return self._available

    @property
    def is_available(self) -> bool:
        return self._available

    # ── CRUD operations ──────────────────────────────────────────

    async def get_secret(self, path: str, key: str, default: str = "") -> str:
        """Get a secret value from Vault.

        Checks the local cache first, then queries Vault.  Falls back
        to *default* if Vault is unavailable.

        Args:
            path: Secret path under the mount (e.g. ``"app/database"``).
            key: The key within the secret data.
            default: Fallback value if the secret is not found or Vault is down.
        """
        cache_key = f"{path}:{key}"

        # Check cache
        if cache_key in self._cache:
            value, expires_at = self._cache[cache_key]
            if time.time() < expires_at:
                return value
            else:
                del self._cache[cache_key]

        if not self._available:
            logger.debug("Vault unavailable — returning default for %s/%s", path, key)
            return default

        try:
            client = self._get_client()
            mount = self._config.mount_path
            # KV v2 endpoint
            resp = await client.get(f"/v1/{mount}/data/{path}")

            if resp.status_code == 200:
                data = resp.json()
                secret_data = data.get("data", {}).get("data", {})
                value = secret_data.get(key, default)
                # Cache it
                self._cache[cache_key] = (value, time.time() + self._cache_ttl)
                return value
            elif resp.status_code == 404:
                logger.debug("Secret not found: %s/%s", path, key)
                return default
            else:
                logger.warning("Vault GET %s returned %d", path, resp.status_code)
                return default

        except Exception as exc:
            logger.warning("Vault read error for %s/%s: %s", path, key, exc)
            self._available = False
            return default

    async def set_secret(self, path: str, key: str, value: str) -> None:
        """Store a secret value in Vault (KV v2).

        Args:
            path: Secret path under the mount.
            key: The key to set.
            value: The secret value.

        Raises:
            RuntimeError: If Vault is unavailable.
        """
        if not self._available:
            raise RuntimeError("Vault is not available — cannot write secrets")

        try:
            client = self._get_client()
            mount = self._config.mount_path

            # Read existing data first (KV v2 stores full object)
            existing: dict = {}
            resp = await client.get(f"/v1/{mount}/data/{path}")
            if resp.status_code == 200:
                existing = resp.json().get("data", {}).get("data", {})

            existing[key] = value

            resp = await client.post(
                f"/v1/{mount}/data/{path}",
                json={"data": existing},
            )

            if resp.status_code not in (200, 204):
                raise RuntimeError(f"Vault write failed: {resp.status_code} {resp.text}")

            # Update cache
            cache_key = f"{path}:{key}"
            self._cache[cache_key] = (value, time.time() + self._cache_ttl)

            logger.info("Secret stored: %s/%s", path, key)

        except httpx.HTTPError as exc:
            logger.error("Vault write error: %s", exc)
            raise RuntimeError(f"Vault write failed: {exc}") from exc

    async def delete_secret(self, path: str, key: str) -> None:
        """Delete a secret key from Vault.

        If *key* is the last key at *path*, the entire secret is deleted.

        Args:
            path: Secret path under the mount.
            key: The key to remove.
        """
        if not self._available:
            raise RuntimeError("Vault is not available — cannot delete secrets")

        try:
            client = self._get_client()
            mount = self._config.mount_path

            # Read current data
            resp = await client.get(f"/v1/{mount}/data/{path}")
            if resp.status_code != 200:
                logger.debug("Secret path %s not found, nothing to delete", path)
                return

            existing = resp.json().get("data", {}).get("data", {})
            if key in existing:
                del existing[key]

            if existing:
                # Write back without the key
                await client.post(
                    f"/v1/{mount}/data/{path}",
                    json={"data": existing},
                )
            else:
                # Delete the entire secret (metadata destroy)
                await client.delete(f"/v1/{mount}/metadata/{path}")

            # Evict cache
            cache_key = f"{path}:{key}"
            self._cache.pop(cache_key, None)

            logger.info("Secret deleted: %s/%s", path, key)

        except httpx.HTTPError as exc:
            logger.error("Vault delete error: %s", exc)
            raise RuntimeError(f"Vault delete failed: {exc}") from exc

    async def list_secrets(self, path: str) -> list[str]:
        """List secret keys at a path.

        Args:
            path: Secret path under the mount.

        Returns:
            List of key names.
        """
        if not self._available:
            return []

        try:
            client = self._get_client()
            mount = self._config.mount_path

            resp = await client.request("LIST", f"/v1/{mount}/metadata/{path}")

            if resp.status_code == 200:
                data = resp.json()
                return data.get("data", {}).get("keys", [])
            elif resp.status_code == 404:
                return []
            else:
                logger.warning("Vault LIST %s returned %d", path, resp.status_code)
                return []

        except Exception as exc:
            logger.warning("Vault list error for %s: %s", path, exc)
            return []

    # ── Cache management ─────────────────────────────────────────

    def clear_cache(self) -> None:
        """Clear the local secret cache."""
        count = len(self._cache)
        self._cache.clear()
        logger.info("Vault cache cleared (%d entries)", count)

    def set_cache_ttl(self, ttl_seconds: int) -> None:
        """Set the cache TTL in seconds."""
        self._cache_ttl = max(0, ttl_seconds)

    # ── Cleanup ──────────────────────────────────────────────────

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
