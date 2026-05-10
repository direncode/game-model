"""Validate the voice/style of chapter prose.

Forbidden patterns (in prose only, not in code blocks or frontmatter):

- First-person pronouns: `we`, `our`, `us`, `ours`, `i` (whole-word, case-insensitive).
- Finance projection acronyms: `ARR`, `MRR`, `YoY`, `MoM` (case-sensitive).
- Growth/projection/forecast claims: `<digit>% growth`, `<digit>% projection`, `<digit>% forecast`.
- Em dashes (U+2014). Use period, comma, colon, parentheses, or the middle-dot
  separator (` · `) as fits the rhythm.
"""

from __future__ import annotations

import re
from pathlib import Path

from scripts.handbook.parse_chapter import Chapter, parse_chapter

FIRST_PERSON_RE = re.compile(r"\b(we|our|us|ours|i)\b", re.IGNORECASE)
FINANCE_ACRONYM_RE = re.compile(r"\b(ARR|MRR|YoY|MoM)\b")
GROWTH_PROJECTION_RE = re.compile(
    r"\b\d+(?:\.\d+)?\s*%\s*(growth|projection|forecast)\b",
    re.IGNORECASE,
)
EM_DASH_RE = re.compile(r"—")


def _strip_code_fences(body: str) -> list[tuple[int, str]]:
    """Return (line_number_1based_within_body, line_text) for prose lines only."""
    result: list[tuple[int, str]] = []
    in_fence = False
    for i, line in enumerate(body.splitlines(), start=1):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        result.append((i, line))
    return result


def validate_voice(chapter: Chapter) -> list[str]:
    errors: list[str] = []
    for line_no, line in _strip_code_fences(chapter.body):
        # Skip empty lines fast.
        if not line.strip():
            continue
        for m in FIRST_PERSON_RE.finditer(line):
            errors.append(
                f"{chapter.path}:{line_no}: first-person pronoun '{m.group(0)}'"
            )
        for m in FINANCE_ACRONYM_RE.finditer(line):
            errors.append(
                f"{chapter.path}:{line_no}: finance acronym '{m.group(0)}'"
            )
        for m in GROWTH_PROJECTION_RE.finditer(line):
            errors.append(
                f"{chapter.path}:{line_no}: forbidden growth/projection claim "
                f"'{m.group(0)}'"
            )
        for m in EM_DASH_RE.finditer(line):
            errors.append(
                f"{chapter.path}:{line_no}: em dash (U+2014) "
                f"not allowed in handbook prose; use period, comma, colon, "
                f"parens, or ' · ' instead"
            )
    return errors


def validate_voice_path(path: str | Path) -> list[str]:
    return validate_voice(parse_chapter(path))
