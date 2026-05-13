"""Operator pause/resume control for the gauntlet TUI.

Lets the human running the demo space-pause and space-resume between
verbs without abandoning the run. The default cadence (one verb every
~0.55s) is tuned for an unattended rehearsal; in front of a live
audience the operator wants to hold on a panel for as long as the
narration takes. Pausing freezes both the verb-walk animation AND the
sleep loop's "real time" so the cost-meter and elapsed clock honour the
pause as well.

Cross-platform key polling without pulling in a third-party library:

* Windows: ``msvcrt.kbhit()`` / ``msvcrt.getwch()`` — non-blocking, no
  termios required, works inside cmd.exe and Windows Terminal.

* POSIX: temporarily flip stdin to raw + non-blocking mode using
  ``termios`` and ``fcntl``, read one byte if available, restore.

Falls back to a no-op poll if stdin is not a TTY (piped, captured by
pytest, running under a test harness), so the demo never blocks.
"""
from __future__ import annotations

import os
import sys
import time
from typing import Callable

_IS_WINDOWS = os.name == "nt"


def _stdin_is_interactive() -> bool:
    """True only when stdin is a real TTY we can poll without hanging."""
    try:
        return sys.stdin is not None and sys.stdin.isatty()
    except (AttributeError, ValueError):
        return False


if _IS_WINDOWS:
    import msvcrt  # type: ignore[import-not-found]

    def _poll_key() -> str | None:
        """Return a single character if a key is pending, else None.

        ``msvcrt.getwch()`` reads a single Unicode char without echo.
        ``kbhit()`` is the non-blocking check that makes it safe to call
        inside the demo's 60-fps update loop. Control sequences (arrow
        keys, F-keys) get reported as a leading \\x00 / \\xe0; we drop
        those by consuming and returning None.
        """
        if not _stdin_is_interactive():
            return None
        if not msvcrt.kbhit():
            return None
        ch = msvcrt.getwch()
        if ch in ("\x00", "\xe0"):
            # Eat the second byte of the escape so subsequent polls
            # don't see a phantom char.
            if msvcrt.kbhit():
                msvcrt.getwch()
            return None
        return ch
else:
    import fcntl
    import select
    import termios
    import tty

    def _poll_key() -> str | None:
        """POSIX equivalent. Cribs the fd into raw mode just for the read."""
        if not _stdin_is_interactive():
            return None
        fd = sys.stdin.fileno()
        old_term = termios.tcgetattr(fd)
        old_flags = fcntl.fcntl(fd, fcntl.F_GETFL)
        try:
            tty.setcbreak(fd)
            fcntl.fcntl(fd, fcntl.F_SETFL, old_flags | os.O_NONBLOCK)
            r, _, _ = select.select([sys.stdin], [], [], 0)
            if not r:
                return None
            try:
                return sys.stdin.read(1)
            except (BlockingIOError, OSError):
                return None
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_term)
            fcntl.fcntl(fd, fcntl.F_SETFL, old_flags)


def check_pause_toggle() -> bool:
    """Return True iff the user has hit the pause key since the last poll.

    The pause key is space. Q is treated as a soft "quit-gracefully" hint
    by returning a special sentinel, but most callers just care about
    the bool — they read .quit_requested separately if they care.
    """
    ch = _poll_key()
    if ch is None:
        return False
    return ch == " "


def is_quit_pressed() -> bool:
    """Standalone check for 'q' to abort the run cleanly. Non-blocking."""
    ch = _poll_key()
    return ch is not None and ch in ("q", "Q")


def hold_while_paused(
    is_paused: Callable[[], bool],
    on_tick: Callable[[], None] | None = None,
    tick_seconds: float = 0.05,
) -> None:
    """Spin until ``is_paused()`` returns False.

    The caller passes a closure that reads whatever flag they keep on
    DemoState; we sleep in tiny ticks so toggling pause back off resumes
    within ~50ms. ``on_tick`` is invoked each iteration so the TUI can
    keep its clock from drifting visibly (the elapsed counter shows the
    pause as it happens).
    """
    while is_paused():
        if on_tick is not None:
            on_tick()
        time.sleep(tick_seconds)


def maybe_toggle(state) -> None:
    """Convenience wrapper for the sequencer loop.

    Reads one polled key. If it's space, flips ``state.operator_paused``.
    The TUI title and border style react to that flag (see
    ``render_corpus_pane`` in tui.py) so the change is visible the next
    frame."""
    if check_pause_toggle():
        state.operator_paused = not getattr(state, "operator_paused", False)
