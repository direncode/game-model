"""Latent Ocean Control Plane — manages cloud fork fleet.

The control plane is the central FastAPI service that provisions,
monitors, and orchestrates customer fork instances. It provides
a REST API for fork lifecycle management, usage metering, and
health monitoring.

Run with:
    uvicorn platform.control_plane.app:app --host 0.0.0.0 --port 9000
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.forks import router as forks_router, configure_services
from .api.billing import router as billing_router, configure_billing
from .api.customers import router as customers_router, configure_customers
from .config import ControlPlaneSettings
from .services.provisioner import ForkProvisioner
from .services.metering import MeteringService
from .services.health_scorer import HealthScorer
from .services.pricing import PricingEngine
from .services.billing import BillingService
from .services.usage_aggregator import UsageAggregator

logger = logging.getLogger(__name__)

settings = ControlPlaneSettings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler — initialize and teardown services."""
    # Startup
    logger.info("[control-plane] starting up")

    provisioner = ForkProvisioner(
        db_session_factory=None,  # Wire real DB in production
        settings=settings,
    )
    metering = MeteringService(db_session_factory=None)
    health_scorer = HealthScorer()

    # Billing & pricing services
    pricing_engine = PricingEngine()
    billing_service = BillingService(
        stripe_api_key=settings.STRIPE_API_KEY,
        stripe_webhook_secret=settings.STRIPE_WEBHOOK_SECRET,
    )
    usage_aggregator = UsageAggregator(
        metering=metering,
        db_session_factory=None,  # Wire real DB in production
    )

    configure_services(
        provisioner=provisioner,
        metering=metering,
        health_scorer=health_scorer,
    )
    configure_billing(
        billing_service=billing_service,
        pricing_engine=pricing_engine,
        usage_aggregator=usage_aggregator,
    )
    configure_customers(
        db_session_factory=None,  # Wire real DB in production
        billing_service=billing_service,
        pricing_engine=pricing_engine,
        usage_aggregator=usage_aggregator,
    )

    logger.info(
        "[control-plane] ready — domain=%s max_forks=%d",
        settings.DOMAIN,
        settings.MAX_FORKS_PER_CUSTOMER,
    )

    yield

    # Shutdown
    logger.info("[control-plane] shutting down")


app = FastAPI(
    title="Latent Ocean Control Plane",
    description=(
        "Manages the fleet of customer fork instances. "
        "Provides fork lifecycle management, usage metering, "
        "and health monitoring."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(forks_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(customers_router, prefix="/api/v1")


@app.get("/health")
async def health_check() -> dict:
    """Control plane health endpoint."""
    return {"status": "ok", "service": "control-plane", "version": "1.0.0"}


@app.get("/")
async def root() -> dict:
    """Control plane root — returns API info."""
    return {
        "service": "Latent Ocean Control Plane",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "api_prefix": "/api/v1",
    }
