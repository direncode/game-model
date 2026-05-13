"""Tests for the runner's path-resolution shim.

Background: on Windows under Git-Bash, ``Path("/c/Users/...").resolve()``
and ``Path("C:\\Users\\...").resolve()`` can produce strings that compare
unequal even though they refer to the same file. ``shutil.copyfile`` then
raises :class:`shutil.SameFileError`. The shim must absorb that without
crashing the gauntlet.
"""
from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from lo.demo.runner import _copy_unless_same


def test_copy_when_paths_differ(tmp_path: Path) -> None:
    src = tmp_path / "src.txt"
    dst = tmp_path / "dst.txt"
    src.write_text("hello", encoding="utf-8")
    _copy_unless_same(src, dst)
    assert dst.read_text(encoding="utf-8") == "hello"


def test_no_copy_when_paths_resolve_to_same_file(tmp_path: Path) -> None:
    """Path.samefile() short-circuits before shutil sees the call."""
    p = tmp_path / "thing.txt"
    p.write_text("payload", encoding="utf-8")
    # Same logical file via two ``Path`` objects → no-op, no SameFileError.
    _copy_unless_same(p, p)
    assert p.read_text(encoding="utf-8") == "payload"


def test_samefile_error_caught_even_without_samefile(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """If Path.samefile() raises (e.g. mid-flight file disappearance), the
    SameFileError fallback still catches the post-copy error."""
    src = tmp_path / "x.txt"
    src.write_text("x", encoding="utf-8")

    # Make samefile always say False so we go through shutil, then patch
    # shutil.copyfile to raise SameFileError.
    monkeypatch.setattr(Path, "samefile", lambda self, other: False)
    original = shutil.copyfile

    def fake_copy(s, d):
        raise shutil.SameFileError(f"pretend same: {s} -> {d}")

    monkeypatch.setattr(shutil, "copyfile", fake_copy)
    # Should not raise.
    _copy_unless_same(src, src)
    # Restore for hygiene; pytest will undo monkeypatches but be explicit.
    monkeypatch.setattr(shutil, "copyfile", original)


def test_source_missing_passes_through(tmp_path: Path) -> None:
    """A genuinely missing source must propagate FileNotFoundError; the
    shim should only swallow SameFileError, not all I/O failures."""
    src = tmp_path / "does_not_exist.txt"
    dst = tmp_path / "dst.txt"
    with pytest.raises(FileNotFoundError):
        _copy_unless_same(src, dst)
