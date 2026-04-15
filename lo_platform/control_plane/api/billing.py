"""Billing API — invoices, usage, payment management.

Exposes billing operations as REST endpoints: current and historical
usage per fork, invoice CRUD, cost estimation, pricing tier info,
and Stripe webhook ingestion.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


# ── Request / Response models ────────────────────────────────────────


class UsageResponse(BaseModel):
    fork_id: str
    period_start: str
    period_end: str
    total_entities_processed: int = 0
    total_queries_served: int = 0
    peak_storage_gb: float = 0.0
    reduction_cycles: int = 0
    enabled_modules: list[str] = []
    total_compute_cost_usd: float = 0.0


class InvoiceLineItemResponse(BaseModel):
    description: str
    quantity: float
    unit_price: float
    total: float
    category: str


class InvoiceResponse(BaseModel):
    customer_id: str = ""
    fork_id: str = ""
    period_start: str = ""
    period_end: str = ""
    tier: str = ""
    line_items: list[InvoiceLineItemResponse] = []
    subtotal: float = 0.0
    tax: float = 0.0
    total: float = 0.0
    currency: str = "usd"
    status: str = "draft"


class InvoiceSummaryResponse(BaseModel):
    id: str
    status: str
    total: int = 0
    currency: str = "usd"
    created: int | None = None
    hosted_invoice_url: str | None = None


class EstimateRequest(BaseModel):
    tier: str = "professional"
    entity_count: int = 0
    query_count: int = 0
    storage_gb: float = 0.0
    module_count: int = 1


class EstimateResponse(BaseModel):
    tier: str
    estimated_monthly_usd: float
    breakdown: dict


class TierResponse(BaseModel):
    tier: str
    name: str
    base_monthly_usd: float
    per_module_monthly_usd: float
    included_entities: int
    per_1k_entities_usd: float
    included_queries: int
    per_1k_queries_usd: float
    per_gb_storage_usd: float
    max_sources: int
    max_modules: int
    features: list[str]


class PayInvoiceRequest(BaseModel):
    payment_method_id: str | None = None


# ── Dependency injection ─────────────────────────────────────────────

_billing_service = None
_pricing_engine = None
_usage_aggregator = None


def configure_billing(
    billing_service: Any = None,
    pricing_engine: Any = None,
    usage_aggregator: Any = None,
) -> None:
    """Wire up billing service instances. Called during app startup."""
    global _billing_service, _pricing_engine, _usage_aggregator
    _billing_service = billing_service
    _pricing_engine = pricing_engine
    _usage_aggregator = usage_aggregator


def _get_billing():
    if _billing_service is None:
        raise HTTPException(503, "Billing service not initialized")
    return _billing_service


def _get_pricing():
    if _pricing_engine is None:
        raise HTTPException(503, "Pricing engine not initialized")
    return _pricing_engine


def _get_aggregator():
    if _usage_aggregator is None:
        raise HTTPException(503, "Usage aggregator not initialized")
    return _usage_aggregator


# ── Routes ───────────────────────────────────────────────────────────


@router.get("/usage/{fork_id}", response_model=UsageResponse)
async def get_current_usage(fork_id: str) -> dict:
    """Get current billing-period usage for a fork.

    Returns aggregated entity, query, storage, and compute metrics
    for the current calendar month.
    """
    aggregator = _get_aggregator()
    summary = await aggregator.get_current_month(fork_id)
    return summary.to_dict()


@router.get("/usage/{fork_id}/history")
async def get_usage_history(
    fork_id: str,
    months: int = Query(6, ge=1, le=24, description="Number of months"),
) -> dict:
    """Get usage history for a fork over previous months.

    Returns a list of monthly usage summaries going back N months.
    """
    aggregator = _get_aggregator()

    now = datetime.now(timezone.utc)
    history: list[dict] = []

    for i in range(months):
        # Walk backwards month by month
        month_end = now.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0,
        ) - timedelta(days=i * 28)  # Approximate
        # Adjust to actual first of month
        month_end = month_end.replace(day=1)
        if i == 0:
            month_end = now  # Current month goes to now

        # Calculate start of the month
        if i == 0:
            month_start = now.replace(
                day=1, hour=0, minute=0, second=0, microsecond=0,
            )
        else:
            # Go back i months from current month start
            year = now.year
            month = now.month - i
            while month <= 0:
                month += 12
                year -= 1
            month_start = datetime(
                year, month, 1, tzinfo=timezone.utc,
            )
            # End is start of next month
            next_month = month + 1
            next_year = year
            if next_month > 12:
                next_month = 1
                next_year += 1
            month_end = datetime(
                next_year, next_month, 1, tzinfo=timezone.utc,
            )

        summary = await aggregator.aggregate_period(
            fork_id, month_start, month_end,
        )
        history.append(summary.to_dict())

    return {"fork_id": fork_id, "months": months, "history": history}


@router.get("/invoices", response_model=list[InvoiceSummaryResponse])
async def list_invoices(
    customer_id: str = Query(..., description="Customer ID"),
    stripe_customer_id: str = Query("", description="Stripe customer ID"),
    limit: int = Query(10, ge=1, le=100),
) -> list[dict]:
    """List invoices for a customer.

    If stripe_customer_id is provided, fetches directly from Stripe.
    Otherwise returns locally tracked invoices.
    """
    billing = _get_billing()
    if stripe_customer_id:
        invoices = await billing.list_invoices(stripe_customer_id, limit=limit)
        return invoices
    # Fallback: return empty list if no Stripe ID
    return []


@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str) -> dict:
    """Get detailed invoice information."""
    billing = _get_billing()
    invoice = await billing.get_invoice(invoice_id)
    return invoice


@router.post("/invoices/{invoice_id}/pay")
async def pay_invoice(invoice_id: str, request: PayInvoiceRequest) -> dict:
    """Finalize and pay an invoice.

    If the invoice is in draft status, it will be finalized first.
    Payment is attempted via the customer's default payment method
    or the one specified in the request.
    """
    billing = _get_billing()

    # First finalize if draft
    invoice = await billing.get_invoice(invoice_id)
    if invoice.get("status") == "draft":
        await billing.finalize_invoice(invoice_id)

    # Stripe auto-charges on finalization if auto_advance is enabled.
    # For manual payment, we'd call stripe.Invoice.pay() here.
    stripe = billing._get_stripe()
    if stripe is not None:
        try:
            params = {}
            if request.payment_method_id:
                params["payment_method"] = request.payment_method_id
            result = stripe.Invoice.pay(invoice_id, **params)
            return {
                "id": result.id,
                "status": result.status,
                "amount_paid": result.amount_paid,
            }
        except Exception as exc:
            raise HTTPException(402, f"Payment failed: {exc}")

    # Mock mode
    return {
        "id": invoice_id,
        "status": "paid",
        "amount_paid": invoice.get("total", 0),
    }


@router.get("/estimate", response_model=EstimateResponse)
async def estimate_monthly_cost(
    tier: str = Query("professional"),
    entity_count: int = Query(500_000, ge=0),
    query_count: int = Query(100_000, ge=0),
    storage_gb: float = Query(10.0, ge=0),
    module_count: int = Query(3, ge=0),
) -> dict:
    """Estimate monthly cost for given usage parameters.

    Useful for sales conversations and self-service plan selection.
    """
    from ..services.pricing import PricingEngine, PricingTier

    try:
        pricing_tier = PricingTier(tier)
    except ValueError:
        raise HTTPException(400, f"Unknown tier: {tier}")

    engine = PricingEngine(pricing_tier)
    estimate = engine.estimate_monthly(
        entity_count=entity_count,
        query_count=query_count,
        storage_gb=storage_gb,
        module_count=module_count,
    )

    limits = engine.get_tier_limits()

    return {
        "tier": tier,
        "estimated_monthly_usd": estimate,
        "breakdown": {
            "base_fee": limits["base_monthly_usd"],
            "module_fees": module_count * limits["per_module_monthly_usd"],
            "entity_overage": max(0, entity_count - limits["included_entities"]),
            "query_overage": max(0, query_count - limits["included_queries"]),
            "storage_cost": round(storage_gb * limits["per_gb_storage_usd"], 2),
        },
    }


@router.get("/tiers", response_model=list[TierResponse])
async def list_tiers() -> list[dict]:
    """List all available pricing tiers with their rates and limits."""
    from ..services.pricing import TIER_PRICING, PricingEngine

    tiers = []
    for tier_enum, pricing in TIER_PRICING.items():
        engine = PricingEngine(tier_enum)
        tiers.append(engine.get_tier_limits())
    return tiers


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request) -> dict:
    """Handle incoming Stripe webhook events.

    Verifies the webhook signature, parses the event, and dispatches
    to the appropriate handler in the BillingService.
    """
    billing = _get_billing()

    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")

    if not signature and not billing.is_mock:
        raise HTTPException(400, "Missing stripe-signature header")

    result = await billing.handle_webhook(payload, signature)

    if result.get("status") == "error":
        raise HTTPException(400, result.get("detail", "Webhook processing failed"))

    return result
