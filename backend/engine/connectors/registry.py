"""Connector registry — register and retrieve connector factories by name.

Usage:
    from engine.connectors.registry import register_connector, get_connector

    register_connector("postgres", PostgresConnector)
    conn = get_connector("postgres", config)
"""
from __future__ import annotations

from typing import Any, Callable

from .base import BaseConnector, ConnectorConfig

# Global registry: name -> factory callable
_CONNECTORS: dict[str, Callable[..., BaseConnector]] = {}


def register_connector(
    name: str,
    factory: Callable[..., BaseConnector],
) -> None:
    """Register a connector factory under a given name.

    Args:
        name: Short identifier (e.g. ``"postgres"``, ``"csv"``).
        factory: A callable that accepts a ``ConnectorConfig`` and returns
            a ``BaseConnector`` instance. Typically a class itself.

    Raises:
        ValueError: If ``name`` is already registered.
    """
    if name in _CONNECTORS:
        raise ValueError(
            f"Connector '{name}' is already registered. "
            f"Use a different name or unregister first."
        )
    _CONNECTORS[name] = factory


def get_connector(
    name: str,
    config: ConnectorConfig | None = None,
    **kwargs: Any,
) -> BaseConnector:
    """Instantiate a registered connector by name.

    Args:
        name: The registered connector name.
        config: Optional ``ConnectorConfig`` passed to the factory.
            If not provided, a minimal config is created from ``name``.
        **kwargs: Extra keyword arguments forwarded to the factory.

    Returns:
        A ``BaseConnector`` instance.

    Raises:
        KeyError: If ``name`` is not registered.
    """
    if name not in _CONNECTORS:
        available = ", ".join(sorted(_CONNECTORS)) or "(none)"
        raise KeyError(
            f"Unknown connector '{name}'. Available: {available}"
        )
    if config is None:
        config = ConnectorConfig(name=name, driver=name)
    return _CONNECTORS[name](config, **kwargs)


def list_connectors() -> list[str]:
    """Return sorted list of registered connector names."""
    return sorted(_CONNECTORS.keys())


def unregister_connector(name: str) -> None:
    """Remove a connector from the registry.

    Args:
        name: The connector name to remove.

    Raises:
        KeyError: If ``name`` is not registered.
    """
    if name not in _CONNECTORS:
        raise KeyError(f"Connector '{name}' is not registered.")
    del _CONNECTORS[name]
