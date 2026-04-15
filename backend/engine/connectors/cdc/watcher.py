"""Change Data Capture base class."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable


@dataclass
class ChangeEvent:
    """Represents a single row-level change detected by CDC."""

    table: str
    operation: str  # INSERT, UPDATE, DELETE
    row_data: dict[str, Any]
    old_data: dict[str, Any] | None = None
    timestamp: datetime = field(default_factory=datetime.utcnow)

    @property
    def is_insert(self) -> bool:
        return self.operation == "INSERT"

    @property
    def is_update(self) -> bool:
        return self.operation == "UPDATE"

    @property
    def is_delete(self) -> bool:
        return self.operation == "DELETE"

    def changed_columns(self) -> list[str]:
        """Return columns that changed between old_data and row_data."""
        if not self.old_data:
            return list(self.row_data.keys())
        return [
            k for k in self.row_data
            if self.row_data.get(k) != self.old_data.get(k)
        ]


class CDCWatcher(ABC):
    """Abstract base for Change Data Capture watchers.

    Implementations detect row-level changes (INSERT, UPDATE, DELETE)
    in a database and invoke a callback for each change event.
    """

    @abstractmethod
    def start(self, callback: Callable[[ChangeEvent], None]) -> None:
        """Begin watching for changes.

        Parameters
        ----------
        callback:
            Invoked with a :class:`ChangeEvent` for each detected change.
        """
        ...

    @abstractmethod
    def stop(self) -> None:
        """Stop watching. Safe to call if not currently running."""
        ...

    @abstractmethod
    def is_running(self) -> bool:
        """Return ``True`` if the watcher is actively polling / listening."""
        ...
