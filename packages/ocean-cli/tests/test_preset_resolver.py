"""Tests for ocean_cli.preset — preset name parser + stdlib resolver."""
from __future__ import annotations

import pytest

from ocean_cli.preset import (
    PresetResolutionError,
    list_presets,
    parse_preset_name,
    resolve_stdlib_path,
)


# ── parse_preset_name ────────────────────────────────────────────────────


def test_parse_preset_name_splits_on_dot():
    ns, preset = parse_preset_name("substrate.basic_run")
    assert ns == "substrate"
    assert preset == "basic_run"


def test_parse_preset_name_preserves_underscore_suffix():
    ns, preset = parse_preset_name("substrate.anomaly_focused")
    assert ns == "substrate"
    assert preset == "anomaly_focused"


def test_parse_preset_name_no_dot_raises():
    with pytest.raises(PresetResolutionError):
        parse_preset_name("basic_run")


def test_parse_preset_name_too_many_dots_raises():
    with pytest.raises(PresetResolutionError):
        parse_preset_name("a.b.c")


# ── resolve_stdlib_path ──────────────────────────────────────────────────


def test_resolve_substrate_namespace_resolves_to_real_file():
    p = resolve_stdlib_path("substrate")
    assert p is not None
    assert p.is_file()
    assert p.name == "substrate.ocean"


def test_resolve_unknown_namespace_returns_none():
    assert resolve_stdlib_path("definitely_not_a_real_namespace_xyz") is None


# ── list_presets ─────────────────────────────────────────────────────────


def test_list_presets_for_substrate_includes_basic_run():
    presets = list_presets("substrate")
    assert "basic_run" in presets


def test_list_presets_for_unknown_namespace_returns_empty_list():
    assert list_presets("nonexistent_namespace_xyz") == []
