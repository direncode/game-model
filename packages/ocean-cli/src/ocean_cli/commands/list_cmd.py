"""ocean list {ops, stdlib} - enumerate operators or stdlib presets."""
from __future__ import annotations

import argparse
import sys


def add_parser(subparsers: argparse._SubParsersAction) -> None:
    p = subparsers.add_parser(
        "list",
        help="enumerate operators or stdlib presets",
    )
    sub = p.add_subparsers(dest="list_kind", required=True)

    ops_p = sub.add_parser("ops", help="enumerate operators")
    ops_p.add_argument("--free", action="store_true", help="free-tier only")
    ops_p.add_argument("--premium", action="store_true", help="premium only")
    ops_p.set_defaults(func=run_ops)

    stdlib_p = sub.add_parser("stdlib", help="enumerate stdlib presets")
    stdlib_p.add_argument(
        "--namespace",
        default=None,
        help="filter to one namespace",
    )
    stdlib_p.set_defaults(func=run_stdlib)


def run_ops(args: argparse.Namespace) -> int:
    from ocean_cli.paths import vendored_root
    vr = str(vendored_root())
    if vr not in sys.path:
        sys.path.insert(0, vr)
    from backend.handbook_runner.premium_gate import OPERATOR_REGISTRY

    show_free = not args.premium
    show_premium = not args.free

    for name in sorted(OPERATOR_REGISTRY):
        spec = OPERATOR_REGISTRY[name]
        if spec.tier == "free" and not show_free:
            continue
        if spec.tier == "premium" and not show_premium:
            continue
        print(f"  {name:35s}  {spec.tier:8s}  {spec.signature}")
        print(f"  {'':35s}            {spec.summary}")
    return 0


def run_stdlib(args: argparse.Namespace) -> int:
    from ocean_cli.preset import list_all_namespaces, list_presets

    namespaces = [args.namespace] if args.namespace else list_all_namespaces()
    for ns in namespaces:
        presets = list_presets(ns)
        if not presets and args.namespace:
            print(f"  {ns}: (no presets found)")
            continue
        print(f"  {ns}:")
        for p in presets:
            print(f"    {ns}.{p}")
    return 0
