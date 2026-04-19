"""Latent Ocean Python SDK.

Public surface
--------------
- ``Client``       — HTTP client for SaaS / dedicated-tenant deployments.
- ``AsyncClient``  — async variant of Client.
- ``LocalClient``  — offline / air-gap client backed by a cached BTUT run.
- ``TickerScore``, ``Finding``, ``Alert``, ``Watchlist``, ``ValidationSummary``
  — dataclasses returned from the commercial surface.
"""

__version__ = "0.2.0"

from .client import AsyncClient, Client
from .local_client import LocalClient
from .models import Alert, Finding, TickerScore, ValidationSummary, Watchlist

__all__ = [
    "__version__",
    "Client",
    "AsyncClient",
    "LocalClient",
    "TickerScore",
    "Finding",
    "Alert",
    "Watchlist",
    "ValidationSummary",
]
