"""Alert rule CRUD endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.core.exceptions import NotFoundError
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.delivery import AlertRule
from app.schemas.common import MessageResponse
from app.schemas.delivery import AlertRuleCreate, AlertRuleResponse, AlertRuleUpdate

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", response_model=AlertRuleResponse, status_code=201)
async def create_alert_rule(
    body: AlertRuleCreate,
    dataset_id: uuid.UUID | None = None,
    user=Depends(require_permission("export_reports")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new alert rule (analyst+ only).

    The dataset_id can be passed as a query parameter.
    """
    rule = AlertRule(
        dataset_id=dataset_id or uuid.uuid4(),  # fallback — caller should provide
        user_id=user.id,
        rule_type=body.rule_type,
        conditions=body.conditions,
        delivery_method=body.delivery_method,
        delivery_config=body.delivery_config,
        active=True,
    )
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


@router.get("", response_model=list[AlertRuleResponse])
async def list_alert_rules(
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List the current user's alert rules."""
    result = await db.execute(
        select(AlertRule)
        .where(AlertRule.user_id == user.id)
        .order_by(AlertRule.created_at.desc())
    )
    return result.scalars().all()


@router.put("/{rule_id}", response_model=AlertRuleResponse)
async def update_alert_rule(
    rule_id: uuid.UUID,
    body: AlertRuleUpdate,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing alert rule."""
    result = await db.execute(
        select(AlertRule).where(AlertRule.id == rule_id, AlertRule.user_id == user.id)
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise NotFoundError(detail="Alert rule not found")

    if body.rule_type is not None:
        rule.rule_type = body.rule_type
    if body.conditions is not None:
        rule.conditions = body.conditions
    if body.delivery_method is not None:
        rule.delivery_method = body.delivery_method
    if body.delivery_config is not None:
        rule.delivery_config = body.delivery_config
    if body.active is not None:
        rule.active = body.active

    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


@router.delete("/{rule_id}", response_model=MessageResponse)
async def delete_alert_rule(
    rule_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an alert rule."""
    result = await db.execute(
        select(AlertRule).where(AlertRule.id == rule_id, AlertRule.user_id == user.id)
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise NotFoundError(detail="Alert rule not found")

    await db.delete(rule)
    await db.flush()
    return MessageResponse(message="Alert rule deleted")
