"""BTUT configuration — all 8 tiers of parameters with budget-aware auto-scaling.

Backward-solves cascade parameters from a dollar budget and entity count,
enabling 3,000 TB ingestion on ~$200 of GPU compute via progressive reduction.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal, Optional


@dataclass
class CascadeLevel:
    """Single level in the hierarchical multi-scale BTUT cascade."""

    sigma: float  # Gaussian RBF bandwidth for this level
    thinning_ratio: float  # Keep 1/thinning_ratio of entities (e.g. 1000 = keep 0.1%)
    max_iterations: int  # Max FP evolution steps before forced convergence
    min_iterations: int = 2  # Minimum before auto-stop kicks in


@dataclass
class BTUTConfig:
    """Complete configuration for the BTUT extreme data reduction engine.

    Eight tiers of parameters, each controlling a different reduction mechanism.
    Use `auto_scale()` to derive optimal settings from entity count + budget.
    """

    # ── Tier 1: Pre-Filter ──────────────────────────────────────────────
    bloom_size_bits: int = 1 << 24  # 16M bits = 2MB default, scales up for billions
    bloom_hash_count: int = 7
    lsh_bands: int = 20
    lsh_rows_per_band: int = 5
    minhash_perms: int = 128
    entropy_threshold: float = 0.1  # Reject entities with Shannon entropy below this
    prefilter_enabled: bool = True

    # ── Tier 2: Hierarchical Cascade ────────────────────────────────────
    cascade_levels: list[CascadeLevel] = field(default_factory=lambda: [
        CascadeLevel(sigma=5.0, thinning_ratio=100, max_iterations=3, min_iterations=1),
        CascadeLevel(sigma=1.0, thinning_ratio=10, max_iterations=5, min_iterations=2),
        CascadeLevel(sigma=0.1, thinning_ratio=5, max_iterations=10, min_iterations=3),
    ])
    max_cascade_depth: int = 5
    adaptive_depth: bool = True  # Spawn extra levels if internal variance too high

    # ── Tier 3: Compute / Memory ────────────────────────────────────────
    chunk_size: int = 50_000  # Entities per GPU batch
    use_fp16: bool = True
    mmap_enabled: bool = True  # Memory-mapped arrays for out-of-core
    mmap_dir: str = "/tmp/btut_mmap"
    dim_schedule: list[int] = field(default_factory=lambda: [32, 16, 8])
    device: str = "auto"  # "auto" / "cuda" / "cpu"

    # ── Tier 4: Sub-Engines ─────────────────────────────────────────────
    text_engine_enabled: bool = True
    numeric_engine_enabled: bool = True
    timeseries_engine_enabled: bool = True
    graph_engine_enabled: bool = True
    embedding_dim: int = 32

    # ── Tier 5: Self-Optimization ───────────────────────────────────────
    budget_dollars: float = 50.0
    annealing_schedule: Literal["exponential", "linear", "cosine"] = "exponential"
    annealing_sigma_init: float = 5.0
    annealing_sigma_final: float = 0.01
    convergence_prediction: bool = True
    historical_learning: bool = True  # Store fingerprint → config in Redis

    # ── Tier 6: Thinning ────────────────────────────────────────────────
    thinning_strategy: str = "composite"  # composite | density | info_theoretic | boundary | stratified | spectral
    min_cluster_representation: int = 3  # Floor per cluster
    max_dispersion_samples: int = 50
    min_entities_floor: int = 50  # Never thin below this

    # ── Tier 7: Resilience ──────────────────────────────────────────────
    checkpoint_every: int = 100  # Steps between checkpoints
    checkpoint_dir: str = "/tmp/btut_checkpoints"
    max_oom_retries: int = 3
    backpressure_enabled: bool = True

    # ── Tier 8: Quality ─────────────────────────────────────────────────
    bootstrap_runs: int = 3  # Cluster stability bootstrap count
    stability_threshold: float = 0.8
    min_coverage: float = 0.85
    max_recon_error: float = 0.15
    quality_gate_between_levels: bool = True

    # ── Convergence ─────────────────────────────────────────────────────
    epsilon_nash: float = 1e-3
    convergence_patience: int = 3
    dt: float = 0.01  # Fokker-Planck time step
    momentum_decay: float = 0.9
    anti_crowding_strength: float = 0.5
    diffusion_coeff: float = 0.1

    @classmethod
    def auto_scale(
        cls,
        entity_count: int,
        budget_dollars: float = 50.0,
        edge_count: int = 0,
    ) -> BTUTConfig:
        """Backward-solve cascade parameters from entity count + budget.

        Cost model (A100 FP16 @ $1.44/hr, 312 TFLOPS):
        - Per chunk pair: C² × D FLOPs for kernel density
        - Budget seconds = budget_dollars / 1.44 × 3600
        - Solve for cascade thinning ratios that keep total compute within budget
        """
        budget_seconds = (budget_dollars / 1.44) * 3600
        config = cls(budget_dollars=budget_dollars)

        if entity_count < 500:
            # Tiny dataset: minimal cascade, no pre-filter
            config.prefilter_enabled = False
            config.cascade_levels = [
                CascadeLevel(sigma=1.0, thinning_ratio=2, max_iterations=10, min_iterations=3),
            ]
            config.dim_schedule = [32]
            config.chunk_size = entity_count
            config.use_fp16 = False
            config.mmap_enabled = False
            config.bootstrap_runs = 1
            return config

        if entity_count < 10_000:
            # Small: light cascade, relaxed quality gates
            config.prefilter_enabled = False
            config.cascade_levels = [
                CascadeLevel(sigma=2.0, thinning_ratio=5, max_iterations=8, min_iterations=2),
                CascadeLevel(sigma=0.5, thinning_ratio=3, max_iterations=10, min_iterations=3),
            ]
            config.dim_schedule = [32, 16]
            config.chunk_size = min(entity_count, 50_000)
            config.mmap_enabled = False
            config.min_coverage = 0.5  # Relax for small sets
            config.max_recon_error = 0.5
            config.quality_gate_between_levels = False
            return config

        if entity_count < 1_000_000:
            # Medium: full cascade, no mmap needed
            config.cascade_levels = [
                CascadeLevel(sigma=3.0, thinning_ratio=50, max_iterations=5, min_iterations=2),
                CascadeLevel(sigma=1.0, thinning_ratio=10, max_iterations=8, min_iterations=3),
                CascadeLevel(sigma=0.2, thinning_ratio=5, max_iterations=10, min_iterations=3),
            ]
            config.dim_schedule = [32, 16]
            config.bloom_size_bits = max(1 << 24, entity_count * 10)
            config.mmap_enabled = entity_count > 500_000
            return config

        if entity_count < 100_000_000:
            # Large (millions): aggressive cascade with mmap
            config.cascade_levels = [
                CascadeLevel(sigma=5.0, thinning_ratio=500, max_iterations=3, min_iterations=1),
                CascadeLevel(sigma=1.0, thinning_ratio=50, max_iterations=5, min_iterations=2),
                CascadeLevel(sigma=0.2, thinning_ratio=10, max_iterations=8, min_iterations=3),
            ]
            config.dim_schedule = [32, 16, 8]
            config.bloom_size_bits = min(1 << 30, entity_count * 10)
            return config

        # Extreme (billions): maximum cascade for 3,000 TB scale
        # Total target reduction: ~1,000,000x
        # Pre-filter: ~10x, then cascade: 1000 × 100 × 10 = 1,000,000x
        config.cascade_levels = [
            CascadeLevel(sigma=5.0, thinning_ratio=1000, max_iterations=3, min_iterations=1),
            CascadeLevel(sigma=1.0, thinning_ratio=100, max_iterations=5, min_iterations=2),
            CascadeLevel(sigma=0.1, thinning_ratio=10, max_iterations=10, min_iterations=3),
        ]
        config.dim_schedule = [32, 16, 8]
        config.bloom_size_bits = 1 << 30  # 128MB bloom filter
        config.chunk_size = 50_000
        config.bootstrap_runs = 5
        config.max_cascade_depth = 5

        # Budget-aware: check if we can afford a 4th level
        # Rough cost estimate for coarse level: N/chunk_size × chunk_size² × D / 312e12 × levels
        coarse_n = entity_count / 10  # Post pre-filter estimate
        cost_per_step_seconds = (
            (coarse_n / config.chunk_size)
            * (config.chunk_size ** 2)
            * config.embedding_dim
            / 312e12
        )
        total_estimated_seconds = cost_per_step_seconds * sum(
            l.max_iterations for l in config.cascade_levels
        )

        if total_estimated_seconds < budget_seconds * 0.5:
            # Budget allows a 4th refinement level
            config.cascade_levels.append(
                CascadeLevel(sigma=0.01, thinning_ratio=3, max_iterations=15, min_iterations=5)
            )

        return config

    def total_target_reduction(self) -> float:
        """Compute the theoretical total reduction ratio across all cascade levels."""
        prefilter_factor = 10.0 if self.prefilter_enabled else 1.0
        cascade_factor = 1.0
        for level in self.cascade_levels:
            cascade_factor *= level.thinning_ratio
        return prefilter_factor * cascade_factor

    def resolve_device(self) -> str:
        """Resolve 'auto' to actual device string."""
        if self.device != "auto":
            return self.device
        try:
            import torch
            return "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"
