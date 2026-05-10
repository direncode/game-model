"""Validate every runnable `ocean` fenced block in a chapter compiles.

Skips blocks whose fence info string is `ocean static` (intended for static
display of OCEAN syntax that may not type-check or is intentionally incomplete).

Returns a list of error strings (empty list means valid).
"""

from __future__ import annotations

from pathlib import Path

from scripts.handbook.parse_chapter import Chapter, parse_chapter

# The existing OCEAN compiler exposes `tokenize` (lexer), `parse_ocean` (parser)
# and `typecheck` (typechecker). We import them under shorter local names.
from scripts.operators.ocean.lexer import tokenize as _ocean_lex
from scripts.operators.ocean.parser import parse_ocean as _ocean_parse
from scripts.operators.ocean.typecheck import typecheck as _ocean_typecheck


def _is_runnable(info: str) -> bool:
    """An 'ocean' fenced block is runnable; 'ocean static' is display-only."""
    parts = info.split()
    if not parts or parts[0] != "ocean":
        return False
    if "static" in parts[1:]:
        return False
    return True


def validate_snippets(chapter: Chapter) -> list[str]:
    errors: list[str] = []
    for snippet in chapter.snippets:
        if not _is_runnable(snippet.info):
            continue
        loc = f"{chapter.path}:{snippet.line_no}"
        try:
            _ocean_lex(snippet.content)
        except Exception as exc:  # noqa: BLE001 - report any compiler error
            errors.append(f"{loc}: lex error: {exc}")
            continue
        try:
            prog = _ocean_parse(snippet.content, source_name=str(chapter.path))
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{loc}: parse error: {exc}")
            continue
        try:
            _ocean_typecheck(prog)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{loc}: type error: {exc}")
    return errors


def validate_snippets_path(path: str | Path) -> list[str]:
    return validate_snippets(parse_chapter(path))
