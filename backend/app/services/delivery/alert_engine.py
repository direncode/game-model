"""Configurable alert evaluation engine.

Evaluates alert rules against new crystallization results and
triggers notifications when conditions are met.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.delivery import AlertEvent, AlertRule
from app.models.module import Module

logger = logging.getLogger(__name__)


@dataclass
class AlertResult:
    """Result of evaluating a single alert rule."""

    rule_id: str
    triggered: bool
    details: dict
    delivery_method: str
    delivery_config: dict


class AlertEngine:
    """Evaluate alert rules against crystallization results."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def evaluate_rules(self, job_id: uuid.UUID) -> list[AlertResult]:
        """Evaluate all active alert rules against a new job's results.

        Args:
            job_id: UUID of the completed crystallization job.

        Returns:
            List of AlertResult for each triggered rule.
        """
        # Load modules for this job
        modules_result = await self._db.execute(
            select(Module).where(Module.job_id == job_id)
        )
        modules = list(modules_result.scalars().all())

        if not modules:
            logger.info("No modules for job %s; no alerts to evaluate", job_id)
            return []

        dataset_id = modules[0].dataset_id

        # Load active rules for this dataset
        rules_result = await self._db.execute(
            select(AlertRule).where(
                and_(
                    AlertRule.dataset_id == dataset_id,
                    AlertRule.active == True,  # noqa: E712
                )
            )
        )
        rules = list(rules_result.scalars().all())

        logger.info(
            "Evaluating %d alert rules for job=%s, dataset=%s",
            len(rules),
            job_id,
            dataset_id,
        )

        triggered: list[AlertResult] = []
        for rule in rules:
            result = await self._evaluate_rule(rule, modules, job_id)
            if result.triggered:
                triggered.append(result)
                await self._record_event(rule, job_id, result.details)

        logger.info(
            "Alert evaluation complete: %d/%d rules triggered",
            len(triggered),
            len(rules),
        )
        return triggered

    async def _evaluate_rule(
        self, rule: AlertRule, modules: list[Module], job_id: uuid.UUID
    ) -> AlertResult:
        """Evaluate a single alert rule."""
        conditions = rule.conditions or {}
        rule_type = rule.rule_type

        triggered = False
        details: dict[str, Any] = {}

        if rule_type == "entity_connection":
            triggered, details = self._entity_connection_alert(
                conditions, modules
            )
        elif rule_type == "purity_threshold":
            triggered, details = self._purity_threshold_alert(
                conditions, modules
            )
        elif rule_type == "module_count":
            triggered, details = self._module_count_alert(
                conditions, modules
            )
        elif rule_type == "new_module":
            triggered, details = self._new_module_alert(conditions, modules)
        else:
            logger.warning("Unknown rule type: %s (rule=%s)", rule_type, rule.id)

        return AlertResult(
            rule_id=str(rule.id),
            triggered=triggered,
            details=details,
            delivery_method=rule.delivery_method,
            delivery_config=rule.delivery_config or {},
        )

    @staticmethod
    def _entity_connection_alert(
        conditions: dict, modules: list[Module]
    ) -> tuple[bool, dict]:
        """Check if specific entities appear in the same module.

        Conditions:
            entities: list of entity names to check.
            same_module: bool, True means alert when together.
        """
        target_entities = set(conditions.get("entities", []))
        same_module = conditions.get("same_module", True)

        if not target_entities:
            return False, {}

        for module in modules:
            if module.anchor_entities:
                module_entities = {
                    a.get("name", "") if isinstance(a, dict) else str(a)
                    for a in module.anchor_entities
                }
                overlap = target_entities & module_entities
                if same_module and len(overlap) >= 2:
                    return True, {
                        "module": module.name,
                        "connected_entities": list(overlap),
                    }

        if not same_module:
            # Check entities are in different modules
            entity_modules: dict[str, str] = {}
            for module in modules:
                if module.anchor_entities:
                    for a in module.anchor_entities:
                        name = a.get("name", "") if isinstance(a, dict) else str(a)
                        if name in target_entities:
                            entity_modules[name] = module.name

            if len(entity_modules) >= 2:
                module_names = set(entity_modules.values())
                if len(module_names) >= 2:
                    return True, {
                        "entity_modules": entity_modules,
                    }

        return False, {}

    @staticmethod
    def _purity_threshold_alert(
        conditions: dict, modules: list[Module]
    ) -> tuple[bool, dict]:
        """Check if any module's purity falls below a threshold.

        Conditions:
            min_purity: float, minimum acceptable purity score.
            max_purity: float, maximum acceptable purity score.
        """
        min_purity = conditions.get("min_purity", 0.0)
        max_purity = conditions.get("max_purity", 1.0)

        violations = []
        for module in modules:
            if module.purity_score is None:
                continue
            if module.purity_score < min_purity:
                violations.append({
                    "module": module.name,
                    "purity": module.purity_score,
                    "reason": f"below minimum {min_purity}",
                })
            elif module.purity_score > max_purity:
                violations.append({
                    "module": module.name,
                    "purity": module.purity_score,
                    "reason": f"above maximum {max_purity}",
                })

        if violations:
            return True, {"violations": violations}
        return False, {}

    @staticmethod
    def _module_count_alert(
        conditions: dict, modules: list[Module]
    ) -> tuple[bool, dict]:
        """Check if the number of modules meets a threshold.

        Conditions:
            min_modules: int, minimum expected.
            max_modules: int, maximum expected.
        """
        count = len(modules)
        min_modules = conditions.get("min_modules", 0)
        max_modules = conditions.get("max_modules", float("inf"))

        if count < min_modules:
            return True, {
                "module_count": count,
                "reason": f"below minimum {min_modules}",
            }
        if count > max_modules:
            return True, {
                "module_count": count,
                "reason": f"above maximum {max_modules}",
            }
        return False, {}

    @staticmethod
    def _new_module_alert(
        conditions: dict, modules: list[Module]
    ) -> tuple[bool, dict]:
        """Check for new modules containing specific entity types.

        Conditions:
            entity_types: list of entity types to watch for.
        """
        watch_types = set(conditions.get("entity_types", []))
        if not watch_types:
            return False, {}

        matching = []
        for module in modules:
            if module.dominant_type and module.dominant_type in watch_types:
                matching.append({
                    "module": module.name,
                    "dominant_type": module.dominant_type,
                })

        if matching:
            return True, {"matching_modules": matching}
        return False, {}

    async def _record_event(
        self, rule: AlertRule, job_id: uuid.UUID, details: dict
    ) -> None:
        """Record an alert event in the database."""
        event = AlertEvent(
            rule_id=rule.id,
            triggered_by_job_id=job_id,
            details=details,
            delivered=False,
        )
        self._db.add(event)
        await self._db.flush()
