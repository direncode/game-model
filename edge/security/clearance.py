"""Clearance-based access control for Edge deployments."""

from __future__ import annotations

import logging
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class ClearanceLevel(str, Enum):
    """User clearance levels (ordered lowest to highest)."""

    UNCLASSIFIED = "unclassified"
    CUI = "cui"
    CONFIDENTIAL = "confidential"
    SECRET = "secret"
    TOP_SECRET = "top_secret"


# Numeric ordering for comparison
_CLEARANCE_ORDER: dict[ClearanceLevel, int] = {
    ClearanceLevel.UNCLASSIFIED: 0,
    ClearanceLevel.CUI: 1,
    ClearanceLevel.CONFIDENTIAL: 2,
    ClearanceLevel.SECRET: 3,
    ClearanceLevel.TOP_SECRET: 4,
}


def _parse_clearance(value: str) -> ClearanceLevel:
    """Best-effort parse of a clearance string to enum."""
    normalized = value.strip().lower().replace(" ", "_").replace("-", "_")
    try:
        return ClearanceLevel(normalized)
    except ValueError:
        return ClearanceLevel.UNCLASSIFIED


class ClearanceManager:
    """Manages user clearance levels and module/data access.

    In Edge deployments every user has a clearance level.  Modules and
    individual data records also carry a minimum-clearance requirement.
    The manager enforces that users can only see what their clearance permits.
    """

    def can_access_module(
        self,
        user_clearance: ClearanceLevel,
        module_min_clearance: str,
    ) -> bool:
        """Return ``True`` if the user's clearance meets or exceeds the module's requirement."""
        required = _parse_clearance(module_min_clearance)
        user_rank = _CLEARANCE_ORDER.get(user_clearance, 0)
        required_rank = _CLEARANCE_ORDER.get(required, 0)
        return user_rank >= required_rank

    def filter_modules(
        self,
        modules: list[Any],
        user_clearance: ClearanceLevel,
        clearance_attr: str = "min_clearance",
    ) -> list[Any]:
        """Filter a list of modules/manifests to only those the user may access.

        Each item is expected to have a ``min_clearance`` attribute (or dict key).
        """
        result: list[Any] = []
        for mod in modules:
            if isinstance(mod, dict):
                min_cl = mod.get(clearance_attr, "unclassified")
            else:
                min_cl = getattr(mod, clearance_attr, "unclassified")
            if self.can_access_module(user_clearance, str(min_cl)):
                result.append(mod)
        return result

    def filter_data(
        self,
        data: list[dict],
        user_clearance: ClearanceLevel,
        clearance_key: str = "classification",
    ) -> list[dict]:
        """Filter data records by the user's clearance level.

        Each record should contain a ``classification`` key whose value
        maps to a :class:`ClearanceLevel`.
        """
        user_rank = _CLEARANCE_ORDER.get(user_clearance, 0)
        result: list[dict] = []
        for record in data:
            record_cl = _parse_clearance(record.get(clearance_key, "unclassified"))
            if user_rank >= _CLEARANCE_ORDER.get(record_cl, 0):
                result.append(record)
        return result
