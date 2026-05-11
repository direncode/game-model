"""Tests for ocean_cli.paths — path resolver helpers."""
from __future__ import annotations

from pathlib import Path


def test_package_root_resolves():
    from ocean_cli.paths import package_root
    root = package_root()
    assert isinstance(root, Path)
    assert root.is_dir()
    assert (root / "__init__.py").is_file()


def test_stdlib_dir_resolves():
    from ocean_cli.paths import stdlib_dir
    d = stdlib_dir()
    assert isinstance(d, Path)
    assert d.is_dir()
    assert d.name == "stdlib"


def test_stdlib_file_resolves_substrate():
    from ocean_cli.paths import stdlib_file
    p = stdlib_file("substrate")
    assert p is not None
    assert isinstance(p, Path)
    assert p.is_file()
    assert p.name == "substrate.ocean"


def test_stdlib_file_missing_returns_none():
    from ocean_cli.paths import stdlib_file
    assert stdlib_file("does_not_exist") is None


def test_vendored_root_resolves():
    from ocean_cli.paths import vendored_root
    v = vendored_root()
    assert isinstance(v, Path)
    assert v.is_dir()
    assert v.name == "_vendored"
