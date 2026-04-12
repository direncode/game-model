"""In-memory registry of active match runtimes.

v0 keeps matches in-process. The router grabs the shared registry via
`get_registry()` so multiple WS connections on the same `match_id` hit the
same `MatchRuntime`. Persistence will land as a follow-up (see design §11).
"""

from __future__ import annotations

import threading
from typing import Optional

# Forward type reference — runtime.py imports from here, so we keep the
# annotation stringy and defer imports at call sites.


class ActiveMatchRegistry:
    def __init__(self) -> None:
        self._matches: dict[str, "object"] = {}
        self._lock = threading.Lock()

    def put(self, match_id: str, runtime) -> None:
        with self._lock:
            self._matches[match_id] = runtime

    def get(self, match_id: str):
        with self._lock:
            return self._matches.get(match_id)

    def drop(self, match_id: str) -> None:
        with self._lock:
            self._matches.pop(match_id, None)

    def all_ids(self) -> list[str]:
        with self._lock:
            return list(self._matches.keys())


_SINGLETON: Optional[ActiveMatchRegistry] = None


def get_registry() -> ActiveMatchRegistry:
    global _SINGLETON
    if _SINGLETON is None:
        _SINGLETON = ActiveMatchRegistry()
    return _SINGLETON
