"""Path resolver helpers for ocean_cli.

These helpers locate the installed package's data files (stdlib, vendored
runtime) regardless of whether ocean_cli is imported from a wheel install
or from a source checkout. All return absolute `pathlib.Path` instances.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional


def package_root() -> Path:
    """Return the absolute path to the ocean_cli package directory.

    This is the directory containing the package's `__init__.py`.
    """
    return Path(__file__).resolve().parent


def stdlib_dir() -> Path:
    """Return the absolute path to the bundled stdlib directory."""
    return package_root() / "stdlib"


def stdlib_file(namespace: str) -> Optional[Path]:
    """Resolve `<namespace>.ocean` inside the bundled stdlib.

    Returns the `Path` if the file exists, otherwise `None`.
    """
    p = stdlib_dir() / f"{namespace}.ocean"
    return p if p.is_file() else None


def vendored_root() -> Path:
    """Return the absolute path to the bundled `_vendored/` directory."""
    return package_root() / "_vendored"
