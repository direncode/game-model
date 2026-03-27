"""Role-based access control (RBAC) with FastAPI dependency factories."""

from __future__ import annotations

from typing import Any, Callable

from fastapi import Depends

from app.core.auth import get_current_active_user
from app.core.exceptions import ForbiddenError

# ── Role → permission mapping ──────────────────────────────────────

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "viewer": {
        "read_modules",
        "read_connections",
        "view_lineage",
    },
    "analyst": {
        "read_modules",
        "read_connections",
        "view_lineage",
        "create_challenges",
        "annotate_modules",
        "export_reports",
    },
    "operator": {
        "read_modules",
        "read_connections",
        "view_lineage",
        "create_challenges",
        "annotate_modules",
        "export_reports",
        "run_crystallization",
        "manage_datasets",
        "resolve_challenges",
    },
    "admin": {
        "read_modules",
        "read_connections",
        "view_lineage",
        "create_challenges",
        "annotate_modules",
        "export_reports",
        "run_crystallization",
        "manage_datasets",
        "resolve_challenges",
        "manage_users",
        "manage_roles",
        "configure_system",
        "access_audit_logs",
    },
    "auditor": {
        "read_modules",
        "read_connections",
        "view_lineage",
        "access_audit_logs",
        "export_audit_reports",
    },
}


def _get_permissions_for_role(role: str) -> set[str]:
    """Return the permission set for a given role name."""
    return ROLE_PERMISSIONS.get(role, set())


# ── Dependency factories ────────────────────────────────────────────


def require_permission(permission: str) -> Callable[..., Any]:
    """Return a FastAPI dependency that enforces a single permission."""

    async def _check(user=Depends(get_current_active_user)):
        role: str = getattr(user, "role", "")
        if permission not in _get_permissions_for_role(role):
            raise ForbiddenError(
                detail=f"Permission '{permission}' required — your role '{role}' does not include it"
            )
        return user

    return _check


def require_role(role: str) -> Callable[..., Any]:
    """Return a FastAPI dependency that enforces a minimum role."""

    async def _check(user=Depends(get_current_active_user)):
        user_role: str = getattr(user, "role", "")
        if user_role != role and role not in ROLE_PERMISSIONS:
            raise ForbiddenError(detail=f"Role '{role}' required")
        if user_role != role:
            # Allow if the user's permissions are a superset of the target role
            user_perms = _get_permissions_for_role(user_role)
            required_perms = _get_permissions_for_role(role)
            if not required_perms.issubset(user_perms):
                raise ForbiddenError(detail=f"Role '{role}' or equivalent permissions required")
        return user

    return _check
