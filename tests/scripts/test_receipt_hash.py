"""Tests for scripts/receipt_hash.py - the receipt-hash derivation primitive.

This module's hash function is the foundation of the entire chain.
The Python and TypeScript implementations must produce byte-identical hashes,
so we test against a known concatenation string and its SHA-256.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import receipt_hash  # noqa: E402


FIXTURE = REPO / "tests" / "scripts" / "fixtures" / "receipt_known_inputs.json"


def test_derive_returns_concatenation_string():
    fix = json.loads(FIXTURE.read_text())
    concat = receipt_hash.derive_concat(**fix["input"])
    assert concat == fix["expected_concat"]


def test_derive_hash_matches_sha256_of_concat():
    fix = json.loads(FIXTURE.read_text())
    expected = hashlib.sha256(fix["expected_concat"].encode("utf-8")).hexdigest()
    actual = receipt_hash.derive_hash(**fix["input"])
    assert actual == expected


def test_genesis_when_prev_is_none():
    h = receipt_hash.derive_concat(
        prev_receipt_hash=None,
        prompt_hash="a" * 64, schema_hash="b" * 64,
        corpus_sha256="c" * 64, model_id="x",
        timestamp="2026-01-01T00:00:00.000Z",
        output_sha256="d" * 64,
    )
    assert h.startswith("GENESIS|")


def test_chain_link_when_prev_provided():
    h = receipt_hash.derive_concat(
        prev_receipt_hash="prev123",
        prompt_hash="a" * 64, schema_hash="b" * 64,
        corpus_sha256="c" * 64, model_id="x",
        timestamp="2026-01-01T00:00:00.000Z",
        output_sha256="d" * 64,
    )
    assert h.startswith("prev123|")


def test_seven_pipe_separated_fields():
    """The concat is exactly 7 fields joined by '|', regardless of input."""
    fix = json.loads(FIXTURE.read_text())
    concat = receipt_hash.derive_concat(**fix["input"])
    assert concat.count("|") == 6, "expected exactly 6 pipes (7 fields)"


def test_derive_hash_changes_with_any_input_change():
    """Tampering any field should produce a different hash."""
    base = {
        "prev_receipt_hash": None,
        "prompt_hash": "0" * 64, "schema_hash": "1" * 64,
        "corpus_sha256": "2" * 64, "model_id": "x",
        "timestamp": "2026-01-01T00:00:00.000Z",
        "output_sha256": "3" * 64,
    }
    h0 = receipt_hash.derive_hash(**base)
    h1 = receipt_hash.derive_hash(**{**base, "output_sha256": "X" * 64})
    h2 = receipt_hash.derive_hash(**{**base, "model_id": "y"})
    h3 = receipt_hash.derive_hash(**{**base, "timestamp": "2026-01-01T00:00:01.000Z"})
    assert len({h0, h1, h2, h3}) == 4, "different inputs must produce different hashes"
