"""Secrets management — Vault integration with environment fallback."""

from .vault import VaultClient, VaultConfig
from .env_fallback import SecretsFallback

__all__ = ["VaultClient", "VaultConfig", "SecretsFallback"]
