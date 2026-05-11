"""ocean repl - interactive OCEAN REPL."""
from __future__ import annotations

import argparse
import sys


def add_parser(subparsers: argparse._SubParsersAction) -> None:
    p = subparsers.add_parser("repl", help="start the interactive REPL")
    p.set_defaults(func=run)


def run(args: argparse.Namespace) -> int:
    from ocean_cli.paths import vendored_root
    vr = str(vendored_root())
    if vr not in sys.path:
        sys.path.insert(0, vr)
    from scripts.operators.ocean import repl as _repl

    # The vendored REPL exposes `repl()` (not `main()`). Earlier wrapper
    # drafts looked for `main`/`run`/`start`; the actual entry is `repl`.
    entry = None
    for name in ("main", "repl", "run", "start"):
        if hasattr(_repl, name):
            entry = getattr(_repl, name)
            break
    if entry is None:
        print(
            "ocean: error: REPL module has no main()/repl()/run()/start() entry point",
            file=sys.stderr,
        )
        return 1

    try:
        rc = entry()
    except (EOFError, KeyboardInterrupt):
        return 0
    # The vendored `repl()` returns None when the user quits; map that to 0.
    if rc is None:
        return 0
    return int(rc)
