"""Engine configuration — zero application dependencies."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class EngineConfig:
    """Configuration for LatentOceanEngine.

    This is the only config the engine needs. Application concerns
    (database URLs, JWT secrets, Redis) live in app.config.Settings.
    """
    # Reduction
    budget_dollars: float = 50.0
    target_survivors: int = 300
    chunk_size: int = 50_000
    thinning_strategy: str = "composite"

    # Representation
    compute_3d_display: bool = True

    # Compute
    device: str = "auto"
    use_fp16: bool = True
    checkpoint_dir: str = "/tmp/btut_checkpoints"
    mmap_dir: str = "/tmp/btut_mmap"
    max_prefilter_memory_mb: int = 512

    # Monitoring
    flow_engine_enabled: bool = True

    # Multi-resolution threading
    resolutions: list[int] = field(default_factory=lambda: [4, 8, 16])
    n_rotations: int = 16

    def to_btut_config(self, entity_count: int, edge_count: int = 0):
        """Convert to BTUTConfig via auto_scale."""
        from .reduce.config import BTUTConfig
        return BTUTConfig.auto_scale(entity_count, self.budget_dollars, edge_count)
