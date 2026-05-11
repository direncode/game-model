"""Preset name resolver — parse `namespace.preset`, locate stdlib files,
list available presets, and dispatch a preset invocation through `_run_file`.

OCEAN_PATH semantics:
    - Colon-separated on POSIX, semicolon-separated on Windows.
    - Directories listed there are searched before the bundled stdlib.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Optional

from ocean_cli.paths import package_root, stdlib_dir, stdlib_file

__all__ = [
    "PresetResolutionError",
    "parse_preset_name",
    "resolve_stdlib_path",
    "list_presets",
    "list_all_namespaces",
    "run_preset",
]


# ── name parsing ─────────────────────────────────────────────────────────

_IDENT = re.compile(r"^[a-z_][a-z0-9_]*$")


class PresetResolutionError(ValueError):
    """Raised when a preset name is malformed or cannot be resolved."""


def parse_preset_name(name: str) -> tuple[str, str]:
    """Split a `<namespace>.<preset>` reference into its two parts.

    Raises `PresetResolutionError` if the name doesn't contain exactly one
    dot, or if either part is not a valid Python-style identifier.
    """
    parts = name.split(".")
    if len(parts) != 2:
        raise PresetResolutionError(
            f"preset name {name!r} must have exactly one dot "
            f"separating namespace and preset (got {len(parts) - 1} dots)"
        )
    namespace, preset = parts
    if not _IDENT.match(namespace):
        raise PresetResolutionError(
            f"namespace {namespace!r} is not a valid identifier "
            "(lowercase letters, digits, underscore; cannot start with digit)"
        )
    if not _IDENT.match(preset):
        raise PresetResolutionError(
            f"preset {preset!r} is not a valid identifier "
            "(lowercase letters, digits, underscore; cannot start with digit)"
        )
    return namespace, preset


# ── path resolution ──────────────────────────────────────────────────────

def _ocean_path_dirs() -> list[Path]:
    """Parse the `OCEAN_PATH` env var into a list of directory paths."""
    raw = os.environ.get("OCEAN_PATH", "")
    if not raw:
        return []
    return [Path(p) for p in raw.split(os.pathsep) if p]


def resolve_stdlib_path(namespace: str) -> Optional[Path]:
    """Find the `.ocean` file backing a namespace.

    Search order:
        1. Each directory in `OCEAN_PATH` (in declaration order).
        2. The bundled stdlib directory.

    Returns `None` if not found anywhere.
    """
    for d in _ocean_path_dirs():
        cand = d / f"{namespace}.ocean"
        if cand.is_file():
            return cand
    return stdlib_file(namespace)


# ── preset enumeration ───────────────────────────────────────────────────

_DEFINE_RE = re.compile(r"^\s*define\s+([a-z_][a-z0-9_]*)\s*\(", re.MULTILINE)


def list_presets(namespace: str) -> list[str]:
    """Return the names of every `define <name>(...)` in `<namespace>.ocean`.

    Returns an empty list if the namespace doesn't resolve.
    """
    path = resolve_stdlib_path(namespace)
    if path is None:
        return []
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return []
    return _DEFINE_RE.findall(text)


def list_all_namespaces() -> list[str]:
    """Enumerate every `*.ocean` file in `OCEAN_PATH` + bundled stdlib.

    Returns the sorted, deduplicated list of stems.
    """
    names: set[str] = set()
    for d in _ocean_path_dirs():
        if d.is_dir():
            for f in d.glob("*.ocean"):
                names.add(f.stem)
    sd = stdlib_dir()
    if sd.is_dir():
        for f in sd.glob("*.ocean"):
            names.add(f.stem)
    return sorted(names)


# ── dispatch ─────────────────────────────────────────────────────────────

# Argparse-internal attributes that aren't user-supplied overrides
_INTERNAL_ARG_KEYS = {"target", "command", "func", "seed", "overrides"}


def _format_override_value(v) -> str:
    """Format a Python value into OCEAN-source syntax for a function arg."""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    # Everything else gets stringified and quoted as a string literal
    s = str(v)
    escaped = s.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def run_preset(name: str, args: argparse.Namespace) -> int:
    """Generate a tiny OCEAN program that imports the namespace and calls the
    requested preset, forwarding all `--key value` overrides as named args."""
    from ocean_cli.commands.run import _run_file

    try:
        namespace, preset = parse_preset_name(name)
    except PresetResolutionError as e:
        print(f"ocean: error: {e}", file=sys.stderr)
        return 1

    path = resolve_stdlib_path(namespace)
    if path is None:
        avail = ", ".join(list_all_namespaces()) or "(none)"
        print(
            f"ocean: error: unknown namespace {namespace!r}. "
            f"Available namespaces: {avail}",
            file=sys.stderr,
        )
        return 1

    presets = list_presets(namespace)
    if preset not in presets:
        avail = ", ".join(presets) or "(none)"
        print(
            f"ocean: error: unknown preset {preset!r} in namespace "
            f"{namespace!r}. Available presets: {avail}",
            file=sys.stderr,
        )
        return 1

    # Collect override key/value pairs from the argparse namespace, skipping
    # internal attributes.
    overrides_dict: dict[str, str] = {}
    for k, v in vars(args).items():
        if k in _INTERNAL_ARG_KEYS:
            continue
        if v is None:
            continue
        overrides_dict[k] = v

    # Build a kwargs-style argument list. Quote string values.
    kwargs_parts = [
        f"{k} = {_format_override_value(v)}" for k, v in overrides_dict.items()
    ]
    kwargs_str = ", ".join(kwargs_parts)

    # Build the tiny program. Use a relative import path so the package
    # resolves regardless of cwd; the runner will read the file from disk.
    seed_line = f"seed {args.seed}\n" if getattr(args, "seed", None) else ""
    program = (
        f'require ocean 1.0\n'
        f'{seed_line}'
        f'import "{path.as_posix()}" as {namespace}\n'
        f'{namespace}.{preset}({kwargs_str})\n'
    )

    # Run with cwd set to package_root so any bundled-relative paths in the
    # preset (e.g. "data/validation/...") resolve to the package install dir.
    saved_cwd = os.getcwd()
    tmpdir = tempfile.mkdtemp(prefix="ocean-preset-")
    tmpfile = Path(tmpdir) / f"{namespace}_{preset}_invoke.ocean"
    tmpfile.write_text(program, encoding="utf-8")
    try:
        os.chdir(str(package_root()))
        return _run_file(tmpfile, args)
    finally:
        os.chdir(saved_cwd)
        try:
            tmpfile.unlink(missing_ok=True)
            Path(tmpdir).rmdir()
        except OSError:
            pass
