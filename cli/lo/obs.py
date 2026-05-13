"""Observability: structured JSON logging + last-resort exception capture.

Production logging surface for the Latent Ocean CLI. Three responsibilities:

* Emit one JSON object per event to a rotating file under
  ``~/.latentocean/logs/lo.log.jsonl``. NDJSON, one record per line, so a
  receipt drop can be ``cat``-ed straight into ``jq`` or shipped to any
  log aggregator without parsing.

* Mirror that stream to stderr when ``LO_LOG_CONSOLE=1`` so live debug
  sessions don't have to ``tail -f`` the file separately.

* Install an ``except`` shim around the demo entry-points so when something
  fails in ``lo demo``, the user gets a one-line apology and the full
  traceback lands in the log file instead of dumping to stderr verbatim.

The logger is silent by default below ``LO_LOG_LEVEL`` (which itself
defaults to ``WARNING``). Set ``LO_LOG_LEVEL=DEBUG`` to follow every
verb-completion event. The cost of running the logger when nobody's
listening is one timestamp per event and one ``json.dumps`` call: at
gauntlet scale (40 events per run) that's ~2ms total, ignorable next to
the actual cluster step.
"""
from __future__ import annotations

import contextvars
import functools
import json
import logging
import logging.handlers
import os
import sys
import time
import traceback
import uuid
from pathlib import Path
from typing import Any, Callable, TypeVar

_LOGGER_NAME = "lo"
_LOG_DIR = Path.home() / ".latentocean" / "logs"
_LOG_FILE = _LOG_DIR / "lo.log.jsonl"
_LOG_MAX_BYTES = 5 * 1024 * 1024   # 5 MiB rotation; keep last 3 files
_LOG_BACKUP_COUNT = 3

_context: contextvars.ContextVar[dict[str, Any]] = contextvars.ContextVar(
    "lo_log_context", default={}
)

_F = TypeVar("_F", bound=Callable[..., Any])


class _JsonFormatter(logging.Formatter):
    """Render every LogRecord as a single-line JSON object.

    Standard fields: ts, level, event, msg, logger. Anything extra the
    caller attaches via ``extra=...`` or via the context var lands as a
    top-level field. Exceptions are flattened into ``error.type`` /
    ``error.message`` / ``error.trace`` so they round-trip through jq.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts":     time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "level":  record.levelname,
            "logger": record.name,
            "event":  getattr(record, "event", record.getMessage()),
        }
        ctx = _context.get() or {}
        for k, v in ctx.items():
            payload.setdefault(k, v)
        for k, v in record.__dict__.items():
            if k in payload or k.startswith("_") or k in _RESERVED:
                continue
            payload[k] = v
        if record.exc_info:
            etype, evalue, etb = record.exc_info
            payload["error"] = {
                "type":    etype.__name__ if etype else None,
                "message": str(evalue) if evalue else None,
                "trace":   "".join(traceback.format_exception(etype, evalue, etb)),
            }
        return json.dumps(payload, default=str, ensure_ascii=False)


_RESERVED = {
    "args", "asctime", "created", "exc_info", "exc_text", "filename",
    "funcName", "levelname", "levelno", "lineno", "message", "module",
    "msecs", "msg", "name", "pathname", "process", "processName",
    "relativeCreated", "stack_info", "thread", "threadName",
}


_initialized = False


def get_logger(name: str = _LOGGER_NAME) -> logging.Logger:
    """Return the configured logger, initialising once on first call."""
    global _initialized
    logger = logging.getLogger(name)
    if not _initialized:
        _initialize(logger)
        _initialized = True
    return logger


def _initialize(logger: logging.Logger) -> None:
    level_name = os.environ.get("LO_LOG_LEVEL", "WARNING").upper()
    level = getattr(logging, level_name, logging.WARNING)
    logger.setLevel(level)
    logger.propagate = False

    try:
        _LOG_DIR.mkdir(parents=True, exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            _LOG_FILE,
            maxBytes=_LOG_MAX_BYTES,
            backupCount=_LOG_BACKUP_COUNT,
            encoding="utf-8",
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(_JsonFormatter())
        logger.addHandler(file_handler)
    except OSError:
        # Log dir un-writable (sandboxed runner, read-only filesystem):
        # fall through to stderr only. Better than crashing the CLI.
        pass

    if os.environ.get("LO_LOG_CONSOLE") == "1":
        stream_handler = logging.StreamHandler(sys.stderr)
        stream_handler.setLevel(level)
        stream_handler.setFormatter(_JsonFormatter())
        logger.addHandler(stream_handler)


def bind(**fields: Any) -> contextvars.Token:
    """Push a dict of fields onto the active context.

    Use as ``token = obs.bind(corpus_id="patents"); ... ; obs.unbind(token)``
    or via ``obs.scope(corpus_id="patents")`` (recommended) for automatic
    unbinding via ``with``.
    """
    snapshot = {**(_context.get() or {}), **fields}
    return _context.set(snapshot)


def unbind(token: contextvars.Token) -> None:
    _context.reset(token)


class scope:
    """Context manager that binds fields for the duration of a block."""

    def __init__(self, **fields: Any) -> None:
        self._fields = fields
        self._token: contextvars.Token | None = None

    def __enter__(self) -> "scope":
        self._token = bind(**self._fields)
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._token is not None:
            unbind(self._token)


def event(name: str, level: int = logging.INFO, **fields: Any) -> None:
    """Emit a structured event. The canonical entry point.

    ``obs.event("verb.completed", verb="cluster", wall_s=1.4, sig="abc")``
    becomes one JSON record with ``event="verb.completed"`` plus the
    fields, merged with whatever is on the context.
    """
    logger = get_logger()
    if not logger.isEnabledFor(level):
        return
    # We pass `event` as the LogRecord's message AND as `extra={"event": ...}`
    # so handlers that don't use _JsonFormatter still see a useful string.
    extra = {"event": name, **fields}
    logger.log(level, name, extra=extra)


def exception(msg: str, **fields: Any) -> None:
    """Log an exception at ERROR with the active traceback attached."""
    logger = get_logger()
    extra = {"event": msg, **fields}
    logger.error(msg, exc_info=True, extra=extra)


def install_uncaught_handler() -> None:
    """Route any uncaught exception through ``obs.exception`` before the
    interpreter dies. Idempotent."""
    existing = getattr(sys, "_lo_obs_hook_installed", False)
    if existing:
        return

    prior_hook = sys.excepthook

    def _hook(etype, evalue, tb):
        try:
            get_logger().error(
                "uncaught.exception",
                exc_info=(etype, evalue, tb),
                extra={"event": "uncaught.exception"},
            )
        except Exception:
            pass
        prior_hook(etype, evalue, tb)

    sys.excepthook = _hook
    sys._lo_obs_hook_installed = True  # type: ignore[attr-defined]


def trace(event_name: str) -> Callable[[_F], _F]:
    """Decorator: wrap a function so entry, exit, and exceptions emit
    structured events.

    Useful for the gauntlet's per-corpus and per-verb boundaries: tag
    the function with ``@obs.trace("gauntlet.corpus")`` and every call
    produces a ``.started`` / ``.completed`` / ``.failed`` triple with
    the wall time."""

    def deco(fn: _F) -> _F:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            call_id = uuid.uuid4().hex[:8]
            t0 = time.time()
            event(f"{event_name}.started", call_id=call_id)
            try:
                result = fn(*args, **kwargs)
            except Exception as e:  # noqa: BLE001
                exception(
                    f"{event_name}.failed",
                    call_id=call_id,
                    wall_s=round(time.time() - t0, 3),
                    error_type=type(e).__name__,
                )
                raise
            event(
                f"{event_name}.completed",
                call_id=call_id,
                wall_s=round(time.time() - t0, 3),
            )
            return result

        return wrapper  # type: ignore[return-value]

    return deco
