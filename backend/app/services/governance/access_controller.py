"""Service-level role-based access control (RBAC).

Provides dataset and module access checks, organization-scoped
permissions, and data classification enforcement with full audit logging.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import ROLE_PERMISSIONS
from app.models.dataset import Dataset
from app.models.governance import DataClassification, UserRole
from app.models.module import Module
from app.models.user import User

logger = logging.getLogger(__name__)

# Classification access levels (higher = more restricted)
_CLASSIFICATION_LEVELS = {
    "public": 0,
    "internal": 1,
    "confidential": 2,
    "restricted": 3,
}

# Minimum role for each classification level
_CLASSIFICATION_REQUIRED_ROLES = {
    "public": {"viewer", "analyst", "operator", "admin", "auditor"},
    "internal": {"analyst", "operator", "admin", "auditor"},
    "confidential": {"operator", "admin"},
    "restricted": {"admin"},
}


class AccessController:
    """Service-level RBAC with organization and classification enforcement."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def check_dataset_access(
        self,
        user: User,
        dataset_id: uuid.UUID,
        permission: str,
    ) -> bool:
        """Check if a user has a specific permission on a dataset.

        Checks:
        1. User role has the required permission.
        2. User belongs to the same organization as the dataset owner.
        3. Data classification allows access.

        Args:
            user: User instance.
            dataset_id: UUID of the dataset.
            permission: Required permission string.

        Returns:
            True if access is granted.
        """
        # Check role permission
        role_perms = ROLE_PERMISSIONS.get(user.role, set())
        if permission not in role_perms:
            logger.info(
                "Access denied: user=%s, permission=%s not in role=%s",
                user.id,
                permission,
                user.role,
            )
            return False

        # Check organization membership
        dataset_result = await self._db.execute(
            select(Dataset).where(Dataset.id == dataset_id)
        )
        dataset = dataset_result.scalar_one_or_none()
        if dataset is None:
            logger.warning(
                "Access check for non-existent dataset: %s", dataset_id
            )
            return False

        owner_result = await self._db.execute(
            select(User).where(User.id == dataset.owner_id)
        )
        owner = owner_result.scalar_one_or_none()

        if owner and owner.organization_id != user.organization_id:
            logger.info(
                "Access denied: user=%s (org=%s) cannot access dataset=%s (org=%s)",
                user.id,
                user.organization_id,
                dataset_id,
                owner.organization_id,
            )
            return False

        # Check data classification
        classification_ok = await self.enforce_data_classification(
            user, dataset_id
        )
        if not classification_ok:
            return False

        logger.debug(
            "Access granted: user=%s, dataset=%s, permission=%s",
            user.id,
            dataset_id,
            permission,
        )
        return True

    async def check_module_access(
        self,
        user: User,
        module_id: uuid.UUID,
        permission: str,
    ) -> bool:
        """Check if a user has permission to access a module.

        Delegates to dataset-level access check through the module's
        parent dataset.

        Args:
            user: User instance.
            module_id: UUID of the module.
            permission: Required permission string.

        Returns:
            True if access is granted.
        """
        result = await self._db.execute(
            select(Module.dataset_id).where(Module.id == module_id)
        )
        dataset_id = result.scalar_one_or_none()

        if dataset_id is None:
            logger.warning(
                "Access check for non-existent module: %s", module_id
            )
            return False

        return await self.check_dataset_access(user, dataset_id, permission)

    async def enforce_data_classification(
        self,
        user: User,
        dataset_id: uuid.UUID,
    ) -> bool:
        """Check if user's role satisfies the dataset's classification level.

        Args:
            user: User instance.
            dataset_id: UUID of the dataset.

        Returns:
            True if classification allows access.
        """
        result = await self._db.execute(
            select(DataClassification)
            .where(DataClassification.dataset_id == dataset_id)
            .order_by(DataClassification.classified_at.desc())
            .limit(1)
        )
        classification = result.scalar_one_or_none()

        if classification is None:
            # No classification = public access
            return True

        allowed_roles = _CLASSIFICATION_REQUIRED_ROLES.get(
            classification.classification, set()
        )

        if user.role not in allowed_roles:
            logger.info(
                "Classification access denied: user=%s (role=%s) "
                "cannot access %s-classified dataset=%s",
                user.id,
                user.role,
                classification.classification,
                dataset_id,
            )
            return False

        return True

    async def get_user_dataset_permissions(
        self,
        user: User,
        dataset_id: uuid.UUID,
    ) -> set[str]:
        """Get the effective permission set for a user on a dataset.

        Args:
            user: User instance.
            dataset_id: UUID of the dataset.

        Returns:
            Set of permission strings the user holds.
        """
        base_perms = ROLE_PERMISSIONS.get(user.role, set())

        # Check dataset-specific roles
        result = await self._db.execute(
            select(UserRole).where(
                and_(
                    UserRole.user_id == user.id,
                    UserRole.dataset_id == dataset_id,
                )
            )
        )
        dataset_roles = result.scalars().all()

        all_perms = set(base_perms)
        for role_entry in dataset_roles:
            role_perms = ROLE_PERMISSIONS.get(role_entry.role, set())
            all_perms.update(role_perms)

        # Filter by classification
        classification_ok = await self.enforce_data_classification(
            user, dataset_id
        )
        if not classification_ok:
            return set()

        return all_perms
