"""ocean run <target> - compile + execute an OCEAN program."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


_PRESET_RE = re.compile(r"^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$")


def add_parser(subparsers: argparse._SubParsersAction) -> None:
    p = subparsers.add_parser(
        "run",
        help="compile + run an OCEAN program or stdlib preset",
    )
    p.add_argument(
        "target",
        help="file path (foo.ocean) or preset name (namespace.preset)",
    )
    p.add_argument(
        "--seed",
        type=int,
        default=None,
        help="override the seed declaration in the program",
    )
    # Trailing --key value overrides for preset invocations. argparse.REMAINDER
    # captures everything after `target` (and any explicitly registered options)
    # as a raw list.
    p.add_argument(
        "overrides",
        nargs=argparse.REMAINDER,
        help="trailing --key value overrides forwarded to a preset call",
    )
    p.set_defaults(func=run)


def run(args: argparse.Namespace) -> int:
    target = args.target
    _apply_overrides(args)
    if _PRESET_RE.match(target):
        return _run_preset(target, args)
    path = Path(target)
    if not path.exists():
        print(f"ocean: error: file not found: {target}", file=sys.stderr)
        return 1
    return _run_file(path, args)


def _apply_overrides(args: argparse.Namespace) -> None:
    """Parse trailing `--key value` pairs from args.overrides and attach
    them to the namespace as attributes (kebab-to-snake)."""
    raw: list[str] = list(getattr(args, "overrides", None) or [])
    parsed: dict[str, str] = {}
    i = 0
    while i < len(raw):
        tok = raw[i]
        if tok.startswith("--"):
            key = tok[2:].replace("-", "_")
            # Either `--key value` or `--key=value`
            if "=" in key:
                k, _, v = key.partition("=")
                parsed[k] = v
                i += 1
                continue
            if i + 1 < len(raw):
                parsed[key] = raw[i + 1]
                i += 2
                continue
            # Lone flag with no value — treat as boolean True
            parsed[key] = "true"
            i += 1
            continue
        # Skip stray positional
        i += 1
    for k, v in parsed.items():
        setattr(args, k, v)
    args.overrides = parsed


def _run_file(path: Path, args: argparse.Namespace) -> int:
    # Add the vendored package directory to sys.path so `from scripts.operators.ocean.X`
    # imports inside the vendored compiler resolve.
    from ocean_cli.paths import vendored_root
    vr = str(vendored_root())
    if vr not in sys.path:
        sys.path.insert(0, vr)

    from scripts.operators.ocean.parser import parse_ocean
    from scripts.operators.ocean.typecheck import typecheck

    try:
        source = path.read_text(encoding="utf-8")
    except OSError as e:
        print(f"ocean: error: cannot read {path}: {e}", file=sys.stderr)
        return 1

    try:
        program = parse_ocean(source, source_name=str(path))
        typecheck(program)
    except Exception as e:
        print(f"ocean: error: {e}", file=sys.stderr)
        return 1

    # If the program has no executable statements, compile-success is the
    # whole answer. Skip the runner entirely.
    if not getattr(program, "statements", []):
        return 0

    # Otherwise dispatch to the vendored universal pipeline runner. The
    # vendored runner calls argparse on sys.argv directly, so set sys.argv
    # before invoking.
    try:
        from scripts import run_universal_pipeline as runner
    except Exception as e:
        # Runner infrastructure not available in this vendored copy.
        print(
            f"ocean: warning: runtime pipeline not available ({e}); "
            "compile-check only",
            file=sys.stderr,
        )
        return 0

    saved_argv = sys.argv[:]
    sys.argv = ["ocean-run", "--config", str(path)]
    if args.seed is not None:
        sys.argv += ["--seed", str(args.seed)]
    try:
        rc = runner.main()
        return int(rc) if rc is not None else 0
    except SystemExit as e:
        return int(e.code or 0)
    except Exception as e:
        print(f"ocean: runtime error: {e}", file=sys.stderr)
        return 1
    finally:
        sys.argv = saved_argv


def _run_preset(name: str, args: argparse.Namespace) -> int:
    from ocean_cli.preset import run_preset
    return run_preset(name, args)
