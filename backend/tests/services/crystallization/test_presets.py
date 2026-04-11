import pytest

from app.services.crystallization.presets import (
    PRESETS,
    get_preset,
    PresetConfig,
)
from app.services.crystallization.vertical_types import VerticalPreset


def test_all_presets_defined():
    for preset in VerticalPreset:
        assert preset in PRESETS, f"Missing preset: {preset}"
        cfg = PRESETS[preset]
        assert isinstance(cfg, PresetConfig)
        assert cfg.langevin_temperature > 0
        assert cfg.langevin_steps > 0
        assert cfg.homology_max_dim in (1, 2)
        assert 0 < cfg.prune_threshold < 1


def test_get_preset_returns_copy():
    a = get_preset(VerticalPreset.GENERIC)
    b = get_preset(VerticalPreset.GENERIC)
    a.langevin_temperature = 999.0
    assert b.langevin_temperature != 999.0  # copy, not shared


def test_trading_preset_has_nonzero_values():
    # Learning mode: user fills in TRADING with real numbers. This test
    # enforces that the stub must actually be completed.
    cfg = get_preset(VerticalPreset.TRADING)
    assert cfg.langevin_temperature > 0
    assert cfg.langevin_steps > 0
    assert cfg.prune_threshold > 0
