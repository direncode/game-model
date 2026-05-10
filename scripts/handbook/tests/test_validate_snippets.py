"""Tests for validate_snippets."""

from pathlib import Path

from scripts.handbook.parse_chapter import parse_chapter
from scripts.handbook.validate_snippets import validate_snippets

FIXTURES = Path(__file__).parent / "fixtures"


def test_bad_snippet_reports_error():
    chap = parse_chapter(FIXTURES / "bad_snippet.md")
    errors = validate_snippets(chap)
    assert errors, "expected errors for bad_snippet.md"
    assert any("bad_snippet.md" in e for e in errors)


def test_static_blocks_are_skipped():
    chap = parse_chapter(FIXTURES / "good_chapter.md")
    # good_chapter has one runnable and one static block; the static one
    # may not parse, but it must not be validated.
    errors = validate_snippets(chap)
    # No errors should mention the static block's line.
    static_lines = [s.line_no for s in chap.snippets if "static" in s.info.split()[1:]]
    for e in errors:
        for sl in static_lines:
            assert f":{sl}:" not in e, f"static block at {sl} was validated: {e}"
