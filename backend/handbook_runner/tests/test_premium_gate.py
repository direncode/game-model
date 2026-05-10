"""Tests for premium_gate: the operator registry."""
from __future__ import annotations
import pytest

from backend.handbook_runner.premium_gate import (
    OPERATOR_REGISTRY,
    is_free_tier,
    is_premium,
    diagnostic_for_premium_op,
)


def test_free_tier_operators_present():
    free = {name for name, op in OPERATOR_REGISTRY.items() if op.tier == "free"}
    assert "load.ndjson" in free
    assert "embed.tfidf_jl" in free
    assert "cluster.kmeans" in free
    assert "align.module" in free
    assert "find.dispersion_per_label" in free
    assert "persist.json" in free


def test_premium_operators_present():
    premium = {name for name, op in OPERATOR_REGISTRY.items() if op.tier == "premium"}
    assert "embed.content_fp48" in premium
    assert "reduce.btut" in premium
    assert "cluster.tcd_recursive_loop" in premium
    assert "align.dispersion" in premium


def test_tier_helpers():
    assert is_free_tier("load.ndjson")
    assert not is_premium("load.ndjson")
    assert is_premium("reduce.btut")
    assert not is_free_tier("reduce.btut")


def test_unknown_op_is_not_free_or_premium():
    assert not is_free_tier("operator.does_not_exist")
    assert not is_premium("operator.does_not_exist")


def test_diagnostic_for_premium_op():
    diag = diagnostic_for_premium_op("reduce.btut", line=5, col=1)
    assert diag["category"] == "runtime"
    assert "api key" in diag["diagnostic"]["message"].lower()
    assert "latentocean.com/protocols" in diag["diagnostic"]["hint"]
    assert diag["diagnostic"]["line"] == 5
