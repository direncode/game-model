"""Unit tests for the module system."""
from __future__ import annotations

import sys
import os
import json
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.services.modules.manifest import (
    ModuleManifest,
    ModuleView,
    ModuleAction,
    ModuleEntityType,
)
from app.services.modules.registry import ModuleRegistry


# =====================================================================
#  ModuleManifest
# =====================================================================

def _minimal_manifest_dict():
    return {
        "id": "test-module",
        "version": "1.0.0",
        "display_name": "Test Module",
        "description": "A test module for unit tests.",
    }


def _full_manifest_dict():
    return {
        "id": "edgar",
        "version": "2.1.0",
        "display_name": "SEC EDGAR",
        "description": "SEC filing analysis.",
        "icon": "file-text",
        "adapter_type": "edgar",
        "adapter_config": {"base_url": "https://efts.sec.gov"},
        "views": [
            {"id": "filings", "component": "FilingsView", "route": "/edgar/filings",
             "label": "Filings", "icon": "file"},
        ],
        "entity_types": [
            {"name": "filing", "color": "#00d4ff", "primary_field": "company_name",
             "secondary_field": "form_type", "icon": "document"},
        ],
        "actions": [
            {"id": "refresh-filings", "label": "Refresh Filings",
             "endpoint": "/api/edgar/refresh", "method": "POST",
             "requires_confirmation": True},
        ],
        "narratives": {"summary": "Filing summary template"},
        "required_permissions": ["viewer", "analyst"],
        "min_clearance": "cui",
        "billable": True,
        "tier": "professional",
        "is_core": False,
    }


class TestModuleManifest:
    """Test module manifest loading and serialization."""

    def test_from_dict_minimal(self):
        m = ModuleManifest.from_dict(_minimal_manifest_dict())
        assert m.id == "test-module"
        assert m.version == "1.0.0"
        assert m.display_name == "Test Module"
        assert m.description == "A test module for unit tests."

    def test_from_dict_default_values(self):
        m = ModuleManifest.from_dict(_minimal_manifest_dict())
        assert m.icon == "box"
        assert m.adapter_type == ""
        assert m.views == []
        assert m.entity_types == []
        assert m.actions == []
        assert m.is_core is False
        assert m.billable is True
        assert m.tier == "professional"
        assert m.min_clearance == "unclassified"
        assert m.required_permissions == ["viewer"]

    def test_from_dict_full(self):
        m = ModuleManifest.from_dict(_full_manifest_dict())
        assert m.id == "edgar"
        assert m.icon == "file-text"
        assert len(m.views) == 1
        assert isinstance(m.views[0], ModuleView)
        assert m.views[0].id == "filings"
        assert len(m.entity_types) == 1
        assert isinstance(m.entity_types[0], ModuleEntityType)
        assert m.entity_types[0].name == "filing"
        assert len(m.actions) == 1
        assert isinstance(m.actions[0], ModuleAction)
        assert m.actions[0].requires_confirmation is True

    def test_from_json_file(self):
        data = _full_manifest_dict()
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8",
        ) as f:
            json.dump(data, f)
            path = f.name

        try:
            m = ModuleManifest.from_json_file(path)
            assert m.id == "edgar"
            assert m.version == "2.1.0"
        finally:
            os.unlink(path)

    def test_to_dict_roundtrip(self):
        original = _full_manifest_dict()
        m = ModuleManifest.from_dict(dict(original))
        result = m.to_dict()
        assert result["id"] == "edgar"
        assert result["version"] == "2.1.0"
        assert len(result["views"]) == 1
        assert result["views"][0]["id"] == "filings"

    def test_to_dict_preserves_all_fields(self):
        m = ModuleManifest.from_dict(_full_manifest_dict())
        d = m.to_dict()
        assert "adapter_config" in d
        assert "narratives" in d
        assert "required_permissions" in d

    def test_required_fields_missing_id_raises(self):
        data = {"version": "1.0", "display_name": "X", "description": "Y"}
        with pytest.raises(TypeError):
            ModuleManifest.from_dict(data)

    def test_required_fields_missing_version_raises(self):
        data = {"id": "x", "display_name": "X", "description": "Y"}
        with pytest.raises(TypeError):
            ModuleManifest.from_dict(data)

    def test_module_view_fields(self):
        v = ModuleView(id="v1", component="MyComp", route="/path", label="Label", icon="star")
        assert v.id == "v1"
        assert v.component == "MyComp"
        assert v.route == "/path"

    def test_module_action_defaults(self):
        a = ModuleAction(id="a1", label="Do Thing", endpoint="/api/do")
        assert a.method == "POST"
        assert a.requires_confirmation is False

    def test_module_entity_type(self):
        et = ModuleEntityType(name="filing", color="#ff0000", primary_field="name")
        assert et.name == "filing"
        assert et.secondary_field == ""


# =====================================================================
#  ModuleRegistry
# =====================================================================

def _make_manifest(mid: str, is_core: bool = False, tier: str = "professional") -> ModuleManifest:
    return ModuleManifest(
        id=mid,
        version="1.0.0",
        display_name=mid.replace("-", " ").title(),
        description=f"Test module {mid}",
        is_core=is_core,
        tier=tier,
    )


class TestModuleRegistry:
    """Test module registry operations."""

    def test_register_and_get(self):
        reg = ModuleRegistry()
        m = _make_manifest("test-mod")
        reg.register(m)
        assert reg.get_module("test-mod") is m

    def test_get_unknown_module_returns_none(self):
        reg = ModuleRegistry()
        assert reg.get_module("nonexistent") is None

    def test_unregister(self):
        reg = ModuleRegistry()
        m = _make_manifest("test-mod")
        reg.register(m)
        reg.unregister("test-mod")
        assert reg.get_module("test-mod") is None

    def test_unregister_nonexistent_is_safe(self):
        reg = ModuleRegistry()
        reg.unregister("nonexistent")  # Should not raise

    def test_get_available_modules(self):
        reg = ModuleRegistry()
        reg.register(_make_manifest("mod-a"))
        reg.register(_make_manifest("mod-b"))
        available = reg.get_available_modules()
        assert len(available) == 2

    def test_enable_module(self):
        reg = ModuleRegistry()
        reg.register(_make_manifest("mod-a"))
        result = reg.enable_module("fork-1", "mod-a")
        assert result is True
        assert reg.is_enabled("fork-1", "mod-a") is True

    def test_enable_unknown_module_returns_false(self):
        reg = ModuleRegistry()
        result = reg.enable_module("fork-1", "nonexistent")
        assert result is False

    def test_disable_module(self):
        reg = ModuleRegistry()
        reg.register(_make_manifest("mod-a"))
        reg.enable_module("fork-1", "mod-a")
        result = reg.disable_module("fork-1", "mod-a")
        assert result is True
        assert reg.is_enabled("fork-1", "mod-a") is False

    def test_core_modules_cannot_be_disabled(self):
        reg = ModuleRegistry()
        reg.register(_make_manifest("core-mod", is_core=True))
        result = reg.disable_module("fork-1", "core-mod")
        assert result is False

    def test_core_modules_always_enabled(self):
        reg = ModuleRegistry()
        reg.register(_make_manifest("core-mod", is_core=True))
        # Even without explicitly enabling, core modules are enabled
        assert reg.is_enabled("fork-1", "core-mod") is True

    def test_non_core_module_not_enabled_by_default(self):
        reg = ModuleRegistry()
        reg.register(_make_manifest("opt-mod"))
        assert reg.is_enabled("fork-1", "opt-mod") is False

    def test_get_enabled_modules_includes_core(self):
        reg = ModuleRegistry()
        reg.register(_make_manifest("core-mod", is_core=True))
        reg.register(_make_manifest("opt-mod"))
        reg.enable_module("fork-1", "opt-mod")
        enabled = reg.get_enabled_modules("fork-1")
        ids = [m.id for m in enabled]
        assert "core-mod" in ids
        assert "opt-mod" in ids

    def test_get_enabled_modules_excludes_disabled(self):
        reg = ModuleRegistry()
        reg.register(_make_manifest("mod-a"))
        reg.register(_make_manifest("mod-b"))
        reg.enable_module("fork-1", "mod-a")
        enabled = reg.get_enabled_modules("fork-1")
        ids = [m.id for m in enabled]
        assert "mod-a" in ids
        assert "mod-b" not in ids

    def test_per_fork_isolation(self):
        reg = ModuleRegistry()
        reg.register(_make_manifest("mod-a"))
        reg.enable_module("fork-1", "mod-a")
        assert reg.is_enabled("fork-1", "mod-a") is True
        assert reg.is_enabled("fork-2", "mod-a") is False

    def test_load_manifests_from_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            # Write two manifest files
            for mid in ["mod-alpha", "mod-beta"]:
                data = {
                    "id": mid,
                    "version": "1.0.0",
                    "display_name": mid,
                    "description": f"Desc for {mid}",
                }
                with open(os.path.join(tmp, f"{mid}.json"), "w") as f:
                    json.dump(data, f)

            reg = ModuleRegistry()
            reg.load_manifests(Path(tmp))
            available = reg.get_available_modules()
            ids = [m.id for m in available]
            assert "mod-alpha" in ids
            assert "mod-beta" in ids

    def test_load_manifests_nonexistent_directory(self):
        reg = ModuleRegistry()
        reg.load_manifests(Path("/nonexistent/path"))
        assert len(reg.get_available_modules()) == 0

    def test_load_manifests_skips_invalid_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            # Valid manifest
            data = {"id": "good", "version": "1.0", "display_name": "Good", "description": "OK"}
            with open(os.path.join(tmp, "good.json"), "w") as f:
                json.dump(data, f)
            # Invalid JSON
            with open(os.path.join(tmp, "bad.json"), "w") as f:
                f.write("{not valid json")

            reg = ModuleRegistry()
            reg.load_manifests(Path(tmp))
            available = reg.get_available_modules()
            assert len(available) == 1
            assert available[0].id == "good"

    def test_disable_nonexistent_module_returns_false(self):
        reg = ModuleRegistry()
        result = reg.disable_module("fork-1", "nonexistent")
        assert result is False
