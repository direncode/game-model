"""Validate that every runnable OCEAN snippet references an allowed toy corpus.

The three sanctioned demo corpora are:

- toy_tna_50
- toy_nslkdd_200
- toy_climate_100

A runnable `ocean` fenced block must mention at least one of these strings.
Snippets with info `ocean static` are skipped.
"""

from __future__ import annotations

from pathlib import Path

from scripts.handbook.parse_chapter import Chapter, parse_chapter

ALLOWED_CORPORA = ("toy_tna_50", "toy_nslkdd_200", "toy_climate_100")


def _is_runnable(info: str) -> bool:
    parts = info.split()
    if not parts or parts[0] != "ocean":
        return False
    return "static" not in parts[1:]


def validate_corpora(chapter: Chapter) -> list[str]:
    errors: list[str] = []
    for snippet in chapter.snippets:
        if not _is_runnable(snippet.info):
            continue
        if not any(corpus in snippet.content for corpus in ALLOWED_CORPORA):
            errors.append(
                f"{chapter.path}:{snippet.line_no}: runnable snippet does not "
                f"reference one of {ALLOWED_CORPORA}"
            )
    return errors


def validate_corpora_path(path: str | Path) -> list[str]:
    return validate_corpora(parse_chapter(path))
