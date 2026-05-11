"""Free-tier reducers.

The only free-tier reducer is a no-op (see runner). Premium reducers
(e.g. reduce.btut) live only on the hosted runtime; ocean_cli registers
a stub instance under that name at import time.
"""
from __future__ import annotations

from typing import Any


_REGISTRY: dict[str, Any] = {}


def get(name: str):
    return _REGISTRY.get(name)
