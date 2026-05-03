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
class BoolLit:
    value: bool
    line: int
    col: int


@dataclass
class BinaryOp:
    op: str                         # ==, !=, <, >, <=, >=, +, -, *, /, and, or
    left: Any
    right: Any
    line: int
    col: int


@dataclass
class UnaryOp:
    op: str                         # 'not', '-'
    operand: Any
    line: int
    col: int


@dataclass
class CallExpr:
    func: str                       # function name (or namespaced 'mod.func')
    args: list[Any]                 # positional or keyword args
    kwargs: dict[str, Any]
    line: int
    col: int


@dataclass
class TypeAnnotation:
    name: str                       # type name (Records, Z, Modules, ...)
    param: 'TypeAnnotation | None' = None  # generic param e.g. List[Records]


@dataclass
class Param:
    """Function parameter."""
    name: str
    type_ann: TypeAnnotation | None = None
    default: Any = None             # literal AST node or None


@dataclass
class DefineDecl:
    name: str
    params: list[Param]
    body: list[Any]                 # statements
    line: int
    col: int


@dataclass
class IfStmt:
    cond: Any                       # expression
    then_body: list[Any]            # statements
    elif_branches: list[tuple[Any, list[Any]]]  # [(cond, body), ...]
    else_body: list[Any] | None
    line: int
    col: int


@dataclass
class ReturnStmt:
    expr: Any | None                # may be None for bare 'return'
    line: int
    col: int


@dataclass
class ImportStmt:
    path: str
    alias: str | None
    line: int
    col: int


@dataclass
class RequireDecl:
    major: int
    minor: int
    patch: int
    line: int
    col: int


@dataclass
class ParallelStmt:
    body: list[Any]
    line: int
    col: int


@dataclass
class Program:
    """Top-level: an OCEAN program is a sequence of statements."""
    seed: int
    statements: list[Any] = field(default_factory=list)
    require_version: tuple[int, int, int] | None = None
    imports: list[ImportStmt] = field(default_factory=list)
    defines: dict[str, DefineDecl] = field(default_factory=dict)
    source_name: str = "<input>"
    source_text: str = ""
