"""SSO Provider Registry — manages per-org SSO configurations."""

from __future__ import annotations

import logging
from typing import Optional

from app.core.sso.saml import SAMLConfig, SAMLProvider
from app.core.sso.oidc import OIDCConfig, OIDCProvider

logger = logging.getLogger(__name__)


class SSOProviderRegistry:
    """Manages SSO providers for each organization.

    Each organization can have at most one active SSO provider
    (either SAML 2.0 or OIDC).  The registry is kept in-memory;
    for persistence the caller should serialize configs to the DB
    and re-register on startup.
    """

    def __init__(self) -> None:
        self._providers: dict[str, dict] = {}  # org_id -> {"type": str, "provider": ..., "config": ...}

    def register_saml(self, org_id: str, config: SAMLConfig) -> SAMLProvider:
        """Register a SAML 2.0 provider for an organization.

        Replaces any existing provider for the org.

        Returns:
            The newly created SAMLProvider.
        """
        provider = SAMLProvider(config)
        self._providers[org_id] = {
            "type": "saml",
            "provider": provider,
            "config": config,
        }
        logger.info(
            "SSO registered: org=%s type=saml entity_id=%s",
            org_id,
            config.entity_id,
        )
        return provider

    def register_oidc(self, org_id: str, config: OIDCConfig) -> OIDCProvider:
        """Register an OIDC provider for an organization.

        Replaces any existing provider for the org.

        Returns:
            The newly created OIDCProvider.
        """
        provider = OIDCProvider(config)
        self._providers[org_id] = {
            "type": "oidc",
            "provider": provider,
            "config": config,
        }
        logger.info(
            "SSO registered: org=%s type=oidc client_id=%s",
            org_id,
            config.client_id,
        )
        return provider

    def get_provider(self, org_id: str) -> SAMLProvider | OIDCProvider | None:
        """Get the SSO provider for an organization.

        Returns:
            The provider instance, or None if the org has no SSO configured.
        """
        entry = self._providers.get(org_id)
        return entry["provider"] if entry else None

    def get_provider_type(self, org_id: str) -> Optional[str]:
        """Return ``"saml"`` or ``"oidc"`` for the org, or None."""
        entry = self._providers.get(org_id)
        return entry["type"] if entry else None

    def get_config(self, org_id: str) -> SAMLConfig | OIDCConfig | None:
        """Return the raw config object for an org's provider."""
        entry = self._providers.get(org_id)
        return entry["config"] if entry else None

    def remove_provider(self, org_id: str) -> bool:
        """Remove the SSO provider for an organization.

        Returns:
            True if a provider was removed, False if none existed.
        """
        if org_id in self._providers:
            provider_type = self._providers[org_id]["type"]
            del self._providers[org_id]
            logger.info("SSO removed: org=%s type=%s", org_id, provider_type)
            return True
        return False

    def list_providers(self) -> list[dict]:
        """List all registered SSO providers.

        Returns:
            List of dicts with ``org_id``, ``type``, and summary info.
        """
        result: list[dict] = []
        for org_id, entry in self._providers.items():
            info: dict = {
                "org_id": org_id,
                "type": entry["type"],
            }
            config = entry["config"]
            if entry["type"] == "saml":
                info["entity_id"] = config.entity_id
                info["idp_entity_id"] = config.idp_entity_id
            elif entry["type"] == "oidc":
                info["client_id"] = config.client_id
                info["discovery_url"] = config.discovery_url
            result.append(info)
        return result

    def has_provider(self, org_id: str) -> bool:
        """Return True if the organization has an SSO provider configured."""
        return org_id in self._providers


# ── Global registry instance ─────────────────────────────────────────

_registry = SSOProviderRegistry()


def get_sso_registry() -> SSOProviderRegistry:
    """Return the global SSO provider registry."""
    return _registry
