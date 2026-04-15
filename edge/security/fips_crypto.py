"""FIPS 140-2 compliant cryptographic operations.

All algorithms used here are FIPS-approved:
- PBKDF2-HMAC-SHA256 for password hashing
- AES-256-GCM for symmetric encryption at rest
- Ed25519 for digital signatures (FIPS 186-5)
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from typing import Tuple


class FIPSCrypto:
    """Wrapper ensuring all crypto uses FIPS-validated algorithms.

    In production, the underlying OpenSSL library should be built with
    FIPS mode enabled.  This class constrains the API surface to only
    FIPS-approved operations.
    """

    # PBKDF2 parameters
    _PBKDF2_ITERATIONS = 600_000
    _PBKDF2_SALT_LEN = 32
    _PBKDF2_KEY_LEN = 32

    # AES-256-GCM parameters
    _AES_KEY_LEN = 32
    _AES_NONCE_LEN = 12
    _AES_TAG_LEN = 16

    # ------------------------------------------------------------------
    # Password hashing (PBKDF2-HMAC-SHA256)
    # ------------------------------------------------------------------

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using PBKDF2-HMAC-SHA256.

        Returns a string in the format: ``pbkdf2:sha256:<iterations>$<salt_hex>$<hash_hex>``
        """
        salt = os.urandom(FIPSCrypto._PBKDF2_SALT_LEN)
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            FIPSCrypto._PBKDF2_ITERATIONS,
            dklen=FIPSCrypto._PBKDF2_KEY_LEN,
        )
        return (
            f"pbkdf2:sha256:{FIPSCrypto._PBKDF2_ITERATIONS}"
            f"${salt.hex()}${dk.hex()}"
        )

    @staticmethod
    def verify_password(password: str, stored_hash: str) -> bool:
        """Verify a password against a PBKDF2 hash string."""
        try:
            header, salt_hex, hash_hex = stored_hash.split("$")
            _, _, iterations_str = header.split(":")
            iterations = int(iterations_str)
            salt = bytes.fromhex(salt_hex)
            expected = bytes.fromhex(hash_hex)
        except (ValueError, AttributeError):
            return False

        dk = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            iterations,
            dklen=len(expected),
        )
        return hmac.compare_digest(dk, expected)

    # ------------------------------------------------------------------
    # Symmetric encryption (AES-256-GCM)
    # ------------------------------------------------------------------

    @staticmethod
    def encrypt_at_rest(data: bytes, key: bytes) -> bytes:
        """Encrypt data using AES-256-GCM.

        Returns: ``nonce (12 bytes) || ciphertext || tag (16 bytes)``

        Requires the ``cryptography`` library for AES-GCM.
        """
        if len(key) != FIPSCrypto._AES_KEY_LEN:
            raise ValueError(f"AES-256 key must be {FIPSCrypto._AES_KEY_LEN} bytes")

        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        nonce = os.urandom(FIPSCrypto._AES_NONCE_LEN)
        aes = AESGCM(key)
        ciphertext = aes.encrypt(nonce, data, None)  # ciphertext includes tag
        return nonce + ciphertext

    @staticmethod
    def decrypt_at_rest(ciphertext: bytes, key: bytes) -> bytes:
        """Decrypt AES-256-GCM ciphertext produced by :meth:`encrypt_at_rest`."""
        if len(key) != FIPSCrypto._AES_KEY_LEN:
            raise ValueError(f"AES-256 key must be {FIPSCrypto._AES_KEY_LEN} bytes")

        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        nonce = ciphertext[: FIPSCrypto._AES_NONCE_LEN]
        ct = ciphertext[FIPSCrypto._AES_NONCE_LEN :]
        aes = AESGCM(key)
        return aes.decrypt(nonce, ct, None)

    # ------------------------------------------------------------------
    # Digital signatures (Ed25519)
    # ------------------------------------------------------------------

    @staticmethod
    def sign_data(data: bytes, private_key: bytes) -> bytes:
        """Sign data with an Ed25519 private key.

        ``private_key`` should be a 32-byte Ed25519 seed or a DER/PEM-encoded key.
        """
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        from cryptography.hazmat.primitives.serialization import (
            Encoding,
            NoEncryption,
            PrivateFormat,
        )

        if len(private_key) == 32:
            key = Ed25519PrivateKey.from_private_bytes(private_key)
        else:
            from cryptography.hazmat.primitives.serialization import load_der_private_key
            key = load_der_private_key(private_key, password=None)

        return key.sign(data)

    @staticmethod
    def verify_signature(data: bytes, signature: bytes, public_key: bytes) -> bool:
        """Verify an Ed25519 signature.

        ``public_key`` should be a 32-byte raw public key or DER-encoded.
        """
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

        try:
            if len(public_key) == 32:
                key = Ed25519PublicKey.from_public_bytes(public_key)
            else:
                from cryptography.hazmat.primitives.serialization import load_der_public_key
                key = load_der_public_key(public_key)
            key.verify(signature, data)
            return True
        except Exception:
            return False

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    @staticmethod
    def generate_key(length: int = 32) -> bytes:
        """Generate a cryptographically secure random key."""
        return secrets.token_bytes(length)
