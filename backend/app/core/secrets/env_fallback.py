"""Fallback secrets provider — reads from environment variables.

Used when HashiCorp Vault is unavailable.  Loads ``.env`` files
manually (without requiring ``python-dotenv``) for air-gapped
deployments.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


class SecretsFallback:
    """Read secrets from environment variables when Vault is unavailable.

    Optionally loads a ``.env`` file into ``os.environ`` on first access.
    """

    def __init__(self, env_file: str = ".env") -> None:
        self._loaded: bool = False
        self._env_file: str = env_file

    def get(self, key: str, default: str = "") -> str:
        """Get a secret from the environment.

        Loads the ``.env`` file on first call (if it exists).

        Args:
            key: Environment variable name.
            default: Fallback value if the variable is unset.

        Returns:
            The value of the environment variable, or *default*.
        """
        if not self._loaded:
            self.load_env_file()
        return os.environ.get(key, default)

    def load_env_file(self) -> None:
        """Load a ``.env`` file into ``os.environ``.

        Skips silently if the file does not exist.  Supports the
        standard ``KEY=value`` format with optional quoting, comments,
        and blank lines.
        """
        if self._loaded:
            return

        self._loaded = True
        path = Path(self._env_file)

        if not path.is_file():
            logger.debug("No .env file at %s — using existing environment only", path.resolve())
            return

        loaded_count = 0
        try:
            with path.open("r", encoding="utf-8") as fh:
                for line_no, raw_line in enumerate(fh, start=1):
                    line = raw_line.strip()

                    # Skip blank lines and comments
                    if not line or line.startswith("#"):
                        continue

                    # Handle export prefix
                    if line.startswith("export "):
                        line = line[7:].strip()

                    if "=" not in line:
                        logger.debug(".env:%d — skipping line without '='", line_no)
                        continue

                    key, _, value = line.partition("=")
                    key = key.strip()
                    value = value.strip()

                    # Strip surrounding quotes
                    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                        value = value[1:-1]

                    # Only set if not already in environment (env vars take precedence)
                    if key not in os.environ:
                        os.environ[key] = value
                        loaded_count += 1

        except OSError as exc:
            logger.warning("Failed to read .env file %s: %s", path.resolve(), exc)
            return

        logger.info(
            "Loaded %d variables from %s (%d skipped — already set in environment)",
            loaded_count,
            path.resolve(),
            0,  # We don't track skipped separately for simplicity
        )
