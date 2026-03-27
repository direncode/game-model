"""Immutable audit log operations.

Provides append-only audit logging, search/query capabilities,
and export functionality for compliance auditors. Audit records
are NEVER updated or deleted.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog

logger = logging.getLogger(__name__)


@dataclass
class AuditQuery:
    """Parameters for querying the audit log."""

    actor_id: uuid.UUID | None = None
    action: str | None = None
    resource_type: str | None = None
    resource_id: uuid.UUID | None = None
    result: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    page: int = 1
    page_size: int = 50


@dataclass
class AuditPage:
    """Paginated audit log results."""

    items: list[AuditLog]
    total: int
    page: int
    page_size: int
    has_next: bool


class AuditLogger:
    """Immutable, append-only audit log service.

    All operations are strictly append-only. No update or delete
    operations are provided or permitted on audit records.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def log_event(
        self,
        actor_id: uuid.UUID | None,
        action: str,
        resource_type: str | None = None,
        resource_id: uuid.UUID | None = None,
        details: dict | None = None,
        result: str = "success",
        actor_type: str | None = None,
        actor_ip: str | None = None,
        session_id: uuid.UUID | None = None,
        request_id: uuid.UUID | None = None,
    ) -> AuditLog:
        """Append an immutable audit log entry.

        Args:
            actor_id: UUID of the acting user/system (None for anonymous).
            action: Action performed (e.g., "dataset.create", "challenge.resolve").
            resource_type: Type of resource acted upon.
            resource_id: UUID of the resource.
            details: Additional context as JSON-serializable dict.
            result: Outcome ("success", "failure", "denied").
            actor_type: Type of actor ("user", "system", "api_key").
            actor_ip: IP address of the actor.
            session_id: Session identifier.
            request_id: Request identifier for correlation.

        Returns:
            Created AuditLog instance.
        """
        entry = AuditLog(
            event_id=uuid.uuid4(),
            actor_id=actor_id,
            actor_type=actor_type or ("user" if actor_id else "system"),
            actor_ip=actor_ip,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            result=result,
            session_id=session_id,
            request_id=request_id,
        )

        self._db.add(entry)
        await self._db.flush()

        logger.info(
            "Audit event: actor=%s, action=%s, resource=%s/%s, result=%s",
            actor_id,
            action,
            resource_type,
            resource_id,
            result,
        )
        return entry

    async def query_log(self, query: AuditQuery) -> AuditPage:
        """Search the audit log with filtering and pagination.

        Args:
            query: AuditQuery with filter parameters.

        Returns:
            AuditPage with matching entries and pagination info.
        """
        conditions = []

        if query.actor_id:
            conditions.append(AuditLog.actor_id == query.actor_id)
        if query.action:
            conditions.append(AuditLog.action.ilike(f"%{query.action}%"))
        if query.resource_type:
            conditions.append(AuditLog.resource_type == query.resource_type)
        if query.resource_id:
            conditions.append(AuditLog.resource_id == query.resource_id)
        if query.result:
            conditions.append(AuditLog.result == query.result)
        if query.date_from:
            conditions.append(AuditLog.timestamp >= query.date_from)
        if query.date_to:
            conditions.append(AuditLog.timestamp <= query.date_to)

        where_clause = and_(*conditions) if conditions else True

        # Count total
        count_result = await self._db.execute(
            select(func.count()).select_from(AuditLog).where(where_clause)
        )
        total = count_result.scalar() or 0

        # Fetch page
        offset = (query.page - 1) * query.page_size
        result = await self._db.execute(
            select(AuditLog)
            .where(where_clause)
            .order_by(AuditLog.timestamp.desc())
            .offset(offset)
            .limit(query.page_size)
        )
        items = list(result.scalars().all())

        has_next = (query.page * query.page_size) < total

        logger.debug(
            "Audit query: %d results (page %d/%d)",
            total,
            query.page,
            (total // query.page_size) + 1,
        )

        return AuditPage(
            items=items,
            total=total,
            page=query.page,
            page_size=query.page_size,
            has_next=has_next,
        )

    async def export_log(
        self,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        format: str = "csv",
    ) -> bytes:
        """Export audit log entries for auditors.

        Args:
            date_from: Start of date range (inclusive).
            date_to: End of date range (inclusive).
            format: Export format ("csv" or "json").

        Returns:
            Exported data as bytes.
        """
        conditions = []
        if date_from:
            conditions.append(AuditLog.timestamp >= date_from)
        if date_to:
            conditions.append(AuditLog.timestamp <= date_to)

        where_clause = and_(*conditions) if conditions else True

        result = await self._db.execute(
            select(AuditLog)
            .where(where_clause)
            .order_by(AuditLog.timestamp.asc())
        )
        entries = list(result.scalars().all())

        logger.info(
            "Exporting %d audit entries (%s format)", len(entries), format
        )

        if format == "csv":
            return self._to_csv(entries)
        if format == "json":
            return self._to_json(entries)

        raise ValueError(f"Unsupported export format: {format}")

    @staticmethod
    def _to_csv(entries: list[AuditLog]) -> bytes:
        """Render audit entries as CSV."""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id", "event_id", "timestamp", "actor_id", "actor_type",
            "actor_ip", "action", "resource_type", "resource_id",
            "result", "details", "session_id", "request_id",
        ])

        for entry in entries:
            writer.writerow([
                entry.id,
                str(entry.event_id),
                entry.timestamp.isoformat() if entry.timestamp else "",
                str(entry.actor_id) if entry.actor_id else "",
                entry.actor_type or "",
                entry.actor_ip or "",
                entry.action,
                entry.resource_type or "",
                str(entry.resource_id) if entry.resource_id else "",
                entry.result or "",
                json.dumps(entry.details) if entry.details else "",
                str(entry.session_id) if entry.session_id else "",
                str(entry.request_id) if entry.request_id else "",
            ])

        return output.getvalue().encode("utf-8")

    @staticmethod
    def _to_json(entries: list[AuditLog]) -> bytes:
        """Render audit entries as JSON."""
        data = [
            {
                "id": entry.id,
                "event_id": str(entry.event_id),
                "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
                "actor_id": str(entry.actor_id) if entry.actor_id else None,
                "actor_type": entry.actor_type,
                "actor_ip": entry.actor_ip,
                "action": entry.action,
                "resource_type": entry.resource_type,
                "resource_id": str(entry.resource_id) if entry.resource_id else None,
                "result": entry.result,
                "details": entry.details,
                "session_id": str(entry.session_id) if entry.session_id else None,
                "request_id": str(entry.request_id) if entry.request_id else None,
            }
            for entry in entries
        ]
        return json.dumps(data, indent=2).encode("utf-8")
