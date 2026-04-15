"""API key authentication."""

from __future__ import annotations


class APIKeyAuth:
    """Manages API key authentication for Latent Ocean requests.

    API keys must follow the format ``lo_sk_<random>``.
    """

    PREFIX = "lo_sk_"

    def __init__(self, api_key: str) -> None:
        if not api_key.startswith(self.PREFIX):
            raise ValueError(
                f"Invalid API key format. Expected key starting with '{self.PREFIX}', "
                f"got '{api_key[:10]}...'"
            )
        self._key = api_key

    def headers(self) -> dict[str, str]:
        """Return HTTP headers for authenticated requests."""
        return {
            "Authorization": f"Bearer {self._key}",
            "X-API-Key": self._key,
        }

    @property
    def key(self) -> str:
        """The raw API key (use with care)."""
        return self._key

    def __repr__(self) -> str:
        masked = self._key[:10] + "..." + self._key[-4:]
        return f"APIKeyAuth({masked!r})"
