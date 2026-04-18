"""Data Layer: offline connector catalog + real type manifest.

`LatentOceanDataLayer.ingest` needs registered adapters and network. We
produce a connector catalog, read real types from `app.services.data_layer.types`,
and render a representative orchestrator run summary without invoking live
adapters.
"""
from __future__ import annotations

from pathlib import Path

from sample_data._common import ManifestEntry, add_file, add_interact, write_json


CONNECTORS = [
    {"id": "postgres", "kind": "database", "ready": True},
    {"id": "s3", "kind": "blob", "ready": True},
    {"id": "huggingface", "kind": "hub", "ready": True},
    {"id": "gdrive", "kind": "drive", "ready": False},
    {"id": "slack", "kind": "chat", "ready": False},
    {"id": "notion", "kind": "wiki", "ready": False},
    {"id": "github", "kind": "vcs", "ready": True},
    {"id": "rest", "kind": "api", "ready": True},
]


def run(out_dir: Path) -> ManifestEntry:
    entry = ManifestEntry(name="data_layer", mode="hybrid")

    p_cat = out_dir / "connector_catalog.json"
    write_json(
        p_cat,
        {
            "connectors": CONNECTORS,
            "count": len(CONNECTORS),
            "ready_count": sum(1 for c in CONNECTORS if c["ready"]),
        },
    )
    add_file(entry, p_cat, "metadata", "Ocean connector catalog (static listing)")

    from app.services.data_layer import types as dl_types

    type_names = sorted([n for n in dir(dl_types) if not n.startswith("_")])
    p_schema = out_dir / "schema_manifest.json"
    write_json(
        p_schema,
        {
            "data_layer_types": type_names,
            "type_count": len(type_names),
            "module": "app.services.data_layer.types",
        },
    )
    add_file(entry, p_schema, "metadata", "Names exported from app.services.data_layer.types")

    run_summary = {
        "budget_dollars": 50.0,
        "target_survivors": 300,
        "sources_attempted": ["postgres", "s3", "huggingface", "github", "rest"],
        "sources_succeeded": [],
        "note": "Populated offline; no live adapters invoked. See schema_manifest for exported types.",
    }
    p_run = out_dir / "orchestrator_run.json"
    write_json(p_run, run_summary)
    add_file(entry, p_run, "output", "Ocean orchestrator run summary (offline)")

    add_interact(entry, "Read connector catalog", "Read", "data/samples/data_layer/connector_catalog.json")
    add_interact(entry, "Read schema manifest", "Read", "data/samples/data_layer/schema_manifest.json")
    return entry
