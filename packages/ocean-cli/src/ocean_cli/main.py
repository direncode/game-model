"""`ocean` CLI entrypoint."""
from __future__ import annotations

import argparse
import sys

from ocean_cli.commands import version as _version


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ocean",
        description="The OCEAN substrate-clustering language CLI.",
    )
    subparsers = parser.add_subparsers(dest="command", metavar="<command>")
    _version.add_parser(subparsers)
    # Later tasks register: run, repl, fmt, lint, lsp, mcp, list, new.
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "func", None):
        parser.print_help()
        return 0
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
