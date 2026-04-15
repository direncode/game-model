"""SDK exceptions."""

from __future__ import annotations


class LatentOceanError(Exception):
    """Base exception for all Latent Ocean SDK errors."""

    def __init__(self, message: str = "", status_code: int | None = None, body: dict | None = None):
        self.status_code = status_code
        self.body = body or {}
        super().__init__(message)


class AuthenticationError(LatentOceanError):
    """Raised when the API key is invalid or expired (401)."""
    pass


class RateLimitError(LatentOceanError):
    """Raised when the API rate limit is exceeded (429)."""

    def __init__(self, message: str = "Rate limit exceeded", retry_after: float | None = None, **kwargs):
        self.retry_after = retry_after
        super().__init__(message, **kwargs)


class NotFoundError(LatentOceanError):
    """Raised when the requested resource does not exist (404)."""
    pass


class ValidationError(LatentOceanError):
    """Raised when the request payload fails validation (422)."""
    pass


class ServerError(LatentOceanError):
    """Raised when the API returns a server-side error (5xx)."""
    pass
