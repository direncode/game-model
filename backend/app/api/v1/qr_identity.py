"""QR Digital Identity API endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.db.session import get_db
from app.schemas.qr_identity import (
    QRCodeImageOut,
    QRIdentityOut,
    QRMintRequest,
    QRScanLogOut,
    QRScanRequest,
    QRScanResult,
)
from app.services.qr_identity.code_generator import generate_qr_image
from app.services.qr_identity.identity_service import QRIdentityService

router = APIRouter(prefix="/qr", tags=["qr-identity"])


@router.post("/mint", response_model=QRIdentityOut)
async def mint_qr_identity(
    body: QRMintRequest,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Mint a new QR identity for any trackable entity."""
    svc = QRIdentityService(db)
    qi = await svc.mint(
        subject_type=body.subject_type,
        subject_id=body.subject_id,
        tier=body.tier,
        minted_by=user.email,
        org_id=body.org_id or getattr(user, "organization_id", None),
        metadata=body.metadata,
    )
    await db.commit()
    return qi


@router.get("/{code}", response_model=QRIdentityOut)
async def resolve_qr_code(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """Resolve a QR code to its identity. Public endpoint (no auth required)."""
    svc = QRIdentityService(db)
    qi = await svc.resolve(code)
    if qi is None:
        raise HTTPException(status_code=404, detail="QR code not found or revoked")
    return qi


@router.post("/{code}/scan", response_model=QRScanResult)
async def scan_qr_code(
    code: str,
    body: QRScanRequest | None = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """Scan a QR code — logs the scan event and returns tier-gated data."""
    svc = QRIdentityService(db)
    qi = await svc.resolve(code)
    if qi is None:
        raise HTTPException(status_code=404, detail="QR code not found or revoked")

    access = qi.tier
    ip = request.client.host if request and request.client else None

    await svc.record_scan(
        qr_identity_id=qi.id,
        access_granted=access,
        scanned_by=body.scanned_by if body else None,
        ip_address=body.ip_address if body else ip,
    )
    await db.commit()

    entity_summary = {
        "subject_type": qi.subject_type,
        "subject_id": str(qi.subject_id),
        "tier": qi.tier,
    }

    # Tier-gated lineage resolution (Task 7)
    from app.services.governance.lineage_tracker import LineageTracker
    from app.services.qr_identity.lineage_resolver import QRLineageResolver

    tracker = LineageTracker(db)
    resolver = QRLineageResolver(tracker)
    lineage_data = await resolver.resolve(qi.subject_type, qi.subject_id, access)

    return QRScanResult(
        qr_identity=qi,
        access_granted=access,
        entity_summary=entity_summary,
        lineage=lineage_data,
    )


@router.get("/{code}/lineage")
async def get_qr_lineage(
    code: str,
    tier: str = Query(default="public"),
    db: AsyncSession = Depends(get_db),
):
    """Get lineage data for a QR-linked entity at a specific tier."""
    svc = QRIdentityService(db)
    qi = await svc.resolve(code)
    if qi is None:
        raise HTTPException(status_code=404, detail="QR code not found or revoked")

    from app.services.governance.lineage_tracker import LineageTracker
    from app.services.qr_identity.lineage_resolver import QRLineageResolver

    tracker = LineageTracker(db)
    resolver = QRLineageResolver(tracker)
    return await resolver.resolve(qi.subject_type, qi.subject_id, tier)


@router.get("/{code}/image", response_model=QRCodeImageOut)
async def get_qr_image(
    code: str,
    base_url: str = Query(default="https://latentocean.com"),
    db: AsyncSession = Depends(get_db),
):
    """Generate a QR code PNG image for the given code."""
    svc = QRIdentityService(db)
    qi = await svc.resolve(code)
    if qi is None:
        raise HTTPException(status_code=404, detail="QR code not found or revoked")

    url = f"{base_url}/qr/{code}"
    image_b64 = generate_qr_image(url)
    return QRCodeImageOut(code=code, image_base64=image_b64, url=url)


@router.delete("/{code}")
async def revoke_qr_code(
    code: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-revoke a QR identity."""
    svc = QRIdentityService(db)
    qi = await svc.revoke(code)
    if qi is None:
        raise HTTPException(status_code=404, detail="QR code not found")
    await db.commit()
    return {"status": "revoked", "code": code}


@router.get("/entity/{subject_type}/{subject_id}", response_model=list[QRIdentityOut])
async def list_entity_qr_codes(
    subject_type: str,
    subject_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all QR codes for a given entity."""
    svc = QRIdentityService(db)
    identities = await svc.list_for_entity(subject_type, subject_id)
    return identities


@router.get("/{code}/scans", response_model=list[QRScanLogOut])
async def get_scan_log(
    code: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the scan audit log for a QR identity (admin only)."""
    svc = QRIdentityService(db)
    qi = await svc.resolve(code)
    if qi is None:
        raise HTTPException(status_code=404, detail="QR code not found")
    logs = await svc.get_scan_log(qi.id)
    return logs
