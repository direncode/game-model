"""Tests for scripts/pulse_harvest.py.

The harvester is the entry point of the Pulse pipeline. Tests cover:
  - canonical_name normalization (Surname I I form)
  - record schema produced from PatentsView TSV joins
  - co-inventor canonical-name list per record
  - text payload contains the right fields and EXCLUDES patentsview_inventor_id
  - year extraction from patent_date
  - byte-identical re-runs given the same input
  - canonical JSON serialization
  - two-stage sampling (per_name_cap and target_per_year)
"""
from __future__ import annotations

import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import pulse_harvest  # noqa: E402

FIXTURE_DIR = REPO / "tests" / "scripts" / "fixtures" / "patentsview_mini"


def _read_ndjson(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def test_canonical_name_simple():
    assert pulse_harvest.canonical_name("John", "Smith") == "Smith J"


def test_canonical_name_with_middle_initial():
    assert pulse_harvest.canonical_name("J W", "Smith") == "Smith J W"
    assert pulse_harvest.canonical_name("John W", "Smith") == "Smith J W"


def test_canonical_name_strips_punctuation():
    assert pulse_harvest.canonical_name("J.", "Smith") == "Smith J"
    assert pulse_harvest.canonical_name("J. W.", "Smith") == "Smith J W"


def test_canonical_name_handles_apostrophes_and_hyphens():
    assert pulse_harvest.canonical_name("Mary-Anne", "OConnor-Doyle") == "OConnor-Doyle M"
    assert pulse_harvest.canonical_name("Pat", "O'Brien") == "OBrien P"


def test_canonical_name_empty_first():
    assert pulse_harvest.canonical_name("", "Smith") == "Smith"


def test_harvest_produces_one_record_per_inventor_appearance(tmp_path):
    out = tmp_path / "pulse.ndjson"
    pulse_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_path=out,
        snapshot_nominal_date="2026-04-30",
        target_per_year=0,
        per_name_cap=100,
    )
    records = _read_ndjson(out)
    # 5 inventor-appearances in the fixture (no rows filtered by date or per_name_cap)
    assert len(records) == 5


def test_harvest_includes_co_inventors(tmp_path):
    out = tmp_path / "pulse.ndjson"
    pulse_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_path=out,
        snapshot_nominal_date="2026-04-30",
        target_per_year=0, per_name_cap=100,
    )
    records = _read_ndjson(out)
    rec_smith_a = next(r for r in records if r["patent_id"] == "10000001" and r["inventor_seq"] == 0)
    assert rec_smith_a["co_inventors_canonical"] == ["Chen A"]


def test_harvest_text_contains_signals(tmp_path):
    out = tmp_path / "pulse.ndjson"
    pulse_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_path=out,
        snapshot_nominal_date="2026-04-30",
        target_per_year=0, per_name_cap=100,
    )
    records = _read_ndjson(out)
    smith = next(r for r in records if r["patent_id"] == "10000001" and r["inventor_seq"] == 0)
    # text starts with canonical name
    assert smith["text"].startswith("Smith J")
    # text contains co-inventor canonical name
    assert "Chen A" in smith["text"]
    # text contains assignee_id
    assert "asg_apple" in smith["text"]
    # text contains city
    assert "Cupertino" in smith["text"]
    # text does NOT contain patentsview_inventor_id (firewall: gold not in fingerprint)
    assert "inv_aaa" not in smith["text"]


def test_harvest_year_extraction(tmp_path):
    out = tmp_path / "pulse.ndjson"
    pulse_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_path=out,
        snapshot_nominal_date="2026-04-30",
        target_per_year=0, per_name_cap=100,
    )
    records = _read_ndjson(out)
    years = sorted(set(r["year"] for r in records))
    assert years == [2017, 2018, 2019]


def test_harvest_canonical_name_in_record_field(tmp_path):
    out = tmp_path / "pulse.ndjson"
    pulse_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_path=out,
        snapshot_nominal_date="2026-04-30",
        target_per_year=0, per_name_cap=100,
    )
    records = _read_ndjson(out)
    smith = next(r for r in records if r["patent_id"] == "10000001" and r["inventor_seq"] == 0)
    assert smith["canonical_name"] == "Smith J"
    # PatentsView's not-disambiguated raw shows "John W Smith"; canonical_name uses
    # the disambiguated first/last fields ("John", "Smith") -> "Smith J"


def test_harvest_byte_identical_on_rerun(tmp_path):
    out_a = tmp_path / "a.ndjson"
    out_b = tmp_path / "b.ndjson"
    for out in (out_a, out_b):
        pulse_harvest.run(
            fixtures_dir=FIXTURE_DIR, output_path=out,
            snapshot_nominal_date="2026-04-30",
            target_per_year=0, per_name_cap=100,
        )
    assert hashlib.sha256(out_a.read_bytes()).hexdigest() == hashlib.sha256(out_b.read_bytes()).hexdigest()


def test_harvest_canonical_json_serialization(tmp_path):
    out = tmp_path / "pulse.ndjson"
    pulse_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_path=out,
        snapshot_nominal_date="2026-04-30",
        target_per_year=0, per_name_cap=100,
    )
    for line in out.read_text(encoding="utf-8").splitlines():
        rec = json.loads(line)
        canonical = json.dumps(rec, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        assert canonical == line, f"line is not canonical JSON:\n  got:      {line}\n  expected: {canonical}"


def test_harvest_per_name_cap_limits_collisions(tmp_path):
    """When per_name_cap=1 and the corpus has 2 records with canonical_name 'Smith J',
    only 1 should survive."""
    out = tmp_path / "pulse.ndjson"
    pulse_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_path=out,
        snapshot_nominal_date="2026-04-30",
        target_per_year=0,
        per_name_cap=1,
    )
    records = _read_ndjson(out)
    name_counts = Counter(r["canonical_name"] for r in records)
    for name, count in name_counts.items():
        assert count <= 1, f"canonical_name '{name}' kept {count} records, expected <= per_name_cap=1"
