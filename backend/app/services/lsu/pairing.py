"""LSU pairing flow — Layer 12 v0.2.

Token-based pairing exchange between the LSC control plane and an
on-prem Latent Stretcher Unit. Replaces the env-variable single-tenant
LSU registration with a multi-tenant, fingerprint-bound auth flow.

Flow:

  1. An admin in the customer's org calls ``POST /api/v1/lsu/pair``.
     Control plane generates a one-time pairing token bound to
     (org_id, allowed_fingerprint_prefix).
  2. The token is given to the operator running the LSU host.
  3. The LSU calls ``POST /api/v1/lsu/pair/redeem`` with the token and
     its hardware fingerprint. Control plane verifies the token, binds
     the fingerprint, and issues a long-lived API key plus
     (optionally) a TLS cert signed by the LSC CA.
  4. LSU uses the long-lived key for all subsequent
     register / heartbeat / job-claim calls.

v0.2 storage is Redis-backed. v0.3 adds an X.509 CA with attested
fingerprint validation (TPM PCR / SGX / SEV-SNP) before issuance.
"""
from __future__ import annotations

import json
import logging
import os
import secrets
import time
import uuid
from dataclasses import dataclass, asdict
from typing import Any

logger = logging.getLogger(__name__)

_TOKEN_PREFIX = "lsu:pair:token"
_FP_BIND_PREFIX = "lsu:pair:fp"
DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24  # 24 hours


@dataclass
class PairingToken:
    token: str
    org_id: str
    allowed_fingerprint_prefix: str | None
    created_at: float
    expires_at: float
    redeemed: bool = False
    redeemed_at: float | None = None
    redeemed_fingerprint: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RedeemedCredential:
    lsu_long_lived_key: str
    org_id: str
    fingerprint: str
    issued_at: float
    pairing_token: str
    cert_pem: str | None = None  # populated when CA is wired (v0.3)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


async def _redis():
    try:
        import redis.asyncio as redis_async  # type: ignore
    except Exception:
        return None
    url = os.environ.get("REDIS_URL") or "redis://localhost:6379/0"
    try:
        return redis_async.from_url(url, decode_responses=True)
    except Exception:
        return None


async def issue_token(
    org_id: str,
    allowed_fingerprint_prefix: str | None = None,
    ttl_seconds: int = DEFAULT_TOKEN_TTL_SECONDS,
) -> PairingToken:
    """Generate a one-time pairing token. Admin scope only at the API layer."""
    client = await _redis()
    if client is None:
        raise RuntimeError("LSU pairing store unavailable: Redis required")
    now = time.time()
    token = "lsu_pair_" + secrets.token_urlsafe(32)
    pt = PairingToken(
        token=token,
        org_id=org_id,
        allowed_fingerprint_prefix=allowed_fingerprint_prefix,
        created_at=now,
        expires_at=now + ttl_seconds,
    )
    try:
        await client.set(f"{_TOKEN_PREFIX}:{token}", json.dumps(pt.to_dict()), ex=ttl_seconds)
        return pt
    finally:
        try:
            await client.aclose()
        except Exception:
            pass


async def redeem_token(token: str, fingerprint: str) -> RedeemedCredential | None:
    """Exchange a pairing token + fingerprint for a long-lived LSU key.

    Returns the issued credential on success. Returns None if the token
    is unknown, expired, already redeemed, or the fingerprint prefix
    constraint fails.
    """
    if not token or not fingerprint:
        return None
    client = await _redis()
    if client is None:
        return None
    try:
        raw = await client.get(f"{_TOKEN_PREFIX}:{token}")
        if not raw:
            return None
        d = json.loads(raw)
        if d.get("redeemed"):
            return None
        if time.time() > d.get("expires_at", 0):
            return None
        prefix = d.get("allowed_fingerprint_prefix")
        if prefix and not fingerprint.startswith(prefix):
            return None

        long_lived = "lo_sk_lsu_" + secrets.token_urlsafe(32)
        cred = RedeemedCredential(
            lsu_long_lived_key=long_lived,
            org_id=d["org_id"],
            fingerprint=fingerprint,
            issued_at=time.time(),
            pairing_token=token,
            cert_pem=None,  # populated when the CA module ships
        )

        d["redeemed"] = True
        d["redeemed_at"] = cred.issued_at
        d["redeemed_fingerprint"] = fingerprint
        # Persist redemption (keeps TTL for audit visibility)
        await client.set(f"{_TOKEN_PREFIX}:{token}", json.dumps(d))
        await client.set(
            f"{_FP_BIND_PREFIX}:{long_lived}",
            json.dumps(cred.to_dict()),
            ex=60 * 60 * 24 * 365,  # one year — rotated by re-pairing
        )
        return cred
    finally:
        try:
            await client.aclose()
        except Exception:
            pass


async def lookup_lsu_credential(lsu_long_lived_key: str) -> RedeemedCredential | None:
    """Look up an issued credential by the long-lived key.

    Used at request time to verify the LSU's API calls. The auth layer
    (api_key_auth) will route LSU-prefixed keys through this lookup
    once the multi-tenant rollout lands.
    """
    if not lsu_long_lived_key.startswith("lo_sk_lsu_"):
        return None
    client = await _redis()
    if client is None:
        return None
    try:
        raw = await client.get(f"{_FP_BIND_PREFIX}:{lsu_long_lived_key}")
        if not raw:
            return None
        d = json.loads(raw)
        return RedeemedCredential(**d)
    finally:
        try:
            await client.aclose()
        except Exception:
            pass
