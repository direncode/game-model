"""Module system — manifest-driven vertical management."""

from .manifest import ModuleManifest, ModuleView, ModuleAction, ModuleEntityType
from .registry import ModuleRegistry

__all__ = [
    "ModuleManifest",
    "ModuleView",
    "ModuleAction",
    "ModuleEntityType",
    "ModuleRegistry",
]
