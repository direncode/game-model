"""Tests for parse_chapter."""

from pathlib import Path

import pytest

from scripts.handbook.parse_chapter import ParseChapterError, parse_chapter

FIXTURES = Path(__file__).parent / "fixtures"


def test_parse_good_chapter_extracts_frontmatter():
    chap = parse_chapter(FIXTURES / "good_chapter.md")
    assert chap.frontmatter["slug"] == "example-chapter"
    assert chap.frontmatter["number"] == 1
    assert chap.frontmatter["title"] == "Example Chapter"
    assert chap.frontmatter["status"] == "draft"


def test_parse_good_chapter_extracts_title():
    chap = parse_chapter(FIXTURES / "good_chapter.md")
    assert chap.title == "Example Chapter"


def test_parse_good_chapter_finds_required_sections():
    chap = parse_chapter(FIXTURES / "good_chapter.md")
    h2_texts = {h.text for h in chap.headings if h.level == 2}
    assert "Concepts in this chapter" in h2_texts
    assert "Wider system" in h2_texts
    assert "Exercises" in h2_texts
    assert "What's next" in h2_texts


def test_parse_good_chapter_finds_two_snippets():
    chap = parse_chapter(FIXTURES / "good_chapter.md")
    assert len(chap.snippets) == 2
    infos = [s.info for s in chap.snippets]
    assert "ocean" in infos
    assert "ocean static" in infos


def test_parse_bad_skeleton_still_parses_frontmatter():
    chap = parse_chapter(FIXTURES / "bad_skeleton.md")
    assert chap.frontmatter["slug"] == "bad-chapter"
    # No H2 sections in the bad skeleton.
    assert [h for h in chap.headings if h.level == 2] == []


def test_parse_no_frontmatter_raises(tmp_path: Path):
    p = tmp_path / "no_fm.md"
    p.write_text("# No Frontmatter\n", encoding="utf-8")
    with pytest.raises(ParseChapterError):
        parse_chapter(p)


def test_parse_unterminated_frontmatter_raises(tmp_path: Path):
    p = tmp_path / "broken.md"
    p.write_text("---\nslug: foo\n# never closes\n", encoding="utf-8")
    with pytest.raises(ParseChapterError):
        parse_chapter(p)
