"""Command-line interface for lo_core.

Commands:
    lo version
    lo analyze <btut_output.json> [--corpus-id NAME] [--output findings.json]
    lo validate <dir> --focus CORPUS_ID [--iterations 30] [--output report.json]
    lo narrate <findings.json>
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any

from lo_core import __version__
from lo_core.analyze import analyze_corpus
from lo_core.generators import TemplateGenerator
from lo_core.schemas import Findings
from lo_core.validate import validate_corpora


def _to_jsonable(obj: Any) -> Any:
    """Recursively convert dataclasses / dict-like structures for json.dump."""
    if is_dataclass(obj):
        return _to_jsonable(asdict(obj))
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_jsonable(v) for v in obj]
    if isinstance(obj, tuple):
        return [_to_jsonable(v) for v in obj]
    return obj


def _load_btut_output(path: Path) -> list[dict]:
    d = json.loads(path.read_text(encoding="utf-8"))
    if "survivors" in d:
        return list(d["survivors"])
    if isinstance(d, list):
        return list(d)
    raise ValueError(f"Cannot interpret {path}: expected a dict with 'survivors' or a list")


def cmd_version(_: argparse.Namespace) -> int:
    print(f"lo_core v{__version__}")
    return 0


def cmd_analyze(args: argparse.Namespace) -> int:
    src = Path(args.input)
    if not src.exists():
        print(f"error: {src} not found", file=sys.stderr)
        return 2
    survivors = _load_btut_output(src)
    findings = analyze_corpus(survivors, corpus_id=args.corpus_id or src.stem)
    payload = _to_jsonable(findings)
    out = Path(args.output) if args.output else None
    text = json.dumps(payload, indent=2, sort_keys=True, default=str)
    if out:
        out.write_text(text, encoding="utf-8")
        print(f"wrote {out}")
    else:
        print(text)
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    src = Path(args.dir)
    if not src.is_dir():
        print(f"error: {src} is not a directory", file=sys.stderr)
        return 2
    survivors_by_corpus: dict[str, list[dict]] = {}
    for p in sorted(src.glob("*.json")):
        try:
            s = _load_btut_output(p)
        except Exception as e:
            print(f"skip {p.name}: {e}", file=sys.stderr)
            continue
        survivors_by_corpus[p.stem] = s
    if not survivors_by_corpus:
        print(f"error: no valid BTUT outputs in {src}", file=sys.stderr)
        return 2

    report = validate_corpora(
        survivors_by_corpus,
        focus_corpus=args.focus,
        n_iterations=args.iterations,
        seed=args.seed,
        held_out=tuple(args.held_out) if args.held_out else None,
    )
    payload = _to_jsonable(report)
    text = json.dumps(payload, indent=2, sort_keys=True, default=str)
    if args.output:
        Path(args.output).write_text(text, encoding="utf-8")
        print(f"wrote {args.output}")

    # Pretty summary table
    print()
    print("=" * 78)
    print(f"VALIDATION SUMMARY  (N={report.n_iterations}, seed={report.seed})")
    print("=" * 78)
    for t in report.null_tests:
        badge = "[PASS] SIGNIFICANT" if t.significant_at_0_05 else "       not signif"
        if t.null_mean is not None:
            print(
                f"  {t.metric:44s}  true={t.true_value:9.3f}  "
                f"null_mean={t.null_mean:9.3f}  p95={t.null_p95:9.3f}  [{badge}]"
            )
        else:
            print(
                f"  {t.metric:44s}  true={t.true_value!s:>9}  "
                f"null_prop={t.null_proportion_true}  [{badge}]"
            )
    if report.holdout:
        h = report.holdout
        print(f"\nHOLD-OUT: held={h.held_out}  train={h.train_bridge_count} "
              f"full={h.full_bridge_count}  heldout_bridges={h.bridges_involving_heldout}")
        if h.top_heldout_bridge:
            print(f"  top heldout bridge: {h.top_heldout_bridge}")
    return 0


def cmd_narrate(args: argparse.Namespace) -> int:
    src = Path(args.input)
    if not src.exists():
        print(f"error: {src} not found", file=sys.stderr)
        return 2
    d = json.loads(src.read_text(encoding="utf-8"))
    # Reconstruct Findings from dict; use duck-typed access
    from lo_core.schemas import (
        ConvergenceEntry,
        ConvergentCluster,
        CrossEraAnchor,
        SurvivorRank,
    )

    findings = Findings(
        corpus_id=d.get("corpus_id", "?"),
        survivor_count=d.get("survivor_count", 0),
        cluster_count=d.get("cluster_count", 0),
        paradigm_distribution=d.get("paradigm_distribution") or {},
        convergent_clusters=[ConvergentCluster(**x) for x in d.get("convergent_clusters") or []],
        cross_era_anchors=[CrossEraAnchor(**x) for x in d.get("cross_era_anchors") or []],
        convergence_index=[ConvergenceEntry(**x) for x in d.get("convergence_index") or []],
        within_cluster_rank={k: SurvivorRank(**v)
                             for k, v in (d.get("within_cluster_rank") or {}).items()},
    )
    gen = TemplateGenerator()
    print(gen.narrate_corpus(findings))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="lo", description="Latent Ocean core engine")
    sub = parser.add_subparsers(dest="command", required=True)

    p_v = sub.add_parser("version", help="Print lo_core version")
    p_v.set_defaults(func=cmd_version)

    p_a = sub.add_parser("analyze", help="Run cross-dimensional analyzers on a BTUT output")
    p_a.add_argument("input", help="Path to BTUT output JSON (contains 'survivors' key)")
    p_a.add_argument("--corpus-id", help="Corpus identifier (defaults to filename)")
    p_a.add_argument("--output", "-o", help="Write findings to this path (default: stdout)")
    p_a.set_defaults(func=cmd_analyze)

    p_val = sub.add_parser("validate", help="Run null + hold-out falsification on a directory of BTUT outputs")
    p_val.add_argument("dir", help="Directory with one BTUT output JSON per corpus")
    p_val.add_argument("--focus", required=True, help="Corpus ID to treat as the primary target")
    p_val.add_argument("--iterations", type=int, default=30, help="Null iterations (default 30)")
    p_val.add_argument("--seed", type=int, default=42, help="Random seed (default 42)")
    p_val.add_argument("--held-out", nargs="*", default=None, help="Corpora to hold out")
    p_val.add_argument("--output", "-o", help="Write full report to this path")
    p_val.set_defaults(func=cmd_validate)

    p_n = sub.add_parser("narrate", help="Produce a deterministic narrative from a findings JSON")
    p_n.add_argument("input", help="Path to findings JSON produced by `lo analyze`")
    p_n.set_defaults(func=cmd_narrate)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
