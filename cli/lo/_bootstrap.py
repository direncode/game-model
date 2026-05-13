"""Pre-import bootstrap.

Runs the moment anything inside `lo.*` is imported, before main.py / typer
have a chance to touch the rest of the world. Must NOT import numpy, scipy,
sklearn, or torch — the whole point is that we run before they do.

Two responsibilities:

1. MKL / OpenMP coexistence. On stock Windows Python + the wheels we depend
   on (numpy, scipy, sklearn, sometimes torch), two copies of the Intel
   OpenMP runtime end up loaded — the one MKL bundled with numpy and the
   one bundled with torch. The default behaviour is to abort with
   `OMP: Error #15: Initializing libiomp5md.dll, but found libiomp5md.dll
   already initialized.` Setting KMP_DUPLICATE_LIB_OK=TRUE turns that into
   a warning. OMP_NUM_THREADS=1 makes the demo deterministic across
   machines with different core counts.

2. UTF-8 stdio. Rich emits ✓ ✗ ▶ and box-drawing chars; the default
   Windows console is still cp1252 in many shells (cmd.exe, Git-Bash,
   older PowerShell). `sys.stdout.reconfigure(...)` is the Python-3.7+
   incantation to upgrade the stream in place. We swallow failures so
   pipes / redirects (which expose non-reconfigurable streams) don't
   crash the CLI.
"""
from __future__ import annotations

import os
import sys


def _setup_numerical_runtime() -> None:
    """Make MKL / OpenMP cohabit. Idempotent; user can override by setting
    the variable themselves before invoking `lo`."""
    os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    # MKL itself respects MKL_NUM_THREADS; pin it for determinism too.
    os.environ.setdefault("MKL_NUM_THREADS", "1")


def _force_utf8_stdio() -> None:
    """Upgrade stdout/stderr to UTF-8 with replacement on undecodable bytes.

    On Windows Python ≥3.7 every stream exposes `.reconfigure()`. If
    something has already wrapped the stream (a test harness, a redirect),
    the call may fail — we swallow that because the alternative (a hard
    crash on the first ✓ glyph) is worse.
    """
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is None:
            continue
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        except (AttributeError, ValueError, OSError):
            pass


_setup_numerical_runtime()
_force_utf8_stdio()


def _install_uncaught_logger() -> None:
    """Late-bind: only import obs if logging has been opted into.

    obs.install_uncaught_handler() routes any otherwise-fatal traceback
    through the structured logger before letting it bubble. We import it
    lazily so the bootstrap stays free of every-import overhead when the
    user hasn't asked for logging.
    """
    if "LO_LOG_LEVEL" not in os.environ and os.environ.get("LO_LOG_CONSOLE") != "1":
        return
    try:
        from . import obs
        obs.install_uncaught_handler()
    except Exception:
        pass


_install_uncaught_logger()
