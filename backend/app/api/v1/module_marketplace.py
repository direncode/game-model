"""Module marketplace — manage available and enabled modules."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import get_current_active_user
from app.services.modules import ModuleManifest, ModuleRegistry

router = APIRouter(prefix="/modules", tags=["modules"])

# ---------------------------------------------------------------------------
# Singleton registry — populated at app startup via load_manifests()
# ---------------------------------------------------------------------------
_registry = ModuleRegistry()
_registry.load_manifests()


def get_registry() -> ModuleRegistry:
    """Dependency: return the global ModuleRegistry."""
    return _registry


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class ModuleViewResponse(BaseModel):
    id: str
    component: str
    route: str
    label: str
    icon: str


class ModuleEntityTypeResponse(BaseModel):
    name: str
    color: str
    primary_field: str
    secondary_field: str = ""
    icon: str = ""


class ModuleActionResponse(BaseModel):
    id: str
    label: str
    endpoint: str
    method: str
    requires_confirmation: bool = False


class ModuleListItem(BaseModel):
    id: str
    version: str
    display_name: str
    description: str
    icon: str
    is_core: bool
    billable: bool
    tier: str
    enabled: bool = False


class ModuleDetailResponse(BaseModel):
    id: str
    version: str
    display_name: str
    description: str
    icon: str
    adapter_type: str
    views: list[ModuleViewResponse]
    entity_types: list[ModuleEntityTypeResponse]
    actions: list[ModuleActionResponse]
    narratives: dict
    required_permissions: list[str]
    min_clearance: str
    billable: bool
    tier: str
    is_core: bool
    enabled: bool = False


class ModuleConfigUpdate(BaseModel):
    adapter_config: dict = {}


class MessageResponse(BaseModel):
    message: str
    module_id: str
    enabled: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fork_id_for(user) -> str:
    """Derive the fork identifier from the authenticated user."""
    return getattr(user, "organization_id", None) or getattr(user, "id", "default")


def _manifest_to_list_item(m: ModuleManifest, enabled: bool) -> ModuleListItem:
    return ModuleListItem(
        id=m.id,
        version=m.version,
        display_name=m.display_name,
        description=m.description,
        icon=m.icon,
        is_core=m.is_core,
        billable=m.billable,
        tier=m.tier,
        enabled=enabled,
    )


def _manifest_to_detail(m: ModuleManifest, enabled: bool) -> ModuleDetailResponse:
    d = m.to_dict()
    d["enabled"] = enabled
    return ModuleDetailResponse(**d)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[ModuleListItem])
async def list_available_modules(
    user=Depends(get_current_active_user),
    registry: ModuleRegistry = Depends(get_registry),
):
    """List all available modules with enabled status for current fork."""
    fork_id = _fork_id_for(user)
    return [
        _manifest_to_list_item(m, registry.is_enabled(fork_id, m.id))
        for m in registry.get_available_modules()
    ]


@router.get("/enabled", response_model=list[ModuleListItem])
async def list_enabled_modules(
    user=Depends(get_current_active_user),
    registry: ModuleRegistry = Depends(get_registry),
):
    """List only the modules currently enabled for the authenticated fork."""
    fork_id = _fork_id_for(user)
    return [
        _manifest_to_list_item(m, enabled=True)
        for m in registry.get_enabled_modules(fork_id)
    ]


@router.get("/{module_id}", response_model=ModuleDetailResponse)
async def get_module_detail(
    module_id: str,
    user=Depends(get_current_active_user),
    registry: ModuleRegistry = Depends(get_registry),
):
    """Get full manifest detail for a single module."""
    manifest = registry.get_module(module_id)
    if manifest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")
    fork_id = _fork_id_for(user)
    return _manifest_to_detail(manifest, registry.is_enabled(fork_id, module_id))


@router.post("/{module_id}/enable", response_model=MessageResponse)
async def enable_module(
    module_id: str,
    user=Depends(get_current_active_user),
    registry: ModuleRegistry = Depends(get_registry),
):
    """Enable a module for the current fork."""
    fork_id = _fork_id_for(user)
    ok = registry.enable_module(fork_id, module_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot enable module '{module_id}'. It may not exist.",
        )
    return MessageResponse(message=f"Module '{module_id}' enabled.", module_id=module_id, enabled=True)


@router.post("/{module_id}/disable", response_model=MessageResponse)
async def disable_module(
    module_id: str,
    user=Depends(get_current_active_user),
    registry: ModuleRegistry = Depends(get_registry),
):
    """Disable a module for the current fork.  Core modules cannot be disabled."""
    fork_id = _fork_id_for(user)
    ok = registry.disable_module(fork_id, module_id)
    if not ok:
        manifest = registry.get_module(module_id)
        if manifest and manifest.is_core:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Core module '{module_id}' cannot be disabled.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module '{module_id}' not found.",
        )
    return MessageResponse(message=f"Module '{module_id}' disabled.", module_id=module_id, enabled=False)


@router.get("/{module_id}/config", response_model=dict)
async def get_module_config(
    module_id: str,
    user=Depends(get_current_active_user),
    registry: ModuleRegistry = Depends(get_registry),
):
    """Get the current adapter configuration for a module."""
    manifest = registry.get_module(module_id)
    if manifest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")
    return {
        "module_id": module_id,
        "adapter_type": manifest.adapter_type,
        "adapter_config": manifest.adapter_config,
    }


@router.put("/{module_id}/config", response_model=dict)
async def update_module_config(
    module_id: str,
    body: ModuleConfigUpdate,
    user=Depends(get_current_active_user),
    registry: ModuleRegistry = Depends(get_registry),
):
    """Update the adapter configuration for a module (in-memory only)."""
    manifest = registry.get_module(module_id)
    if manifest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")
    manifest.adapter_config.update(body.adapter_config)
    return {
        "module_id": module_id,
        "adapter_type": manifest.adapter_type,
        "adapter_config": manifest.adapter_config,
    }
