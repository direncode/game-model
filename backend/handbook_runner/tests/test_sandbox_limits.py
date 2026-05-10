"""Tests for sandbox: rlimit enforcement, wall-time watchdog, output capture."""
from __future__ import annotations
import sys
import tempfile

import pytest

from backend.handbook_runner.sandbox import (
    SandboxResult,
    run_sandboxed,
    SandboxTimeoutError,
    SandboxLimitError,
)


def _tmp_cwd() -> str:
    """Return a writable cwd that exists on the host OS."""
    return tempfile.gettempdir()


def test_simple_program_succeeds():
    result = run_sandboxed(
        script=[sys.executable, "-c", "print('hello')"],
        wall_seconds=5,
        cpu_seconds=3,
        rss_bytes=128 * 1024 * 1024,
        cwd=_tmp_cwd(),
    )
    assert isinstance(result, SandboxResult)
    assert result.exit_code == 0
    assert "hello" in result.stdout


def test_wall_timeout_raises():
    with pytest.raises(SandboxTimeoutError):
        run_sandboxed(
            script=[sys.executable, "-c", "import time; time.sleep(10)"],
            wall_seconds=1,
            cpu_seconds=3,
            rss_bytes=128 * 1024 * 1024,
            cwd=_tmp_cwd(),
        )


@pytest.mark.skipif(sys.platform != "linux", reason="rlimit memory caps are Linux-only")
def test_rss_limit_kills_runaway_alloc():
    # Try to allocate ~512 MB while capped at 128 MB; expect non-zero exit.
    result = run_sandboxed(
        script=[
            sys.executable,
            "-c",
            "x = bytearray(512 * 1024 * 1024); print('survived', len(x))",
        ],
        wall_seconds=5,
        cpu_seconds=3,
        rss_bytes=128 * 1024 * 1024,
        cwd=_tmp_cwd(),
    )
    assert result.exit_code != 0
