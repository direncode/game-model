"""Parity test: Python Resolver vs. Node mirror of the TS route.ts resolver.

The production TS resolver (frontend/app/api/resolve/route.ts) and the
Python CLI resolver (lo_nlp/resolve.py) implement the same algorithm.
Nothing stops them from drifting. This test runs the same fixture
through both, diffs the results, and fails on any mismatch.

Node is invoked as a subprocess. scripts/parity_cli.mjs is the mirror
of route.ts's logic (see its header for the sync contract).

Usage:
    python -m lo_nlp.test_parity              # run, exit 0 on parity
    python -m lo_nlp.test_parity --verbose    # show per-query diffs
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from lo_nlp.resolve import Resolver

REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURE = REPO_ROOT / "lo_nlp" / "data" / "eval_fixture.json"
TS_CLI = REPO_ROOT / "scripts" / "parity_cli.mjs"

# Tolerances
CONFIDENCE_EPSILON = 0.002  # rounding differences between float math


def run_python(fixture: list[dict]) -> list[dict]:
    r = Resolver()
    out = []
    for item in fixture:
        res = r.resolve(item["query"], top_k=5)
        out.append({
            "query": item["query"],
            "resolved": res.resolved,
            "code": res.code,
            "family": res.family,
            "confidence": res.confidence,
            "source": res.source,
        })
    return out


def run_ts(fixture_path: Path) -> list[dict]:
    """Invoke the Node mirror CLI."""
    result = subprocess.run(
        ["node", str(TS_CLI), str(fixture_path)],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"parity_cli.mjs exited {result.returncode}\nstderr:\n{result.stderr}"
        )
    out = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        out.append({
            "query": obj["query"],
            "resolved": obj["resolved"],
            "code": obj["code"],
            "family": obj["family"],
            "confidence": obj["confidence"],
            "source": obj["source"],
        })
    return out


def diff_row(py: dict, ts: dict) -> list[str]:
    """Return a list of field names that differ."""
    mismatches = []
    if py["resolved"] != ts["resolved"]:
        mismatches.append(f"resolved: py={py['resolved']} ts={ts['resolved']}")
    if py["code"] != ts["code"]:
        mismatches.append(f"code: py={py['code']!r} ts={ts['code']!r}")
    if py["family"] != ts["family"]:
        mismatches.append(f"family: py={py['family']!r} ts={ts['family']!r}")
    if py["source"] != ts["source"]:
        mismatches.append(f"source: py={py['source']} ts={ts['source']}")
    if abs(py["confidence"] - ts["confidence"]) > CONFIDENCE_EPSILON:
        mismatches.append(
            f"confidence: py={py['confidence']:.3f} ts={ts['confidence']:.3f}"
        )
    return mismatches


def main() -> int:
    ap = argparse.ArgumentParser(description="Cross-validate Python/TS resolver parity")
    ap.add_argument("--fixture", default=str(FIXTURE), help="Fixture JSON path")
    ap.add_argument("--verbose", action="store_true", help="Show per-query rows")
    args = ap.parse_args()

    fixture = json.loads(Path(args.fixture).read_text(encoding="utf-8"))

    try:
        ts_results = run_ts(Path(args.fixture))
    except FileNotFoundError:
        print("[parity] 'node' not found on PATH — install Node.js to run this test.")
        return 3
    except RuntimeError as e:
        print(f"[parity] TS mirror failed: {e}")
        return 4

    py_results = run_python(fixture)

    if len(py_results) != len(ts_results):
        print(f"[parity] row count mismatch: py={len(py_results)} ts={len(ts_results)}")
        return 5

    mismatches = 0
    for py, ts, item in zip(py_results, ts_results, fixture):
        diffs = diff_row(py, ts)
        if diffs:
            mismatches += 1
            print(f"[DRIFT] query={item['query']!r}")
            for d in diffs:
                print(f"    {d}")
        elif args.verbose:
            print(f"[ok]    {item['query']:<30} -> {py['code']} (conf {py['confidence']:.2f})")

    n = len(py_results)
    agree = n - mismatches
    print(f"\nparity: {agree}/{n} queries agree  ({round(100*agree/n, 1)}%)")
    if mismatches:
        print("Drift detected. Check frontend/app/api/resolve/route.ts, "
              "lo_nlp/resolve.py, and scripts/parity_cli.mjs.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
