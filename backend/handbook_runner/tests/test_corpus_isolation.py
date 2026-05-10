"""Verify the sandboxed program runs with HOME and cwd set to its workdir.

Full corpus isolation (no read access outside the workdir) is enforced at
the container layer via Docker mount scope and process-level rlimits; this
test only confirms the convention-level guarantees the sandbox itself
provides.
"""
from __future__ import annotations

from pathlib import Path

from backend.handbook_runner.sandbox import run_sandboxed


def test_program_cwd_and_home_are_workdir(tmp_path: Path) -> None:
    workdir = tmp_path / "work"
    workdir.mkdir()

    result = run_sandboxed(
        script=[
            "python",
            "-c",
            "import os; print('cwd:', os.getcwd()); "
            "print('home:', os.environ.get('HOME'))",
        ],
        wall_seconds=5,
        cpu_seconds=3,
        rss_bytes=128 * 1024 * 1024,
        cwd=str(workdir),
    )

    assert result.exit_code == 0
    # cwd line confirms the child inherited the requested working directory.
    assert "cwd:" in result.stdout
    cwd_line = next(
        line for line in result.stdout.splitlines() if line.startswith("cwd:")
    )
    home_line = next(
        line for line in result.stdout.splitlines() if line.startswith("home:")
    )
    # Path values may differ in case or short/long form on Windows. Compare
    # via Path.resolve() to neutralize that.
    cwd_value = cwd_line.split("cwd:", 1)[1].strip()
    home_value = home_line.split("home:", 1)[1].strip()
    assert Path(cwd_value).resolve() == workdir.resolve()
    assert Path(home_value).resolve() == workdir.resolve()
