"""Run an external process under wall-time, CPU, RSS, and file-size limits.

Linux is the supported production platform. On non-Linux (e.g. Windows
controllers, macOS dev boxes), the rlimit calls are skipped and the
wall-time watchdog still works via Popen's communicate() timeout.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Any

# ``resource`` is Unix-only. Importing it on Windows raises ImportError, so we
# guard the import. All rlimit code paths are gated on ``sys.platform``.
if sys.platform == "linux":
    import resource  # type: ignore[import-not-found]
else:  # pragma: no cover - platform-specific
    resource = None  # type: ignore[assignment]


class SandboxError(Exception):
    """Base class for sandbox errors."""


class SandboxTimeoutError(SandboxError):
    """Process exceeded the wall-time deadline."""


class SandboxLimitError(SandboxError):
    """Process hit one of the explicit rlimits."""


@dataclass
class SandboxResult:
    exit_code: int
    stdout: str
    stderr: str
    wall_ms: int


def _preexec(
    cpu_seconds: int,
    rss_bytes: int,
    fsize_bytes: int = 8 * 1024 * 1024,
    nofile: int = 64,
) -> None:
    """Set rlimits BEFORE the child execs. Linux-only."""
    if sys.platform == "linux" and resource is not None:
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))
        resource.setrlimit(resource.RLIMIT_AS, (rss_bytes, rss_bytes))
        resource.setrlimit(resource.RLIMIT_FSIZE, (fsize_bytes, fsize_bytes))
        resource.setrlimit(resource.RLIMIT_NOFILE, (nofile, nofile))
        # New process group so killpg() works on timeout.
        os.setsid()


def run_sandboxed(
    *,
    script: list[str],
    wall_seconds: int,
    cpu_seconds: int,
    rss_bytes: int,
    cwd: str,
    env: dict[str, str] | None = None,
    stdin_data: str | None = None,
) -> SandboxResult:
    if env is None:
        # Whitelist a minimal env so the child can't read host secrets.
        # On Windows, PATH is taken from the host because cmd.exe needs it.
        if sys.platform == "linux":
            default_path = "/usr/local/bin:/usr/bin:/bin"
        else:  # pragma: no cover - platform-specific fallback
            default_path = os.environ.get("PATH", "")
        env = {
            "PATH": default_path,
            "PYTHONIOENCODING": "utf-8",
            "PYTHONHASHSEED": "0",      # determinism
            "HOME": cwd,
        }
        # Windows needs SYSTEMROOT to load DLLs; preserve it without leaking
        # anything else.
        if sys.platform != "linux":  # pragma: no cover - platform-specific
            for var in ("SYSTEMROOT", "SYSTEMDRIVE", "TEMP", "TMP"):
                host_value = os.environ.get(var)
                if host_value is not None:
                    env[var] = host_value

    popen_kwargs: dict[str, Any] = dict(
        cwd=cwd,
        env=env,
        stdin=subprocess.PIPE if stdin_data is not None else None,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if sys.platform == "linux":
        popen_kwargs["preexec_fn"] = lambda: _preexec(cpu_seconds, rss_bytes)

    start = time.monotonic()
    try:
        proc = subprocess.Popen(script, **popen_kwargs)
    except OSError as e:
        raise SandboxError(f"failed to spawn sandbox: {e}") from e

    try:
        stdout, stderr = proc.communicate(input=stdin_data, timeout=wall_seconds)
    except subprocess.TimeoutExpired:
        # Kill the whole process group; preexec set setsid() on Linux.
        if sys.platform == "linux":
            try:
                os.killpg(proc.pid, 9)  # SIGKILL
            except (ProcessLookupError, PermissionError):
                pass
        else:  # pragma: no cover - platform-specific
            proc.kill()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:  # pragma: no cover - very unlikely
            pass
        raise SandboxTimeoutError(
            f"sandbox exceeded {wall_seconds}s wall time"
        ) from None

    wall_ms = int((time.monotonic() - start) * 1000)
    return SandboxResult(
        exit_code=proc.returncode,
        stdout=stdout,
        stderr=stderr,
        wall_ms=wall_ms,
    )
