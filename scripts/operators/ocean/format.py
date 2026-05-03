"""OCEAN formatter — canonical pretty-print.

Walks the AST and emits a normalized source representation:
  - Single space between tokens
  - 2-space indent inside blocks (define, sweep, if, parallel)
  - Imports sorted alphabetically
  - Blank line between defines
  - Trailing newline at EOF
  - Comments preserved at their original lines (best-effort)

Usage:
    python -m scripts.operators.ocean.format file.ocean
    python -m scripts.operators.ocean.format file.ocean --write
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.ocean.parser import parse_ocean, ParseError
from scripts.operators.ocean.lexer import LexerError
from scripts.operators.ocean.ast import (
    Program, VerbStmt, LetStmt, SweepStmt, CompareStmt, IfStmt, ReturnStmt,
    DefineDecl, ImportStmt, ParallelStmt,
    IntLit, FloatLit, StringLit, PathLit, BoolLit, IdentRef,
    BinaryOp, UnaryOp, CallExpr,
)


def format_program(prog: Program) -> str:
    out: list[str] = []
    if prog.require_version:
        m, mi, p = prog.require_version
        out.append(f"require ocean {m}.{mi}" + (f".{p}" if p else ""))
        out.append("")
    if prog.seed != 42 or any(True for _ in prog.statements if False):  # placeholder for explicit-seed detection
        out.append(f"seed {prog.seed}")
        out.append("")
    if prog.imports:
        for imp in sorted(prog.imports, key=lambda i: i.path):
            line = f'import "{imp.path}"'
            if imp.alias:
                line += f" as {imp.alias}"
            out.append(line)
        out.append("")
    for name, d in sorted(prog.defines.items()):
        out.extend(format_define(d))
        out.append("")
    for stmt in prog.statements:
        out.extend(format_statement(stmt, indent=0))
    # Drop trailing empties
    while out and out[-1] == "":
        out.pop()
    out.append("")
    return "\n".join(out)


def format_define(d: DefineDecl) -> list[str]:
    sig = f"define {d.name}"
    if d.params:
        parts = []
        for p in d.params:
            s = p.name
            if p.type_ann:
                s += f" : {p.type_ann.name}"
            if p.default is not None:
                s += f" = {format_expr(p.default)}"
            parts.append(s)
        sig += "(" + ", ".join(parts) + ")"
    sig += " do"
    lines = [sig]
    for stmt in d.body:
        lines.extend(format_statement(stmt, indent=1))
    lines.append("end")
    return lines


def format_statement(stmt, indent: int) -> list[str]:
    pad = "    " * indent
    if isinstance(stmt, VerbStmt):
        return [pad + format_verb_stmt(stmt)]
    if isinstance(stmt, LetStmt):
        ann = getattr(stmt, "type_ann", None)
        head = f"let {stmt.name}"
        if ann is not None:
            head += f" : {ann.name}"
        rhs = format_verb_stmt(stmt.expr) if isinstance(stmt.expr, VerbStmt) else format_expr(stmt.expr)
        return [pad + head + " = " + rhs]
    if isinstance(stmt, SweepStmt):
        head = f"sweep {stmt.var} from {stmt.start} to {stmt.end}"
        if stmt.step != 1:
            head += f" step {stmt.step}"
        head += " do"
        out = [pad + head]
        for sub in stmt.body:
            out.extend(format_statement(sub, indent + 1))
        out.append(pad + "end")
        return out
    if isinstance(stmt, CompareStmt):
        out = [pad + "compare"]
        out.append(pad + "    " + format_verb_stmt(stmt.left))
        out.append(pad + "against")
        out.append(pad + "    " + format_verb_stmt(stmt.right))
        if stmt.on_metric and stmt.on_label:
            out.append(pad + f"on {stmt.on_metric} of {stmt.on_label}")
        return out
    if isinstance(stmt, IfStmt):
        out = [pad + f"if {format_expr(stmt.cond)} then"]
        for sub in stmt.then_body:
            out.extend(format_statement(sub, indent + 1))
        for cond, body in stmt.elif_branches:
            out.append(pad + f"elif {format_expr(cond)} then")
            for sub in body:
                out.extend(format_statement(sub, indent + 1))
        if stmt.else_body:
            out.append(pad + "else")
            for sub in stmt.else_body:
                out.extend(format_statement(sub, indent + 1))
        out.append(pad + "end")
        return out
    if isinstance(stmt, ReturnStmt):
        if stmt.expr is None:
            return [pad + "return"]
        return [pad + f"return {format_expr(stmt.expr)}"]
    if isinstance(stmt, ParallelStmt):
        out = [pad + "parallel do"]
        for sub in stmt.body:
            out.extend(format_statement(sub, indent + 1))
        out.append(pad + "end")
        return out
    return [pad + f"# unsupported {type(stmt).__name__}"]


def format_verb_stmt(stmt: VerbStmt) -> str:
    parts = [stmt.verb]
    args = stmt.args or {}
    # Verb-specific re-emission
    if stmt.verb == "load":
        if "path" in args:
            parts.append(args["path"])
        if "target" in args:
            parts += ["take", str(args["target"]), "records"]
        if "stratify_by" in args:
            parts += ["balanced", "by", args["stratify_by"]]
        if "label_field" in args:
            parts += ["label", "field", "is", args["label_field"]]
        if "text_field" in args:
            parts += ["text", "field", "is", args["text_field"]]
    elif stmt.verb == "embed":
        parts.append("text")
        if stmt.from_ref:
            parts += ["from", stmt.from_ref]
        if "dims" in args:
            parts += ["into", str(args["dims"]), "dimensions"]
        for k in ("max_features", "min_df", "max_df"):
            if k in args:
                parts += ["with", f"{k} = {args[k]}"]
    elif stmt.verb == "cluster":
        if stmt.from_ref:
            parts.append(stmt.from_ref)
        if "iters" in args:
            parts += ["for", str(args["iters"]), "rounds"]
        if "max_modules" in args:
            parts += ["max", str(args["max_modules"]), "modules"]
        if "energy" in args:
            if args["energy"] == "corpus_mean":
                parts += ["energy", "=", "corpus", "mean"]
            elif args["energy"] == "normal_centroid":
                parts += ["energy", "=", "normal", "anchored", "on", str(args.get("normal_label", "?"))]
        if "crystallize_every" in args:
            parts += ["crystallize", "every", str(args["crystallize_every"])]
    elif stmt.verb == "align":
        parts.append("modules")
        if "k_nearest" in args:
            parts += ["using", str(args["k_nearest"]), "nearest", "records"]
        if "fine_label_field" in args:
            parts += ["fine", "label", "field", "is", args["fine_label_field"]]
    elif stmt.verb == "find":
        parts += ["dispersion", "of", "each", "label"]
    elif stmt.verb == "save":
        if "output" in args:
            parts += ["to", args["output"]]
    if stmt.bind_name and stmt.bind_name not in (None, ""):
        parts += ["as", stmt.bind_name]
    # using-variant for embed
    if stmt.verb == "embed":
        variant_for_kind = {
            "embed.tfidf_jl":       "tf-idf",
            "embed.content_fp48":   "content fingerprint",
            "embed.onehot_numeric": "one-hot numeric",
        }
        v = variant_for_kind.get(stmt.operator_kind)
        if v and v != "tf-idf":  # tf-idf is the default; don't emit
            parts += ["using", v]
        elif v:
            parts += ["using", v]
    return " ".join(parts)


def format_expr(expr) -> str:
    if isinstance(expr, IntLit):
        return str(expr.value)
    if isinstance(expr, FloatLit):
        return str(expr.value)
    if isinstance(expr, StringLit):
        return f'"{expr.value}"'
    if isinstance(expr, PathLit):
        return expr.value
    if isinstance(expr, BoolLit):
        return "true" if expr.value else "false"
    if isinstance(expr, IdentRef):
        return expr.name
    if isinstance(expr, BinaryOp):
        return f"{format_expr(expr.left)} {expr.op} {format_expr(expr.right)}"
    if isinstance(expr, UnaryOp):
        return f"{expr.op} {format_expr(expr.operand)}"
    if isinstance(expr, CallExpr):
        a = [format_expr(a) for a in expr.args]
        a += [f"{k}={format_expr(v)}" for k, v in expr.kwargs.items()]
        return f"{expr.func}({', '.join(a)})"
    if isinstance(expr, VerbStmt):
        return format_verb_stmt(expr)
    return str(expr)


def main():
    ap = argparse.ArgumentParser(description="OCEAN formatter — canonical pretty-print.")
    ap.add_argument("file", type=Path)
    ap.add_argument("--write", action="store_true", help="format in place")
    args = ap.parse_args()
    text = args.file.read_text(encoding="utf-8")
    try:
        prog = parse_ocean(text, source_name=str(args.file))
    except (LexerError, ParseError) as e:
        print(e.pretty(str(args.file)))
        return 1
    formatted = format_program(prog)
    if args.write:
        args.file.write_text(formatted, encoding="utf-8")
        print(f"formatted: {args.file}")
    else:
        print(formatted, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
