"""FastAPI application factory for the Latent Intelligence platform."""

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.middleware import AuditLogMiddleware

logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a `x-request-id` header to every request and log start/end.

    Enables trace correlation across logs + future distributed tracing.
    """

    async def dispatch(self, request: Request, call_next):
        req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = req_id
        t0 = time.time()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "request_failed", extra={"request_id": req_id, "path": request.url.path}
            )
            raise
        elapsed_ms = int((time.time() - t0) * 1000)
        response.headers["x-request-id"] = req_id
        logger.info(
            "request_completed",
            extra={
                "request_id": req_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "elapsed_ms": elapsed_ms,
            },
        )
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("Latent Intelligence API starting")
    yield
    logger.info("Latent Intelligence API shutting down")


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    app = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        debug=settings.APP_DEBUG,
        lifespan=lifespan,
    )

    # ── Middleware (order matters — outermost first) ─────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(AuditLogMiddleware)
    app.add_middleware(RequestIDMiddleware)

    # ── Prometheus /metrics endpoint ─────────────────────────────────
    try:
        from prometheus_fastapi_instrumentator import Instrumentator  # noqa: E402

        Instrumentator(
            should_group_status_codes=True,
            should_ignore_untemplated=True,
            should_respect_env_var=False,
            excluded_handlers=["/metrics", "/health"],
        ).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
    except ImportError:
        logger.warning("prometheus-fastapi-instrumentator not installed; /metrics disabled")

    # ── Exception handlers ──────────────────────────────────────────
    register_exception_handlers(app)

    # ── API routers ─────────────────────────────────────────────────
    from app.api.v1 import router as api_v1_router  # noqa: E402

    app.include_router(api_v1_router, prefix="/api/v1")

    # ── WebSocket routes ────────────────────────────────────────────
    try:
        from app.api.v1.ws import router as ws_router  # noqa: E402

        app.include_router(ws_router)
    except ImportError:
        logger.debug("WebSocket routes not yet available — skipping")

    # ── Root endpoints ──────────────────────────────────────────────
    @app.get("/", tags=["meta"])
    async def root():
        return {"name": "Latent Intelligence", "version": "0.1.0"}

    @app.get("/health", tags=["meta"])
    async def health():
        return {"status": "healthy"}

    return app


app = create_app()
