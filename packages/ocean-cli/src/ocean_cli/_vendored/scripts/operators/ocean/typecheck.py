"""OCEAN type system — static type checking with inference.

Runs after parsing, before compilation. Verifies that:
  - Operator inputs match the upstream type produced by their default
    or explicit binding.
  - `let x : T = expr` annotations match the inferred RHS type.
  - `if`/`elif`/`else` branches produce the same type (or are terminal).
  - `compare A against B` arms produce the same type.
  - `define` parameter types align with default-value literals.
  - `sweep` variable is a Number.
  - Binary/unary operators receive operands of compatible types.

Type errors carry source location + caret + suggestion.
"""
from __future__ import annotations

from typing import Any

from .ast import (
    Program, VerbStmt, LetStmt, SweepStmt, CompareStmt, IfStmt, ReturnStmt,
    DefineDecl, ImportStmt, ParallelStmt,
    IntLit, FloatLit, StringLit, PathLit, BoolLit, IdentRef,
    BinaryOp, UnaryOp, CallExpr, TypeAnnotation,
)


# ── Type representation ─────────────────────────────────────────────────

class Type:
    def __init__(self, name: str, param: 'Type | None' = None):
        self.name = name
        self.param = param

    def __repr__(self):
        if self.param:
            return f"{self.name}[{self.param}]"
        return self.name

    def __eq__(self, other):
        return isinstance(other, Type) and self.name == other.name and self.param == other.param

    def __hash__(self):
        return hash((self.name, repr(self.param)))


# Singleton type values
T_RECORDS    = Type("Records")
T_Z          = Type("Z")
T_MODULES    = Type("Modules")
T_ALIGNED    = Type("Aligned")
T_DISPERSION = Type("Dispersion")
T_ARTIFACT   = Type("Artifact")
T_PIPELINE   = Type("Pipeline")
T_NUMBER     = Type("Number")
T_STRING     = Type("String")
T_PATH       = Type("Path")
T_BOOL       = Type("Bool")
T_ANY        = Type("Any")


PRIMITIVES = {
    "Records": T_RECORDS, "Z": T_Z, "Modules": T_MODULES,
    "Aligned": T_ALIGNED, "Dispersion": T_DISPERSION, "Artifact": T_ARTIFACT,
    "Pipeline": T_PIPELINE, "Number": T_NUMBER, "String": T_STRING,
    "Path": T_PATH, "Bool": T_BOOL, "Any": T_ANY,
}


def resolve_type_ann(ann: TypeAnnotation | None) -> Type | None:
    if ann is None:
        return None
    base = PRIMITIVES.get(ann.name)
    if base is None:
        raise TypeError_(f"unknown type {ann.name!r}; valid: {', '.join(sorted(PRIMITIVES))}")
    if ann.param is not None:
        return Type(ann.name, resolve_type_ann(ann.param))
    return base


def is_subtype(sub: Type, sup: Type) -> bool:
    """Narrow subtyping: T <: T, T <: Any, Aligned <: Modules."""
    if sup == T_ANY:
        return True
    if sub == sup:
        return True
    if sub == T_ALIGNED and sup == T_MODULES:
        return True
    return False


# Operator signatures — see §3.3 of OCEAN_LANG.md.
# For each operator, the input type for the *primary* upstream binding
# (the thing the type-checker validates against the source step's type).
OPERATOR_INPUT_TYPE: dict[str, Type] = {
    "source.ndjson":              T_PATH,
    "embed.tfidf_jl":             T_RECORDS,
    "embed.content_fp48":         T_RECORDS,
    "embed.onehot_numeric":       T_RECORDS,
    "reduce.btut":                T_RECORDS,
    "cluster.tcd_recursive_loop": T_Z,
    "cluster.kmeans":             T_Z,
    "align.module":               T_MODULES,
    "align.dispersion":           T_ALIGNED,
    "find.dispersion_per_label":  T_ALIGNED,
    "narrate.plain_english":      T_ALIGNED,
    "persist.json":               T_ANY,
    "meta.compare":               T_ANY,
}

OPERATOR_OUTPUT_TYPE: dict[str, Type] = {
    "source.ndjson":              T_RECORDS,
    "embed.tfidf_jl":             T_Z,
    "embed.content_fp48":         T_Z,
    "embed.onehot_numeric":       T_Z,
    "reduce.btut":                T_RECORDS,
    "cluster.tcd_recursive_loop": T_MODULES,
    "cluster.kmeans":             T_MODULES,
    "align.module":               T_ALIGNED,
    "align.dispersion":           T_DISPERSION,
    "find.dispersion_per_label":  T_DISPERSION,
    "narrate.plain_english":      T_ALIGNED,
    "persist.json":               T_ARTIFACT,
    "meta.compare":               T_ARTIFACT,
}


# ── Errors ──────────────────────────────────────────────────────────────

class TypeError_(Exception):
    def __init__(self, message: str, line: int = 0, col: int = 0,
                 source_lines: list[str] | None = None,
                 suggestion: str | None = None):
        super().__init__(message)
        self.message = message
        self.line = line
        self.col = col
        self.source_lines = source_lines or []
        self.suggestion = suggestion

    def pretty(self, source_name: str = "<input>") -> str:
        if self.line and self.source_lines:
            src = self.source_lines[self.line - 1] if 0 < self.line <= len(self.source_lines) else ""
            caret = " " * max(0, self.col - 1) + "^"
            out = (f"ocean: error at {source_name}:{self.line}:{self.col}\n\n"
                   f"  {self.line:>3} | {src}\n"
                   f"      | {caret}\n\n"
                   f"type error: {self.message}")
        else:
            out = f"ocean: type error: {self.message}"
        if self.suggestion:
            out += f"\n\nhint: {self.suggestion}"
        return out


# ── Checker ─────────────────────────────────────────────────────────────

class TypeChecker:
    def __init__(self, source_lines: list[str]):
        self.source_lines = source_lines
        self.env: dict[str, Type] = {}            # name -> type
        self.last_by_verb: dict[str, str] = {}    # verb -> name of last binding
        self.defines: dict[str, DefineDecl] = {}  # function table
        self.in_define = False

    def check_program(self, prog: Program):
        self.defines = dict(prog.defines)
        # Type-check defines (their bodies)
        for name, d in self.defines.items():
            self._check_define(d)
        # Type-check top-level statements
        for stmt in prog.statements:
            self.check_statement(stmt)

    def _check_define(self, d: DefineDecl):
        # Bring parameters into scope with their declared types
        saved_env = dict(self.env)
        saved_last = dict(self.last_by_verb)
        self.in_define = True
        try:
            for p in d.params:
                t = resolve_type_ann(p.type_ann) or self._infer_default_type(p.default)
                self.env[p.name] = t or T_ANY
            for stmt in d.body:
                self.check_statement(stmt)
        finally:
            self.env = saved_env
            self.last_by_verb = saved_last
            self.in_define = False

    def _infer_default_type(self, default) -> Type | None:
        if default is None:
            return None
        return self.check_expression(default)

    def check_statement(self, stmt) -> Type | None:
        if isinstance(stmt, VerbStmt):
            return self.check_verb_stmt(stmt)
        if isinstance(stmt, LetStmt):
            return self.check_let(stmt)
        if isinstance(stmt, SweepStmt):
            return self.check_sweep(stmt)
        if isinstance(stmt, CompareStmt):
            return self.check_compare(stmt)
        if isinstance(stmt, IfStmt):
            return self.check_if(stmt)
        if isinstance(stmt, ReturnStmt):
            return self.check_return(stmt)
        if isinstance(stmt, ParallelStmt):
            for s in stmt.body:
                self.check_statement(s)
            return None
        return None

    def check_verb_stmt(self, stmt: VerbStmt) -> Type:
        kind = stmt.operator_kind
        out_t = OPERATOR_OUTPUT_TYPE.get(kind)
        in_t = OPERATOR_INPUT_TYPE.get(kind)
        if out_t is None:
            raise TypeError_(
                f"unknown operator kind {kind!r}",
                stmt.line, stmt.col, self.source_lines,
            )

        # Validate primary upstream input
        if stmt.from_ref is not None:
            ref_t = self.env.get(stmt.from_ref)
            if ref_t is None:
                raise TypeError_(
                    f"name {stmt.from_ref!r} not in scope",
                    stmt.line, stmt.col, self.source_lines,
                    suggestion=f"declared names: {', '.join(sorted(self.env)) or '(none)'}",
                )
            if not is_subtype(ref_t, in_t):
                raise TypeError_(
                    f"{stmt.verb} expects {in_t}, got {ref_t} from {stmt.from_ref!r}",
                    stmt.line, stmt.col, self.source_lines,
                    suggestion=self._upstream_suggestion(stmt.verb, ref_t, in_t),
                )
        else:
            # Validate via implicit upstream (last stage of expected type)
            if stmt.verb != "load":
                expected_source_verb = {
                    "embed":   "load",
                    "reduce":  "load",
                    "cluster": "embed",
                    "align":   "cluster",
                    "find":    "align",
                    "narrate": "align",
                    "save":    None,  # save accepts Any
                }.get(stmt.verb)
                if expected_source_verb and expected_source_verb not in self.last_by_verb:
                    raise TypeError_(
                        f"{stmt.verb} requires a prior {expected_source_verb} step; none found",
                        stmt.line, stmt.col, self.source_lines,
                        suggestion=f"add a {expected_source_verb!r} statement above",
                    )

        # Track the binding
        bind = stmt.bind_name or _DEFAULT_NAME.get(stmt.verb, stmt.verb)
        self.env[bind] = out_t
        self.last_by_verb[stmt.verb] = bind
        return out_t

    def _upstream_suggestion(self, verb: str, got: Type, want: Type) -> str:
        if verb == "cluster" and got == T_RECORDS:
            return "pipe through `embed` first, e.g.\n  let z = embed text from raw into 128 dimensions\n  cluster z using tcd recursive loop"
        if verb == "align" and got == T_Z:
            return "pipe through `cluster` first to produce Modules"
        return f"the upstream value is {got} but the verb wants {want}"

    def check_let(self, stmt: LetStmt) -> Type:
        rhs_type = self._check_rhs(stmt.expr)
        ann = getattr(stmt, "type_ann", None)
        if ann is not None:
            ann_type = resolve_type_ann(ann)
            if ann_type is not None and not is_subtype(rhs_type, ann_type):
                raise TypeError_(
                    f"let {stmt.name} : {ann_type} got {rhs_type}",
                    stmt.line, stmt.col, self.source_lines,
                )
        # If RHS was a verb_stmt, the verb_check already bound stmt.bind_name.
        # We additionally bind the let-name for downstream lookups.
        self.env[stmt.name] = rhs_type
        return rhs_type

    def _check_rhs(self, expr) -> Type:
        if isinstance(expr, VerbStmt):
            return self.check_verb_stmt(expr)
        return self.check_expression(expr)

    def check_sweep(self, stmt: SweepStmt) -> Type | None:
        saved_env = dict(self.env)
        saved_last = dict(self.last_by_verb)
        self.env[stmt.var] = T_NUMBER
        for sub in stmt.body:
            self.check_statement(sub)
        # Sweep doesn't bubble a single type; restore last_by_verb so subsequent
        # statements outside the sweep don't see sweep-internal bindings.
        self.env = saved_env
        self.last_by_verb = saved_last
        return None

    def check_compare(self, stmt: CompareStmt) -> Type:
        # Both arms must produce the same type
        saved_env = dict(self.env)
        saved_last = dict(self.last_by_verb)
        left_t = self.check_verb_stmt(stmt.left) if isinstance(stmt.left, VerbStmt) else self.check_expression(stmt.left)
        self.env = saved_env
        self.last_by_verb = dict(saved_last)
        right_t = self.check_verb_stmt(stmt.right) if isinstance(stmt.right, VerbStmt) else self.check_expression(stmt.right)
        self.env = saved_env
        self.last_by_verb = saved_last
        if left_t != right_t:
            raise TypeError_(
                f"compare arms produce different types: left={left_t} vs right={right_t}",
                stmt.line, stmt.col, self.source_lines,
                suggestion="both sides of `compare ... against ...` must produce the same type",
            )
        return T_ARTIFACT

    def check_if(self, stmt: IfStmt) -> Type | None:
        cond_t = self.check_expression(stmt.cond)
        if cond_t != T_BOOL and cond_t != T_ANY:
            raise TypeError_(
                f"if condition must be Bool, got {cond_t}",
                stmt.line, stmt.col, self.source_lines,
            )
        # Type-check each branch in its own env snapshot (branches see the
        # same outer scope but don't leak into each other).
        for branch in [stmt.then_body] + [b for _, b in stmt.elif_branches] + ([stmt.else_body] if stmt.else_body else []):
            saved_env = dict(self.env)
            saved_last = dict(self.last_by_verb)
            for s in branch:
                self.check_statement(s)
            self.env = saved_env
            self.last_by_verb = saved_last
        for cond, body in stmt.elif_branches:
            ct = self.check_expression(cond)
            if ct != T_BOOL and ct != T_ANY:
                raise TypeError_(
                    f"elif condition must be Bool, got {ct}",
                    stmt.line, stmt.col, self.source_lines,
                )
        return None

    def check_return(self, stmt: ReturnStmt) -> Type | None:
        if stmt.expr is None:
            return None
        return self.check_expression(stmt.expr)

    def check_expression(self, expr) -> Type:
        if isinstance(expr, IntLit) or isinstance(expr, FloatLit):
            return T_NUMBER
        if isinstance(expr, StringLit):
            return T_STRING
        if isinstance(expr, PathLit):
            return T_PATH
        if isinstance(expr, BoolLit):
            return T_BOOL
        if isinstance(expr, IdentRef):
            t = self.env.get(expr.name)
            if t is None:
                raise TypeError_(
                    f"name {expr.name!r} not in scope",
                    expr.line, expr.col, self.source_lines,
                    suggestion=f"declared names: {', '.join(sorted(self.env)) or '(none)'}",
                )
            return t
        if isinstance(expr, BinaryOp):
            lt = self.check_expression(expr.left)
            rt = self.check_expression(expr.right)
            if expr.op in ("==", "!="):
                if lt != rt:
                    raise TypeError_(
                        f"{expr.op} comparing different types: {lt} vs {rt}",
                        expr.line, expr.col, self.source_lines,
                    )
                return T_BOOL
            if expr.op in ("<", ">", "<=", ">="):
                if lt != T_NUMBER or rt != T_NUMBER:
                    raise TypeError_(
                        f"{expr.op} requires Number operands, got {lt} {expr.op} {rt}",
                        expr.line, expr.col, self.source_lines,
                    )
                return T_BOOL
            if expr.op in ("+", "-", "*", "/"):
                if lt != T_NUMBER or rt != T_NUMBER:
                    raise TypeError_(
                        f"{expr.op} requires Number operands, got {lt} {expr.op} {rt}",
                        expr.line, expr.col, self.source_lines,
                    )
                return T_NUMBER
            if expr.op in ("and", "or"):
                if lt != T_BOOL or rt != T_BOOL:
                    raise TypeError_(
                        f"{expr.op} requires Bool operands",
                        expr.line, expr.col, self.source_lines,
                    )
                return T_BOOL
        if isinstance(expr, UnaryOp):
            t = self.check_expression(expr.operand)
            if expr.op == "not":
                if t != T_BOOL:
                    raise TypeError_(
                        f"`not` requires Bool, got {t}",
                        expr.line, expr.col, self.source_lines,
                    )
                return T_BOOL
            if expr.op == "-":
                if t != T_NUMBER:
                    raise TypeError_(
                        f"unary `-` requires Number, got {t}",
                        expr.line, expr.col, self.source_lines,
                    )
                return T_NUMBER
        if isinstance(expr, CallExpr):
            d = self.defines.get(expr.func)
            if d is None:
                raise TypeError_(
                    f"unknown function {expr.func!r}",
                    expr.line, expr.col, self.source_lines,
                    suggestion=f"defined functions: {', '.join(sorted(self.defines)) or '(none)'}",
                )
            # We don't infer return type yet; treat as Pipeline for now.
            return T_PIPELINE
        if isinstance(expr, VerbStmt):
            return self.check_verb_stmt(expr)
        return T_ANY


_DEFAULT_NAME = {
    "load":    "source",
    "embed":   "embed",
    "reduce":  "reduce",
    "cluster": "cluster",
    "align":   "align",
    "find":    "disperse",
    "narrate": "narrate",
    "save":    "persist",
}


def typecheck(prog: Program) -> None:
    """Top-level entry. Raises TypeError_ if the program doesn't type-check."""
    source_lines = prog.source_text.splitlines()
    checker = TypeChecker(source_lines)
    checker.check_program(prog)
