"""Tests for `ocean version`."""
from __future__ import annotations

from ocean_cli import __version__
from ocean_cli.main import main


def test_version_prints_version_string(capsys):
    rc = main(["version"])
    captured = capsys.readouterr()
    assert rc == 0
    assert "OCEAN" in captured.out
    assert __version__ in captured.out
