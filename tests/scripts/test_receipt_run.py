"""Tests for scripts/receipt_run.py - the run orchestrator's chain logic.

The Anthropic API call itself is not exercised here. The chain integrity logic
is what's tested: each receipt's prev_receipt_hash must equal the previous
receipt's receipt_hash, and the chain head must be the last receipt's
receipt_hash.
"""
from __future__ import annotations
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import receipt_run  # noqa: E402


def test_mint_chain_links_receipts_in_order():
    inputs = [
        {"filing_id": "f1", "corpus_sha256": "a" * 64, "output_sha256": "b" * 64, "timestamp": "2026-05-02T12:00:00.000Z"},
        {"filing_id": "f2", "corpus_sha256": "c" * 64, "output_sha256": "d" * 64, "timestamp": "2026-05-02T12:00:01.000Z"},
        {"filing_id": "f3", "corpus_sha256": "e" * 64, "output_sha256": "f" * 64, "timestamp": "2026-05-02T12:00:02.000Z"},
    ]
    receipts = receipt_run.mint_chain(
        inputs,
        prompt_hash="0" * 64, schema_hash="1" * 64, model_id="claude-sonnet-4-6-test",
    )
    assert receipts[0]["prev_receipt_hash"] is None
    assert receipts[1]["prev_receipt_hash"] == receipts[0]["receipt_hash"]
    assert receipts[2]["prev_receipt_hash"] == receipts[1]["receipt_hash"]


def test_chain_head_is_last_receipt_hash():
    inputs = [
        {"filing_id": "f1", "corpus_sha256": "a" * 64, "output_sha256": "b" * 64, "timestamp": "2026-05-02T12:00:00.000Z"},
        {"filing_id": "f2", "corpus_sha256": "c" * 64, "output_sha256": "d" * 64, "timestamp": "2026-05-02T12:00:01.000Z"},
    ]
    receipts = receipt_run.mint_chain(
        inputs, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x",
    )
    head = receipt_run.chain_head(receipts)
    assert head == receipts[-1]["receipt_hash"]


def test_chain_head_empty_when_no_receipts():
    assert receipt_run.chain_head([]) == ""


def test_verify_chain_passes_for_valid_chain():
    inputs = [
        {"filing_id": "f1", "corpus_sha256": "a" * 64, "output_sha256": "b" * 64, "timestamp": "2026-05-02T12:00:00.000Z"},
        {"filing_id": "f2", "corpus_sha256": "c" * 64, "output_sha256": "d" * 64, "timestamp": "2026-05-02T12:00:01.000Z"},
    ]
    receipts = receipt_run.mint_chain(inputs, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x")
    ok, err = receipt_run.verify_chain(receipts, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x")
    assert ok is True
    assert err is None


def test_verify_chain_fails_when_receipt_tampered():
    inputs = [
        {"filing_id": "f1", "corpus_sha256": "a" * 64, "output_sha256": "b" * 64, "timestamp": "2026-05-02T12:00:00.000Z"},
        {"filing_id": "f2", "corpus_sha256": "c" * 64, "output_sha256": "d" * 64, "timestamp": "2026-05-02T12:00:01.000Z"},
    ]
    receipts = receipt_run.mint_chain(inputs, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x")
    receipts[1] = {**receipts[1], "output_sha256": "X" * 64}
    ok, err = receipt_run.verify_chain(receipts, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x")
    assert ok is False
    assert err is not None and "receipt_hash" in err


def test_verify_chain_fails_when_link_broken():
    inputs = [
        {"filing_id": "f1", "corpus_sha256": "a" * 64, "output_sha256": "b" * 64, "timestamp": "2026-05-02T12:00:00.000Z"},
        {"filing_id": "f2", "corpus_sha256": "c" * 64, "output_sha256": "d" * 64, "timestamp": "2026-05-02T12:00:01.000Z"},
    ]
    receipts = receipt_run.mint_chain(inputs, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x")
    receipts[1] = {**receipts[1], "prev_receipt_hash": "Y" * 64}
    ok, err = receipt_run.verify_chain(receipts, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x")
    assert ok is False
    assert err is not None


def test_verify_chain_genesis_receipt_with_wrong_prev():
    """First receipt's prev should be None; if it's anything else, verify fails."""
    inputs = [
        {"filing_id": "f1", "corpus_sha256": "a" * 64, "output_sha256": "b" * 64, "timestamp": "2026-05-02T12:00:00.000Z"},
    ]
    receipts = receipt_run.mint_chain(inputs, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x")
    receipts[0] = {**receipts[0], "prev_receipt_hash": "not-genesis"}
    ok, err = receipt_run.verify_chain(receipts, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x")
    assert ok is False
