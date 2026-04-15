"""Hash-chained immutable audit log."""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Sequence

logger = logging.getLogger(__name__)

# Genesis hash — the "previous hash" for the very first entry
_GENESIS_HASH = "0" * 64


@dataclass
class AuditEntry:
    """A single entry in the immutable audit log."""

    event_type: str
    actor_id: str
    action: str
    resource_type: str
    resource_id: str
    details: dict = field(default_factory=dict)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    previous_hash: str = ""
    entry_hash: str = ""


class ImmutableAuditLog:
    """Cryptographically hash-chained audit log.

    Each entry includes SHA-256 hash of: entry data + previous entry's hash.
    Any tampering breaks the chain and is detectable via ``verify_chain()``.
    """

    def __init__(self, algorithm: str = "sha256") -> None:
        self._algorithm = algorithm
        self._entries: list[AuditEntry] = []
        self._last_hash: str = _GENESIS_HASH

    @property
    def entries(self) -> list[AuditEntry]:
        return list(self._entries)

    @property
    def length(self) -> int:
        return len(self._entries)

    def append(self, entry: AuditEntry) -> AuditEntry:
        """Compute the hash chain and append a new entry."""
        entry.previous_hash = self._last_hash
        entry.entry_hash = self._compute_hash(entry)
        self._entries.append(entry)
        self._last_hash = entry.entry_hash
        logger.debug(
            "Audit entry appended: %s %s -> %s (hash=%s…)",
            entry.event_type,
            entry.actor_id,
            entry.resource_id,
            entry.entry_hash[:12],
        )
        return entry

    def verify_chain(self, entries: Sequence[AuditEntry] | None = None) -> tuple[bool, str]:
        """Verify the integrity of the hash chain.

        Returns ``(True, "")`` on success or ``(False, reason)`` on failure.
        """
        target = list(entries) if entries is not None else self._entries
        if not target:
            return True, ""

        prev_hash = _GENESIS_HASH
        for idx, entry in enumerate(target):
            # Check previous_hash linkage
            if entry.previous_hash != prev_hash:
                return False, (
                    f"Entry {idx}: previous_hash mismatch. "
                    f"Expected {prev_hash[:16]}…, got {entry.previous_hash[:16]}…"
                )
            # Recompute and compare
            expected = self._compute_hash(entry)
            if entry.entry_hash != expected:
                return False, (
                    f"Entry {idx}: entry_hash mismatch. "
                    f"Expected {expected[:16]}…, got {entry.entry_hash[:16]}…"
                )
            prev_hash = entry.entry_hash

        return True, ""

    def _compute_hash(self, entry: AuditEntry) -> str:
        """Compute the hash for a single audit entry."""
        payload = {
            "event_type": entry.event_type,
            "actor_id": entry.actor_id,
            "action": entry.action,
            "resource_type": entry.resource_type,
            "resource_id": entry.resource_id,
            "details": entry.details,
            "timestamp": entry.timestamp.isoformat() if isinstance(entry.timestamp, datetime) else str(entry.timestamp),
            "previous_hash": entry.previous_hash,
        }
        serialized = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
        h = hashlib.new(self._algorithm)
        h.update(serialized)
        return h.hexdigest()
