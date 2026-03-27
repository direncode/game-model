"""Audit logging middleware — records every API request for compliance."""

from __future__ import annotations

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings

logger = logging.getLogger("audit")

# Paths that should NOT be audit-logged (high-frequency / non-sensitive).
_SKIP_PATHS: set[str] = {"/health", "/"}


class AuditLogMiddleware(BaseHTTPMiddleware):
    """Capture request metadata and persist an audit log entry."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Skip noisy endpoints
        if request.url.path in _SKIP_PATHS:
            return await call_next(request)

        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # Extract actor from JWT (best-effort; token may be absent)
        actor_id: str | None = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                from app.core.auth import decode_token

                payload = decode_token(auth_header.removeprefix("Bearer ").strip())
                actor_id = payload.get("sub")
            except Exception:
                pass  # unauthenticated or invalid — still log the request

        actor_ip = request.client.host if request.client else "unknown"
        action = f"{request.method} {request.url.path}"

        # Derive a coarse resource type from the path
        path_parts = [p for p in request.url.path.strip("/").split("/") if p]
        resource_type = path_parts[2] if len(path_parts) > 2 else path_parts[0] if path_parts else "root"

        start = time.perf_counter()
        response: Response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        # Persist audit record asynchronously (fire-and-forget into DB)
        try:
            await _persist_audit_log(
                request_id=request_id,
                actor_id=actor_id,
                actor_ip=actor_ip,
                action=action,
                resource_type=resource_type,
                result=response.status_code,
                duration_ms=duration_ms,
            )
        except Exception:
            logger.exception("Failed to persist audit log entry %s", request_id)

        # Attach request-id header for traceability
        response.headers["X-Request-ID"] = request_id
        return response


async def _persist_audit_log(
    *,
    request_id: str,
    actor_id: str | None,
    actor_ip: str,
    action: str,
    resource_type: str,
    result: int,
    duration_ms: float,
) -> None:
    """Insert an audit log row via a short-lived async session."""
    from app.db.session import async_session_factory

    try:
        from app.models.audit_log import AuditLog
    except ImportError:
        # Model not yet created — fall back to structured logging
        logger.info(
            "audit | request_id=%s actor=%s ip=%s action=%s resource=%s status=%s duration=%.1fms",
            request_id,
            actor_id,
            actor_ip,
            action,
            resource_type,
            result,
            duration_ms,
        )
        return

    async with async_session_factory() as session:
        entry = AuditLog(
            request_id=request_id,
            actor_id=actor_id,
            actor_ip=actor_ip,
            action=action,
            resource_type=resource_type,
            result=result,
        )
        session.add(entry)
        await session.commit()
