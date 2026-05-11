"""ocean new <name> - scaffold a new OCEAN program from a template."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ocean_cli.paths import package_root


def add_parser(subparsers: argparse._SubParsersAction) -> None:
    p = subparsers.add_parser(
        "new",
        help="scaffold a new OCEAN program from a template",
    )
    p.add_argument("name", help="name of the new file (without .ocean extension)")
    p.add_argument(
        "--template",
        default="basic",
        help="template to use (default: basic)",
    )
    p.set_defaults(func=run)


def run(args: argparse.Namespace) -> int:
    target = Path(f"{args.name}.ocean")
    if target.exists():
        print(f"ocean: error: file already exists: {target}", file=sys.stderr)
        return 1

    template_path = package_root() / "templates" / f"{args.template}.ocean"
    if not template_path.is_file():
        templates = sorted(
            p.stem for p in (package_root() / "templates").glob("*.ocean")
        )
        print(
            f"ocean: error: unknown template '{args.template}'; "
            f"available: {', '.join(templates)}",
            file=sys.stderr,
        )
        return 1

    target.write_text(
        template_path.read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    print(f"wrote {target}")
    return 0
