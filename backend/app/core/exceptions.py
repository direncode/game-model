"""Custom exception hierarchy and FastAPI exception handlers."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


# ── Exception classes ───────────────────────────────────────────────


class LIException(Exception):
    """Base exception for the Latent Intelligence platform."""

    status_code: int = 500
    detail: str = "Internal server error"

    def __init__(self, detail: str | None = None, status_code: int | None = None) -> None:
        self.detail = detail or self.__class__.detail
        self.status_code = status_code or self.__class__.status_code
        super().__init__(self.detail)


class NotFoundError(LIException):
    """Resource not found (404)."""

    status_code = 404
    detail = "Resource not found"


class ForbiddenError(LIException):
    """Insufficient permissions (403)."""

    status_code = 403
    detail = "Forbidden"


class UnauthorizedError(LIException):
    """Authentication required or invalid (401)."""

    status_code = 401
    detail = "Not authenticated"


class ConflictError(LIException):
    """Resource conflict (409)."""

    status_code = 409
    detail = "Conflict"


class ValidationError(LIException):
    """Request validation failed (422)."""

    status_code = 422
    detail = "Validation error"


# ── FastAPI exception handlers ──────────────────────────────────────


def register_exception_handlers(app: FastAPI) -> None:
    """Attach JSON-returning handlers for custom exceptions."""

    @app.exception_handler(LIException)
    async def li_exception_handler(request: Request, exc: LIException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "type": type(exc).__name__,
                    "detail": exc.detail,
                }
            },
        )
