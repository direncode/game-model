"""Tests for ocean list stdlib."""
from __future__ import annotations

from ocean_cli.main import main


def test_list_stdlib_includes_substrate(capsys):
    rc = main(["list", "stdlib"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "substrate" in out
    assert "basic_run" in out


def test_list_stdlib_namespace_filter(capsys):
    rc = main(["list", "stdlib", "--namespace", "substrate"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "substrate" in out
    assert "basic_run" in out


def test_list_stdlib_unknown_namespace(capsys):
    rc = main(["list", "stdlib", "--namespace", "no_such_namespace"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "no presets" in out.lower()
