"""Structured expert annotation for modules and entities.

Supports tagging, labeling, confidence scoring, and tracking
annotation history across multiple experts.
"""

from __future__ import annotations

import logging
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.module import Module, ModuleEntity

logger = logging.getLogger(__name__)


@dataclass
class Annotation:
    """A structured expert annotation."""

    id: str
    target_type: str  # "module" or "entity"
    target_id: str
    annotator_id: str
    annotation_type: str  # "tag", "label", "confidence", "note"
    value: Any
    created_at: str


@dataclass
class AgreementReport:
    """Inter-annotator agreement metrics."""

    target_id: str
    annotator_count: int
    agreement_score: float  # 0-1
    majority_value: Any
    value_distribution: dict[str, int]


class ExpertAnnotation:
    """Manage structured expert annotations on modules and entities.

    Annotations are stored in the module/entity JSONB metadata fields
    as an append-only annotations array.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def add_module_annotation(
        self,
        module_id: uuid.UUID,
        annotator_id: uuid.UUID,
        annotation_type: str,
        value: Any,
        note: str | None = None,
    ) -> Annotation:
        """Add an annotation to a module.

        Args:
            module_id: UUID of the target module.
            annotator_id: UUID of the annotating user.
            annotation_type: Type of annotation (tag, label, confidence, note).
            value: Annotation value (string, number, etc.).
            note: Optional free-text note.

        Returns:
            Created Annotation record.
        """
        result = await self._db.execute(
            select(Module).where(Module.id == module_id)
        )
        module = result.scalar_one_or_none()
        if module is None:
            raise ValueError(f"Module {module_id} not found")

        annotation_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        entry = {
            "id": annotation_id,
            "annotator_id": str(annotator_id),
            "type": annotation_type,
            "value": value,
            "note": note,
            "created_at": now,
        }

        # Append to metadata annotations array
        current_meta = module.metadata_ or {}
        annotations = current_meta.get("annotations", [])
        annotations.append(entry)
        current_meta["annotations"] = annotations

        await self._db.execute(
            update(Module)
            .where(Module.id == module_id)
            .values(metadata_=current_meta)
        )
        await self._db.flush()

        logger.info(
            "Module annotation added: module=%s, type=%s, by=%s",
            module_id,
            annotation_type,
            annotator_id,
        )

        return Annotation(
            id=annotation_id,
            target_type="module",
            target_id=str(module_id),
            annotator_id=str(annotator_id),
            annotation_type=annotation_type,
            value=value,
            created_at=now,
        )

    async def add_entity_annotation(
        self,
        entity_id: uuid.UUID,
        annotator_id: uuid.UUID,
        annotation_type: str,
        value: Any,
        note: str | None = None,
    ) -> Annotation:
        """Add an annotation to a module entity.

        Args:
            entity_id: UUID of the target module entity.
            annotator_id: UUID of the annotating user.
            annotation_type: Type (label_correction, importance, tag, note).
            value: Annotation value.
            note: Optional free-text note.

        Returns:
            Created Annotation record.
        """
        result = await self._db.execute(
            select(ModuleEntity).where(ModuleEntity.id == entity_id)
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            raise ValueError(f"Entity {entity_id} not found")

        annotation_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        entry = {
            "id": annotation_id,
            "annotator_id": str(annotator_id),
            "type": annotation_type,
            "value": value,
            "note": note,
            "created_at": now,
        }

        current_attrs = entity.attributes or {}
        annotations = current_attrs.get("annotations", [])
        annotations.append(entry)
        current_attrs["annotations"] = annotations

        await self._db.execute(
            update(ModuleEntity)
            .where(ModuleEntity.id == entity_id)
            .values(attributes=current_attrs)
        )
        await self._db.flush()

        logger.info(
            "Entity annotation added: entity=%s, type=%s, by=%s",
            entity_id,
            annotation_type,
            annotator_id,
        )

        return Annotation(
            id=annotation_id,
            target_type="entity",
            target_id=str(entity_id),
            annotator_id=str(annotator_id),
            annotation_type=annotation_type,
            value=value,
            created_at=now,
        )

    async def get_annotations(
        self,
        target_type: str,
        target_id: uuid.UUID,
    ) -> list[dict]:
        """Get all annotations for a target.

        Args:
            target_type: "module" or "entity".
            target_id: UUID of the target.

        Returns:
            List of annotation dicts.
        """
        if target_type == "module":
            result = await self._db.execute(
                select(Module.metadata_).where(Module.id == target_id)
            )
            meta = result.scalar_one_or_none()
            return (meta or {}).get("annotations", [])

        if target_type == "entity":
            result = await self._db.execute(
                select(ModuleEntity.attributes).where(
                    ModuleEntity.id == target_id
                )
            )
            attrs = result.scalar_one_or_none()
            return (attrs or {}).get("annotations", [])

        raise ValueError(f"Unknown target type: {target_type}")

    async def compute_agreement(
        self,
        target_type: str,
        target_id: uuid.UUID,
        annotation_type: str,
    ) -> AgreementReport:
        """Compute inter-annotator agreement for a specific annotation type.

        Args:
            target_type: "module" or "entity".
            target_id: UUID of the target.
            annotation_type: Type of annotation to evaluate.

        Returns:
            AgreementReport with agreement score and distribution.
        """
        annotations = await self.get_annotations(target_type, target_id)
        filtered = [
            a for a in annotations if a.get("type") == annotation_type
        ]

        if not filtered:
            return AgreementReport(
                target_id=str(target_id),
                annotator_count=0,
                agreement_score=0.0,
                majority_value=None,
                value_distribution={},
            )

        # Count unique annotators
        annotators = {a["annotator_id"] for a in filtered}
        annotator_count = len(annotators)

        # Count value occurrences
        value_counts: Counter[str] = Counter()
        for a in filtered:
            value_counts[str(a["value"])] += 1

        # Agreement = majority fraction
        majority_value, majority_count = value_counts.most_common(1)[0]
        agreement = majority_count / len(filtered) if filtered else 0.0

        report = AgreementReport(
            target_id=str(target_id),
            annotator_count=annotator_count,
            agreement_score=round(agreement, 4),
            majority_value=majority_value,
            value_distribution=dict(value_counts),
        )

        logger.debug(
            "Agreement for %s/%s (%s): score=%.2f, annotators=%d",
            target_type,
            target_id,
            annotation_type,
            agreement,
            annotator_count,
        )
        return report
