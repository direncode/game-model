"""Regression: ``cluster x using kmeans`` MUST select cluster.kmeans.

Before the patch the parser silently dropped the variant for `cluster`
and `kmeans` resolved to the default `cluster.tcd_recursive_loop`. That
produced wrong results without any error from the type-checker. This
test pins both arms (legal variant + unknown variant) of the fix.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.ocean.parser import parse_ocean, ParseError  # noqa: E402


_PREFIX = """\
seed 42
load corpus.ndjson take 100 records balanced by label label field is label
embed text into 128 dimensions using tf-idf
"""


def _get_step_kinds(source: str):
    prog = parse_ocean(source, source_name="<test>")
    # `parse_ocean` returns either the AST or a dict; we accept both shapes
    # so this test stays resilient to small refactors.
    if hasattr(prog, "statements"):
        return [getattr(s, "operator_kind", None) for s in prog.statements]
    if isinstance(prog, dict) and "steps" in prog:
        return [s.get("kind") for s in prog["steps"]]
    raise AssertionError(f"unexpected parse result type: {type(prog)}")


def test_cluster_using_kmeans_resolves_to_cluster_kmeans() -> None:
    src = _PREFIX + "cluster for 16 rounds max 24 modules using kmeans\n"
    kinds = _get_step_kinds(src)
    assert "cluster.kmeans" in kinds, kinds


def test_cluster_using_tcd_resolves_to_tcd_recursive_loop() -> None:
    src = _PREFIX + "cluster for 16 rounds max 24 modules using tcd recursive loop\n"
    kinds = _get_step_kinds(src)
    assert "cluster.tcd_recursive_loop" in kinds, kinds


def test_cluster_using_bogus_variant_raises_parse_error() -> None:
    src = _PREFIX + "cluster for 16 rounds max 24 modules using madeupthing\n"
    with pytest.raises(ParseError):
        parse_ocean(src, source_name="<test>")
