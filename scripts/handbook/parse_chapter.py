"""Parse a handbook markdown chapter into a structured representation.

A chapter has YAML frontmatter, headings, paragraphs, and fenced code blocks.
This module exposes a single public function `parse_chapter(path)` returning
a `Chapter` dataclass with fields:

- path: Path
- frontmatter: dict
- title: str (the H1 title, or "" if absent)
- headings: list[Heading]            # (level, text, line_no)
- snippets: list[Snippet]            # fenced blocks with info string + content
- body: str                          # the full body text after frontmatter
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


@dataclass
class Heading:
    level: int
    text: str
    line_no: int


@dataclass
class Snippet:
    info: str  # full info string, e.g. "ocean" or "ocean static"
    content: str
    line_no: int  # 1-based line where the opening fence sits


@dataclass
class Chapter:
    path: Path
    frontmatter: dict[str, Any]
    title: str
    headings: list[Heading] = field(default_factory=list)
    snippets: list[Snippet] = field(default_factory=list)
    body: str = ""


class ParseChapterError(Exception):
    """Raised when a chapter file is malformed (no frontmatter, bad YAML, etc.)."""


def parse_chapter(path: str | Path) -> Chapter:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    lines = text.splitlines()

    # Frontmatter must be the very first thing.
    if not lines or lines[0].strip() != "---":
        raise ParseChapterError(f"{p}: missing YAML frontmatter")

    end_idx = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_idx = i
            break
    if end_idx is None:
        raise ParseChapterError(f"{p}: unterminated YAML frontmatter")

    fm_text = "\n".join(lines[1:end_idx])
    try:
        fm = yaml.safe_load(fm_text) or {}
    except yaml.YAMLError as exc:
        raise ParseChapterError(f"{p}: malformed YAML frontmatter: {exc}") from exc
    if not isinstance(fm, dict):
        raise ParseChapterError(f"{p}: frontmatter must be a mapping")

    body_start = end_idx + 1
    body_lines = lines[body_start:]
    body = "\n".join(body_lines)

    headings: list[Heading] = []
    snippets: list[Snippet] = []
    title = ""

    in_fence = False
    fence_info = ""
    fence_start_line = 0
    fence_buf: list[str] = []

    for offset, line in enumerate(body_lines):
        line_no = body_start + offset + 1  # 1-based file line
        stripped = line.lstrip()
        if in_fence:
            if stripped.startswith("```"):
                snippets.append(
                    Snippet(
                        info=fence_info,
                        content="\n".join(fence_buf),
                        line_no=fence_start_line,
                    )
                )
                in_fence = False
                fence_info = ""
                fence_buf = []
            else:
                fence_buf.append(line)
            continue

        if stripped.startswith("```"):
            in_fence = True
            fence_info = stripped[3:].strip()
            fence_start_line = line_no
            fence_buf = []
            continue

        if stripped.startswith("#"):
            level = 0
            for ch in stripped:
                if ch == "#":
                    level += 1
                else:
                    break
            text_part = stripped[level:].strip()
            if 1 <= level <= 6:
                headings.append(Heading(level=level, text=text_part, line_no=line_no))
                if level == 1 and not title:
                    title = text_part

    return Chapter(
        path=p,
        frontmatter=fm,
        title=title,
        headings=headings,
        snippets=snippets,
        body=body,
    )
