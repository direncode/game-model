"""SIEM export — export audit logs to Splunk, Datadog, Elastic, etc.

Supports Common Event Format (CEF), JSON Lines, and RFC 5424 syslog.
"""

from __future__ import annotations

import json
import logging
import socket
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


# ── Event model ──────────────────────────────────────────────────────


@dataclass
class SIEMEvent:
    """A single audit event for SIEM export."""

    timestamp: datetime
    event_type: str
    actor_id: str
    actor_type: str  # "user", "system", "api_key"
    action: str
    resource_type: str
    resource_id: str
    result: str  # "success", "failure", "denied"
    details: dict = field(default_factory=dict)
    ip_address: str = ""
    session_id: str = ""

    def severity(self) -> int:
        """Map result to CEF severity (0-10)."""
        return {
            "success": 3,
            "failure": 6,
            "denied": 8,
        }.get(self.result, 5)

    def to_dict(self) -> dict:
        """Serialize to a plain dict for JSON export."""
        return {
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type,
            "actor_id": self.actor_id,
            "actor_type": self.actor_type,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "result": self.result,
            "details": self.details,
            "ip_address": self.ip_address,
            "session_id": self.session_id,
        }


# ── Abstract exporter ────────────────────────────────────────────────


class SIEMExporter(ABC):
    """Base class for SIEM exporters."""

    @abstractmethod
    def format_event(self, event: SIEMEvent) -> str:
        """Format a single event as a string."""
        ...

    @abstractmethod
    async def send(self, events: list[SIEMEvent]) -> None:
        """Send a batch of events to the SIEM destination."""
        ...


# ── CEF exporter (Splunk / ArcSight) ────────────────────────────────


class CEFExporter(SIEMExporter):
    """Common Event Format exporter for Splunk, ArcSight, and similar.

    CEF format::

        CEF:0|Latent Ocean|Platform|1.0|event_type|action|severity|extensions
    """

    def __init__(
        self,
        endpoint_url: str = "",
        auth_token: str = "",
    ) -> None:
        self._endpoint_url = endpoint_url
        self._auth_token = auth_token

    def format_event(self, event: SIEMEvent) -> str:
        """Format as CEF string."""
        # Escape pipes and backslashes in CEF header fields
        def _esc(val: str) -> str:
            return val.replace("\\", "\\\\").replace("|", "\\|")

        severity = event.severity()
        extensions = (
            f"src={event.ip_address} "
            f"suser={_esc(event.actor_id)} "
            f"suid={_esc(event.actor_id)} "
            f"act={_esc(event.action)} "
            f"outcome={_esc(event.result)} "
            f"cs1={_esc(event.resource_type)} cs1Label=resourceType "
            f"cs2={_esc(event.resource_id)} cs2Label=resourceId "
            f"cs3={_esc(event.actor_type)} cs3Label=actorType "
            f"cs4={_esc(event.session_id)} cs4Label=sessionId "
            f"rt={int(event.timestamp.timestamp() * 1000)}"
        )

        return (
            f"CEF:0|Latent Ocean|Platform|1.0"
            f"|{_esc(event.event_type)}"
            f"|{_esc(event.action)}"
            f"|{severity}"
            f"|{extensions}"
        )

    async def send(self, events: list[SIEMEvent]) -> None:
        """Send events to the configured HTTP endpoint."""
        if not self._endpoint_url:
            logger.warning("CEF exporter: no endpoint URL configured, logging locally")
            for event in events:
                logger.info("CEF: %s", self.format_event(event))
            return

        payload = "\n".join(self.format_event(e) for e in events)
        headers: dict[str, str] = {"Content-Type": "text/plain"}
        if self._auth_token:
            headers["Authorization"] = f"Splunk {self._auth_token}"

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.post(
                    self._endpoint_url,
                    content=payload,
                    headers=headers,
                )
                if resp.status_code >= 400:
                    logger.error("CEF send failed: %d %s", resp.status_code, resp.text[:200])
                else:
                    logger.info("CEF: sent %d events to %s", len(events), self._endpoint_url)
            except httpx.HTTPError as exc:
                logger.error("CEF send error: %s", exc)


# ── JSON Lines exporter (Elastic / Datadog) ──────────────────────────


class JSONLinesExporter(SIEMExporter):
    """JSON Lines exporter for Elasticsearch, Datadog, and similar.

    Each event is a single JSON object on its own line.
    """

    def __init__(
        self,
        endpoint_url: str = "",
        api_key: str = "",
        index_name: str = "latent-ocean-audit",
    ) -> None:
        self._endpoint_url = endpoint_url
        self._api_key = api_key
        self._index_name = index_name

    def format_event(self, event: SIEMEvent) -> str:
        """Format as a JSON line."""
        record = event.to_dict()
        record["@timestamp"] = record.pop("timestamp")
        record["_index"] = self._index_name
        record["source"] = "latent-ocean"
        return json.dumps(record, separators=(",", ":"), default=str)

    async def send(self, events: list[SIEMEvent]) -> None:
        """Send events to the configured HTTP endpoint."""
        if not self._endpoint_url:
            logger.warning("JSONLines exporter: no endpoint URL, logging locally")
            for event in events:
                logger.info("JSONL: %s", self.format_event(event))
            return

        payload = "\n".join(self.format_event(e) for e in events) + "\n"
        headers: dict[str, str] = {"Content-Type": "application/x-ndjson"}
        if self._api_key:
            headers["DD-API-KEY"] = self._api_key
            headers["Authorization"] = f"ApiKey {self._api_key}"

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.post(
                    self._endpoint_url,
                    content=payload,
                    headers=headers,
                )
                if resp.status_code >= 400:
                    logger.error("JSONL send failed: %d %s", resp.status_code, resp.text[:200])
                else:
                    logger.info("JSONL: sent %d events to %s", len(events), self._endpoint_url)
            except httpx.HTTPError as exc:
                logger.error("JSONL send error: %s", exc)


# ── Syslog exporter (RFC 5424) ───────────────────────────────────────


class SyslogExporter(SIEMExporter):
    """RFC 5424 syslog exporter via UDP or TCP.

    Sends structured syslog messages to a remote syslog collector.
    """

    # RFC 5424 severity mapping
    _SEVERITY_MAP = {
        "success": 6,   # Informational
        "failure": 3,   # Error
        "denied": 4,    # Warning
    }

    def __init__(
        self,
        host: str = "localhost",
        port: int = 514,
        protocol: str = "udp",  # "udp" or "tcp"
        facility: int = 16,  # local0
        app_name: str = "latent-ocean",
    ) -> None:
        self._host = host
        self._port = port
        self._protocol = protocol
        self._facility = facility
        self._app_name = app_name

    def format_event(self, event: SIEMEvent) -> str:
        """Format as RFC 5424 syslog message."""
        severity = self._SEVERITY_MAP.get(event.result, 6)
        priority = self._facility * 8 + severity

        timestamp = event.timestamp.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        hostname = socket.gethostname()
        proc_id = "-"
        msg_id = event.event_type

        # Structured data (SD-ELEMENT)
        sd = (
            f'[latent-ocean@0 '
            f'actor="{event.actor_id}" '
            f'actorType="{event.actor_type}" '
            f'action="{event.action}" '
            f'resourceType="{event.resource_type}" '
            f'resourceId="{event.resource_id}" '
            f'result="{event.result}" '
            f'ip="{event.ip_address}" '
            f'sessionId="{event.session_id}"]'
        )

        # Human-readable message
        msg = f"{event.actor_type}:{event.actor_id} {event.action} {event.resource_type}/{event.resource_id} -> {event.result}"

        return f"<{priority}>1 {timestamp} {hostname} {self._app_name} {proc_id} {msg_id} {sd} {msg}"

    async def send(self, events: list[SIEMEvent]) -> None:
        """Send events to syslog collector."""
        if self._protocol == "udp":
            await self._send_udp(events)
        elif self._protocol == "tcp":
            await self._send_tcp(events)
        else:
            logger.error("Unknown syslog protocol: %s", self._protocol)

    async def _send_udp(self, events: list[SIEMEvent]) -> None:
        """Send via UDP."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            for event in events:
                message = self.format_event(event)
                sock.sendto(message.encode("utf-8"), (self._host, self._port))
            logger.info("Syslog UDP: sent %d events to %s:%d", len(events), self._host, self._port)
        except OSError as exc:
            logger.error("Syslog UDP send error: %s", exc)
        finally:
            sock.close()

    async def _send_tcp(self, events: list[SIEMEvent]) -> None:
        """Send via TCP with newline framing."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.settimeout(10)
            sock.connect((self._host, self._port))
            for event in events:
                message = self.format_event(event) + "\n"
                sock.sendall(message.encode("utf-8"))
            logger.info("Syslog TCP: sent %d events to %s:%d", len(events), self._host, self._port)
        except OSError as exc:
            logger.error("Syslog TCP send error: %s", exc)
        finally:
            sock.close()


# ── SIEM manager ─────────────────────────────────────────────────────


class SIEMManager:
    """Manages SIEM export configuration and delivery.

    Supports multiple exporters running in parallel so the same events
    can be sent to Splunk AND Elasticsearch simultaneously.
    """

    def __init__(self) -> None:
        self._exporters: list[SIEMExporter] = []

    def add_exporter(self, exporter: SIEMExporter) -> None:
        """Register an exporter."""
        self._exporters.append(exporter)
        logger.info("SIEM exporter added: %s", type(exporter).__name__)

    def remove_exporter(self, exporter: SIEMExporter) -> None:
        """Remove a registered exporter."""
        self._exporters.remove(exporter)

    @property
    def exporter_count(self) -> int:
        return len(self._exporters)

    async def export_events(self, events: list[SIEMEvent]) -> None:
        """Send events to all registered exporters.

        Errors in individual exporters are logged but do not prevent
        other exporters from receiving the events.
        """
        if not self._exporters:
            logger.debug("No SIEM exporters registered — skipping %d events", len(events))
            return

        if not events:
            return

        for exporter in self._exporters:
            try:
                await exporter.send(events)
            except Exception as exc:
                logger.error(
                    "SIEM export failed (%s): %s",
                    type(exporter).__name__,
                    exc,
                )

    async def export_audit_log(
        self,
        start: datetime,
        end: datetime,
        db_session=None,
    ) -> int:
        """Export audit log entries from the database for a time range.

        Reads from the audit log table, converts to SIEMEvents, and
        sends through all registered exporters.

        Args:
            start: Start of the time range (inclusive).
            end: End of the time range (exclusive).
            db_session: Optional SQLAlchemy AsyncSession.

        Returns:
            Number of events exported.
        """
        if db_session is None:
            logger.warning("No database session provided — cannot query audit log")
            return 0

        from sqlalchemy import select, and_
        from app.models.audit import AuditLog

        result = await db_session.execute(
            select(AuditLog)
            .where(
                and_(
                    AuditLog.timestamp >= start,
                    AuditLog.timestamp < end,
                )
            )
            .order_by(AuditLog.timestamp.asc())
        )
        entries = list(result.scalars().all())

        if not entries:
            logger.info("No audit entries in range %s to %s", start, end)
            return 0

        events: list[SIEMEvent] = []
        for entry in entries:
            events.append(
                SIEMEvent(
                    timestamp=entry.timestamp or datetime.now(timezone.utc),
                    event_type=entry.action or "unknown",
                    actor_id=str(entry.actor_id) if entry.actor_id else "",
                    actor_type=entry.actor_type or "user",
                    action=entry.action or "",
                    resource_type=entry.resource_type or "",
                    resource_id=str(entry.resource_id) if entry.resource_id else "",
                    result=entry.result or "success",
                    details=entry.details or {},
                    ip_address=entry.actor_ip or "",
                    session_id=str(entry.session_id) if entry.session_id else "",
                )
            )

        await self.export_events(events)
        logger.info("Exported %d audit events for range %s to %s", len(events), start, end)
        return len(events)
