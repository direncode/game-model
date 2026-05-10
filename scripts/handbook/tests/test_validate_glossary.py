"""Tests for validate_glossary."""

from pathlib import Path

from scripts.handbook.parse_chapter import parse_chapter
from scripts.handbook.validate_glossary import validate_glossary

FIXTURES = Path(__file__).parent / "fixtures"


def test_italicized_term_without_entry_is_error(tmp_path: Path):
    chap = parse_chapter(FIXTURES / "good_chapter.md")
    glossary = tmp_path / "glossary.md"
    glossary.write_text(
        "---\nslug: g\nnumber: null\ntitle: t\npromise: \"x\"\nstatus: draft\n---\n\n"
        "# Glossary\n",
        encoding="utf-8",
    )
    errors = validate_glossary([chap], glossary)
    assert errors, "expected an error since 'example' isn't in glossary"
    assert any("example" in e for e in errors)


def test_italicized_term_with_entry_passes(tmp_path: Path):
    chap = parse_chapter(FIXTURES / "good_chapter.md")
    glossary = tmp_path / "glossary.md"
    glossary.write_text(
        "---\nslug: g\nnumber: null\ntitle: t\npromise: \"x\"\nstatus: draft\n---\n\n"
        "# Glossary\n\n"
        "## example\n\nThe example term.\n",
        encoding="utf-8",
    )
    assert validate_glossary([chap], glossary) == []


def test_stoplist_words_ignored(tmp_path: Path):
    chap_path = tmp_path / "ch.md"
    chap_path.write_text(
        "---\nslug: ch\nnumber: 1\ntitle: ch\npromise: \"x\"\nstatus: draft\n---\n\n"
        "# Ch\n\n"
        "## Concepts in this chapter\n\n"
        "Here are _the_ and _and_ italicized but they should be ignored.\n\n"
        "## Wider system\n\n## Exercises\n\n## What's next\n",
        encoding="utf-8",
    )
    glossary = tmp_path / "glossary.md"
    glossary.write_text(
        "---\nslug: g\nnumber: null\ntitle: t\npromise: \"x\"\nstatus: draft\n---\n\n"
        "# Glossary\n",
        encoding="utf-8",
    )
    chap = parse_chapter(chap_path)
    assert validate_glossary([chap], glossary) == []


def test_code_block_terms_ignored(tmp_path: Path):
    chap_path = tmp_path / "ch.md"
    chap_path.write_text(
        "---\nslug: ch\nnumber: 1\ntitle: ch\npromise: \"x\"\nstatus: draft\n---\n\n"
        "# Ch\n\n## Concepts in this chapter\n\n"
        "```python\n_secret_word\n```\n\n"
        "## Wider system\n\n## Exercises\n\n## What's next\n",
        encoding="utf-8",
    )
    glossary = tmp_path / "glossary.md"
    glossary.write_text(
        "---\nslug: g\nnumber: null\ntitle: t\npromise: \"x\"\nstatus: draft\n---\n\n"
        "# Glossary\n",
        encoding="utf-8",
    )
    chap = parse_chapter(chap_path)
    assert validate_glossary([chap], glossary) == []


def test_bold_not_treated_as_italic(tmp_path: Path):
    chap_path = tmp_path / "ch.md"
    chap_path.write_text(
        "---\nslug: ch\nnumber: 1\ntitle: ch\npromise: \"x\"\nstatus: draft\n---\n\n"
        "# Ch\n\n## Concepts in this chapter\n\n"
        "This **boldword** should not be flagged.\n\n"
        "## Wider system\n\n## Exercises\n\n## What's next\n",
        encoding="utf-8",
    )
    glossary = tmp_path / "glossary.md"
    glossary.write_text(
        "---\nslug: g\nnumber: null\ntitle: t\npromise: \"x\"\nstatus: draft\n---\n\n"
        "# Glossary\n",
        encoding="utf-8",
    )
    chap = parse_chapter(chap_path)
    assert validate_glossary([chap], glossary) == []
