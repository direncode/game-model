"""Smoke tests for the OCEAN MCP server.

We don't run the JSON-RPC stdio loop in tests; we test the tool functions
directly. They're the same functions the MCP loop dispatches to."""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.ocean.mcp import (
    tool_compile, tool_validate, tool_list_ops, tool_list_stdlib,
    tool_format, tool_lint, TOOLS,
)


def test_tool_compile_succeeds_on_valid_program():
    src = (
        "load tmp/x.ndjson take 100 records\n"
        "embed text into 64 dimensions\n"
        "cluster for 8 rounds\n"
    )
    r = tool_compile(src)
    assert r["ok"] is True
    assert "config" in r
    assert len(r["config"]["steps"]) == 3


def test_tool_compile_fails_with_diagnostics():
    src = "embedd text into 64 dimensions"   # typo
    r = tool_compile(src)
    assert r["ok"] is False
    assert "embedd" in r["error"]


def test_tool_validate_passes():
    src = (
        "load tmp/x.ndjson\n"
        "embed text into 128 dimensions\n"
        "cluster for 16 rounds\n"
    )
    r = tool_validate(src)
    assert r["ok"] is True
    assert r["diagnostics"] == []


def test_tool_validate_catches_type_error():
    src = (
        "load tmp/x.ndjson\n"
        "cluster for 8 rounds\n"   # missing embed → type error
    )
    r = tool_validate(src)
    assert r["ok"] is True
    assert len(r["diagnostics"]) >= 1
    assert r["diagnostics"][0]["category"] == "TypeError_"


def test_tool_list_ops_returns_schemas():
    r = tool_list_ops()
    assert r["ok"] is True
    assert "embed.tfidf_jl" in r["operators"]
    assert any(p["english"] for p in r["operators"]["embed.tfidf_jl"])


def test_tool_list_stdlib_finds_substrate():
    r = tool_list_stdlib()
    assert r["ok"] is True
    files = [f["file"] for f in r["files"]]
    assert "substrate.ocean" in files
    sub = next(f for f in r["files"] if f["file"] == "substrate.ocean")
    fns = [d["name"] for d in sub["functions"]]
    assert "basic_run" in fns


def test_tool_format_canonicalizes():
    src = (
        "load    tmp/x.ndjson    take    100   records\n"
        "embed text into 64 dimensions\n"
    )
    r = tool_format(src)
    assert r["ok"] is True
    # Whitespace normalized
    assert "   " not in r["formatted"]


def test_tool_lint_returns_lints():
    src = "load nonexistent_file.ndjson take 100 records"
    r = tool_lint(src)
    assert r["ok"] is True
    # Linter should flag the missing-corpus warning
    codes = [l["code"] for l in r["lints"]]
    assert any("corpus" in c for c in codes)


def test_tool_definitions_have_required_shape():
    for tool in TOOLS:
        assert "name" in tool
        assert "description" in tool
        assert "inputSchema" in tool
        assert tool["inputSchema"]["type"] == "object"
