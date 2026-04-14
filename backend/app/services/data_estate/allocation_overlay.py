"""Optional transparent allocation ledger overlay."""
from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_estate import EstateLedgerEntry


class AllocationOverlay:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_entry(
        self, org_id: uuid.UUID, amount: float, label: str,
        category_tag: str, effective_date: date, created_by: uuid.UUID,
        metadata: dict | None = None,
    ) -> EstateLedgerEntry:
        stmt = select(func.max(EstateLedgerEntry.version)).where(
            EstateLedgerEntry.org_id == org_id,
            EstateLedgerEntry.category_tag == category_tag,
        )
        result = await self.db.execute(stmt)
        max_version = result.scalar() or 0

        entry = EstateLedgerEntry(
            org_id=org_id, amount=amount, label=label,
            category_tag=category_tag, version=max_version + 1,
            effective_date=effective_date, created_by=created_by,
            metadata_=metadata,
        )
        self.db.add(entry)
        await self.db.flush()
        return entry

    async def list_entries(
        self, org_id: uuid.UUID, category_tag: str | None = None,
        limit: int = 100, offset: int = 0,
    ) -> list[EstateLedgerEntry]:
        stmt = (
            select(EstateLedgerEntry)
            .where(EstateLedgerEntry.org_id == org_id)
            .order_by(EstateLedgerEntry.created_at.desc())
            .limit(limit).offset(offset)
        )
        if category_tag:
            stmt = stmt.where(EstateLedgerEntry.category_tag == category_tag)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_summary(self, org_id: uuid.UUID) -> dict[str, Any]:
        stmt = (
            select(
                EstateLedgerEntry.category_tag,
                func.sum(EstateLedgerEntry.amount).label("total"),
                func.count(EstateLedgerEntry.id).label("count"),
            )
            .where(EstateLedgerEntry.org_id == org_id)
            .group_by(EstateLedgerEntry.category_tag)
        )
        result = await self.db.execute(stmt)
        rows = result.all()

        category_totals = {}
        grand_total = 0.0
        entry_count = 0
        for row in rows:
            category_totals[row.category_tag] = float(row.total)
            grand_total += float(row.total)
            entry_count += int(row.count)

        return {"total_allocated": grand_total, "category_totals": category_totals, "entry_count": entry_count}
