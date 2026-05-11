"""Tests for ocean_cli.main — the argparse dispatch shell."""
from __future__ import annotations

import pytest

from ocean_cli.main import main


def test_main_with_no_args_prints_help_and_exits_0(capsys):
    rc = main([])
    captured = capsys.readouterr()
    assert rc == 0
    combined = captured.out + captured.err
    assert "usage:" in combined.lower()


def test_main_with_unknown_subcommand_returns_non_zero(capsys):
    # argparse calls SystemExit(2) on unknown subcommand
    with pytest.raises(SystemExit) as excinfo:
        main(["does-not-exist"])
    assert excinfo.value.code != 0


def test_main_help_subcommand_exits_0(capsys):
    # argparse --help calls SystemExit(0)
    with pytest.raises(SystemExit) as excinfo:
        main(["--help"])
    assert excinfo.value.code == 0
