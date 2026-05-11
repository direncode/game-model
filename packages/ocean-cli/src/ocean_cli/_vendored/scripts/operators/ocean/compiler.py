"""OCEAN compiler — Program (AST) -> PipelineConfig (operator DAG).

Resolves implicit data-flow edges (each verb's default upstream stage),
expands sweeps into parallel branches, type-checks operator inputs/outputs
against schema.py, and emits the JSON-shaped config the runner consumes.
"""
from __future__ import annotations

import hashlib
import json
import os
from copy import deepcopy
from pathlib import Path
from typing import Any

from .ast import (
    Program, VerbStmt, LetStmt, SweepStmt, CompareStmt,
    IfStmt, ReturnStmt, ParallelStmt, BoolLit, IntLit, FloatLit,
    BinaryOp, UnaryOp, IdentRef,
    # v1.1
    MatchStmt, MatchArm, WildcardPattern, LiteralPattern,
    ConstructorPattern, BindPattern,
    TryStmt, ThrowStmt, SpawnStmt, JoinStmt, ExternDecl,
)
from .parser import parse_ocean


# Default upstream stage per verb — used when 'from NAME' isn't specified.
# This implements the "implicit data flow" of §3.2 of the spec.
DEFAULT_UPSTREAM: dict[str, dict[str, str]] = {
    "load":    {},
    "embed":   {"records": "{source}.records",
                "text_field": "{source}.text_field"},
    "cluster": {"Z": "{embed}.Z",
                "records": "{source}.records",
                "label_field": "{source}.label_field"},
    "align":   {"modules": "{cluster}.modules",
                "records": "{source}.records",
                "Z": "{embed}.Z",
                "label_field": "{source}.label_field"},
    "find":    {"aligned_modules": "{align}.aligned_modules",
                "records": "{source}.records",
                "Z": "{embed}.Z",
                "label_field": "{source}.label_field"},
    "save":    {"aligned_modules":      "{align}.aligned_modules",
                "dispersion_per_label": "{find}.dispersion_per_label",
                "per_record_assignments": "{find}.per_record_assignments"},
}

# Default step-name per verb (when no 'as NAME' override).
DEFAULT_STEP_NAME = {
    "load":    "source",
    "embed":   "embed",
    "cluster": "cluster",
    "align":   "align",
    "find":    "disperse",   # 'find dispersion ...' → step 'disperse'
    "save":    "persist",
}


class CompileError(Exception):
    def __init__(self, message: str, line: int = 0, col: int = 0,
                 source_lines: list[str] | None = None, suggestion: str | None = None):
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
                   f"{self.message}")
        else:
            out = f"ocean: error: {self.message}"
        if self.suggestion:
            out += f"\n\nhint: {self.suggestion}"
        return out


class CompileContext:
    """Per-compile state: name table, last-step-by-stage tracking, content hashes."""
    def __init__(self, source_name: str, source_lines: list[str]):
        self.source_name = source_name
        self.source_lines = source_lines
        self.steps: list[dict] = []
        self.named_steps: dict[str, dict] = {}        # bind_name -> step dict
        self.last_by_verb: dict[str, str] = {}        # verb -> step name
        self.sweep_subs: dict[str, str] = {}          # variable -> string value (for ${var})
        self.defines: dict = {}                       # function table
        self.param_subs: dict = {}                    # parameter name -> compile-time value

    def step_count(self) -> int:
        return len(self.steps)


def compile_ocean(text: str, source_name: str = "<input>",
                  skip_typecheck: bool = False,
                  module_resolver=None) -> dict:
    """Compile OCEAN source -> a JSON-shaped pipeline config dict.

    Pipeline:  parse -> resolve imports -> typecheck -> compile DAG.

    `module_resolver(path: str) -> Program` is an optional callback that
    loads an imported file. Defaults to filesystem reads relative to the
    source file's directory.
    """
    prog = parse_ocean(text, source_name=source_name)

    # Resolve imports — load each imported file and merge its `define`s
    # into our program's namespace under the alias.
    if prog.imports:
        prog = _resolve_imports(prog, source_name, module_resolver)

    # Static type check (can be disabled for debugging).
    if not skip_typecheck:
        from .typecheck import typecheck
        typecheck(prog)

    ctx = CompileContext(source_name, text.splitlines())
    ctx.defines = dict(prog.defines)  # function table for call expansion
    for stmt in prog.statements:
        _compile_stmt(stmt, ctx)
    return {
        "seed":  prog.seed,
        "steps": ctx.steps,
        "_source_name": source_name,
        "_require_version": prog.require_version,
    }


def _resolve_imports(prog: Program, source_name: str, resolver) -> Program:
    """Walk imports, parse imported files, namespace their defines under alias."""
    base_dir = Path(source_name).parent if source_name != "<input>" else Path(".")
    for imp in prog.imports:
        if resolver:
            imported = resolver(imp.path)
        else:
            imp_path = base_dir / imp.path
            if not imp_path.exists():
                # Try absolute / repo-rooted
                imp_path = Path(imp.path)
            if not imp_path.exists():
                raise CompileError(
                    f"import not found: {imp.path}",
                    imp.line, imp.col, prog.source_text.splitlines(),
                )
            imported = parse_ocean(imp_path.read_text(encoding="utf-8"),
                                   source_name=str(imp_path))
        # Namespace defines under alias (or no prefix if no alias)
        prefix = (imp.alias + ".") if imp.alias else ""
        for name, d in imported.defines.items():
            prog.defines[prefix + name] = d
    return prog


# ── Statement compilers ──────────────────────────────────────────────────

def _compile_stmt(stmt, ctx: CompileContext):
    if isinstance(stmt, VerbStmt):
        _compile_verb(stmt, ctx)
    elif isinstance(stmt, LetStmt):
        # Let just compiles the inner verb_stmt, but binds the result-name
        if isinstance(stmt.expr, VerbStmt):
            if stmt.expr.bind_name is None:
                stmt.expr.bind_name = stmt.name
            _compile_verb(stmt.expr, ctx)
        # Non-verb let-bindings (let x = 5) don't emit DAG steps; their
        # value is consumed by upstream wiring at parse time.
    elif isinstance(stmt, SweepStmt):
        _compile_sweep(stmt, ctx)
    elif isinstance(stmt, CompareStmt):
        _compile_compare(stmt, ctx)
    elif isinstance(stmt, IfStmt):
        _compile_if(stmt, ctx)
    elif isinstance(stmt, ParallelStmt):
        # Parallel = inline-with-marker. The runner already runs independent
        # ops in topological order; `parallel do ... end` is currently a hint.
        for sub in stmt.body:
            _compile_stmt(sub, ctx)
    elif isinstance(stmt, ReturnStmt):
        # `return` inside a define declares the function output, but defines
        # don't emit DAG steps directly. At top level, `return` is a no-op.
        if stmt.expr is not None and isinstance(stmt.expr, VerbStmt):
            _compile_verb(stmt.expr, ctx)
    elif isinstance(stmt, MatchStmt):
        _compile_match(stmt, ctx)
    elif isinstance(stmt, TryStmt):
        _compile_try(stmt, ctx)
    elif isinstance(stmt, ThrowStmt):
        # Throws compile to a meta operator the runner reads
        ctx.steps.append({
            "name": f"throw_{ctx.step_count()}",
            "kind": "meta.throw",
            "inputs": {},
            "config": {"_throw_repr": str(type(stmt.expr).__name__)},
        })
    elif isinstance(stmt, SpawnStmt):
        # Mark the inner statement as parallelizable. Without a true async
        # runner, this is a hint — the DAG runner already executes
        # independent branches in topological order.
        if stmt.body is not None:
            _compile_stmt(stmt.body, ctx)
    elif isinstance(stmt, JoinStmt):
        # Compile-time barrier — a no-op for the DAG runner since
        # topological order already implies join semantics.
        pass
    else:
        # Function call as a top-level statement (rare but valid)
        from .ast import CallExpr
        if isinstance(stmt, CallExpr):
            _expand_call(stmt, ctx)
            return
        raise CompileError(f"unsupported statement type {type(stmt).__name__}")


def _compile_match(stmt: MatchStmt, ctx: CompileContext):
    """Compile-time match: evaluate the scrutinee if constant; pick the
    matching arm; compile its body. Non-constant scrutinees emit a
    runtime-match operator placeholder."""
    val = _eval_const(stmt.scrutinee)
    if val is not None:
        for arm in stmt.arms:
            if _pattern_matches(arm.pattern, val):
                # Bind any captured variables for the arm body
                saved_subs = dict(ctx.param_subs)
                _bind_pattern(arm.pattern, val, ctx)
                # Guards (if any) — evaluate at compile time too
                if arm.guard is not None:
                    g = _eval_const(arm.guard)
                    if not g:
                        ctx.param_subs = saved_subs
                        continue
                for sub in arm.body:
                    _compile_stmt(sub, ctx)
                ctx.param_subs = saved_subs
                return
        return  # no arm matched — silent (could warn)
    # Non-constant scrutinee — emit a meta operator marker
    ctx.steps.append({
        "name": f"match_{ctx.step_count()}",
        "kind": "meta.match",
        "inputs": {},
        "config": {"_n_arms": len(stmt.arms)},
    })


def _pattern_matches(pat, val) -> bool:
    if isinstance(pat, WildcardPattern):
        return True
    if isinstance(pat, BindPattern):
        return True
    if isinstance(pat, LiteralPattern):
        lv = _eval_const(pat.value)
        return lv == val
    if isinstance(pat, ConstructorPattern):
        # Result/Option semantics: ok(x) matches dict {ok: x}; etc.
        if isinstance(val, dict) and pat.name in val:
            return True
        if val == pat.name:    # bare constructors like 'none' that evaluate to "none"
            return True
    return False


def _bind_pattern(pat, val, ctx: CompileContext):
    if isinstance(pat, BindPattern):
        ctx.param_subs[pat.name] = val
    if isinstance(pat, ConstructorPattern):
        # Bind the captured variables; for ok(x) on val={"ok": v}, x = v
        if isinstance(val, dict) and pat.name in val:
            inner = val[pat.name]
            if pat.bindings:
                ctx.param_subs[pat.bindings[0]] = inner


def _compile_try(stmt: TryStmt, ctx: CompileContext):
    """try/catch: compile the body; on compile-time exception, compile
    the handler. The runner doesn't yet support runtime exception
    propagation across operators — runtime errors surface from the
    operator that raised them."""
    saved_count = ctx.step_count()
    try:
        for sub in stmt.body:
            _compile_stmt(sub, ctx)
    except CompileError:
        # Roll back partial steps; compile the handler instead.
        del ctx.steps[saved_count:]
        ctx.param_subs[stmt.error_name] = "compile-time error"
        for sub in stmt.handler:
            _compile_stmt(sub, ctx)


def _expand_call(call, ctx: CompileContext):
    """Inline-expand a function call: substitute params, compile body."""
    d = ctx.defines.get(call.func)
    if d is None:
        raise CompileError(
            f"call to undefined function {call.func!r}",
            call.line, call.col, ctx.source_lines,
            suggestion=f"defined functions: {', '.join(sorted(ctx.defines)) or '(none)'}",
        )
    # Build arg map from positional + kwargs
    arg_map = {}
    for i, p in enumerate(d.params):
        if i < len(call.args):
            arg_map[p.name] = call.args[i]
        elif p.name in call.kwargs:
            arg_map[p.name] = call.kwargs[p.name]
        elif p.default is not None:
            arg_map[p.name] = p.default
        else:
            raise CompileError(
                f"missing required argument {p.name!r} in call to {call.func!r}",
                call.line, call.col, ctx.source_lines,
            )
    # Resolve to literal values where possible (compile-time)
    saved_subs = dict(ctx.param_subs)
    for k, v in arg_map.items():
        ctx.param_subs[k] = _eval_const(v) if v else None
    # Compile the body with substitutions in scope
    for sub in d.body:
        _compile_stmt(sub, ctx)
    ctx.param_subs = saved_subs


def _compile_if(stmt: IfStmt, ctx: CompileContext):
    """Constant-fold the condition at compile time and emit the chosen branch.

    Non-constant conditions raise CompileError. This is appropriate for a
    DAG language: the condition determines pipeline STRUCTURE, not data.
    Like Rust's `if cfg!(...)` or C++ `if constexpr`.
    """
    val = _eval_const(stmt.cond)
    if val is None:
        raise CompileError(
            "if condition must be a compile-time constant; "
            "found non-constant expression",
            stmt.line, stmt.col, ctx.source_lines,
            suggestion="OCEAN if-statements determine pipeline structure at compile time. "
                       "Use `sweep` for parameterized variation or branch on literal flags.",
        )
    if val:
        for sub in stmt.then_body:
            _compile_stmt(sub, ctx)
        return
    for cond, body in stmt.elif_branches:
        if _eval_const(cond):
            for sub in body:
                _compile_stmt(sub, ctx)
            return
    if stmt.else_body:
        for sub in stmt.else_body:
            _compile_stmt(sub, ctx)


def _eval_const(expr):
    """Evaluate a literal expression at compile time. Returns None if it
    contains a non-literal (e.g. an IdentRef), which surfaces a CompileError."""
    if expr is None:
        return None
    if isinstance(expr, BoolLit):
        return expr.value
    if isinstance(expr, IntLit):
        return expr.value
    if isinstance(expr, FloatLit):
        return expr.value
    # String + Path literals: import here to avoid circular imports
    from .ast import StringLit, PathLit
    if isinstance(expr, StringLit):
        return expr.value
    if isinstance(expr, PathLit):
        return expr.value
    if isinstance(expr, BinaryOp):
        l = _eval_const(expr.left)
        r = _eval_const(expr.right)
        if l is None or r is None:
            return None
        ops = {
            "==": lambda a, b: a == b,
            "!=": lambda a, b: a != b,
            "<":  lambda a, b: a < b,
            ">":  lambda a, b: a > b,
            "<=": lambda a, b: a <= b,
            ">=": lambda a, b: a >= b,
            "+":  lambda a, b: a + b,
            "-":  lambda a, b: a - b,
            "*":  lambda a, b: a * b,
            "/":  lambda a, b: a / b,
            "and": lambda a, b: a and b,
            "or":  lambda a, b: a or b,
        }
        op = ops.get(expr.op)
        if op is None:
            return None
        return op(l, r)
    if isinstance(expr, UnaryOp):
        v = _eval_const(expr.operand)
        if v is None:
            return None
        return (not v) if expr.op == "not" else (-v)
    if isinstance(expr, IdentRef):
        return None
    return None


def _compile_verb(stmt: VerbStmt, ctx: CompileContext):
    name = stmt.bind_name or DEFAULT_STEP_NAME.get(stmt.verb, stmt.verb)
    # If a sweep is active, suffix the step name with ${var} so we don't collide.
    if ctx.sweep_subs:
        name = f"{name}_" + "_".join(f"{k}{v}" for k, v in ctx.sweep_subs.items())

    # Resolve inputs from defaults, with overrides for from_ref + last_by_verb
    inputs = {}
    upstream_map = DEFAULT_UPSTREAM.get(stmt.verb, {})
    for in_name, template in upstream_map.items():
        # template like "{source}.records" — substitute the actual step name
        ref = _resolve_template(template, stmt, ctx)
        inputs[in_name] = ref
    if stmt.from_ref is not None:
        # Override the primary upstream binding (records / Z / modules)
        primary = next(iter(upstream_map), None)
        if primary:
            # If the user said `from raw`, that's typically the source.
            # Map identifiers to known step names.
            inputs[primary] = f"{stmt.from_ref}.records" if primary == "records" else f"{stmt.from_ref}.Z"

    config = _coerce_config(stmt, ctx)

    step = {
        "name":   name,
        "kind":   stmt.operator_kind,
        "inputs": inputs,
        "config": config,
    }
    ctx.steps.append(step)
    if stmt.bind_name:
        ctx.named_steps[stmt.bind_name] = step
    ctx.last_by_verb[stmt.verb] = name


def _resolve_template(template: str, stmt: VerbStmt, ctx: CompileContext) -> str:
    """Replace {source}/{embed}/{cluster}/{align}/{find} with the most recent step name for that verb."""
    out = template
    for verb, last_name in ctx.last_by_verb.items():
        out = out.replace("{" + verb + "}", last_name)
    # Defaults if no prior step yet (will fail at runner time with a clear error,
    # but we emit anyway to surface dependency-order issues at runtime not compile)
    out = (out.replace("{source}", ctx.last_by_verb.get("load", "source"))
              .replace("{embed}", ctx.last_by_verb.get("embed", "embed"))
              .replace("{cluster}", ctx.last_by_verb.get("cluster", "cluster"))
              .replace("{align}", ctx.last_by_verb.get("align", "align"))
              .replace("{find}", ctx.last_by_verb.get("find", "disperse")))
    return out


def _coerce_config(stmt: VerbStmt, ctx: CompileContext) -> dict:
    """Normalize args dict into the operator's expected config shape."""
    cfg = dict(stmt.args)

    # Resolve parameter references ({"_param_ref": "name"}) using ctx.param_subs.
    for k, v in list(cfg.items()):
        if isinstance(v, dict) and "_param_ref" in v:
            ref = v["_param_ref"]
            resolved = ctx.param_subs.get(ref)
            if resolved is None:
                raise CompileError(
                    f"parameter {ref!r} is not bound at this call site",
                    stmt.line, stmt.col, ctx.source_lines,
                )
            cfg[k] = resolved

    # output_template (path with ${var}) -> output (resolved)
    if "output_template" in cfg:
        parts = cfg.pop("output_template")
        s = ""
        for p in parts:
            v = getattr(p, "value", "")
            if hasattr(p, "type") and p.type.name == "INTERP":
                s += str(ctx.sweep_subs.get(v, "${" + v + "}"))
            else:
                s += v
        cfg["output"] = s

    # Pin file content hash into the load operator's signature so runs are
    # truly deterministic at the source level. (Closes the determinism hole
    # we found in the universal pipeline.)
    if stmt.verb == "load" and "path" in cfg:
        path = cfg["path"]
        try:
            sha = _file_sha256(Path(path))
            cfg["_content_sha256"] = sha
        except FileNotFoundError:
            pass  # let the runner report the missing file

    return cfg


def _file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


# ── Sweep ────────────────────────────────────────────────────────────────

def _compile_sweep(sweep: SweepStmt, ctx: CompileContext):
    """Expand `sweep VAR from A to B do ... end` into N independent branches.

    A/B/step may be ints OR `_param_ref` dicts (parameter references from
    a `define` body). Resolve refs against ctx.param_subs at expansion time.
    """
    def _resolve(v):
        if isinstance(v, dict) and "_param_ref" in v:
            ref = v["_param_ref"]
            resolved = ctx.param_subs.get(ref)
            if resolved is None:
                raise CompileError(
                    f"sweep bound references parameter {ref!r} which is not bound",
                    sweep.line, sweep.col, ctx.source_lines,
                )
            return int(resolved)
        return int(v)

    start = _resolve(sweep.start)
    end = _resolve(sweep.end)
    step = _resolve(sweep.step) if sweep.step != 1 else 1

    saved_subs = dict(ctx.sweep_subs)
    saved_last = dict(ctx.last_by_verb)
    for v in range(start, end + 1, step):
        ctx.last_by_verb = dict(saved_last)
        ctx.sweep_subs = dict(saved_subs)
        ctx.sweep_subs[sweep.var] = str(v)
        for sub_stmt in sweep.body:
            _compile_stmt(sub_stmt, ctx)
    ctx.sweep_subs = saved_subs
    ctx.last_by_verb = saved_last


# ── Compare ──────────────────────────────────────────────────────────────

def _compile_compare(stmt: CompareStmt, ctx: CompileContext):
    """compare A against B [on METRIC of LABEL] — emit two branches + a meta-step.

    The meta-step is a virtual operator (`meta.compare`) that the runner
    handles specially: it reads the two named outputs and emits a diff.
    """
    # Compile both branches with a tag so step names don't collide
    saved_last = dict(ctx.last_by_verb)
    saved_count = ctx.step_count()

    ctx.last_by_verb = dict(saved_last)
    if stmt.left.bind_name is None:
        stmt.left.bind_name = "compare_a"
    _compile_stmt(stmt.left, ctx)
    a_name = ctx.steps[-1]["name"]

    ctx.last_by_verb = dict(saved_last)
    if stmt.right.bind_name is None:
        stmt.right.bind_name = "compare_b"
    _compile_stmt(stmt.right, ctx)
    b_name = ctx.steps[-1]["name"]

    ctx.steps.append({
        "name":   "compare",
        "kind":   "meta.compare",
        "inputs": {"a": f"{a_name}.Z", "b": f"{b_name}.Z"},
        "config": {"on_metric": stmt.on_metric, "on_label": stmt.on_label},
    })
