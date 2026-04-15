"""SSO API — SAML and OIDC endpoints for enterprise single sign-on."""

from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Form, Query, Request, Response
from pydantic import BaseModel, Field

from app.core.auth import create_access_token, create_refresh_token, get_current_active_user
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.core.permissions import require_permission
from app.core.sso import (
    OIDCConfig,
    OIDCProvider,
    SAMLConfig,
    SAMLProvider,
)
from app.core.sso.provider_registry import get_sso_registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sso", tags=["sso"])

# ── In-memory state store for OIDC flows ─────────────────────────────
# In production this would be Redis-backed with short TTLs.
_oidc_state_store: dict[str, dict] = {}  # state -> {"nonce": ..., "org_id": ..., "created_at": ...}


# ── Request / response schemas ───────────────────────────────────────


class SAMLProviderConfig(BaseModel):
    """Request body to configure a SAML provider for an org."""
    type: str = "saml"
    entity_id: str
    acs_url: str
    slo_url: str = ""
    idp_entity_id: str
    idp_sso_url: str
    idp_slo_url: str = ""
    idp_certificate: str = ""
    name_id_format: str = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"


class OIDCProviderConfig(BaseModel):
    """Request body to configure an OIDC provider for an org."""
    type: str = "oidc"
    client_id: str
    client_secret: str
    discovery_url: str
    redirect_uri: str
    scopes: list[str] = Field(default_factory=lambda: ["openid", "email", "profile"])


class SSOProviderRequest(BaseModel):
    """Union request for configuring an SSO provider."""
    org_id: str
    type: str  # "saml" or "oidc"
    saml: Optional[SAMLProviderConfig] = None
    oidc: Optional[OIDCProviderConfig] = None


class SSOProviderResponse(BaseModel):
    """Response for SSO provider queries."""
    org_id: str
    type: str
    configured: bool
    details: dict = Field(default_factory=dict)


# ── SAML endpoints ───────────────────────────────────────────────────


@router.get("/saml/{org_id}/login")
async def saml_login(org_id: str, relay_state: str = ""):
    """Initiate SAML login — redirects the browser to the IDP."""
    registry = get_sso_registry()
    provider = registry.get_provider(org_id)

    if provider is None or not isinstance(provider, SAMLProvider):
        raise NotFoundError(detail=f"No SAML provider configured for organization '{org_id}'")

    redirect_url, request_id = provider.create_auth_request(relay_state=relay_state)

    logger.info("SAML login initiated: org=%s request_id=%s", org_id, request_id)
    return {"redirect_url": redirect_url, "request_id": request_id}


@router.post("/saml/{org_id}/acs")
async def saml_acs(
    org_id: str,
    SAMLResponse: str = Form(...),
    RelayState: str = Form(""),
):
    """SAML Assertion Consumer Service — receives the IDP response.

    This endpoint is called by the IDP after the user authenticates.
    It validates the SAML assertion and returns platform tokens.
    """
    registry = get_sso_registry()
    provider = registry.get_provider(org_id)

    if provider is None or not isinstance(provider, SAMLProvider):
        raise NotFoundError(detail=f"No SAML provider configured for organization '{org_id}'")

    try:
        saml_user = provider.process_response(SAMLResponse, relay_state=RelayState)
    except ValueError as exc:
        logger.warning("SAML ACS validation failed: org=%s error=%s", org_id, exc)
        raise ValidationError(detail=f"SAML response validation failed: {exc}")

    if not saml_user.email:
        raise ValidationError(detail="SAML assertion did not contain an email address")

    # Generate platform tokens for the SSO-authenticated user
    token_data = {
        "sub": saml_user.email,
        "email": saml_user.email,
        "name": saml_user.name,
        "org_id": org_id,
        "sso": "saml",
        "groups": saml_user.groups,
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    logger.info("SAML ACS success: org=%s email=%s", org_id, saml_user.email)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "email": saml_user.email,
            "name": saml_user.name,
            "groups": saml_user.groups,
        },
        "relay_state": RelayState,
    }


@router.get("/saml/{org_id}/metadata")
async def saml_metadata(org_id: str):
    """Return SP metadata XML for IDP configuration."""
    registry = get_sso_registry()
    provider = registry.get_provider(org_id)

    if provider is None or not isinstance(provider, SAMLProvider):
        raise NotFoundError(detail=f"No SAML provider configured for organization '{org_id}'")

    xml = provider.get_metadata_xml()
    return Response(content=xml, media_type="application/xml")


# ── OIDC endpoints ───────────────────────────────────────────────────


@router.get("/oidc/{org_id}/login")
async def oidc_login(org_id: str):
    """Initiate OIDC login — returns the authorization URL."""
    registry = get_sso_registry()
    provider = registry.get_provider(org_id)

    if provider is None or not isinstance(provider, OIDCProvider):
        raise NotFoundError(detail=f"No OIDC provider configured for organization '{org_id}'")

    # Discover endpoints (cached after first call)
    await provider.discover()

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)

    # Store state for callback validation
    _oidc_state_store[state] = {
        "nonce": nonce,
        "org_id": org_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    auth_url = provider.create_auth_url(state=state, nonce=nonce)

    logger.info("OIDC login initiated: org=%s", org_id)
    return {"redirect_url": auth_url, "state": state}


@router.get("/oidc/{org_id}/callback")
async def oidc_callback(
    org_id: str,
    code: str = Query(...),
    state: str = Query(...),
):
    """OIDC callback — exchanges the code for tokens.

    Validates the state parameter, exchanges the authorization code,
    validates the ID token, and returns platform tokens.
    """
    # Validate state
    state_data = _oidc_state_store.pop(state, None)
    if state_data is None:
        raise ValidationError(detail="Invalid or expired OIDC state parameter")

    if state_data["org_id"] != org_id:
        raise ValidationError(detail="OIDC state organization mismatch")

    nonce = state_data["nonce"]

    registry = get_sso_registry()
    provider = registry.get_provider(org_id)

    if provider is None or not isinstance(provider, OIDCProvider):
        raise NotFoundError(detail=f"No OIDC provider configured for organization '{org_id}'")

    # Exchange code for tokens
    try:
        tokens = await provider.exchange_code(code=code, state=state)
    except ValueError as exc:
        raise ValidationError(detail=f"OIDC code exchange failed: {exc}")

    # Validate ID token
    id_token = tokens.get("id_token")
    claims: dict = {}
    if id_token:
        try:
            claims = await provider.validate_id_token(id_token, nonce=nonce)
        except ValueError as exc:
            logger.warning("OIDC ID token validation failed: %s", exc)
            # Fall back to userinfo endpoint

    # Get user info
    access_token = tokens.get("access_token", "")
    try:
        oidc_user = await provider.get_user_info(access_token)
    except ValueError as exc:
        if not claims:
            raise ValidationError(detail=f"Could not retrieve user info: {exc}")
        # Use claims from ID token as fallback
        oidc_user = None

    email = ""
    name = ""
    groups: list[str] = []

    if oidc_user:
        email = oidc_user.email
        name = oidc_user.name
        groups = oidc_user.groups
    elif claims:
        email = claims.get("email", "")
        name = claims.get("name", "")
        groups = claims.get("groups", [])

    if not email:
        raise ValidationError(detail="OIDC flow did not return an email address")

    # Generate platform tokens
    token_data = {
        "sub": email,
        "email": email,
        "name": name,
        "org_id": org_id,
        "sso": "oidc",
        "groups": groups,
    }
    platform_access = create_access_token(token_data)
    platform_refresh = create_refresh_token(token_data)

    logger.info("OIDC callback success: org=%s email=%s", org_id, email)

    return {
        "access_token": platform_access,
        "refresh_token": platform_refresh,
        "token_type": "bearer",
        "user": {
            "email": email,
            "name": name,
            "groups": groups,
        },
    }


# ── Provider management (admin) ─────────────────────────────────────


@router.post("/providers")
async def configure_sso_provider(
    body: SSOProviderRequest,
    user=Depends(require_permission("configure_system")),
):
    """Configure SSO for an organization (admin only)."""
    registry = get_sso_registry()

    if body.type == "saml":
        if body.saml is None:
            raise ValidationError(detail="SAML configuration required when type is 'saml'")
        config = SAMLConfig(
            entity_id=body.saml.entity_id,
            acs_url=body.saml.acs_url,
            slo_url=body.saml.slo_url,
            idp_entity_id=body.saml.idp_entity_id,
            idp_sso_url=body.saml.idp_sso_url,
            idp_slo_url=body.saml.idp_slo_url,
            idp_certificate=body.saml.idp_certificate,
            name_id_format=body.saml.name_id_format,
        )
        registry.register_saml(body.org_id, config)
        logger.info("SAML SSO configured: org=%s entity=%s", body.org_id, config.entity_id)

    elif body.type == "oidc":
        if body.oidc is None:
            raise ValidationError(detail="OIDC configuration required when type is 'oidc'")
        config = OIDCConfig(
            client_id=body.oidc.client_id,
            client_secret=body.oidc.client_secret,
            discovery_url=body.oidc.discovery_url,
            redirect_uri=body.oidc.redirect_uri,
            scopes=body.oidc.scopes,
        )
        registry.register_oidc(body.org_id, config)
        logger.info("OIDC SSO configured: org=%s client=%s", body.org_id, config.client_id)

    else:
        raise ValidationError(detail=f"Unknown SSO type: {body.type}")

    return {"status": "configured", "org_id": body.org_id, "type": body.type}


@router.get("/providers/{org_id}")
async def get_sso_provider(
    org_id: str,
    user=Depends(require_permission("configure_system")),
):
    """Get SSO configuration for an organization."""
    registry = get_sso_registry()

    provider_type = registry.get_provider_type(org_id)
    if provider_type is None:
        raise NotFoundError(detail=f"No SSO provider configured for organization '{org_id}'")

    config = registry.get_config(org_id)
    details: dict = {"type": provider_type}

    if provider_type == "saml" and config:
        details["entity_id"] = config.entity_id
        details["acs_url"] = config.acs_url
        details["idp_entity_id"] = config.idp_entity_id
        details["idp_sso_url"] = config.idp_sso_url
    elif provider_type == "oidc" and config:
        details["client_id"] = config.client_id
        details["discovery_url"] = config.discovery_url
        details["redirect_uri"] = config.redirect_uri
        details["scopes"] = config.scopes

    return SSOProviderResponse(
        org_id=org_id,
        type=provider_type,
        configured=True,
        details=details,
    )


@router.delete("/providers/{org_id}")
async def remove_sso_provider(
    org_id: str,
    user=Depends(require_permission("configure_system")),
):
    """Remove SSO configuration for an organization."""
    registry = get_sso_registry()

    if not registry.remove_provider(org_id):
        raise NotFoundError(detail=f"No SSO provider configured for organization '{org_id}'")

    logger.info("SSO provider removed: org=%s", org_id)
    return {"status": "removed", "org_id": org_id}
