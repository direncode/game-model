"""OpenID Connect integration for enterprise SSO.

Uses ``httpx`` for async HTTP and ``python-jose`` (already a project
dependency) for JWT validation.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from urllib.parse import urlencode

import httpx
from jose import jwt as jose_jwt, JWTError

logger = logging.getLogger(__name__)


# ── Data models ──────────────────────────────────────────────────────


@dataclass
class OIDCConfig:
    """Configuration for an OpenID Connect Relying Party."""

    client_id: str
    client_secret: str
    discovery_url: str  # .well-known/openid-configuration
    redirect_uri: str
    scopes: list[str] = field(default_factory=lambda: ["openid", "email", "profile"])


@dataclass
class OIDCUser:
    """User identity extracted from OIDC claims."""

    sub: str  # Subject identifier
    email: str
    name: str = ""
    groups: list[str] = field(default_factory=list)
    claims: dict = field(default_factory=dict)


# ── Provider implementation ──────────────────────────────────────────


class OIDCProvider:
    """OpenID Connect Relying Party.

    Discovers the IDP configuration, builds authorization URLs,
    exchanges codes for tokens, and validates ID tokens.
    """

    def __init__(self, config: OIDCConfig) -> None:
        self._config = config
        self._discovery: dict[str, Any] = {}
        self._jwks: dict[str, Any] = {}
        self._jwks_fetched_at: float = 0
        self._client = httpx.AsyncClient(timeout=15, follow_redirects=True)

    # ── Discovery ────────────────────────────────────────────────

    async def discover(self) -> dict:
        """Fetch the ``.well-known/openid-configuration`` document.

        Caches the result for the lifetime of this provider instance.

        Returns:
            The full OpenID configuration dict.
        """
        if self._discovery:
            return self._discovery

        url = self._config.discovery_url
        if not url.endswith("/.well-known/openid-configuration"):
            url = url.rstrip("/") + "/.well-known/openid-configuration"

        logger.info("OIDC discovery: fetching %s", url)
        resp = await self._client.get(url)
        resp.raise_for_status()
        self._discovery = resp.json()

        required_keys = ["authorization_endpoint", "token_endpoint", "issuer"]
        for key in required_keys:
            if key not in self._discovery:
                raise ValueError(f"OIDC discovery missing required key: {key}")

        logger.info("OIDC discovery complete: issuer=%s", self._discovery.get("issuer"))
        return self._discovery

    # ── Authorization URL ────────────────────────────────────────

    def create_auth_url(self, state: str, nonce: str) -> str:
        """Build the authorization URL for the browser redirect.

        Args:
            state: Opaque value for CSRF protection.
            nonce: Unique value bound to the session for replay protection.

        Returns:
            Full authorization URL.

        Raises:
            RuntimeError: If ``discover()`` has not been called.
        """
        if not self._discovery:
            raise RuntimeError("Call discover() before create_auth_url()")

        auth_endpoint = self._discovery["authorization_endpoint"]
        params = {
            "response_type": "code",
            "client_id": self._config.client_id,
            "redirect_uri": self._config.redirect_uri,
            "scope": " ".join(self._config.scopes),
            "state": state,
            "nonce": nonce,
        }

        url = f"{auth_endpoint}?{urlencode(params)}"
        logger.debug("OIDC auth URL: %s", url)
        return url

    # ── Code exchange ────────────────────────────────────────────

    async def exchange_code(self, code: str, state: str) -> dict:
        """Exchange an authorization code for tokens.

        Args:
            code: The authorization code from the callback.
            state: The state parameter for verification.

        Returns:
            Token response dict containing ``access_token``, ``id_token``, etc.
        """
        if not self._discovery:
            await self.discover()

        token_endpoint = self._discovery["token_endpoint"]

        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self._config.redirect_uri,
            "client_id": self._config.client_id,
            "client_secret": self._config.client_secret,
        }

        logger.info("OIDC code exchange: endpoint=%s", token_endpoint)
        resp = await self._client.post(
            token_endpoint,
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if resp.status_code != 200:
            logger.error("OIDC token exchange failed: %d %s", resp.status_code, resp.text)
            raise ValueError(f"OIDC token exchange failed: {resp.status_code}")

        tokens = resp.json()

        if "error" in tokens:
            raise ValueError(f"OIDC token error: {tokens['error']} — {tokens.get('error_description', '')}")

        logger.info("OIDC code exchange successful")
        return tokens

    # ── User info ────────────────────────────────────────────────

    async def get_user_info(self, access_token: str) -> OIDCUser:
        """Fetch user information from the userinfo endpoint.

        Args:
            access_token: A valid access token.

        Returns:
            OIDCUser with identity claims.
        """
        if not self._discovery:
            await self.discover()

        userinfo_endpoint = self._discovery.get("userinfo_endpoint")
        if not userinfo_endpoint:
            raise ValueError("OIDC provider does not expose a userinfo endpoint")

        resp = await self._client.get(
            userinfo_endpoint,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if resp.status_code != 200:
            logger.error("OIDC userinfo failed: %d", resp.status_code)
            raise ValueError(f"OIDC userinfo request failed: {resp.status_code}")

        claims = resp.json()

        user = OIDCUser(
            sub=claims.get("sub", ""),
            email=claims.get("email", ""),
            name=claims.get("name", claims.get("preferred_username", "")),
            groups=claims.get("groups", []),
            claims=claims,
        )

        logger.info("OIDC userinfo: sub=%s email=%s", user.sub, user.email)
        return user

    # ── ID token validation ──────────────────────────────────────

    async def validate_id_token(self, id_token: str, nonce: str) -> dict:
        """Validate and decode an OIDC ID token.

        Verifies the signature using the IDP's JWKS, checks issuer,
        audience, expiration, and nonce.

        Args:
            id_token: The raw JWT id_token.
            nonce: The nonce used in the authorization request.

        Returns:
            Decoded claims dict.
        """
        if not self._discovery:
            await self.discover()

        # Fetch JWKS
        jwks = await self._fetch_jwks()

        # Decode header to find the key
        headers = jose_jwt.get_unverified_headers(id_token)
        kid = headers.get("kid")
        alg = headers.get("alg", "RS256")

        # Find matching key
        signing_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                signing_key = key
                break

        if signing_key is None:
            # Refresh JWKS and retry
            self._jwks = {}
            jwks = await self._fetch_jwks()
            for key in jwks.get("keys", []):
                if key.get("kid") == kid:
                    signing_key = key
                    break

        if signing_key is None:
            raise ValueError(f"No matching key found in JWKS for kid={kid}")

        # Validate the token
        try:
            claims = jose_jwt.decode(
                id_token,
                signing_key,
                algorithms=[alg],
                audience=self._config.client_id,
                issuer=self._discovery.get("issuer"),
                options={"verify_at_hash": False},
            )
        except JWTError as exc:
            raise ValueError(f"ID token validation failed: {exc}") from exc

        # Verify nonce
        if claims.get("nonce") != nonce:
            raise ValueError("ID token nonce mismatch — possible replay attack")

        logger.info("OIDC ID token validated: sub=%s", claims.get("sub"))
        return claims

    # ── JWKS fetching ────────────────────────────────────────────

    async def _fetch_jwks(self) -> dict:
        """Fetch and cache the IDP's JSON Web Key Set."""
        import time

        now = time.time()
        if self._jwks and (now - self._jwks_fetched_at) < 3600:
            return self._jwks

        jwks_uri = self._discovery.get("jwks_uri")
        if not jwks_uri:
            raise ValueError("OIDC discovery missing jwks_uri")

        resp = await self._client.get(jwks_uri)
        resp.raise_for_status()
        self._jwks = resp.json()
        self._jwks_fetched_at = now

        logger.debug("OIDC JWKS fetched: %d keys", len(self._jwks.get("keys", [])))
        return self._jwks

    # ── Cleanup ──────────────────────────────────────────────────

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()
