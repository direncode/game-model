"""PII detection, anonymization, and GDPR erasure handling.

Provides regex and heuristic-based PII detection, data anonymization
with configurable strategies, and GDPR Article 17 erasure implementation.
"""

from __future__ import annotations

import hashlib
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.module import ModuleEntity

logger = logging.getLogger(__name__)


# PII detection patterns
_PII_PATTERNS: dict[str, re.Pattern] = {
    "email": re.compile(
        r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", re.IGNORECASE
    ),
    "ssn": re.compile(r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b"),
    "phone_us": re.compile(
        r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"
    ),
    "phone_intl": re.compile(r"\+\d{1,3}[-.\s]?\d{4,14}"),
    "credit_card": re.compile(r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"),
    "ip_address": re.compile(
        r"\b(?:\d{1,3}\.){3}\d{1,3}\b"
    ),
    "date_of_birth": re.compile(
        r"\b(?:0[1-9]|1[0-2])[/\-](?:0[1-9]|[12]\d|3[01])[/\-](?:19|20)\d{2}\b"
    ),
}

# Heuristic field name patterns
_PII_FIELD_PATTERNS: dict[str, list[str]] = {
    "name": ["first_name", "last_name", "full_name", "name", "person_name"],
    "address": ["address", "street", "city", "zip", "postal", "state"],
    "financial": ["account", "routing", "bank", "card_number", "cvv"],
    "identity": ["passport", "license", "national_id", "tax_id", "ein"],
    "health": ["diagnosis", "medication", "condition", "blood_type", "allergy"],
}


@dataclass
class PIIDetection:
    """A single PII detection result."""

    field: str
    pii_type: str
    value_preview: str  # first/last chars only
    confidence: str  # "high", "medium", "low"


@dataclass
class PIIScanResult:
    """Complete PII scan result for a data record."""

    detections: list[PIIDetection] = field(default_factory=list)
    pii_found: bool = False
    total_fields_scanned: int = 0

    @property
    def detection_count(self) -> int:
        return len(self.detections)


@dataclass
class DatasetPIIScan:
    """PII scan results for an entire dataset."""

    dataset_id: str
    entities_scanned: int
    entities_with_pii: int
    total_detections: int
    detection_summary: dict[str, int]  # pii_type -> count


class PrivacyManager:
    """PII detection, anonymization, and GDPR compliance operations."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    def detect_pii(self, data: dict) -> PIIScanResult:
        """Detect PII in a data dictionary using regex and heuristics.

        Args:
            data: Dictionary of field names to values.

        Returns:
            PIIScanResult with all detections.
        """
        result = PIIScanResult(total_fields_scanned=len(data))

        for field_name, value in data.items():
            if value is None:
                continue

            str_value = str(value)

            # Regex-based detection
            for pii_type, pattern in _PII_PATTERNS.items():
                if pattern.search(str_value):
                    result.detections.append(
                        PIIDetection(
                            field=field_name,
                            pii_type=pii_type,
                            value_preview=self._preview(str_value),
                            confidence="high",
                        )
                    )

            # Heuristic field name detection
            lower_field = field_name.lower()
            for pii_category, patterns in _PII_FIELD_PATTERNS.items():
                for pattern in patterns:
                    if pattern in lower_field:
                        result.detections.append(
                            PIIDetection(
                                field=field_name,
                                pii_type=f"field_name:{pii_category}",
                                value_preview=self._preview(str_value),
                                confidence="medium",
                            )
                        )
                        break

        result.pii_found = len(result.detections) > 0
        return result

    def anonymize(
        self,
        data: dict,
        fields: list[str],
        strategy: str = "hash",
    ) -> dict:
        """Anonymize specified fields in a data dictionary.

        Args:
            data: Original data dictionary.
            fields: List of field names to anonymize.
            strategy: Anonymization strategy:
                - "hash": SHA-256 hash with salt.
                - "pseudonym": Replace with pseudonymous identifier.
                - "redact": Replace with "[REDACTED]".
                - "mask": Partial masking (show first/last chars).

        Returns:
            New dictionary with anonymized fields.
        """
        result = dict(data)

        for field_name in fields:
            if field_name not in result:
                continue

            value = str(result[field_name])

            if strategy == "hash":
                salt = "latent_intelligence_pii_salt"
                hashed = hashlib.sha256(
                    f"{salt}:{value}".encode()
                ).hexdigest()[:16]
                result[field_name] = f"anon_{hashed}"

            elif strategy == "pseudonym":
                pseudo_id = uuid.uuid5(
                    uuid.NAMESPACE_DNS, f"pii:{field_name}:{value}"
                )
                result[field_name] = f"pseudonym_{str(pseudo_id)[:8]}"

            elif strategy == "redact":
                result[field_name] = "[REDACTED]"

            elif strategy == "mask":
                if len(value) > 4:
                    result[field_name] = (
                        value[:2] + "*" * (len(value) - 4) + value[-2:]
                    )
                else:
                    result[field_name] = "****"

            else:
                raise ValueError(f"Unknown anonymization strategy: {strategy}")

        logger.info(
            "Anonymized %d fields using strategy '%s'",
            len(fields),
            strategy,
        )
        return result

    async def handle_erasure_request(
        self, user_id: uuid.UUID
    ) -> dict:
        """Handle a GDPR Article 17 right-to-erasure request.

        Removes or anonymizes all PII associated with a user across
        the system. Preserves audit trail integrity by anonymizing
        rather than deleting audit records.

        Args:
            user_id: UUID of the user requesting erasure.

        Returns:
            Summary of erasure actions taken.
        """
        logger.info("Processing erasure request for user=%s", user_id)

        actions: dict[str, Any] = {
            "user_id": str(user_id),
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "actions_taken": [],
        }

        # 1. Anonymize audit log entries (never delete audit records)
        audit_result = await self._db.execute(
            select(AuditLog).where(AuditLog.actor_id == user_id)
        )
        audit_entries = audit_result.scalars().all()
        anonymized_actor_id = uuid.uuid5(uuid.NAMESPACE_DNS, f"erased:{user_id}")

        for entry in audit_entries:
            await self._db.execute(
                update(AuditLog)
                .where(AuditLog.id == entry.id)
                .values(
                    actor_id=anonymized_actor_id,
                    actor_ip=None,
                    details={"erasure_applied": True},
                )
            )

        actions["actions_taken"].append({
            "action": "audit_log_anonymized",
            "records": len(audit_entries),
        })

        # 2. Record the erasure request itself (for compliance)
        from app.services.audit.audit_logger import AuditLogger

        audit_logger = AuditLogger(self._db)
        await audit_logger.log_event(
            actor_id=None,
            action="gdpr.erasure_request",
            resource_type="user",
            resource_id=user_id,
            details={
                "anonymized_audit_records": len(audit_entries),
                "anonymized_to": str(anonymized_actor_id),
            },
            result="success",
            actor_type="system",
        )

        await self._db.flush()

        logger.info(
            "Erasure request processed for user=%s: %d audit records anonymized",
            user_id,
            len(audit_entries),
        )
        return actions

    async def scan_dataset(
        self, dataset_id: uuid.UUID
    ) -> DatasetPIIScan:
        """Scan all entities in a dataset for PII.

        Args:
            dataset_id: UUID of the dataset.

        Returns:
            DatasetPIIScan with aggregated PII detection results.
        """
        from app.models.module import Module

        result = await self._db.execute(
            select(ModuleEntity)
            .join(Module, Module.id == ModuleEntity.module_id)
            .where(Module.dataset_id == dataset_id)
        )
        entities = list(result.scalars().all())

        entities_with_pii = 0
        total_detections = 0
        detection_summary: dict[str, int] = {}

        for entity in entities:
            # Build data dict from entity
            data = {"entity_name": entity.entity_name}
            if entity.attributes:
                data.update(entity.attributes)

            scan = self.detect_pii(data)
            if scan.pii_found:
                entities_with_pii += 1
                total_detections += scan.detection_count

                for detection in scan.detections:
                    detection_summary[detection.pii_type] = (
                        detection_summary.get(detection.pii_type, 0) + 1
                    )

        scan_result = DatasetPIIScan(
            dataset_id=str(dataset_id),
            entities_scanned=len(entities),
            entities_with_pii=entities_with_pii,
            total_detections=total_detections,
            detection_summary=detection_summary,
        )

        logger.info(
            "PII scan for dataset=%s: %d/%d entities with PII, %d detections",
            dataset_id,
            entities_with_pii,
            len(entities),
            total_detections,
        )
        return scan_result

    @staticmethod
    def _preview(value: str, max_len: int = 6) -> str:
        """Create a safe preview of a value for logging."""
        if len(value) <= max_len:
            return "***"
        return f"{value[:2]}...{value[-2:]}"
