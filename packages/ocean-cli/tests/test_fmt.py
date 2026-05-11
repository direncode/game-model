"""Tests for ocean fmt."""
from __future__ import annotations

import shutil
from pathlib import Path

from ocean_cli.main import main

FIXTURES = Path(__file__).parent / "fixtures"


def test_fmt_prints_canonical_form_by_default(capsys):
    rc = main(["fmt", str(FIXTURES / "unformatted.ocean")])
    out = capsys.readouterr().out
    assert rc == 0
    # Canonical form collapses runs of spaces inside statements.
    assert "   500" not in out


def test_fmt_write_modifies_file_in_place(capsys, tmp_path):
    src = FIXTURES / "unformatted.ocean"
    target = tmp_path / "u.ocean"
    shutil.copy2(src, target)
    rc = main(["fmt", str(target), "--write"])
    assert rc == 0
    text = target.read_text(encoding="utf-8")
    assert "   500" not in text
