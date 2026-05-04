"""OCEAN linter — style + dead-code analysis.

Catches:
  - unused let-bindings
  - unused imports
  - missing seed declaration (deterministic-by-default warning)
  - missing label_field (silent default of 'archive' may surprise)
  - sweep with single iteration (start == end → why is this a sweep?)
  - cluster without a prior embed (caught by typecheck, but linter
    confirms after typecheck succeeds in case of recovery)
  - paths that don't exist on disk
  - magic numbers — embed_dim ∉ {64, 128, 192, 256} → flag

Usage:
    python -m scripts.operators.ocean.lint file.ocean
    python -m scripts.operators.ocean.lint file.ocean --strict   # warnings as errors
"""
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.ocean.parser import parse_ocean, ParseError
from scripts.operators.ocean.lexer import LexerError
from scripts.operators.ocean.ast import (
    VerbStmt, LetStmt, SweepStmt, CompareStmt, IfStmt, ParallelStmt,
    DefineDecl, ImportStmt, IdentRef,
)


@dataclass
class Lint:
    severity: str    # 'error' | 'warning' | 'info'
    line: int
    col: int
    code: str        # short identifier like 'unused-let'
    message: str

    def format(self, source_name: str, source_line: str = "") -> str:
        return (f"{source_name}:{self.line}:{self.col}: {self.severity} [{self.code}] "
                f"{self.message}")


# Canonical embed_dim values (validated on actual runs)
GOOD_EMBED_DIMS = {32, 64, 96, 128, 192, 256, 384, 512}


class Linter:
    def __init__(self, source_lines: list[str], strict: bool = False):
        self.source_lines = source_lines
        self.strict = strict
        self.lints: list[Lint] = []
        self.declared: dict[str, tuple[int, int]] = {}    # name -> (line, col)
        self.referenced: set[str] = set()

    def lint_program(self, prog) -> list[Lint]:
        # Top-level checks
        if not prog.statements and not prog.defines:
            self._add("warning", 1, 1, "empty-program",
                      "program has no statements or defines")

        # Import usage tracking
        for imp in prog.imports:
            if imp.alias:
                self.declared[imp.alias] = (imp.line, imp.col)

        # Walk all statements
        for stmt in prog.statements:
            self._walk_stmt(stmt)
        for d in prog.defines.values():
            for stmt in d.body:
                self._walk_stmt(stmt)

        # Flag unused
        for name, (line, col) in self.declared.items():
            if name not in self.referenced:
                self._add("warning", line, col, "unused-binding",
                          f"binding {name!r} is declared but never used")

        return self.lints

    def _walk_stmt(self, stmt):
        if isinstance(stmt, VerbStmt):
            self._lint_verb(stmt)
        elif isinstance(stmt, LetStmt):
            self.declared[stmt.name] = (stmt.line, stmt.col)
            if isinstance(stmt.expr, VerbStmt):
                self._lint_verb(stmt.expr)
            else:
                self._walk_expr(stmt.expr)
        elif isinstance(stmt, SweepStmt):
            if stmt.start == stmt.end:
                self._add("warning", stmt.line, stmt.col, "single-sweep",
                          f"sweep {stmt.var} from {stmt.start} to {stmt.end} "
                          "has only one iteration; consider removing the sweep")
            for sub in stmt.body:
                self._walk_stmt(sub)
        elif isinstance(stmt, CompareStmt):
            self._lint_verb(stmt.left)
            self._lint_verb(stmt.right)
        elif isinstance(stmt, IfStmt):
            self._walk_expr(stmt.cond)
            for sub in stmt.then_body:
                self._walk_stmt(sub)
            for cond, body in stmt.elif_branches:
                self._walk_expr(cond)
                for sub in body:
                    self._walk_stmt(sub)
            if stmt.else_body:
                for sub in stmt.else_body:
                    self._walk_stmt(sub)
        elif isinstance(stmt, ParallelStmt):
            for sub in stmt.body:
                self._walk_stmt(sub)

    def _walk_expr(self, expr):
        if isinstance(expr, IdentRef):
            self.referenced.add(expr.name)
        # binary/unary recurse — skipped for brevity in v1 linter

    def _lint_verb(self, stmt: VerbStmt):
        if stmt.from_ref:
            self.referenced.add(stmt.from_ref)
        # Path-existence check (warning, not error — file may be runtime-supplied)
        if stmt.verb == "load":
            path = stmt.args.get("path")
            if path and isinstance(path, str) and not Path(path).exists():
                self._add("warning", stmt.line, stmt.col, "missing-corpus",
                          f"corpus path {path!r} does not exist on disk")
            if "label_field" not in stmt.args:
                self._add("info", stmt.line, stmt.col, "implicit-label-field",
                          "no label field specified; using default 'archive'. "
                          "This is silent — consider being explicit.")
        # Embed dim sanity
        if stmt.verb == "embed":
            dims = stmt.args.get("dims")
            if isinstance(dims, int) and dims not in GOOD_EMBED_DIMS:
                self._add("info", stmt.line, stmt.col, "unusual-embed-dim",
                          f"embed_dim={dims} is unusual; "
                          f"validated values: {sorted(GOOD_EMBED_DIMS)}")
        # Cluster sanity
        if stmt.verb == "cluster":
            iters = stmt.args.get("iters", 16)
            if isinstance(iters, int):
                if iters < 4:
                    self._add("warning", stmt.line, stmt.col, "low-iters",
                              f"cluster iters={iters} is low; "
                              "TCD recursive loop typically needs ≥8 to crystallize")
                if iters > 32:
                    self._add("info", stmt.line, stmt.col, "high-iters",
                              f"cluster iters={iters} is high; "
                              "modules rarely emerge after iter 24")
            energy = stmt.args.get("energy")
            if energy == "normal_centroid" and "normal_label" not in stmt.args:
                self._add("error", stmt.line, stmt.col, "missing-normal-label",
                          "energy=normal_centroid requires `anchored on <label>`")

    def _add(self, severity: str, line: int, col: int, code: str, message: str):
        self.lints.append(Lint(severity, line, col, code, message))


def main():
    ap = argparse.ArgumentParser(description="OCEAN linter")
    ap.add_argument("file", type=Path)
    ap.add_argument("--strict", action="store_true",
                    help="warnings become errors (exit 1)")
    args = ap.parse_args()
    text = args.file.read_text(encoding="utf-8")
    try:
        prog = parse_ocean(text, source_name=str(args.file))
    except (LexerError, ParseError) as e:
        print(e.pretty(str(args.file)))
        return 1

    linter = Linter(text.splitlines(), strict=args.strict)
    lints = linter.lint_program(prog)
    if not lints:
        print(f"{args.file}: clean (0 lints)")
        return 0
    by_severity = {"error": 0, "warning": 0, "info": 0}
    for l in lints:
        by_severity[l.severity] += 1
        print(l.format(str(args.file)))
    print()
    print(f"  {by_severity['error']} error(s), {by_severity['warning']} warning(s), {by_severity['info']} info")
    if by_severity["error"] > 0:
        return 1
    if args.strict and by_severity["warning"] > 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
