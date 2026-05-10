"""Validate the skeleton of a chapter file.

Rules:
- Numbered chapters (frontmatter.number in 1..14) MUST contain H2 sections:
  "Concepts in this chapter", "Wider system", "Exercises", "What's next".
- Preface (number == 0) MUST have a non-empty `promise` (anything but the
  placeholder string).
- Index and appendices (number is null) use a relaxed skeleton; only that
  required frontmatter keys exist.

All chapters MUST have the required frontmatter keys: slug, number, title,
promise, status.
"""

from __future__ import annotations

from pathlib import Path

from scripts.handbook.parse_chapter import Chapter, parse_chapter

REQUIRED_H2 = [
    "Concepts in this chapter",
    "Wider system",
    "Exercises",
    "What's next",
]
REQUIRED_FRONTMATTER = ["slug", "number", "title", "promise", "status"]
PLACEHOLDER_PROMISE = "(placeholder)"


def validate_skeleton(chapter: Chapter) -> list[str]:
    errors: list[str] = []
    fm = chapter.frontmatter
    path = chapter.path

    for key in REQUIRED_FRONTMATTER:
        if key not in fm:
            errors.append(f"{path}: missing frontmatter key '{key}'")

    if errors:
        return errors

    number = fm.get("number")
    promise = fm.get("promise", "")

    if isinstance(number, int) and 1 <= number <= 14:
        h2_texts = {h.text for h in chapter.headings if h.level == 2}
        for required in REQUIRED_H2:
            if required not in h2_texts:
                errors.append(
                    f"{path}: numbered chapter missing required H2 '{required}'"
                )
        if not promise or promise == PLACEHOLDER_PROMISE:
            errors.append(f"{path}: numbered chapter has placeholder promise")
    elif number == 0:
        if not promise or promise == PLACEHOLDER_PROMISE:
            errors.append(f"{path}: preface has placeholder promise")
    elif number is None:
        # Relaxed: only frontmatter required (already checked above).
        pass
    else:
        errors.append(f"{path}: unexpected number {number!r} in frontmatter")

    return errors


def validate_skeleton_path(path: str | Path) -> list[str]:
    return validate_skeleton(parse_chapter(path))
