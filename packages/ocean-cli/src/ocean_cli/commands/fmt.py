"""ocean fmt - pretty-print to canonical form."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def add_parser(subparsers: argparse._SubParsersAction) -> None:
    p = subparsers.add_parser("fmt", help="pretty-print OCEAN to canonical form")
    p.add_argument("file", help="path to a .ocean file")
    p.add_argument(
        "--write",
        action="store_true",
        help="overwrite in place instead of printing to stdout",
    )
    p.set_defaults(func=run)


def _format_source(source: str, source_name: str) -> str:
    """Parse the OCEAN source and emit canonical text via the vendored
    formatter. Raises on parse error."""
    from scripts.operators.ocean.parser import parse_ocean
    from scripts.operators.ocean import format as _fmt

    # Prefer a direct source->source entry-point if/when the vendored module
    # gains one; otherwise fall back to parse + format_program (AST -> text).
    if hasattr(_fmt, "format_source"):
        return _fmt.format_source(source)
    if hasattr(_fmt, "format_text"):
        return _fmt.format_text(source)
    if hasattr(_fmt, "format_program"):
        prog = parse_ocean(source, source_name=source_name)
        return _fmt.format_program(prog)
    # Last-ditch — a generic `format()` name (avoid shadowing the builtin).
    if hasattr(_fmt, "format"):
        return _fmt.format(source)
    raise RuntimeError("formatter module exposes no known entry point")


def run(args: argparse.Namespace) -> int:
    path = Path(args.file)
    if not path.exists():
        print(f"ocean: error: file not found: {args.file}", file=sys.stderr)
        return 1

    from ocean_cli.paths import vendored_root
    vr = str(vendored_root())
    if vr not in sys.path:
        sys.path.insert(0, vr)

    source = path.read_text(encoding="utf-8")
    try:
        canonical = _format_source(source, source_name=str(path))
    except Exception as e:
        print(f"ocean: error: format failed: {e}", file=sys.stderr)
        return 1

    if args.write:
        path.write_text(canonical, encoding="utf-8")
    else:
        sys.stdout.write(canonical)
    return 0
