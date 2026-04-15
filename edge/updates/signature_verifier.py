"""Ed25519 signature verification for update packages."""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class SignatureVerifier:
    """Ed25519 signature verification for offline update packages.

    Supports loading the public key from a file (raw 32-byte or PEM)
    or setting it directly.
    """

    def __init__(self, public_key_path: str | None = None) -> None:
        self._public_key: bytes | None = None
        if public_key_path:
            self.load_public_key(public_key_path)

    def load_public_key(self, path: str) -> None:
        """Load an Ed25519 public key from a file.

        Supports raw 32-byte keys and PEM-encoded keys.
        """
        key_path = Path(path)
        if not key_path.exists():
            raise FileNotFoundError(f"Public key file not found: {path}")

        raw = key_path.read_bytes()

        # If it looks like PEM, parse it
        if raw.strip().startswith(b"-----BEGIN"):
            from cryptography.hazmat.primitives.serialization import load_pem_public_key

            key_obj = load_pem_public_key(raw)
            from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

            self._public_key = key_obj.public_bytes(Encoding.Raw, PublicFormat.Raw)
        elif len(raw) == 32:
            self._public_key = raw
        else:
            # Try as hex
            try:
                self._public_key = bytes.fromhex(raw.decode("utf-8").strip())
            except (ValueError, UnicodeDecodeError):
                raise ValueError(
                    f"Cannot parse public key from {path}. "
                    "Expected raw 32-byte, PEM, or hex-encoded key."
                )

        logger.info("Loaded Ed25519 public key from %s", path)

    def verify(self, data: bytes, signature: bytes) -> bool:
        """Verify an Ed25519 signature over *data*.

        Returns ``True`` if valid, ``False`` otherwise.
        """
        if self._public_key is None:
            raise RuntimeError("No public key loaded. Call load_public_key() first.")

        try:
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

            key = Ed25519PublicKey.from_public_bytes(self._public_key)
            key.verify(signature, data)
            return True
        except Exception as exc:
            logger.debug("Signature verification failed: %s", exc)
            return False

    @property
    def has_key(self) -> bool:
        """Whether a public key has been loaded."""
        return self._public_key is not None
