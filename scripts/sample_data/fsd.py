"""FSD (Franklin Street Data): Redis-shaped cached-modules payload.

The real Celery task hits RunPod + live Franklin data + Redis. We synthesize
the cache payload shape that `app.api.v1.fsd` reads so the frontend/Franklin
page and any consumer sees the same structure offline.
"""
from __future__ import annotations

from pathlib import Path

from sample_data._common import FIXTURE_NOW, ManifestEntry, add_file, add_interact, write_json


def _synthetic_modules() -> list[dict]:
    categories = [
        ("Restaurant", "6Pm", 65),
        ("Restaurant", "Brunch", 42),
        ("Bar", "Cocktail", 38),
        ("Cafe", "Espresso", 33),
        ("Museum", "Art", 21),
        ("Gallery", "Contemporary", 17),
        ("Theater", "Drama", 12),
        ("Music", "Jazz", 9),
    ]
    return [
        {
            "module_id": f"fsd_{i:03d}",
            "label": f"{cat} \u00b7 {sub}",
            "category": cat,
            "sub_category": sub,
            "entity_count": n,
            "top_entities": [f"{cat.lower()}_{j}" for j in range(min(5, n))],
        }
        for i, (cat, sub, n) in enumerate(categories)
    ]


def run(out_dir: Path) -> ManifestEntry:
    entry = ManifestEntry(name="fsd", mode="synthetic")

    modules = sorted(_synthetic_modules(), key=lambda m: m["entity_count"], reverse=True)
    ts = FIXTURE_NOW.isoformat()

    p_mods = out_dir / "modules.json"
    write_json(
        p_mods,
        {
            "status": "success",
            "timestamp": ts,
            "dataset_id": "franklin-street-sample",
            "modules": modules,
            "module_count": len(modules),
        },
    )
    add_file(entry, p_mods, "output", "FSD modules sorted by entity_count desc (matches API shape)")

    p_cache = out_dir / "cache_snapshot.json"
    write_json(
        p_cache,
        {
            "redis_key": "fsd:latest",
            "ttl_seconds": 86_400,
            "value": {"status": "success", "timestamp": ts, "module_count": len(modules)},
        },
    )
    add_file(entry, p_cache, "metadata", "Redis cache snapshot for fsd:latest")

    add_interact(entry, "Read FSD modules", "Read", "data/samples/fsd/modules.json")
    add_interact(
        entry,
        "Find Restaurant modules",
        "Grep",
        args={"pattern": "Restaurant", "path": "data/samples/fsd"},
    )
    return entry
