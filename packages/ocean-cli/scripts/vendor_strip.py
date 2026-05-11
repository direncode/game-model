"""Pre-publish IP guard for the ocean-cli wheel.

Run before `python -m build`. The script:
    1. AST-strips any proprietary class definitions that slipped in.
    2. Emits a TRIMMED.txt manifest of what was removed.

Exits non-zero if any proprietary identifier still exists in the
vendored tree after stripping.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
PKG = REPO_ROOT / "packages/ocean-cli"
VENDORED = PKG / "src/ocean_cli/_vendored"

PROPRIETARY_CLASSES = (
    "ContentFP48Embedder",
    "BTUTReducer",
    "TCDRecursiveLoop",
    "DispersionAlignment",
)


def main() -> int:
    if not VENDORED.exists():
        print(f"error: {VENDORED} does not exist", file=sys.stderr)
        return 1

    trimmed: list[str] = []
    for py in VENDORED.rglob("*.py"):
        text = py.read_text(encoding="utf-8")
        new_text = _strip_classes(text, PROPRIETARY_CLASSES, removed=trimmed, path=py)
        if new_text != text:
            py.write_text(new_text, encoding="utf-8")

    manifest = VENDORED / "TRIMMED.txt"
    manifest.write_text("\n".join(sorted(trimmed)) + "\n", encoding="utf-8")
    print(f"vendor_strip: removed {len(trimmed)} class(es) from vendored tree")

    leaked = []
    for py in VENDORED.rglob("*.py"):
        text = py.read_text(encoding="utf-8")
        for ident in PROPRIETARY_CLASSES:
            if ident in text:
                leaked.append(f"{py.relative_to(VENDORED)}::{ident}")
    if leaked:
        print(f"error: identifiers still present after strip: {leaked}", file=sys.stderr)
        return 1
    return 0


def _strip_classes(source: str, names: tuple[str, ...], *, removed: list[str], path: Path) -> str:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return source
    new_body = [
        node for node in tree.body
        if not (isinstance(node, ast.ClassDef) and node.name in names)
    ]
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name in names:
            removed.append(f"{path.relative_to(VENDORED)}::{node.name}")
    if len(new_body) == len(tree.body):
        return source
    tree.body = new_body
    return ast.unparse(tree) + "\n"


if __name__ == "__main__":
    sys.exit(main())
