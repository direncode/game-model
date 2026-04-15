"""Control plane configuration.

Manages settings for the Latent Ocean control plane — the central
service that provisions, monitors, and orchestrates customer fork
instances. Uses pydantic-settings for environment variable binding.
"""
from __future__ import annotations

from pydantic_settings import BaseSettings


class ControlPlaneSettings(BaseSettings):
    """Control plane configuration, loaded from environment variables.

    All settings can be overridden via env vars with the same name
    (case-insensitive). For example:
        export DATABASE_URL=postgresql+asyncpg://...
        export MAX_FORKS_PER_CUSTOMER=10
    """

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://localhost/latentocean_control"
    REDIS_URL: str = "redis://localhost:6379/1"

    # Domain and routing
    DOMAIN: str = "latentocean.io"
    API_BASE_URL: str = "https://api.latentocean.io"

    # Docker / container orchestration
    DOCKER_REGISTRY: str = "ghcr.io/latentocean"
    FORK_IMAGE: str = "latentocean/fork:latest"
    DOCKER_NETWORK: str = "latentocean_net"

    # Fork limits
    MAX_FORKS_PER_CUSTOMER: int = 5
    DEFAULT_ENGINE_BUDGET: float = 50.0
    DEFAULT_TARGET_SURVIVORS: int = 300

    # Billing
    STRIPE_API_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # Security
    ENCRYPTION_KEY: str = ""  # Fernet key for encrypting customer DSNs
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 60

    # Health monitoring
    HEALTH_CHECK_INTERVAL_SECONDS: int = 60
    FORK_STARTUP_TIMEOUT_SECONDS: int = 120
    FORK_TEARDOWN_TIMEOUT_SECONDS: int = 60

    # Metering
    METERING_FLUSH_INTERVAL_SECONDS: int = 30
    USAGE_RETENTION_DAYS: int = 90

    model_config = {"env_prefix": "", "case_sensitive": False}
