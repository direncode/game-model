"""ocean lint - style + dead-code analysis."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


def add_parser(subparsers: argparse._SubParsersAction) -> None:
    p = subparsers.add_parser("lint", help="style and dead-code analysis")
    p.add_argument("file", help="path to a .ocean file")
    p.add_argument(
        "--strict",
        action="store_true",
        help="treat warnings as errors",
    )
    p.set_defaults(func=run)


# Tokens that count as an explicit `seed` declaration. The grammar puts
# the seed on its own line right after the optional `require` line, so
# a regex on the textual source is sufficient here.
_SEED_RE = re.compile(r"(?m)^\s*seed\s+\d+\s*$")


def _has_explicit_seed(source: str) -> bool:
    return _SEED_RE.search(source) is not None


def _format_lint(lint, source_path: str) -> str:
    # The vendored Lint dataclass has a `.format(source_name)` helper.
    fmt = getattr(lint, "format", None)
    if callable(fmt):
        try:
            return fmt(source_path)
        except TypeError:
            pass
    return str(lint)


def _run_vendored_linter(source: str, path: Path) -> list:
    """Drive the vendored Linter class (or any of the documented entry-point
    names) and return a list of warning records."""
    from scripts.operators.ocean.parser import parse_ocean
    from scripts.operators.ocean import lint as _lint

    if hasattr(_lint, "lint_source"):
        return list(_lint.lint_source(source, path=str(path)))
    if hasattr(_lint, "lint"):
        return list(_lint.lint(source, path=str(path)))
    if hasattr(_lint, "Linter"):
        prog = parse_ocean(source, source_name=str(path))
        linter = _lint.Linter(source.splitlines(), strict=False)
        return list(linter.lint_program(prog))
    if hasattr(_lint, "run"):
        return list(_lint.run(source, path=str(path)))
    raise RuntimeError("linter module exposes no known entry point")


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
    warnings: list = []

    # Pre-check: deterministic-by-default requires an explicit seed. The
    # vendored linter currently doesn't surface this; add it here so the
    # CLI's contract holds even before the vendored module catches up.
    if not _has_explicit_seed(source):
        warnings.append(
            f"{path}:1:1: warning [missing-seed] "
            "no explicit `seed N` declaration; runs are non-reproducible"
        )

    try:
        vendored = _run_vendored_linter(source, path)
    except Exception as e:
        print(f"ocean: error: lint failed: {e}", file=sys.stderr)
        return 1
    for w in vendored:
        warnings.append(_format_lint(w, str(path)))

    for w in warnings:
        print(w)

    if args.strict and warnings:
        return 1
    return 0
