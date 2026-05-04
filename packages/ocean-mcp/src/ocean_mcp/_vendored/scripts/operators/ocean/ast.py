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


# ── v1.1 additions ───────────────────────────────────────────────────────

@dataclass
class MatchArm:
    """One arm of a match expression: 'case PATTERN [when GUARD] => BODY'."""
    pattern: Any                    # pattern AST (Wildcard, Constructor, Lit, Bind)
    guard: Any | None               # optional 'when' guard expression
    body: Any                       # statement or expression
    line: int
    col: int


@dataclass
class MatchStmt:
    """match X with case A => ... case B => ... end"""
    scrutinee: Any                  # the expression being matched
    arms: list[MatchArm]
    line: int
    col: int


@dataclass
class WildcardPattern:
    line: int
    col: int


@dataclass
class LiteralPattern:
    """Pattern that matches a specific literal value."""
    value: Any                      # IntLit, StringLit, BoolLit, etc.
    line: int
    col: int


@dataclass
class ConstructorPattern:
    """Pattern matching a constructor like 'ok(x)' or 'err(msg)'."""
    name: str                       # constructor name: 'ok' / 'err' / 'some' / 'none'
    bindings: list[str]             # variable names captured from the constructor
    line: int
    col: int


@dataclass
class BindPattern:
    """A bare identifier — matches anything and binds it to NAME."""
    name: str
    line: int
    col: int


@dataclass
class TryStmt:
    """try BODY catch IDENT do HANDLER end"""
    body: list[Any]
    error_name: str
    handler: list[Any]
    line: int
    col: int


@dataclass
class ThrowStmt:
    expr: Any
    line: int
    col: int


@dataclass
class ExternDecl:
    """extern fn NAME(p1: T1, p2: T2) -> RET — register a foreign operator."""
    name: str
    params: list['Param']
    return_type: TypeAnnotation | None
    impl: str                       # 'python:module.func' or registered kind
    line: int
    col: int


@dataclass
class SpawnStmt:
    """spawn STMT — fire a step into a parallel branch (DAG-implicit)."""
    body: Any
    bind_name: str | None
    line: int
    col: int


@dataclass
class JoinStmt:
    """join NAME1, NAME2, ... — synchronization barrier in the DAG."""
    names: list[str]
    line: int
    col: int


@dataclass
class MacroDecl:
    """macro NAME(p1, p2) do quote ... end end — quote-based pseudo-macro."""
    name: str
    params: list[str]
    body: list[Any]                 # AST nodes that get spliced
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
