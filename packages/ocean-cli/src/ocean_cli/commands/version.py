"""ocean version - print the toolchain version."""
from __future__ import annotations

import argparse

from ocean_cli import __version__


def add_parser(subparsers: argparse._SubParsersAction) -> None:
    p = subparsers.add_parser("version", help="print the OCEAN toolchain version")
    p.set_defaults(func=run)


def run(args: argparse.Namespace) -> int:
    print(f"OCEAN {__version__}")
    return 0
