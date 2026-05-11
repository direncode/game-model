"""Tests for ocean repl."""
from __future__ import annotations

import io

from ocean_cli.main import main


def test_repl_quit_immediately_exits_0(monkeypatch, capsys):
    monkeypatch.setattr("sys.stdin", io.StringIO("quit\n"))
    rc = main(["repl"])
    assert rc == 0


def test_repl_evaluates_no_op(monkeypatch, capsys):
    monkeypatch.setattr("sys.stdin", io.StringIO("seed 42\nquit\n"))
    rc = main(["repl"])
    assert rc == 0
