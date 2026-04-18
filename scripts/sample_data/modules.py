"""Modules: real ModuleRegistry loading the committed manifests directory."""
from __future__ import annotations

from pathlib import Path

from sample_data._common import ManifestEntry, add_file, add_interact, write_json


def run(out_dir: Path) -> ManifestEntry:
    entry = ManifestEntry(name="modules", mode="real")

    from app.services.modules.registry import ModuleRegistry

    reg = ModuleRegistry()
    reg.load_manifests()

    listings = []
    for mod_id, manifest in sorted(reg._available.items()):
        listings.append(
            {
                "id": mod_id,
                "display_name": getattr(manifest, "display_name", mod_id),
                "description": getattr(manifest, "description", ""),
                "version": getattr(manifest, "version", "0.0.0"),
                "core": getattr(manifest, "core", False),
            }
        )

    p_reg = out_dir / "registry.json"
    write_json(p_reg, {"modules": listings, "count": len(listings)})
    add_file(entry, p_reg, "output", "Loaded module manifests (real registry)")

    p_mkt = out_dir / "marketplace_listings.json"
    write_json(
        p_mkt,
        {
            "listings": [
                {"id": m["id"], "display_name": m["display_name"]} for m in listings
            ],
            "count": len(listings),
        },
    )
    add_file(entry, p_mkt, "output", "Marketplace listing shape")

    add_interact(entry, "Read module registry", "Read", "data/samples/modules/registry.json")
    return entry
