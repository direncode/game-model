"""Tests for build.py --emit-content."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def _write(path: Path, text: str) -> None:
    """Write UTF-8 explicitly (Windows default codepage breaks on em-dash)."""
    path.write_text(text, encoding="utf-8")


def test_emit_content_writes_valid_ts(tmp_path):
    # Use a minimal handbook with one chapter for testing.
    handbook = tmp_path / "docs" / "handbook"
    handbook.mkdir(parents=True)

    _write(
        handbook / "01-x.md",
        "---\nslug: 01-x\nnumber: 1\ntitle: \"X\"\n"
        "promise: \"learn\"\nstatus: draft\n---\n# Ch 1 — X\n> learn\n\n"
        "## Concepts in this chapter\n- a\n- b\n\n"
        "## A section\nbody\n\n"
        "## Wider system\nstuff\n\n## Exercises\n1. Do x.\n\n"
        "## What's next\nnext\n",
    )
    _write(
        handbook / "app-d-glossary.md",
        "---\nslug: app-d-glossary\nnumber: null\ntitle: \"App D\"\n"
        "promise: \"defs\"\nstatus: draft\n---\n# App D\n\n> defs\n",
    )
    _write(
        handbook / "app-f-exercise-solutions.md",
        "---\nslug: app-f-exercise-solutions\nnumber: null\n"
        "title: \"App F\"\npromise: \"sols\"\nstatus: draft\n---\n"
        "# App F\n\n> sols\n\n## 01-x — 1\nsolve.\n",
    )

    output = tmp_path / "handbook-content.generated.ts"
    repo_root = Path(__file__).resolve().parents[3]
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "scripts.handbook.build",
            "--emit-content",
            str(output),
            "--handbook-dir",
            str(handbook),
        ],
        cwd=repo_root,
        env={**os.environ, "PYTHONPATH": str(repo_root), "PYTHONIOENCODING": "utf-8"},
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert output.exists()
    text = output.read_text(encoding="utf-8")
    assert "export const handbookChapters" in text

    # Verify the embedded JSON is valid by finding it between `= [` and ` as const;`.
    json_start = text.find("= [") + 2
    json_end = text.rfind(" as const;")
    parsed = json.loads(text[json_start:json_end])
    slugs = [c["slug"] for c in parsed]
    assert "01-x" in slugs

    # Schema checks: every chapter exposes the keys the frontend expects.
    for c in parsed:
        for key in (
            "slug",
            "number",
            "title",
            "promise",
            "concepts",
            "outline",
            "snippets",
            "exercises",
        ):
            assert key in c, f"missing key {key} in chapter {c.get('slug')}"

    # The "01-x" chapter has two concepts and one exercise.
    ch = next(c for c in parsed if c["slug"] == "01-x")
    assert ch["concepts"] == ["a", "b"]
    assert len(ch["exercises"]) == 1
    assert ch["exercises"][0]["number"] == 1
