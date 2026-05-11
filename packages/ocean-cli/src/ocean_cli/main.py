"""`ocean` CLI entrypoint."""
from __future__ import annotations

import argparse
import sys

from ocean_cli.commands import fmt as _fmt
from ocean_cli.commands import lint as _lint
from ocean_cli.commands import list_cmd as _list
from ocean_cli.commands import lsp as _lsp
from ocean_cli.commands import mcp as _mcp
from ocean_cli.commands import repl as _repl
from ocean_cli.commands import run as _run
from ocean_cli.commands import version as _version


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ocean",
        description="The OCEAN substrate-clustering language CLI.",
    )
    subparsers = parser.add_subparsers(dest="command", metavar="<command>")
    _version.add_parser(subparsers)
    _run.add_parser(subparsers)
    _repl.add_parser(subparsers)
    _fmt.add_parser(subparsers)
    _lint.add_parser(subparsers)
    _lsp.add_parser(subparsers)
    _mcp.add_parser(subparsers)
    _list.add_parser(subparsers)
    # Later tasks register: new.
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
