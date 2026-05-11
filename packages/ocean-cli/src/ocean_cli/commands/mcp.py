"""ocean mcp - MCP server on stdio, mirroring the ocean-mcp binary."""
from __future__ import annotations

import argparse
import sys


def add_parser(subparsers: argparse._SubParsersAction) -> None:
    p = subparsers.add_parser(
        "mcp",
        help="start the MCP server on stdio (mirrors the ocean-mcp binary)",
    )
    p.set_defaults(func=run)


def run(args: argparse.Namespace) -> int:
    from ocean_cli.paths import vendored_root
    vr = str(vendored_root())
    if vr not in sys.path:
        sys.path.insert(0, vr)
    from scripts.operators.ocean import mcp as _mcp

    # The vendored MCP exposes `serve()` (not `main()`); fall back across
    # the documented names so this wrapper survives module renames.
    for entry in ("main", "serve", "run", "start"):
        if hasattr(_mcp, entry):
            rc = getattr(_mcp, entry)()
            return 0 if rc is None else int(rc)
    print("ocean: error: mcp module exposes no known entry point", file=sys.stderr)
    return 1
