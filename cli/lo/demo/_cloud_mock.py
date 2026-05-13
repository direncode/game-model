"""Local mock of the production ``POST /v1/ocean/run`` endpoint.

For dev and CI. The real endpoint lives in
``backend/app/api/v1/ocean_run.py`` and can be hosted via the
standalone uvicorn entry at ``backend/ocean_run_standalone.py``. This
mock is the lightweight in-process alternative: it spins up a daemon-
thread HTTP server bound to an ephemeral localhost port, parses the
multipart frame, hashes the *contents* (not the raw body — httpx
randomizes multipart boundaries so raw-body hashing breaks
idempotency), and returns ``{"artifact_sha256": ...}``.

Usage:

    from lo.demo._cloud_mock import LocalCloudMock

    with LocalCloudMock() as mock:
        os.environ["LO_BASE_URL"] = mock.base_url
        os.environ["LO_API_KEY"]  = "test-key"
        replay_against_cloud(ledger=led, work_root=root)
"""
from __future__ import annotations

import contextlib
import hashlib
import http.server
import json
import re
import socket
import threading
from typing import Any


class _MockHandler(http.server.BaseHTTPRequestHandler):
    """One-method handler for ``POST /v1/ocean/run``. Wrong paths 404."""

    def log_message(self, *args: Any, **kwargs: Any) -> None:
        return  # silence per-request stderr trace

    def do_POST(self) -> None:  # noqa: N802
        if self.path.rstrip("/") != "/v1/ocean/run":
            self.send_response(404)
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length > 0 else b""
        ctype = self.headers.get("Content-Type", "")
        content_bytes = _extract_multipart_payload(body, ctype)
        sha = hashlib.sha256(content_bytes).hexdigest()
        payload = json.dumps({"artifact_sha256": sha}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def _extract_multipart_payload(body: bytes, content_type: str) -> bytes:
    """Concatenate every multipart field's bytes in name-sorted order.

    Falls back to the raw body on malformed input. Sorting by field
    name keeps the digest stable across SDK clients that emit fields
    in different orders.
    """
    m = re.search(r"boundary=([^;]+)", content_type)
    if not m:
        return body
    boundary = m.group(1).strip().strip('"').encode()
    if not boundary:
        return body
    sep = b"--" + boundary
    parts = body.split(sep)
    extracted: dict[str, bytes] = {}
    for part in parts:
        part = part.strip(b"\r\n")
        if not part or part == b"--":
            continue
        try:
            head, _, content = part.partition(b"\r\n\r\n")
        except Exception:
            continue
        name_match = re.search(rb'name="([^"]+)"', head)
        if not name_match:
            continue
        name = name_match.group(1).decode("latin-1", errors="replace")
        extracted[name] = content.rstrip(b"\r\n")
    if not extracted:
        return body
    return b"".join(
        f"{name}=".encode() + extracted[name] + b"\n"
        for name in sorted(extracted)
    )


class LocalCloudMock:
    """Context-managed local server for ``POST /v1/ocean/run``."""

    def __init__(self, host: str = "127.0.0.1") -> None:
        self._host = host
        self._server: http.server.ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    @property
    def base_url(self) -> str:
        if self._server is None:
            raise RuntimeError("mock server has not started yet")
        return f"http://{self._host}:{self._server.server_port}"

    def start(self) -> None:
        if self._server is not None:
            return
        self._server = http.server.ThreadingHTTPServer(
            (self._host, 0), _MockHandler,
        )
        self._thread = threading.Thread(
            target=self._server.serve_forever, daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        if self._server is None:
            return
        self._server.shutdown()
        self._server.server_close()
        self._server = None
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None

    def __enter__(self) -> "LocalCloudMock":
        self.start()
        return self

    def __exit__(self, *exc: Any) -> None:
        self.stop()


@contextlib.contextmanager
def running_mock(host: str = "127.0.0.1"):
    """Functional sugar: ``with running_mock() as mock: ...``."""
    mock = LocalCloudMock(host=host)
    mock.start()
    try:
        yield mock
    finally:
        mock.stop()


def _free_port(host: str = "127.0.0.1") -> int:
    """Reserve an ephemeral port without binding it (debug helper)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind((host, 0))
    port = s.getsockname()[1]
    s.close()
    return port
