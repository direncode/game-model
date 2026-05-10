"""Tests for validate_corpora."""

from pathlib import Path

from scripts.handbook.parse_chapter import parse_chapter
from scripts.handbook.validate_corpora import validate_corpora

FIXTURES = Path(__file__).parent / "fixtures"


def test_good_chapter_runnable_snippet_lacks_corpus():
    # good_chapter.md has `pipeline P { }` which doesn't reference any
    # allowed corpus; that's an error.
    chap = parse_chapter(FIXTURES / "good_chapter.md")
    errors = validate_corpora(chap)
    assert errors


def test_runnable_with_corpus_passes(tmp_path: Path):
    p = tmp_path / "ch.md"
    p.write_text(
        "---\nslug: ch\nnumber: 1\ntitle: ch\npromise: \"x\"\nstatus: draft\n---\n\n"
        "# Ch\n\n## Concepts in this chapter\n\n"
        "```ocean\npipeline P { source = toy_tna_50 }\n```\n\n"
        "## Wider system\n\n## Exercises\n\n## What's next\n",
        encoding="utf-8",
    )
    chap = parse_chapter(p)
    assert validate_corpora(chap) == []


def test_static_block_skipped(tmp_path: Path):
    p = tmp_path / "ch.md"
    p.write_text(
        "---\nslug: ch\nnumber: 1\ntitle: ch\npromise: \"x\"\nstatus: draft\n---\n\n"
        "# Ch\n\n## Concepts in this chapter\n\n"
        "```ocean static\npipeline NoCorpus { }\n```\n\n"
        "## Wider system\n\n## Exercises\n\n## What's next\n",
        encoding="utf-8",
    )
    chap = parse_chapter(p)
    assert validate_corpora(chap) == []
