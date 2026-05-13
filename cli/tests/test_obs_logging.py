"""Tests for the structured-logging surface.

Two things matter: the log format is valid NDJSON jq can parse, and
context-bound fields make it through into the emitted records.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import pytest

from lo import obs


def _drain(logger: logging.Logger) -> list[str]:
    """Read every record this test's StringIO handler captured."""
    for h in logger.handlers:
        if hasattr(h, "stream") and hasattr(h.stream, "getvalue"):
            return [ln for ln in h.stream.getvalue().splitlines() if ln]
    return []


@pytest.fixture
def captured_logger(monkeypatch: pytest.MonkeyPatch) -> logging.Logger:
    """Replace obs's handlers with a single in-memory stream."""
    import io
    logger = logging.getLogger("lo.test")
    for h in list(logger.handlers):
        logger.removeHandler(h)
    stream = io.StringIO()
    h = logging.StreamHandler(stream)
    h.setFormatter(obs._JsonFormatter())
    logger.addHandler(h)
    logger.setLevel(logging.DEBUG)

    # Redirect obs to our test logger by reaching into the module's global.
    monkeypatch.setattr(obs, "get_logger", lambda name="lo": logger)
    monkeypatch.setattr(obs, "_initialized", True)
    return logger


def test_event_emits_valid_json(captured_logger: logging.Logger) -> None:
    obs.event("test.fired", level=logging.WARNING, foo="bar", n=3)
    lines = _drain(captured_logger)
    assert len(lines) == 1
    rec = json.loads(lines[0])
    assert rec["event"] == "test.fired"
    assert rec["foo"] == "bar"
    assert rec["n"] == 3
    assert rec["level"] == "WARNING"


def test_scope_binds_context_fields(captured_logger: logging.Logger) -> None:
    with obs.scope(corpus_id="patents", seed=42):
        obs.event("corpus.started", level=logging.INFO)
    lines = _drain(captured_logger)
    rec = json.loads(lines[-1])
    assert rec["corpus_id"] == "patents"
    assert rec["seed"] == 42


def test_scope_unbinds_after_exit(captured_logger: logging.Logger) -> None:
    with obs.scope(corpus_id="patents"):
        pass
    obs.event("after.scope", level=logging.INFO)
    lines = _drain(captured_logger)
    rec = json.loads(lines[-1])
    assert "corpus_id" not in rec


def test_exception_captures_traceback(captured_logger: logging.Logger) -> None:
    try:
        raise ValueError("synthetic")
    except ValueError:
        obs.exception("boom", where="test")
    lines = _drain(captured_logger)
    rec = json.loads(lines[-1])
    assert rec["event"] == "boom"
    assert rec["error"]["type"] == "ValueError"
    assert "synthetic" in rec["error"]["message"]
    assert "ValueError" in rec["error"]["trace"]


def test_trace_decorator_emits_started_and_completed(captured_logger: logging.Logger) -> None:
    @obs.trace("unit.work")
    def work(x: int) -> int:
        return x * 2

    assert work(5) == 10
    events = [json.loads(ln)["event"] for ln in _drain(captured_logger)]
    assert "unit.work.started" in events
    assert "unit.work.completed" in events


def test_trace_decorator_logs_failure(captured_logger: logging.Logger) -> None:
    @obs.trace("unit.broken")
    def broken() -> None:
        raise RuntimeError("nope")

    with pytest.raises(RuntimeError):
        broken()
    events = [json.loads(ln)["event"] for ln in _drain(captured_logger)]
    assert "unit.broken.started" in events
    assert "unit.broken.failed" in events
