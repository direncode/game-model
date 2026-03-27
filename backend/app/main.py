"""FastAPI application factory for the Latent Intelligence platform."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.middleware import AuditLogMiddleware

logger = logging.getLogger(__name__)


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
