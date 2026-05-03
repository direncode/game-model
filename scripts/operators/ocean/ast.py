"""OCEAN AST nodes."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# ── Expressions / values ─────────────────────────────────────────────────

@dataclass
class IntLit:
    value: int
    line: int
    col: int


@dataclass
class FloatLit:
    value: float
    line: int
    col: int


@dataclass
class StringLit:
    value: str
    line: int
    col: int


@dataclass
class PathLit:
    value: str
    line: int
    col: int


@dataclass
class IdentRef:
    name: str
    line: int
    col: int


@dataclass
class InterpString:
    """Path or string with embedded ${var} references."""
    parts: list[Any]   # mix of str literals and IdentRef
    line: int
    col: int


# ── Statements ───────────────────────────────────────────────────────────

@dataclass
class VerbStmt:
    """A verb invocation: load X, embed Y, cluster Z, ..."""
    verb: str                           # 'load' / 'embed' / 'cluster' / ...
    operator_kind: str                  # resolved at parse time, e.g. 'embed.tfidf_jl'
    args: dict[str, Any]                # keyword -> value (parsed phrase)
    bind_name: str | None               # 'as NAME' override
    from_ref: str | None                # explicit upstream binding (overrides default)
    line: int
    col: int


@dataclass
class LetStmt:
    name: str
    expr: VerbStmt
    line: int
    col: int


@dataclass
class SweepStmt:
    var: str                            # the sweep variable (e.g. 'seed')
    start: int
    end: int                            # inclusive
    step: int
    body: list[Any]                     # statements
    line: int
    col: int


@dataclass
class CompareStmt:
    left: VerbStmt
    right: VerbStmt
    on_metric: str | None               # e.g. 'dispersion'
    on_label: str | None                # e.g. 'directorate_to_pm'
    line: int
    col: int


@dataclass
class SeedDecl:
    value: int
    line: int
    col: int


@dataclass
class Program:
    """Top-level: an OCEAN program is a sequence of statements."""
    seed: int
    statements: list[Any] = field(default_factory=list)
    source_name: str = "<input>"
    source_text: str = ""
