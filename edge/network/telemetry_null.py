"""Null telemetry sink — replaces any analytics in Edge deployments.

Drop-in replacement for any telemetry/analytics client.  All methods
accept arbitrary arguments and silently discard them, ensuring that
no usage data ever leaves the deployment boundary.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class NullTelemetry:
    """Drop-in replacement for any telemetry/analytics client.

    Every method is a no-op.  This class can replace Segment, Mixpanel,
    PostHog, or any similar analytics SDK in air-gapped deployments.

    Usage::

        from edge.network.telemetry_null import NullTelemetry

        analytics = NullTelemetry()
        analytics.track("event_name", {"key": "value"})  # silently dropped
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        logger.debug("NullTelemetry initialized — all telemetry will be suppressed")

    def track(self, *args: Any, **kwargs: Any) -> None:
        """No-op: would normally track an event."""
        pass

    def identify(self, *args: Any, **kwargs: Any) -> None:
        """No-op: would normally identify a user."""
        pass

    def page(self, *args: Any, **kwargs: Any) -> None:
        """No-op: would normally track a page view."""
        pass

    def group(self, *args: Any, **kwargs: Any) -> None:
        """No-op: would normally associate a user with a group."""
        pass

    def alias(self, *args: Any, **kwargs: Any) -> None:
        """No-op: would normally create a user alias."""
        pass

    def screen(self, *args: Any, **kwargs: Any) -> None:
        """No-op: would normally track a screen view."""
        pass

    def flush(self) -> None:
        """No-op: would normally flush queued events."""
        pass

    def shutdown(self) -> None:
        """No-op: would normally shut down the analytics client."""
        pass

    def reset(self) -> None:
        """No-op: would normally reset the analytics state."""
        pass

    def __getattr__(self, name: str) -> Any:
        """Catch-all: any unrecognized method call is a no-op."""
        def noop(*args: Any, **kwargs: Any) -> None:
            pass
        return noop
