"""Module manifest — defines a vertical's capabilities and views."""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from typing import Literal


@dataclass
class ModuleView:
    """A dashboard view provided by a module."""

    id: str
    component: str  # React component name
    route: str  # URL path
    label: str = ""
    icon: str = ""


@dataclass
class ModuleAction:
    """An action a module can perform."""

    id: str
    label: str
    endpoint: str  # API endpoint to call
    method: str = "POST"
    requires_confirmation: bool = False


@dataclass
class ModuleEntityType:
    """An entity type contributed by a module."""

    name: str
    color: str
    primary_field: str
    secondary_field: str = ""
    icon: str = ""


@dataclass
class ModuleManifest:
    """Complete manifest for a Latent Ocean module/vertical."""

    id: str
    version: str
    display_name: str
    description: str
    icon: str = "box"

    # Adapter configuration
    adapter_type: str = ""  # e.g., "edgar", "pubmed", or "generic"
    adapter_config: dict = field(default_factory=dict)

    # Dashboard views
    views: list[ModuleView] = field(default_factory=list)

    # Entity types this module adds
    entity_types: list[ModuleEntityType] = field(default_factory=list)

    # Actions available in the module
    actions: list[ModuleAction] = field(default_factory=list)

    # Narrative templates
    narratives: dict = field(default_factory=dict)

    # Access control
    required_permissions: list[str] = field(default_factory=lambda: ["viewer"])
    min_clearance: str = "unclassified"  # For Edge Edition

    # Billing
    billable: bool = True
    tier: Literal["free", "starter", "professional", "enterprise"] = "professional"

    # Core modules can't be disabled
    is_core: bool = False

    @classmethod
    def from_dict(cls, data: dict) -> ModuleManifest:
        """Create a ModuleManifest from a dictionary."""
        views = [ModuleView(**v) for v in data.pop("views", [])]
        entity_types = [ModuleEntityType(**e) for e in data.pop("entity_types", [])]
        actions = [ModuleAction(**a) for a in data.pop("actions", [])]

        return cls(
            views=views,
            entity_types=entity_types,
            actions=actions,
            **data,
        )

    @classmethod
    def from_json_file(cls, path: str) -> ModuleManifest:
        """Load a ModuleManifest from a JSON file on disk."""
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return cls.from_dict(data)

    def to_dict(self) -> dict:
        """Serialize the manifest to a plain dictionary."""
        result = asdict(self)
        return result
