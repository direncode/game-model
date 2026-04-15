"""Fork instance configuration — injected at provision time.

Each fork container receives its configuration via environment variables.
This module reads those variables and provides a typed settings object
for the fork's runtime services (API server, reduction scheduler,
materializer).

Environment variables are set by the control plane's provisioner when
creating the fork container.
"""
from __future__ import annotations

from pydantic_settings import BaseSettings


class ForkSettings(BaseSettings):
    """Per-fork runtime configuration.

    All values are injected as environment variables by the control
    plane at container creation time.
    """

    # ── Identity ──────────────────────────────────────────────────────

    FORK_ID: str
    CUSTOMER_ID: str
    SUBDOMAIN: str

    # ── Database connections ──────────────────────────────────────────

    SOURCE_DSN: str  # Customer's source database
    OUTPUT_DSN: str  # Where to write lo_* tables (may equal SOURCE_DSN)
    OUTPUT_SCHEMA: str = "latent_ocean"

    # ── Engine configuration ──────────────────────────────────────────

    ENGINE_BUDGET: float = 50.0
    TARGET_SURVIVORS: int = 300
    THINNING_STRATEGY: str = "composite"
    COMPUTE_3D_DISPLAY: bool = True
    FLOW_ENGINE_ENABLED: bool = True

    # ── Modules ───────────────────────────────────────────────────────

    ENABLED_MODULES: str = ""  # Comma-separated module names

    # ── Scheduling ────────────────────────────────────────────────────

    REDUCTION_SCHEDULE: str = "0 2 * * *"  # Cron: daily at 2 AM
    REDUCTION_ON_STARTUP: bool = True

    # ── Network ───────────────────────────────────────────────────────

    API_PORT: int = 8000
    API_HOST: str = "0.0.0.0"
    DASHBOARD_PORT: int = 3000

    # ── Redis (per-fork cache) ────────────────────────────────────────

    REDIS_URL: str = "redis://redis:6379/0"

    # ── Logging ───────────────────────────────────────────────────────

    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # "json" or "text"

    # ── Resource limits ───────────────────────────────────────────────

    MAX_PREFILTER_MEMORY_MB: int = 512
    CHUNK_SIZE: int = 50_000
    USE_FP16: bool = True
    DEVICE: str = "auto"

    model_config = {"env_prefix": "", "case_sensitive": True}

    @property
    def enabled_module_list(self) -> list[str]:
        """Parse comma-separated ENABLED_MODULES into a list."""
        if not self.ENABLED_MODULES:
            return []
        return [m.strip() for m in self.ENABLED_MODULES.split(",") if m.strip()]

    def to_engine_config_dict(self) -> dict:
        """Convert to a dict suitable for EngineConfig construction."""
        return {
            "budget_dollars": self.ENGINE_BUDGET,
            "target_survivors": self.TARGET_SURVIVORS,
            "thinning_strategy": self.THINNING_STRATEGY,
            "compute_3d_display": self.COMPUTE_3D_DISPLAY,
            "flow_engine_enabled": self.FLOW_ENGINE_ENABLED,
            "device": self.DEVICE,
            "use_fp16": self.USE_FP16,
            "max_prefilter_memory_mb": self.MAX_PREFILTER_MEMORY_MB,
            "chunk_size": self.CHUNK_SIZE,
        }

    def to_materializer_config_dict(self) -> dict:
        """Convert to a dict suitable for MaterializerConfig construction."""
        return {
            "connection_string": self.OUTPUT_DSN,
            "schema_name": self.OUTPUT_SCHEMA,
            "table_prefix": "lo_",
            "create_schema": True,
            "incremental": True,
        }
