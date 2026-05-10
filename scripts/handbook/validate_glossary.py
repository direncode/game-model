"""Validate that every italicized single-word term has a glossary entry.

A term is a markdown italic span around a single word: `_word_` or `*word*`
(but NOT `**word**` which is bold). The word must be lowercase, alphabetic,
and at least 3 characters. A small stoplist of common English words is
ignored.

A glossary entry is an H2 heading in app-d-glossary.md exactly matching the
term (case-insensitive).

Text inside fenced code blocks and YAML frontmatter is ignored.
"""

from __future__ import annotations

import re
from pathlib import Path

from scripts.handbook.parse_chapter import Chapter, parse_chapter

# Common words to skip.
STOPLIST = {
    "the", "and", "but", "for", "not", "with", "this", "that", "from",
    "into", "onto", "you", "your", "yours", "they", "them", "their", "theirs",
    "have", "has", "had", "are", "was", "were", "will", "would", "should",
    "could", "may", "might", "can", "cannot", "all", "any", "some", "most",
    "more", "less", "few", "many", "such", "each", "every", "one", "two",
    "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "what", "when", "where", "which", "while", "why", "how",
    "here", "there", "then", "than", "thus", "also", "very",
    "just", "only", "even", "still", "yet", "out", "off", "via", "per",
    "about", "after", "before", "between", "during", "within", "without",
    "see", "use", "used", "uses", "using", "make", "made", "makes",
    "let", "lets", "get", "gets", "got", "give", "gives", "given",
    "say", "says", "said", "way", "ways", "thing", "things",
    "good", "bad", "new", "old", "same", "different",
    "below", "above", "next", "previous", "first", "last",
    "now", "later", "soon", "often", "always", "never",
}

ITALIC_WORD_RE = re.compile(
    r"(?<![\w_*])([_*])(?![_*])([a-z]{3,})\1(?![_*])"
)
# Reject bold: `**word**` would match the inner `*word*` otherwise. We require
# that the delim is NOT adjacent to another delim character on either side.

H2_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)


def _strip_code_fences(body: str) -> str:
    out_lines: list[str] = []
    in_fence = False
    for line in body.splitlines():
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            out_lines.append("")  # drop fence and content
            continue
        out_lines.append("" if in_fence else line)
    return "\n".join(out_lines)


def _terms_in_chapter(chapter: Chapter) -> set[str]:
    text = _strip_code_fences(chapter.body)
    terms: set[str] = set()
    for m in ITALIC_WORD_RE.finditer(text):
        w = m.group(2).lower()
        if w in STOPLIST:
            continue
        terms.add(w)
    return terms


def _glossary_entries(glossary_path: Path) -> set[str]:
    text = glossary_path.read_text(encoding="utf-8")
    entries: set[str] = set()
    for m in H2_RE.finditer(text):
        entries.add(m.group(1).strip().lower())
    return entries


def validate_glossary(
    chapters: list[Chapter],
    glossary_path: str | Path,
) -> list[str]:
    gpath = Path(glossary_path)
    if not gpath.exists():
        return [f"{gpath}: glossary file missing"]
    entries = _glossary_entries(gpath)
    errors: list[str] = []
    for chap in chapters:
        for term in sorted(_terms_in_chapter(chap)):
            if term not in entries:
                errors.append(
                    f"{chap.path}: italicized term '{term}' has no glossary entry"
                )
    return errors


def validate_glossary_paths(
    chapter_paths: list[str | Path],
    glossary_path: str | Path,
) -> list[str]:
    chapters = [parse_chapter(p) for p in chapter_paths]
    return validate_glossary(chapters, glossary_path)
