"""Vertical presets — hyperparameters for TCD-JEPA per use case.

GENERIC / INFERENCE / SOVEREIGN ship with validated defaults.
TRADING is a learning-mode stub — the user fills it in.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass

from .vertical_types import VerticalPreset


@dataclass
class PresetConfig:
    langevin_temperature: float
    langevin_steps: int
    langevin_noise_scale: float
    homology_max_dim: int
    prune_threshold: float
    max_modules: int


PRESETS: dict[VerticalPreset, PresetConfig] = {
    VerticalPreset.GENERIC: PresetConfig(
        langevin_temperature=1.0,
        langevin_steps=200,
        langevin_noise_scale=0.1,
        homology_max_dim=2,
        prune_threshold=0.2,
        max_modules=32,
    ),
    VerticalPreset.INFERENCE: PresetConfig(
        langevin_temperature=0.5,        # cooler -> exploits known landscape
        langevin_steps=100,              # fewer steps, faster turnaround
        langevin_noise_scale=0.05,
        homology_max_dim=1,              # skip H2 for speed
        prune_threshold=0.1,             # keep more modules for coverage
        max_modules=64,
    ),
    VerticalPreset.SOVEREIGN: PresetConfig(
        langevin_temperature=1.5,        # hotter -> aggressive exploration
        langevin_steps=500,              # long trajectories, more structure
        langevin_noise_scale=0.15,
        homology_max_dim=2,
        prune_threshold=0.25,            # strict quality gate
        max_modules=128,
    ),

    # Trading vertical — balanced exploit/explore stance.
    # Slightly cooler than GENERIC (0.8 vs 1.0) to resist noisy signals
    # without collapsing onto a single attractor. Trajectory length is
    # trimmed to 150 steps (fast decisions matter more than richer
    # topology). H1 only — cycles matter (regime rotations) but H2
    # voids add latency that trading routing cannot absorb. Prune
    # threshold 0.2 keeps a moderate number of strategies alive; 48
    # simultaneous routable modules gives room for N sector × M regime
    # coverage without exploding the router's search space.
    VerticalPreset.TRADING: PresetConfig(
        langevin_temperature=0.8,
        langevin_steps=150,
        langevin_noise_scale=0.08,
        homology_max_dim=1,
        prune_threshold=0.2,
        max_modules=48,
    ),

    # Data Estate vertical — warm exploration for diverse document estates.
    # Temperature is above GENERIC (1.2 vs 1.0) because document collections
    # are inherently diverse (different topics, authors, time periods) and
    # the crystallizer needs to explore broadly before settling. Trajectory
    # length is moderate (300 steps) to map knowledge topology without
    # excessive compute. Full H0/H1/H2 enabled — H2 boundaries are a core
    # value proposition (detecting documentation gaps). Module capacity is
    # high (96) because knowledge bases have many distinct topic clusters.
    # Prune threshold 0.15 keeps more modules alive for coverage.
    VerticalPreset.DATA_ESTATE: PresetConfig(
        langevin_temperature=1.2,
        langevin_steps=300,
        langevin_noise_scale=0.12,
        homology_max_dim=2,
        prune_threshold=0.15,
        max_modules=96,
    ),
}


def get_preset(preset: VerticalPreset) -> PresetConfig:
    """Return a deep copy so caller mutation doesn't leak into the registry."""
    return deepcopy(PRESETS[preset])
