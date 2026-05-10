"""Tests for validate_skeleton."""

from pathlib import Path

from scripts.handbook.parse_chapter import parse_chapter
from scripts.handbook.validate_skeleton import validate_skeleton

FIXTURES = Path(__file__).parent / "fixtures"


def test_good_chapter_skeleton_ok():
    chap = parse_chapter(FIXTURES / "good_chapter.md")
    # good_chapter has placeholder=False (we wrote a real promise).
    errors = validate_skeleton(chap)
    assert errors == [], f"expected no errors, got: {errors}"


def test_bad_skeleton_reports_missing_sections():
    chap = parse_chapter(FIXTURES / "bad_skeleton.md")
    errors = validate_skeleton(chap)
    assert errors
    joined = " | ".join(errors)
    assert "Concepts in this chapter" in joined
    assert "Wider system" in joined
    assert "Exercises" in joined
    assert "What's next" in joined


def test_appendix_with_null_number_ok(tmp_path: Path):
    p = tmp_path / "app-x.md"
    p.write_text(
        "---\n"
        "slug: app-x\n"
        "number: null\n"
        "title: Appendix X\n"
        "promise: \"(placeholder)\"\n"
        "status: draft\n"
        "---\n\n"
        "# Appendix X\n",
        encoding="utf-8",
    )
    chap = parse_chapter(p)
    assert validate_skeleton(chap) == []


def test_placeholder_promise_on_numbered_chapter_is_error(tmp_path: Path):
    p = tmp_path / "ch.md"
    p.write_text(
        "---\n"
        "slug: ch\n"
        "number: 1\n"
        "title: Ch\n"
        "promise: \"(placeholder)\"\n"
        "status: draft\n"
        "---\n\n"
        "# Ch\n\n"
        "## Concepts in this chapter\n\n"
        "## Wider system\n\n"
        "## Exercises\n\n"
        "## What's next\n",
        encoding="utf-8",
    )
    chap = parse_chapter(p)
    errors = validate_skeleton(chap)
    assert any("placeholder promise" in e for e in errors)
