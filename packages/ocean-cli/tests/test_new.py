"""Tests for ocean new."""
from __future__ import annotations

from pathlib import Path

from ocean_cli.main import main


def test_new_creates_file(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    rc = main(["new", "my_pipeline"])
    assert rc == 0
    target = tmp_path / "my_pipeline.ocean"
    assert target.is_file()
    text = target.read_text(encoding="utf-8")
    assert "require ocean 1.0" in text
    assert "seed 42" in text


def test_new_refuses_to_overwrite(tmp_path, monkeypatch, capsys):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "existing.ocean").write_text("seed 99\n", encoding="utf-8")
    rc = main(["new", "existing"])
    out = capsys.readouterr()
    combined = out.out + out.err
    assert rc != 0
    assert "exists" in combined.lower()
    assert (tmp_path / "existing.ocean").read_text(encoding="utf-8") == "seed 99\n"
