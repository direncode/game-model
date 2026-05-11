"""Tests for `ocean run <file>`."""
from __future__ import annotations

from pathlib import Path

from ocean_cli.main import main

FIXTURES = Path(__file__).parent / "fixtures"


def test_run_minimal_file_returns_0(capsys):
    rc = main(["run", str(FIXTURES / "hello.ocean")])
    assert rc == 0


def test_run_missing_file_returns_non_zero(capsys):
    rc = main(["run", str(FIXTURES / "does_not_exist.ocean")])
    captured = capsys.readouterr()
    assert rc != 0
    combined = (captured.out + captured.err).lower()
    assert "not found" in combined or "error" in combined


def test_run_bad_type_file_returns_non_zero(capsys):
    rc = main(["run", str(FIXTURES / "bad_type.ocean")])
    captured = capsys.readouterr()
    assert rc != 0
    combined = (captured.out + captured.err).lower()
    assert "error" in combined
