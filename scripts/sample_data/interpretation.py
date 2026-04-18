"""Interpretation: module analyses, hidden connections, purity scores."""
from __future__ import annotations

from pathlib import Path

from sample_data._common import (
    ManifestEntry,
    add_file,
    add_interact,
    round_floats,
    write_json,
)


def run(out_dir: Path) -> ManifestEntry:
    entry = ManifestEntry(name="interpretation", mode="synthetic")

    modules = [f"module_{i:02d}" for i in range(10)]

    analyses = [
        {
            "module_id": m,
            "natural_language_summary": (
                f"{m} clusters entities by type and era, with 3 dominant clusters."
            ),
            "dominant_types": ["Concept", "Inventor", "Material"][: (i % 3) + 1],
            "cluster_count": 3 + (i % 4),
        }
        for i, m in enumerate(modules)
    ]
    p_a = out_dir / "module_analyses.json"
    write_json(p_a, {"analyses": analyses, "count": len(analyses)})
    add_file(entry, p_a, "output", "Per-module natural-language analyses")

    connections = []
    for i in range(15):
        connections.append(
            {
                "from_module": modules[i % len(modules)],
                "to_module": modules[(i + 3) % len(modules)],
                "connection_type": [
                    "shared_cluster",
                    "temporal_succession",
                    "co_citation",
                ][i % 3],
                "strength": round(0.4 + 0.04 * i, 6),
            }
        )
    p_c = out_dir / "hidden_connections.json"
    write_json(p_c, round_floats({"connections": connections, "count": len(connections)}))
    add_file(entry, p_c, "output", "Hidden cross-module connections")

    purity = [
        {
            "module_id": m,
            "purity": round(0.5 + 0.03 * i, 6),
            "noise_fraction": round(0.1 + 0.02 * i, 6),
        }
        for i, m in enumerate(modules)
    ]
    p_p = out_dir / "purity_scores.json"
    write_json(p_p, round_floats({"scores": purity, "count": len(purity)}))
    add_file(entry, p_p, "output", "Module purity scores")

    add_interact(
        entry, "Read module analyses", "Read", "data/samples/interpretation/module_analyses.json"
    )
    return entry
