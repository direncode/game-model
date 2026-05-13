"""vendor_strip.py — vendor + strip proprietary operators from ocean-mcp.

Runs during the package build. Walks the source tree under
`scripts/operators/`, copies it into `src/ocean_mcp/_vendored/`, and
removes specific class definitions (the proprietary operator
implementations) so they are NOT shipped on PyPI.

The four premium operators (TCDRecursiveLoop, ContentFp48Embedder,
BTUTReducer if present, DispersionAnalysis) are stripped here.
Stub classes that register under the same kinds live in
`ocean_mcp._premium_stubs` and are imported when the package loads.

Why AST-based stripping vs. regex: regex breaks on class bodies that
span unusual whitespace, decorators, or nested defs. AST gives a clean
boundary at the class-def node level.

Usage:
    python packages/ocean-mcp/scripts/vendor_strip.py
"""
from __future__ import annotations

import ast
import shutil
import sys
from pathlib import Path


REPO_ROOT      = Path(__file__).resolve().parents[3]
SOURCE_OPS     = REPO_ROOT / "scripts" / "operators"
TCD_JEPA_DIR   = REPO_ROOT / "tcd-jepa"
PKG_VENDORED   = REPO_ROOT / "packages" / "ocean-mcp" / "src" / "ocean_mcp" / "_vendored"

# Class names to strip per file. These are the proprietary implementations
# that must not ship on PyPI. Stubs in _premium_stubs.py replace them.
PROPRIETARY: dict[str, set[str]] = {
    "scripts/operators/cluster.py": {"TCDRecursiveLoop"},
    "scripts/operators/embed.py":   {"ContentFp48Embedder"},
    "scripts/operators/reduce.py":  {"BTUTReducer"},
    # NOTE: ``DispersionAnalysis`` is generic kNN+crosstab and SHIPS in
    # the wheel — do not add it back. ``StratifiedReducer``,
    # ``HammingClusterer``, and ``NarrateLlmSummary`` are also generic
    # and ship freely. Only trade-secret algorithm bodies get stripped.
}


class StripClasses(ast.NodeTransformer):
    """Remove ClassDef nodes whose name is in the strip set, including any
    decorators they carry (e.g. @register)."""

    def __init__(self, names: set[str]):
        self.names = names
        self.removed: list[str] = []

    def visit_Module(self, node: ast.Module):
        new_body = []
        for stmt in node.body:
            if isinstance(stmt, ast.ClassDef) and stmt.name in self.names:
                self.removed.append(stmt.name)
                continue
            new_body.append(stmt)
        node.body = new_body
        return node


def strip_file(path: Path, dest: Path, names: set[str]) -> list[str]:
    """Read source, AST-parse, remove named classes, write to dest."""
    source = path.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(path))
    stripper = StripClasses(names)
    tree = stripper.visit(tree)
    ast.fix_missing_locations(tree)
    new_source = ast.unparse(tree)

    # Add a stamp at the top so the public source is clearly marked.
    stamp = (
        "# ─────────────────────────────────────────────────────────\n"
        "# This file ships in ocean-mcp on PyPI / npm.\n"
        "# Premium operator implementations have been stripped from\n"
        "# this build and replaced with stubs in ocean_mcp._premium_stubs.\n"
        "# Premium operators run only on api.latentocean.com.\n"
        "# Stripped classes from this file: " + ", ".join(stripper.removed) + "\n"
        "# ─────────────────────────────────────────────────────────\n\n"
    )
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(stamp + new_source, encoding="utf-8")
    return stripper.removed


def copy_file(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)


def main() -> int:
    if not SOURCE_OPS.exists():
        print(f"FATAL: source operators dir not found: {SOURCE_OPS}", file=sys.stderr)
        return 2

    # Wipe the vendored tree so we start clean each build.
    if PKG_VENDORED.exists():
        shutil.rmtree(PKG_VENDORED)
    PKG_VENDORED.mkdir(parents=True)

    scripts_pkg = PKG_VENDORED / "scripts"
    scripts_pkg.mkdir(parents=True)
    (scripts_pkg / "__init__.py").write_text("", encoding="utf-8")

    operators_pkg = scripts_pkg / "operators"
    operators_pkg.mkdir(parents=True)

    # Walk the source tree and copy/strip as appropriate.
    summary: dict[str, list[str]] = {}
    for py_file in SOURCE_OPS.rglob("*"):
        if py_file.is_dir():
            continue
        if "__pycache__" in py_file.parts:
            continue

        rel = py_file.relative_to(SOURCE_OPS)
        dest = operators_pkg / rel
        rel_repo = py_file.relative_to(REPO_ROOT).as_posix()

        if rel_repo in PROPRIETARY:
            removed = strip_file(py_file, dest, PROPRIETARY[rel_repo])
            summary[rel_repo] = removed
        else:
            copy_file(py_file, dest)

    print("vendor_strip: build complete")
    print(f"  source:  {SOURCE_OPS}")
    print(f"  output:  {PKG_VENDORED}")
    print()
    print("  proprietary classes stripped from public package:")
    for f, names in summary.items():
        print(f"    {f}  ->removed: {', '.join(names) if names else '(none - sentinel)'}")

    # Sanity: confirm none of the stripped names appear in the vendored output.
    leaks: list[tuple[str, str]] = []
    for vendored_file in PKG_VENDORED.rglob("*.py"):
        text = vendored_file.read_text(encoding="utf-8")
        for class_set in PROPRIETARY.values():
            for cls_name in class_set:
                # Look for the class definition pattern only — not arbitrary mentions.
                if f"class {cls_name}" in text:
                    leaks.append((str(vendored_file), cls_name))

    if leaks:
        print()
        print("FATAL: proprietary class definitions leaked into vendored output:")
        for f, c in leaks:
            print(f"    {f}  ->class {c}")
        return 1

    print()
    print("  [OK] verified: no proprietary class definitions leaked into vendored tree")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
