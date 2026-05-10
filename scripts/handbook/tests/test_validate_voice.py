"""Tests for validate_voice."""

from pathlib import Path

from scripts.handbook.parse_chapter import parse_chapter
from scripts.handbook.validate_voice import validate_voice


def _chapter(tmp_path: Path, body: str):
    p = tmp_path / "ch.md"
    p.write_text(
        "---\nslug: ch\nnumber: 1\ntitle: ch\npromise: \"x\"\nstatus: draft\n---\n\n"
        + body,
        encoding="utf-8",
    )
    return parse_chapter(p)


def test_first_person_pronouns_flagged(tmp_path: Path):
    chap = _chapter(tmp_path, "# Ch\n\nWe build things and our work is great.\n")
    errors = validate_voice(chap)
    assert any("we" in e.lower() for e in errors)
    assert any("our" in e.lower() for e in errors)


def test_finance_acronyms_flagged(tmp_path: Path):
    chap = _chapter(tmp_path, "# Ch\n\nThe ARR grew alongside MRR.\n")
    errors = validate_voice(chap)
    joined = " | ".join(errors)
    assert "ARR" in joined
    assert "MRR" in joined


def test_growth_percent_flagged(tmp_path: Path):
    chap = _chapter(tmp_path, "# Ch\n\nExpect 30% growth and a 40% forecast.\n")
    errors = validate_voice(chap)
    joined = " | ".join(errors)
    assert "30% growth" in joined or "30 % growth" in joined.replace(" %", "%")
    assert "forecast" in joined


def test_code_block_content_not_flagged(tmp_path: Path):
    chap = _chapter(
        tmp_path,
        "# Ch\n\n```\nwe our ARR 30% growth\n```\n\nProse line.\n",
    )
    errors = validate_voice(chap)
    assert errors == []


def test_clean_prose_passes(tmp_path: Path):
    chap = _chapter(
        tmp_path,
        "# Ch\n\nThis chapter describes the pipeline. The compiler accepts it.\n",
    )
    assert validate_voice(chap) == []
