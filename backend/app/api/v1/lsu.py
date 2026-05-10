"""LSU hardware-bridge API — Layer 12.

Endpoints for on-prem Latent Stretcher Unit registration, heartbeat, and
discovery. See ``docs/specs/LSU_PROTOCOL.md`` for the protocol details.

The LSU registry is the data plane the cost-aware router consults when
deciding whether to send a job to a customer's on-prem hardware instead
of cloud backends.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.api_key_auth import require_api_scope
from app.services.lsu import (
    LSU,
    deregister_lsu,
    heartbeat_lsu,
    list_lsus,
    register_lsu,
)
from app.services.lsu.pairing import (
    DEFAULT_TOKEN_TTL_SECONDS,
    issue_token,
    redeem_token,
)


router = APIRouter(prefix="/lsu", tags=["lsu"])


class LSUOut(BaseModel):
    id: str
    org_id: str
    name: str
    endpoint_url: str
    fingerprint: str
    registered_at: float
    last_heartbeat_at: float
    status: str
    capabilities: dict
    workload_tags: list[str]


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    endpoint_url: str = Field(..., description="URL the LSC control plane reaches this unit at")
    fingerprint: str = Field(..., min_length=8, max_length=128, description="Hardware fingerprint")
    capabilities: dict = Field(default_factory=dict)
    workload_tags: list[str] = Field(default_factory=list)


class HeartbeatRequest(BaseModel):
    status: str = Field(default="online", description="online | offline | draining")


def _to_out(l: LSU) -> LSUOut:
    return LSUOut(**l.to_dict())


@router.get("/", response_model=list[LSUOut])
async def list_lsus_endpoint(
    org_id: str | None = None,
    ctx: dict = Depends(require_api_scope("query")),
) -> list[LSUOut]:
    """List registered LSUs.

    Non-admin callers can only see LSUs for their own org. Admins can
    pass ``org_id`` to filter to a different tenant; omitting it returns
    all LSUs across all orgs.
    """
    is_admin = bool(ctx.get("scopes") and getattr(ctx["scopes"], "admin", False))
    requested_org = org_id if is_admin else ctx.get("org_id")
    lsus = await list_lsus(org_id=requested_org)
    return [_to_out(l) for l in lsus]


@router.post("/register", response_model=LSUOut)
async def register_lsu_endpoint(
    req: RegisterRequest,
    ctx: dict = Depends(require_api_scope("write")),
) -> LSUOut:
    """Register a new LSU. Idempotent on (org_id, fingerprint)."""
    org_id = ctx.get("org_id")
    if not org_id:
        raise HTTPException(status_code=403, detail="register requires an org-scoped API key")
    try:
        lsu = await register_lsu(
            org_id=org_id,
            name=req.name,
            endpoint_url=req.endpoint_url,
            fingerprint=req.fingerprint,
            capabilities=req.capabilities,
            workload_tags=req.workload_tags,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return _to_out(lsu)


@router.post("/{lsu_id}/heartbeat")
async def heartbeat_endpoint(
    lsu_id: str,
    req: HeartbeatRequest,
    _: dict = Depends(require_api_scope("write")),
) -> dict:
    """Heartbeat an LSU. Marks it online (or the requested status)."""
    ok = await heartbeat_lsu(lsu_id, status=req.status)
    if not ok:
        raise HTTPException(status_code=404, detail="LSU not found")
    return {"ok": True, "lsu_id": lsu_id, "status": req.status}


@router.delete("/{lsu_id}")
async def deregister_endpoint(
    lsu_id: str,
    _: dict = Depends(require_api_scope("write")),
) -> dict:
    """Deregister an LSU."""
    ok = await deregister_lsu(lsu_id)
    if not ok:
        raise HTTPException(status_code=404, detail="LSU not found")
    return {"ok": True, "deregistered": lsu_id}


# ---------------------------------------------------------------------------
# Pairing flow — v0.2
# ---------------------------------------------------------------------------


class PairRequest(BaseModel):
    allowed_fingerprint_prefix: str | None = Field(
        default=None,
        description="Optional prefix the redeeming fingerprint must match.",
    )
    ttl_seconds: int = Field(
        default=DEFAULT_TOKEN_TTL_SECONDS,
        ge=60, le=60 * 60 * 24 * 30,
    )


class PairResponse(BaseModel):
    token: str
    expires_at: float
    org_id: str
    allowed_fingerprint_prefix: str | None


class RedeemRequest(BaseModel):
    token: str = Field(..., min_length=8)
    fingerprint: str = Field(..., min_length=8, max_length=128)


class RedeemResponse(BaseModel):
    lsu_long_lived_key: str
    org_id: str
    fingerprint: str
    issued_at: float


@router.post("/pair", response_model=PairResponse)
async def pair_endpoint(
    req: PairRequest,
    ctx: dict = Depends(require_api_scope("admin")),
) -> PairResponse:
    """Issue a one-time LSU pairing token.

    Admin-scope; bound to the caller's org. Operator passes the token
    to the on-prem unit which redeems it for a long-lived key.
    """
    org_id = ctx.get("org_id")
    if not org_id:
        raise HTTPException(status_code=403, detail="pair requires org-scoped admin key")
    try:
        token = await issue_token(
            org_id=org_id,
            allowed_fingerprint_prefix=req.allowed_fingerprint_prefix,
            ttl_seconds=req.ttl_seconds,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return PairResponse(
        token=token.token,
        expires_at=token.expires_at,
        org_id=token.org_id,
        allowed_fingerprint_prefix=token.allowed_fingerprint_prefix,
    )


@router.post("/pair/redeem", response_model=RedeemResponse)
async def redeem_endpoint(req: RedeemRequest) -> RedeemResponse:
    """Redeem a pairing token + fingerprint for a long-lived LSU key.

    Public (the LSU calling in does not yet have an API key). The token
    itself is the secret; redemption is one-shot.
    """
    cred = await redeem_token(req.token, req.fingerprint)
    if cred is None:
        raise HTTPException(
            status_code=400,
            detail="token unknown, expired, already redeemed, or fingerprint mismatch",
        )
    return RedeemResponse(
        lsu_long_lived_key=cred.lsu_long_lived_key,
        org_id=cred.org_id,
        fingerprint=cred.fingerprint,
        issued_at=cred.issued_at,
    )
