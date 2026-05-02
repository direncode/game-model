"""Tests for scripts/arxiv_harvest.py.

The harvester is the entry point of the Atlas pipeline. Tests cover:
  - Filter behavior (withdrawn, future-dated, empty-abstract)
  - Record schema (paper_id, primary_category, archive, year, etc.)
  - Sort determinism (paper_id ascending)
  - Byte-identical re-runs given the same input
  - Stratified-by-year sampling determinism (the Phase 0 re-scoping decision)
"""
from __future__ import annotations

import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import arxiv_harvest  # noqa: E402

FIXTURE_INPUT = REPO / "tests" / "scripts" / "fixtures" / "arxiv_mini.json"
SNAPSHOT_DATE = "2026-04-30"


def _read_ndjson(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def test_filter_drops_withdrawn(tmp_path):
    out = tmp_path / "arxiv.ndjson"
    arxiv_harvest.run(
        input_path=FIXTURE_INPUT, output_path=out,
        snapshot_nominal_date=SNAPSHOT_DATE, target_per_year=0,
    )
    paper_ids = [r["paper_id"] for r in _read_ndjson(out)]
    assert "0001.00001" not in paper_ids, "withdrawn paper should be filtered"


def test_filter_drops_future_dated(tmp_path):
    out = tmp_path / "arxiv.ndjson"
    arxiv_harvest.run(
        input_path=FIXTURE_INPUT, output_path=out,
        snapshot_nominal_date=SNAPSHOT_DATE, target_per_year=0,
    )
    paper_ids = [r["paper_id"] for r in _read_ndjson(out)]
    assert "2999.99999" not in paper_ids, "future-dated paper should be filtered"


def test_filter_drops_empty_abstract(tmp_path):
    out = tmp_path / "arxiv.ndjson"
    arxiv_harvest.run(
        input_path=FIXTURE_INPUT, output_path=out,
        snapshot_nominal_date=SNAPSHOT_DATE, target_per_year=0,
    )
    paper_ids = [r["paper_id"] for r in _read_ndjson(out)]
    assert "9901.0002" not in paper_ids, "empty-abstract paper should be filtered"


def test_record_schema(tmp_path):
    out = tmp_path / "arxiv.ndjson"
    arxiv_harvest.run(
        input_path=FIXTURE_INPUT, output_path=out,
        snapshot_nominal_date=SNAPSHOT_DATE, target_per_year=0,
    )
    rec = next(r for r in _read_ndjson(out) if r["paper_id"] == "1706.03762")
    assert rec["primary_category"] == "cs.CL"
    assert rec["archive"] == "cs"
    assert rec["categories"] == ["cs.CL", "cs.LG"]
    assert rec["year"] == 2017
    assert rec["authors_count"] == 2
    assert rec["title"] == "Attention Is All You Need"
    assert rec["text"].startswith("Attention Is All You Need\n\n")
    assert "abstract" in rec["text"].lower() or "neural" in rec["text"].lower()


def test_legacy_dashed_archive(tmp_path):
    out = tmp_path / "arxiv.ndjson"
    arxiv_harvest.run(
        input_path=FIXTURE_INPUT, output_path=out,
        snapshot_nominal_date=SNAPSHOT_DATE, target_per_year=0,
    )
    rec = next(r for r in _read_ndjson(out) if r["paper_id"] == "9901.0001")
    assert rec["primary_category"] == "hep-th"
    assert rec["archive"] == "hep-th", "legacy dashed categories without dot are their own archive"


def test_sorted_by_paper_id(tmp_path):
    out = tmp_path / "arxiv.ndjson"
    arxiv_harvest.run(
        input_path=FIXTURE_INPUT, output_path=out,
        snapshot_nominal_date=SNAPSHOT_DATE, target_per_year=0,
    )
    ids = [r["paper_id"] for r in _read_ndjson(out)]
    assert ids == sorted(ids), f"records not sorted by paper_id: {ids}"


def test_byte_identical_on_rerun(tmp_path):
    out_a = tmp_path / "a.ndjson"
    out_b = tmp_path / "b.ndjson"
    arxiv_harvest.run(input_path=FIXTURE_INPUT, output_path=out_a,
                      snapshot_nominal_date=SNAPSHOT_DATE, target_per_year=0)
    arxiv_harvest.run(input_path=FIXTURE_INPUT, output_path=out_b,
                      snapshot_nominal_date=SNAPSHOT_DATE, target_per_year=0)
    sha_a = hashlib.sha256(out_a.read_bytes()).hexdigest()
    sha_b = hashlib.sha256(out_b.read_bytes()).hexdigest()
    assert sha_a == sha_b, "harvester output should be byte-identical between runs"


def test_stratified_sampling_caps_per_year(tmp_path):
    """Year 2015 has 2 papers in the fixture; targeting 1/year should keep 1."""
    out = tmp_path / "arxiv.ndjson"
    arxiv_harvest.run(
        input_path=FIXTURE_INPUT, output_path=out,
        snapshot_nominal_date=SNAPSHOT_DATE, target_per_year=1,
    )
    by_year = Counter(r["year"] for r in _read_ndjson(out))
    for year, count in by_year.items():
        assert count <= 1, f"year {year} kept {count} papers, expected <=1 with target_per_year=1"


def test_stratified_sampling_takes_all_when_under_target(tmp_path):
    """Year 1999 has 1 paper (after filtering empty-abstract); target=10/year keeps it."""
    out = tmp_path / "arxiv.ndjson"
    arxiv_harvest.run(
        input_path=FIXTURE_INPUT, output_path=out,
        snapshot_nominal_date=SNAPSHOT_DATE, target_per_year=10,
    )
    paper_ids = [r["paper_id"] for r in _read_ndjson(out)]
    assert "9901.0001" in paper_ids, "single 1999 paper should be kept when target exceeds available"


def test_stratified_sampling_deterministic(tmp_path):
    """Two runs at the same target_per_year produce byte-identical output."""
    out_a = tmp_path / "a.ndjson"
    out_b = tmp_path / "b.ndjson"
    arxiv_harvest.run(input_path=FIXTURE_INPUT, output_path=out_a,
                      snapshot_nominal_date=SNAPSHOT_DATE, target_per_year=1)
    arxiv_harvest.run(input_path=FIXTURE_INPUT, output_path=out_b,
                      snapshot_nominal_date=SNAPSHOT_DATE, target_per_year=1)
    assert out_a.read_bytes() == out_b.read_bytes()


def test_canonical_json_serialization(tmp_path):
    """Each record line is canonical JSON: sorted keys, no whitespace, UTF-8."""
    out = tmp_path / "arxiv.ndjson"
    arxiv_harvest.run(
        input_path=FIXTURE_INPUT, output_path=out,
        snapshot_nominal_date=SNAPSHOT_DATE, target_per_year=0,
    )
    raw = out.read_text(encoding="utf-8")
    for line in raw.splitlines():
        # Round-trip and re-canonicalize; must produce the same string.
        rec = json.loads(line)
        canonical = json.dumps(rec, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        assert canonical == line, f"line is not canonical JSON:\n  got:      {line}\n  expected: {canonical}"


def test_run_returns_stats(tmp_path):
    out = tmp_path / "arxiv.ndjson"
    stats = arxiv_harvest.run(
        input_path=FIXTURE_INPUT, output_path=out,
        snapshot_nominal_date=SNAPSHOT_DATE, target_per_year=0,
    )
    assert stats["total_input_records"] == 11
    assert stats["skipped_withdrawn"] == 1
    assert stats["skipped_future"] == 1
    assert stats["skipped_empty"] == 1
    assert stats["kept_records"] == 8
