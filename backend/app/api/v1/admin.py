"""Admin endpoints: user management, audit logs, compliance."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.admin import (
    AuditLogListResponse,
    AuditLogResponse,
    UserListResponse,
    UserUpdateRole,
)
from app.schemas.auth import UserResponse
from app.schemas.common import PaginationParams

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=UserListResponse)
async def list_users(
    pagination: PaginationParams = Depends(),
    user=Depends(require_permission("manage_users")),
    db: AsyncSession = Depends(get_db),
):
    """List all users (admin only)."""
    offset = (pagination.page - 1) * pagination.per_page

    count_q = select(func.count()).select_from(User)
    total = (await db.execute(count_q)).scalar_one()

    q = (
        select(User)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(pagination.per_page)
    )
    result = await db.execute(q)
    users = result.scalars().all()

    return UserListResponse(
        users=[UserResponse.model_validate(u) for u in users],
        total=total,
    )


@router.put("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: uuid.UUID,
    body: UserUpdateRole,
    user=Depends(require_permission("manage_roles")),
    db: AsyncSession = Depends(get_db),
):
    """Update a user's role (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()
    if target_user is None:
        raise NotFoundError(detail="User not found")

    target_user.role = body.role
    db.add(target_user)
    await db.flush()
    await db.refresh(target_user)
    return target_user


@router.get("/audit", response_model=AuditLogListResponse)
async def query_audit_log(
    pagination: PaginationParams = Depends(),
    action: str | None = Query(default=None),
    actor_id: uuid.UUID | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    user=Depends(require_permission("access_audit_logs")),
    db: AsyncSession = Depends(get_db),
):
    """Query the audit log (admin/auditor only)."""
    offset = (pagination.page - 1) * pagination.per_page

    filters = []
    if action:
        filters.append(AuditLog.action.ilike(f"%{action}%"))
    if actor_id:
        filters.append(AuditLog.actor_id == actor_id)
    if resource_type:
        filters.append(AuditLog.resource_type == resource_type)

    count_q = select(func.count()).select_from(AuditLog)
    if filters:
        count_q = count_q.where(*filters)
    total = (await db.execute(count_q)).scalar_one()

    q = select(AuditLog).order_by(AuditLog.timestamp.desc()).offset(offset).limit(pagination.per_page)
    if filters:
        q = q.where(*filters)
    result = await db.execute(q)
    logs = result.scalars().all()

    return AuditLogListResponse(
        logs=[AuditLogResponse.model_validate(log) for log in logs],
        total=total,
    )


@router.get("/compliance", response_model=dict)
async def compliance_dashboard(
    user=Depends(require_permission("access_audit_logs")),
    db: AsyncSession = Depends(get_db),
):
    """Return compliance dashboard summary data (auditor/admin)."""
    # Total users
    user_count = (await db.execute(select(func.count()).select_from(User))).scalar_one()

    # Total audit entries
    audit_count = (await db.execute(select(func.count()).select_from(AuditLog))).scalar_one()

    # Distinct actions
    action_result = await db.execute(
        select(AuditLog.action, func.count())
        .group_by(AuditLog.action)
        .order_by(func.count().desc())
        .limit(20)
    )
    top_actions = [{"action": row[0], "count": row[1]} for row in action_result.all()]

    return {
        "total_users": user_count,
        "total_audit_entries": audit_count,
        "top_actions": top_actions,
    }
