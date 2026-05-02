"""Tests for scripts/receipt_harvest.py.

The harvester takes a directory of pre-fetched SEC EDGAR 10-K filing texts
and produces a deterministic filings_index.json. Live SEC fetch is NOT
tested here (operator runbook tests that integration in pre-flight).
"""
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import receipt_harvest  # noqa: E402

FIXTURE_DIR = REPO / "tests" / "scripts" / "fixtures" / "sec_edgar_mini"


def test_parse_accession_components():
    cik, year, seq = receipt_harvest.parse_accession("0000320193-24-000123")
    assert cik == "0000320193"
    assert year == 2024
    assert seq == "000123"


def test_parse_accession_2019_filing():
    cik, year, seq = receipt_harvest.parse_accession("0000051143-19-000789")
    assert year == 2019


def test_parse_accession_invalid_raises():
    import pytest
    with pytest.raises(ValueError):
        receipt_harvest.parse_accession("not-a-real-accession")


def test_corpus_sha256_per_filing(tmp_path):
    """Each filing's corpus_sha256 is the sha256 of its raw .txt bytes."""
    out_index = tmp_path / "filings_index.json"
    receipt_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_index=out_index, target_n=10,
    )
    index = json.loads(out_index.read_text())
    for entry in index["filings"]:
        filing_path = FIXTURE_DIR / f"{entry['accession_number']}.txt"
        expected = hashlib.sha256(filing_path.read_bytes()).hexdigest()
        assert entry["corpus_sha256"] == expected


def test_filings_index_is_sorted_by_filing_id(tmp_path):
    out_index = tmp_path / "filings_index.json"
    receipt_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_index=out_index, target_n=10,
    )
    index = json.loads(out_index.read_text())
    ids = [e["filing_id"] for e in index["filings"]]
    assert ids == sorted(ids), f"filings not sorted by filing_id: {ids}"


def test_filings_index_byte_identical_on_rerun(tmp_path):
    out_a = tmp_path / "a.json"
    out_b = tmp_path / "b.json"
    receipt_harvest.run(fixtures_dir=FIXTURE_DIR, output_index=out_a, target_n=10)
    receipt_harvest.run(fixtures_dir=FIXTURE_DIR, output_index=out_b, target_n=10)
    assert hashlib.sha256(out_a.read_bytes()).hexdigest() == hashlib.sha256(out_b.read_bytes()).hexdigest()


def test_filing_id_format():
    """filing_id is `<accession_number>-10K`."""
    fid = receipt_harvest.make_filing_id("0000320193-24-000123")
    assert fid == "0000320193-24-000123-10K"


def test_target_n_caps_output(tmp_path):
    out_index = tmp_path / "filings_index.json"
    receipt_harvest.run(fixtures_dir=FIXTURE_DIR, output_index=out_index, target_n=2)
    index = json.loads(out_index.read_text())
    assert index["n_filings"] == 2


def test_filings_have_required_fields(tmp_path):
    out_index = tmp_path / "filings_index.json"
    receipt_harvest.run(fixtures_dir=FIXTURE_DIR, output_index=out_index, target_n=10)
    index = json.loads(out_index.read_text())
    required = {"filing_id", "accession_number", "cik", "year", "form", "edgar_url", "corpus_sha256", "filing_text_path"}
    for entry in index["filings"]:
        assert required.issubset(entry.keys()), f"missing fields: {required - entry.keys()}"
