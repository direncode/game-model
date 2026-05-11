"""ocean lsp - LSP server on stdio."""
from __future__ import annotations

import argparse
import sys


def add_parser(subparsers: argparse._SubParsersAction) -> None:
    p = subparsers.add_parser("lsp", help="start the LSP server on stdio")
    p.set_defaults(func=run)


def run(args: argparse.Namespace) -> int:
    from ocean_cli.paths import vendored_root
    vr = str(vendored_root())
    if vr not in sys.path:
        sys.path.insert(0, vr)
    from scripts.operators.ocean import lsp as _lsp

    # The vendored LSP exposes `serve()` (not `main()`); fall back across
    # the documented names so this wrapper survives module renames.
    for entry in ("main", "serve", "run", "start"):
        if hasattr(_lsp, entry):
            rc = getattr(_lsp, entry)()
            return 0 if rc is None else int(rc)
    print("ocean: error: lsp module exposes no known entry point", file=sys.stderr)
    return 1
