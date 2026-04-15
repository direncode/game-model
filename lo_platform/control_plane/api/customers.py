"""Customer management API.

CRUD endpoints for customer organizations, plus operations for
listing forks, viewing usage summaries, and changing pricing tiers.
"""
from __future__ import annotations

import logging
import uuid as _uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/customers", tags=["customers"])


# ── Request / Response models ────────────────────────────────────────


class CreateCustomerRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    organization: str = ""
    tier: str = "professional"
    billing_email: str = ""


class UpdateCustomerRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    organization: str | None = None
    billing_email: str | None = None
    settings: dict | None = None


class CustomerResponse(BaseModel):
    id: str
    name: str
    email: str
    organization: str = ""
    status: str = "active"
    tier: str | None = None
    stripe_customer_id: str = ""
    created_at: str | None = None


class CustomerDetailResponse(CustomerResponse):
    billing_email: str = ""
    settings: dict = {}
    updated_at: str | None = None
    last_login_at: str | None = None
    fork_count: int = 0


class CustomerUsageResponse(BaseModel):
    customer_id: str
    tier: str = ""
    total_forks: int = 0
    total_entities: int = 0
    total_queries: int = 0
    total_storage_gb: float = 0.0
    estimated_monthly_cost: float = 0.0
    forks: list[dict] = []


class ChangeTierRequest(BaseModel):
    tier: str = Field(..., description="Target pricing tier")


class ChangeTierResponse(BaseModel):
    customer_id: str
    previous_tier: str
    new_tier: str
    effective_immediately: bool = True


# ── Dependency injection ─────────────────────────────────────────────

_db_session_factory = None
_billing_service = None
_pricing_engine = None
_usage_aggregator = None


def configure_customers(
    db_session_factory: Any = None,
    billing_service: Any = None,
    pricing_engine: Any = None,
    usage_aggregator: Any = None,
) -> None:
    """Wire up service instances. Called during app startup."""
    global _db_session_factory, _billing_service, _pricing_engine, _usage_aggregator
    _db_session_factory = db_session_factory
    _billing_service = billing_service
    _pricing_engine = pricing_engine
    _usage_aggregator = usage_aggregator


# ── Routes ───────────────────────────────────────────────────────────


@router.post("/", response_model=CustomerResponse, status_code=201)
async def create_customer(request: CreateCustomerRequest) -> dict:
    """Create a new customer organization.

    Provisions a Stripe customer and creates the local record.
    """
    customer_id = str(_uuid.uuid4())

    # Create Stripe customer if billing service is available
    stripe_customer_id = ""
    if _billing_service is not None:
        stripe_result = await _billing_service.create_customer(
            customer_id=customer_id,
            email=request.billing_email or request.email,
            name=request.name,
            metadata={"organization": request.organization, "tier": request.tier},
        )
        stripe_customer_id = stripe_result.get("id", "")

    # Create local record
    now = datetime.now(timezone.utc)
    customer_data = {
        "id": customer_id,
        "name": request.name,
        "email": request.email,
        "organization": request.organization,
        "status": "active",
        "tier": request.tier,
        "stripe_customer_id": stripe_customer_id,
        "created_at": now.isoformat(),
    }

    if _db_session_factory is not None:
        from ..models.customer import Customer
        try:
            async with _db_session_factory() as session:
                customer = Customer(
                    id=_uuid.UUID(customer_id),
                    name=request.name,
                    email=request.email,
                    organization=request.organization,
                    billing_email=request.billing_email or request.email,
                    stripe_customer_id=stripe_customer_id,
                    status="active",
                    created_at=now,
                )
                session.add(customer)
                await session.commit()
        except Exception as exc:
            logger.error("[customers] create failed: %s", exc)
            raise HTTPException(500, f"Customer creation failed: {exc}")

    # Create subscription for the tier
    if _billing_service is not None and stripe_customer_id:
        await _billing_service.create_subscription(
            stripe_customer_id=stripe_customer_id,
            tier=request.tier,
        )

    logger.info(
        "[customers] created customer %s (%s) tier=%s",
        customer_id, request.name, request.tier,
    )
    return customer_data


@router.get("/", response_model=list[CustomerResponse])
async def list_customers(
    status: str | None = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[dict]:
    """List all customers, optionally filtered by status."""
    if _db_session_factory is None:
        return []

    from sqlalchemy import select, func
    from ..models.customer import Customer

    try:
        async with _db_session_factory() as session:
            stmt = select(Customer).limit(limit).offset(offset)
            if status:
                stmt = stmt.where(Customer.status == status)
            stmt = stmt.order_by(Customer.created_at.desc())

            result = await session.execute(stmt)
            customers = result.scalars().all()
            return [c.to_dict() for c in customers]
    except Exception as exc:
        logger.error("[customers] list failed: %s", exc)
        return []


@router.get("/{customer_id}", response_model=CustomerDetailResponse)
async def get_customer(customer_id: str) -> dict:
    """Get detailed customer information."""
    if _db_session_factory is None:
        raise HTTPException(503, "Database not initialized")

    from sqlalchemy import select, func
    from ..models.customer import Customer
    from ..models.fork import Fork

    try:
        async with _db_session_factory() as session:
            # Get customer
            stmt = select(Customer).where(
                Customer.id == _uuid.UUID(customer_id)
            )
            result = await session.execute(stmt)
            customer = result.scalar_one_or_none()

            if customer is None:
                raise HTTPException(404, "Customer not found")

            # Count forks
            fork_stmt = (
                select(func.count(Fork.id))
                .where(Fork.customer_id == _uuid.UUID(customer_id))
            )
            fork_result = await session.execute(fork_stmt)
            fork_count = fork_result.scalar() or 0

            data = customer.to_dict()
            data["billing_email"] = customer.billing_email or ""
            data["settings"] = customer.settings or {}
            data["updated_at"] = (
                customer.updated_at.isoformat()
                if customer.updated_at else None
            )
            data["last_login_at"] = (
                customer.last_login_at.isoformat()
                if customer.last_login_at else None
            )
            data["fork_count"] = fork_count
            data["stripe_customer_id"] = customer.stripe_customer_id or ""
            return data

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[customers] get %s failed: %s", customer_id, exc)
        raise HTTPException(500, f"Failed to retrieve customer: {exc}")


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str, request: UpdateCustomerRequest,
) -> dict:
    """Update customer details. Only provided fields are changed."""
    if _db_session_factory is None:
        raise HTTPException(503, "Database not initialized")

    from sqlalchemy import select
    from ..models.customer import Customer

    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields provided for update")

    try:
        async with _db_session_factory() as session:
            stmt = select(Customer).where(
                Customer.id == _uuid.UUID(customer_id)
            )
            result = await session.execute(stmt)
            customer = result.scalar_one_or_none()

            if customer is None:
                raise HTTPException(404, "Customer not found")

            for key, value in updates.items():
                if hasattr(customer, key):
                    setattr(customer, key, value)

            await session.commit()

            # Also update Stripe if name or email changed
            if _billing_service and customer.stripe_customer_id:
                stripe_updates = {}
                if "name" in updates:
                    stripe_updates["name"] = updates["name"]
                if "email" in updates or "billing_email" in updates:
                    stripe_updates["email"] = (
                        updates.get("billing_email")
                        or updates.get("email")
                        or customer.email
                    )
                if stripe_updates:
                    await _billing_service.update_customer(
                        customer.stripe_customer_id, **stripe_updates,
                    )

            return customer.to_dict()

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[customers] update %s failed: %s", customer_id, exc)
        raise HTTPException(500, f"Update failed: {exc}")


@router.get("/{customer_id}/forks")
async def list_customer_forks(
    customer_id: str,
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """List all forks belonging to a customer."""
    if _db_session_factory is None:
        return {"customer_id": customer_id, "forks": [], "total": 0}

    from sqlalchemy import select, func
    from ..models.fork import Fork

    try:
        async with _db_session_factory() as session:
            stmt = (
                select(Fork)
                .where(Fork.customer_id == _uuid.UUID(customer_id))
                .limit(limit)
            )
            if status:
                stmt = stmt.where(Fork.status == status)

            result = await session.execute(stmt)
            forks = result.scalars().all()

            # Count total
            count_stmt = (
                select(func.count(Fork.id))
                .where(Fork.customer_id == _uuid.UUID(customer_id))
            )
            if status:
                count_stmt = count_stmt.where(Fork.status == status)
            count_result = await session.execute(count_stmt)
            total = count_result.scalar() or 0

            return {
                "customer_id": customer_id,
                "forks": [f.to_dict() for f in forks],
                "total": total,
            }
    except Exception as exc:
        logger.error(
            "[customers] list_forks %s failed: %s", customer_id, exc,
        )
        return {"customer_id": customer_id, "forks": [], "total": 0}


@router.get("/{customer_id}/usage", response_model=CustomerUsageResponse)
async def get_customer_usage(customer_id: str) -> dict:
    """Get aggregated usage summary across all of a customer's forks.

    Includes per-fork breakdowns and an estimated monthly cost.
    """
    forks_data = await list_customer_forks(customer_id)
    forks = forks_data.get("forks", [])

    total_entities = 0
    total_queries = 0
    total_storage_gb = 0.0
    fork_summaries: list[dict] = []

    for fork in forks:
        fork_id = fork.get("id", "")
        entities = fork.get("entity_count", 0)
        queries = fork.get("queries_served_total", 0)
        storage_bytes = fork.get("storage_used_bytes", 0)
        storage_gb = storage_bytes / (1024 ** 3)

        total_entities += entities
        total_queries += queries
        total_storage_gb += storage_gb

        # Get current-month usage if aggregator is available
        if _usage_aggregator is not None:
            summary = await _usage_aggregator.get_current_month(fork_id)
            fork_summaries.append(summary.to_dict())
        else:
            fork_summaries.append({
                "fork_id": fork_id,
                "entity_count": entities,
                "queries_served": queries,
                "storage_gb": round(storage_gb, 4),
            })

    # Estimate cost
    estimated_cost = 0.0
    tier = "professional"
    if _pricing_engine is not None:
        estimated_cost = _pricing_engine.estimate_monthly(
            entity_count=total_entities,
            query_count=total_queries,
            storage_gb=total_storage_gb,
            module_count=len(forks),  # Approximate
        )
        tier = _pricing_engine.tier.value

    return {
        "customer_id": customer_id,
        "tier": tier,
        "total_forks": len(forks),
        "total_entities": total_entities,
        "total_queries": total_queries,
        "total_storage_gb": round(total_storage_gb, 4),
        "estimated_monthly_cost": estimated_cost,
        "forks": fork_summaries,
    }


@router.post("/{customer_id}/tier", response_model=ChangeTierResponse)
async def change_tier(customer_id: str, request: ChangeTierRequest) -> dict:
    """Change a customer's pricing tier.

    Updates the local plan association and Stripe subscription.
    """
    from ..services.pricing import PricingTier

    try:
        new_tier = PricingTier(request.tier)
    except ValueError:
        raise HTTPException(400, f"Unknown tier: {request.tier}")

    previous_tier = "unknown"

    # Update local record
    if _db_session_factory is not None:
        from sqlalchemy import select
        from ..models.customer import Customer

        try:
            async with _db_session_factory() as session:
                stmt = select(Customer).where(
                    Customer.id == _uuid.UUID(customer_id)
                )
                result = await session.execute(stmt)
                customer = result.scalar_one_or_none()

                if customer is None:
                    raise HTTPException(404, "Customer not found")

                # Track previous tier from plan
                if customer.plan:
                    previous_tier = customer.plan.name
                elif customer.settings and "tier" in customer.settings:
                    previous_tier = customer.settings["tier"]

                # Update settings with new tier
                settings = customer.settings or {}
                settings["tier"] = new_tier.value
                customer.settings = settings

                await session.commit()

                # Update Stripe subscription
                if _billing_service and customer.stripe_subscription_id:
                    await _billing_service.update_subscription(
                        subscription_id=customer.stripe_subscription_id,
                        tier=new_tier.value,
                    )

        except HTTPException:
            raise
        except Exception as exc:
            logger.error(
                "[customers] change_tier %s failed: %s", customer_id, exc,
            )
            raise HTTPException(500, f"Tier change failed: {exc}")

    logger.info(
        "[customers] tier change: customer=%s %s -> %s",
        customer_id, previous_tier, new_tier.value,
    )

    return {
        "customer_id": customer_id,
        "previous_tier": previous_tier,
        "new_tier": new_tier.value,
        "effective_immediately": True,
    }
