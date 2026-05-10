"""Validate every exercise has a corresponding solution.

A chapter declares exercises as bullet items under "## Exercises" in the form:

    - Exercise <slug>-<number>: <text>

The matching solution must appear in `app-f-exercise-solutions.md` as an H2
heading of the form:

    ## <slug> -- <number>          (or with em dash --, en dash, or hyphen)
"""

from __future__ import annotations

import re
from pathlib import Path

from scripts.handbook.parse_chapter import Chapter, parse_chapter

EXERCISE_BULLET_RE = re.compile(
    r"^\s*[-*]\s+Exercise\s+([a-z0-9-]+)-(\d+)\b", re.IGNORECASE
)

# Match H2 headings like "## slug -- 1", "## slug — 1", "## slug - 1".
DASH = r"(?:-+|—|–)"  # hyphen(s), em dash, en dash
SOLUTION_HEADING_RE = re.compile(
    rf"^##\s+([a-z0-9-]+)\s*{DASH}\s*(\d+)\s*$", re.IGNORECASE | re.MULTILINE
)


def _exercises_in_chapter(chapter: Chapter) -> list[tuple[str, int]]:
    exercises: list[tuple[str, int]] = []
    body_lines = chapter.body.splitlines()

    # Find the "Exercises" H2 line within the body lines.
    in_exercises = False
    for line in body_lines:
        stripped = line.lstrip()
        if stripped.startswith("## "):
            in_exercises = stripped[3:].strip().lower() == "exercises"
            continue
        if not in_exercises:
            continue
        m = EXERCISE_BULLET_RE.match(line)
        if m:
            exercises.append((m.group(1).lower(), int(m.group(2))))
    return exercises


def _solutions_in_doc(path: Path) -> set[tuple[str, int]]:
    text = path.read_text(encoding="utf-8")
    found: set[tuple[str, int]] = set()
    for m in SOLUTION_HEADING_RE.finditer(text):
        found.add((m.group(1).lower(), int(m.group(2))))
    return found


def validate_exercises(
    chapters: list[Chapter],
    solutions_path: str | Path,
) -> list[str]:
    sol_path = Path(solutions_path)
    if not sol_path.exists():
        return [f"{sol_path}: solutions file missing"]
    solutions = _solutions_in_doc(sol_path)

    errors: list[str] = []
    for chap in chapters:
        for slug, num in _exercises_in_chapter(chap):
            if (slug, num) not in solutions:
                errors.append(
                    f"{chap.path}: exercise {slug}-{num} has no solution in {sol_path}"
                )
    return errors


def validate_exercises_paths(
    chapter_paths: list[str | Path],
    solutions_path: str | Path,
) -> list[str]:
    chapters = [parse_chapter(p) for p in chapter_paths]
    return validate_exercises(chapters, solutions_path)
