"""Tests for ocean lint."""
from __future__ import annotations

from pathlib import Path

from ocean_cli.main import main

FIXTURES = Path(__file__).parent / "fixtures"


def test_lint_missing_seed_warns(capsys):
    rc = main(["lint", str(FIXTURES / "missing_seed.ocean")])
    out = capsys.readouterr()
    combined = out.out + out.err
    assert "seed" in combined.lower()


def test_lint_strict_treats_warning_as_error(capsys):
    rc = main(["lint", str(FIXTURES / "missing_seed.ocean"), "--strict"])
    assert rc != 0
