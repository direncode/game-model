"""Evaluation harness for lo_nlp.resolve.Resolver.

Runs the resolver over a labeled fixture and reports aggregate, per-family,
per-source, and per-stage-hint metrics. The scoring function is the
replaceable slot that defines what "resolved correctly" means for the
feature.

Quick use:
    python -m lo_nlp.eval                   # summary
    python -m lo_nlp.eval --verbose         # per-query rows
    python -m lo_nlp.eval --json out.json   # dump full stats
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Optional

from lo_nlp.resolve import Resolver, ResolverResult

FIXTURE_PATH = Path(__file__).resolve().parent / "data" / "eval_fixture.json"


def load_fixture(path: Path = FIXTURE_PATH) -> list[dict]:
    """Load labeled queries.

    Each entry:
        query          - input string passed to resolve()
        expect_code    - ground-truth code (str) or None for unknowns
        expect_family  - ground-truth family ("mesh","hs",...) or None
        stage_hint     - which cascade stage we expect to fire (informational)
        notes          - optional human commentary
    """
    return json.loads(path.read_text(encoding="utf-8"))


def score_resolution(
    query: str,
    expected: dict,
    result: ResolverResult,
) -> float:
    """Score one resolution attempt. Return a float in [0.0, 1.0].

    ━━━━━━━━━━━━━━━━━━━━  HOW WE DEFINE SUCCESS  ━━━━━━━━━━━━━━━━━━━━
    This function IS the feature's success metric. The baseline below
    is deliberately conservative — top-1 exact match, with credit for
    correctly NOT resolving an unknown. No partial credit.

    Replace this body with whichever blend matches the promise you
    want the resolver to make:

      • TOP-K RECALL    — credit if expect_code appears anywhere in
                          result.candidates (UI shows a candidate list)
      • FAMILY MATCH    — partial credit when the family is right even
                          if the code isn't (lenient, long-tail wins)
      • CONFIDENCE-WEIGHTED — penalise high-confidence wrong answers
                          more than low-confidence wrong ones
      • TIERED PARTIAL  — e.g. 1.0 exact / 0.5 top-3 / 0.2 family-only / 0

    The 5-10 lines you put here decide what the feature PROMISES.

    Available inputs:
        expected['expect_code']     str or None
        expected['expect_family']   str or None
        result.resolved             bool
        result.code                 str or None
        result.family               str or None
        result.confidence           float in [0.0, 1.0]
        result.source               'codebook'|'lexical'|'fuzzy'|'none'
        result.candidates           list of {'code','canonical_name','family','score',...}
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    """
    expected_code = expected.get("expect_code")
    # Unknown query: reward NOT resolving.
    if expected_code is None:
        return 1.0 if not result.resolved else 0.0
    # Known query: reward top-1 exact code match. No partial credit in baseline.
    return 1.0 if result.code == expected_code else 0.0


def run_eval(
    resolver: Optional[Resolver] = None,
    fixture: Optional[list[dict]] = None,
    top_k: int = 5,
) -> dict:
    """Iterate the fixture, score each query, return aggregated stats."""
    resolver = resolver or Resolver()
    fixture = fixture if fixture is not None else load_fixture()

    per_query: list[dict] = []
    per_family: dict[str, list[float]] = {}
    per_source: dict[str, list[float]] = {}
    per_stage_hint: dict[str, list[float]] = {}

    for item in fixture:
        query = item["query"]
        result = resolver.resolve(query, top_k=top_k)
        score = score_resolution(query, item, result)

        per_query.append({
            "query": query,
            "expected_code": item.get("expect_code"),
            "expected_family": item.get("expect_family"),
            "got_code": result.code,
            "got_family": result.family,
            "confidence": result.confidence,
            "source": result.source,
            "resolved": result.resolved,
            "stage_hint": item.get("stage_hint"),
            "score": score,
        })
        fam = item.get("expect_family") or "_unknown"
        per_family.setdefault(fam, []).append(score)
        per_source.setdefault(result.source, []).append(score)
        stage = item.get("stage_hint") or "_unspec"
        per_stage_hint.setdefault(stage, []).append(score)

    def avg(xs: list[float]) -> float:
        return round(sum(xs) / len(xs), 3) if xs else 0.0

    return {
        "n": len(per_query),
        "aggregate": avg([p["score"] for p in per_query]),
        "by_family": {k: avg(v) for k, v in per_family.items()},
        "by_source": {k: avg(v) for k, v in per_source.items()},
        "by_stage_hint": {k: avg(v) for k, v in per_stage_hint.items()},
        "per_query": per_query,
    }


def format_summary(stats: dict) -> str:
    lines = [
        f"n={stats['n']}  aggregate={stats['aggregate']:.3f}",
        f"by_family      {stats['by_family']}",
        f"by_source      {stats['by_source']}",
        f"by_stage_hint  {stats['by_stage_hint']}",
    ]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Evaluate lo_nlp.Resolver against a labeled fixture.",
    )
    ap.add_argument("--fixture", default=str(FIXTURE_PATH), help="Path to fixture JSON")
    ap.add_argument("--verbose", action="store_true", help="Print per-query rows")
    ap.add_argument("--json", metavar="PATH", help="Dump full stats to this JSON path")
    ap.add_argument("--top-k", type=int, default=5, help="top_k for resolver candidates")
    args = ap.parse_args()

    fixture = json.loads(Path(args.fixture).read_text(encoding="utf-8"))
    stats = run_eval(fixture=fixture, top_k=args.top_k)

    print(format_summary(stats))
    if args.verbose:
        print()
        hdr = f"{'score':>5}  {'stage':<16}  {'source':<10}  {'conf':>5}  {'query':<30}  expected -> got"
        print(hdr)
        print("-" * len(hdr))
        for row in stats["per_query"]:
            print(
                f"{row['score']:>5.2f}  "
                f"{(row['stage_hint'] or '-'):<16}  "
                f"{row['source']:<10}  "
                f"{row['confidence']:>5.2f}  "
                f"{row['query']:<30}  "
                f"{row['expected_code']} -> {row['got_code']}"
            )

    if args.json:
        Path(args.json).write_text(json.dumps(stats, indent=2), encoding="utf-8")

    # Exit 0 if aggregate is meaningful (≥ some floor), 2 otherwise — useful in CI.
    return 0 if stats["aggregate"] >= 0.5 else 2


if __name__ == "__main__":
    raise SystemExit(main())
