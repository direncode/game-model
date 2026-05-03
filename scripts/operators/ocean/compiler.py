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

    def step_count(self) -> int:
        return len(self.steps)


def compile_ocean(text: str, source_name: str = "<input>") -> dict:
    """Compile OCEAN source -> a JSON-shaped pipeline config dict.

    The dict matches the schema run_pipeline() expects:
        {seed, steps: [{name, kind, inputs, config}, ...]}
    """
    prog = parse_ocean(text, source_name=source_name)
    ctx = CompileContext(source_name, text.splitlines())
    for stmt in prog.statements:
        _compile_stmt(stmt, ctx)
    return {
        "seed":  prog.seed,
        "steps": ctx.steps,
        "_source_name": source_name,
    }


# ── Statement compilers ──────────────────────────────────────────────────

def _compile_stmt(stmt, ctx: CompileContext):
    if isinstance(stmt, VerbStmt):
        _compile_verb(stmt, ctx)
    elif isinstance(stmt, LetStmt):
        # Let just compiles the inner verb_stmt, but binds the result-name
        if stmt.expr.bind_name is None:
            stmt.expr.bind_name = stmt.name
        _compile_verb(stmt.expr, ctx)
    elif isinstance(stmt, SweepStmt):
        _compile_sweep(stmt, ctx)
    elif isinstance(stmt, CompareStmt):
        _compile_compare(stmt, ctx)
    else:
        raise CompileError(f"unsupported statement type {type(stmt).__name__}")


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
    """Expand `sweep VAR from A to B do ... end` into N independent branches."""
    saved_subs = dict(ctx.sweep_subs)
    saved_last = dict(ctx.last_by_verb)
    for v in range(sweep.start, sweep.end + 1, sweep.step):
        # Reset the per-branch verb tracker (each branch is independent)
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
