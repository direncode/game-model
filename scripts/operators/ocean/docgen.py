"""OCEAN doc-gen — extract `## ` doc-comments from .ocean source files
and emit Markdown reference documentation.

Doc-comment convention: lines beginning with `##` immediately preceding
a `define` declaration become the function's docstring. Argument
descriptions follow `Args:` and one-per-line `name — description`.

Usage:
    python -m scripts.operators.ocean.docgen scripts/operators/ocean/stdlib/
    python -m scripts.operators.ocean.docgen file.ocean --output docs/REFERENCE.md
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.ocean.parser import parse_ocean


DEFINE_RE = re.compile(r"^\s*define\s+(\w+)")


@dataclass
class FunctionDoc:
    name: str
    summary: str
    description: list[str] = field(default_factory=list)
    args: dict[str, str] = field(default_factory=dict)
    body_preview: list[str] = field(default_factory=list)
    source_file: str = ""
    line: int = 0


def extract_doc_comments(text: str) -> list[FunctionDoc]:
    """Walk source text and pair `## ` blocks with their following `define`."""
    lines = text.splitlines()
    docs: list[FunctionDoc] = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        # Collect doc-comment block
        if line.startswith("##"):
            comment_start = i
            comment_lines = []
            while i < len(lines) and lines[i].lstrip().startswith("##"):
                comment_lines.append(lines[i].lstrip()[2:].lstrip())
                i += 1
            # The next non-blank line should be a `define`
            while i < len(lines) and not lines[i].strip():
                i += 1
            m = DEFINE_RE.match(lines[i] if i < len(lines) else "")
            if m:
                doc = _parse_doc_block(comment_lines, m.group(1), comment_start + 1)
                docs.append(doc)
        i += 1
    return docs


def _parse_doc_block(lines: list[str], name: str, start_line: int) -> FunctionDoc:
    summary = lines[0] if lines else ""
    # Strip leading "name — " from summary if user wrote `name — description`
    summary = re.sub(rf"^{re.escape(name)}\s*[—-]\s*", "", summary)
    desc: list[str] = []
    args: dict[str, str] = {}
    in_args = False
    for ln in lines[1:]:
        if ln.lower().startswith("args:"):
            in_args = True
            continue
        if in_args:
            am = re.match(r"^(\w+)\s*[—-]\s*(.+)$", ln.strip())
            if am:
                args[am.group(1)] = am.group(2)
            continue
        if ln:
            desc.append(ln)
    return FunctionDoc(name=name, summary=summary, description=desc,
                       args=args, line=start_line)


def render_markdown(docs_by_file: dict[str, list[FunctionDoc]]) -> str:
    out: list[str] = ["# OCEAN reference\n",
                       "*Auto-generated from `## ` doc-comments in `.ocean` source.*\n"]
    for file, docs in sorted(docs_by_file.items()):
        out.append(f"\n## `{file}`\n")
        for d in docs:
            out.append(f"\n### `{d.name}`\n")
            if d.summary:
                out.append(f"{d.summary}\n")
            if d.description:
                out.append("")
                for ln in d.description:
                    out.append(ln)
                out.append("")
            if d.args:
                out.append("**Arguments:**\n")
                for arg, descr in d.args.items():
                    out.append(f"- `{arg}` — {descr}")
                out.append("")
    return "\n".join(out)


def collect_from_path(p: Path) -> dict[str, list[FunctionDoc]]:
    out: dict[str, list[FunctionDoc]] = {}
    if p.is_file():
        out[str(p)] = extract_doc_comments(p.read_text(encoding="utf-8"))
    else:
        for f in sorted(p.rglob("*.ocean")):
            docs = extract_doc_comments(f.read_text(encoding="utf-8"))
            if docs:
                out[str(f.relative_to(p) if p in f.parents else f)] = docs
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path", type=Path, help="file or directory to scan")
    ap.add_argument("--output", type=Path, help="output Markdown (default: stdout)")
    args = ap.parse_args()
    docs = collect_from_path(args.path)
    md = render_markdown(docs)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(md, encoding="utf-8")
        print(f"wrote {args.output}", file=sys.stderr)
    else:
        print(md)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
