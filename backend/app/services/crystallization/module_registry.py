"""CRUD service for the persistent ModuleRegistryEntry table.

Pure persistence — no routing, no scoring, no ML. The vertical orchestrator
composes this with other services.
"""
from __future__ import annotations

import hashlib
import json
import logging
import uuid
from typing import Any

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.module_registry import ModuleRegistryEntry
from .vertical_types import CrystallizedModule, VerticalPreset

logger = logging.getLogger(__name__)


def hash_module(module: CrystallizedModule) -> str:
    """Stable content hash for dedup. Changes if centroid or members change."""
    payload = {
        "vertical": module.vertical.value,
        "module_type": module.module_type,
        "centroid": [round(float(x), 6) for x in module.centroid.tolist()],
        "members": sorted(module.members),
    }
    blob = json.dumps(payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


class ModuleRegistryService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def register_many(
        self, modules: list[CrystallizedModule]
    ) -> list[ModuleRegistryEntry]:
        """Insert or update modules, dedup on (provenance_job_id, module_hash).

        On collision: updates quality_score, purity, and metadata_ from the
        newer module (so re-runs with improved scoring actually land).
        Intra-batch dedup uses an explicit ``seen`` set — not autoflush.
        """
        upserted: list[ModuleRegistryEntry] = []
        created: list[ModuleRegistryEntry] = []
        seen: set[str] = set()
        for m in modules:
            mh = hash_module(m)
            dedup_key = f"{m.provenance_job_id}:{mh}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            result = await self._session.execute(
                select(ModuleRegistryEntry).where(
                    ModuleRegistryEntry.provenance_job_id == m.provenance_job_id,
                    ModuleRegistryEntry.module_hash == mh,
                )
            )
            existing = result.scalar_one_or_none()
            if existing is not None:
                # Update mutable fields so re-runs don't silently discard
                # better scoring.
                existing.quality_score = float(m.quality_score)
                existing.purity = float(m.purity)
                upserted.append(existing)
                continue
            entry = ModuleRegistryEntry(
                id=uuid.uuid4(),
                vertical=m.vertical.value,
                module_type=m.module_type,
                module_hash=mh,
                centroid=[float(x) for x in m.centroid.tolist()],
                members=list(m.members),
                purity=float(m.purity),
                quality_score=float(m.quality_score),
                provenance_job_id=m.provenance_job_id,
                metadata_=None,
                description=None,
            )
            self._session.add(entry)
            upserted.append(entry)
            created.append(entry)
        await self._session.flush()

        # Auto-mint QR identities for newly registered modules
        try:
            from app.services.qr_identity.identity_service import QRIdentityService
            qr_svc = QRIdentityService(self._session)
            for entry in created:
                await qr_svc.mint(
                    subject_type="module",
                    subject_id=entry.id,
                    tier="org",
                    minted_by="system:crystallization",
                    metadata={"vertical": entry.vertical, "module_type": entry.module_type},
                )
        except Exception:
            logger.warning("QR auto-mint failed for batch, continuing", exc_info=True)

        return upserted

    async def list(
        self,
        *,
        vertical: VerticalPreset | None = None,
        min_purity: float | None = None,
        min_quality: float | None = None,
        limit: int = 200,
    ) -> list[ModuleRegistryEntry]:
        stmt = select(ModuleRegistryEntry)
        if vertical is not None:
            stmt = stmt.where(ModuleRegistryEntry.vertical == vertical.value)
        if min_purity is not None:
            stmt = stmt.where(ModuleRegistryEntry.purity >= min_purity)
        if min_quality is not None:
            stmt = stmt.where(ModuleRegistryEntry.quality_score >= min_quality)
        stmt = stmt.order_by(ModuleRegistryEntry.quality_score.desc()).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get(self, entry_id: uuid.UUID | str) -> ModuleRegistryEntry | None:
        if isinstance(entry_id, str):
            entry_id = uuid.UUID(entry_id)
        return await self._session.get(ModuleRegistryEntry, entry_id)
