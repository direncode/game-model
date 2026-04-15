"""Module registry — manages available and enabled modules per fork."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from .manifest import ModuleManifest

logger = logging.getLogger(__name__)

# Default module manifests directory
MANIFESTS_DIR = Path(__file__).parent / "manifests"


class ModuleRegistry:
    """Registry of available modules and per-fork enabled state.

    Modules are loaded from JSON manifest files.  Each fork (tenant)
    maintains its own set of enabled modules.  Core modules are always
    enabled and cannot be disabled.
    """

    def __init__(self) -> None:
        self._available: dict[str, ModuleManifest] = {}
        self._enabled: dict[str, set[str]] = {}  # fork_id -> set of module_ids

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------

    def load_manifests(self, directory: Path = MANIFESTS_DIR) -> None:
        """Scan *directory* for ``*.json`` manifest files and register each one."""
        if not directory.exists():
            logger.warning("Manifests directory does not exist: %s", directory)
            return

        for manifest_file in sorted(directory.glob("*.json")):
            try:
                manifest = ModuleManifest.from_json_file(str(manifest_file))
                self.register(manifest)
                logger.info("Loaded module manifest: %s (%s)", manifest.id, manifest.display_name)
            except Exception:
                logger.exception("Failed to load manifest from %s", manifest_file)

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, manifest: ModuleManifest) -> None:
        """Add a module to the available pool."""
        self._available[manifest.id] = manifest
        logger.debug("Registered module: %s", manifest.id)

    def unregister(self, module_id: str) -> None:
        """Remove a module from the available pool (does not affect enabled state)."""
        self._available.pop(module_id, None)
        logger.debug("Unregistered module: %s", module_id)

    # ------------------------------------------------------------------
    # Per-fork enable/disable
    # ------------------------------------------------------------------

    def enable_module(self, fork_id: str, module_id: str) -> bool:
        """Enable *module_id* for *fork_id*.  Returns ``True`` on success."""
        if module_id not in self._available:
            logger.warning("Cannot enable unknown module: %s", module_id)
            return False
        self._enabled.setdefault(fork_id, set()).add(module_id)
        logger.info("Enabled module %s for fork %s", module_id, fork_id)
        return True

    def disable_module(self, fork_id: str, module_id: str) -> bool:
        """Disable *module_id* for *fork_id*.  Core modules cannot be disabled."""
        manifest = self._available.get(module_id)
        if manifest is None:
            return False
        if manifest.is_core:
            logger.warning("Cannot disable core module: %s", module_id)
            return False
        fork_set = self._enabled.get(fork_id)
        if fork_set:
            fork_set.discard(module_id)
        logger.info("Disabled module %s for fork %s", module_id, fork_id)
        return True

    def is_enabled(self, fork_id: str, module_id: str) -> bool:
        """Return ``True`` if *module_id* is currently enabled for *fork_id*."""
        manifest = self._available.get(module_id)
        if manifest and manifest.is_core:
            return True
        return module_id in self._enabled.get(fork_id, set())

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def get_enabled_modules(self, fork_id: str) -> list[ModuleManifest]:
        """Return all enabled manifests for *fork_id* (includes core modules)."""
        enabled: list[ModuleManifest] = []
        for mid, manifest in self._available.items():
            if manifest.is_core or mid in self._enabled.get(fork_id, set()):
                enabled.append(manifest)
        return enabled

    def get_available_modules(self) -> list[ModuleManifest]:
        """Return every registered module regardless of enabled state."""
        return list(self._available.values())

    def get_module(self, module_id: str) -> ModuleManifest | None:
        """Look up a single module by ID."""
        return self._available.get(module_id)
