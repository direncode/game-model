"""Crystallization (TCD-JEPA): real semiconductor bundle via demo_data.

Uses the ship-ready `demo_data.generate_semiconductor_bundle` (100 entities,
8D, deterministic seed). `demo_runner.run_demo` is async + needs GPU + DB,
so we bypass it and also invoke `demo_data.generate_demo_intelligence` for
real intelligence-cache output derived from the bundle statistics.
"""
from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

from sample_data._common import (
    ManifestEntry,
    add_file,
    add_interact,
    round_floats,
    truncate_array,
    write_json,
)


def run(out_dir: Path) -> ManifestEntry:
    entry = ManifestEntry(name="crystallization", mode="real")

    from app.services.crystallization.demo_data import (
        generate_demo_intelligence,
        generate_semiconductor_bundle,
    )

    bundle = generate_semiconductor_bundle(n=100, d=8, seed=42)

    ids = list(bundle.ids)
    emb = bundle.embeddings.tolist()
    edges = [{"from": ids[i], "to": ids[j], "weight": round(w, 6)} for i, j, w in bundle.edges]

    entities_rows: list[dict] = []
    type_list = bundle.metadata.get("entity_types", [])
    cluster_list = bundle.metadata.get("cluster_assignments", [])
    for i, name in enumerate(ids):
        entities_rows.append(
            {
                "name": name,
                "type": type_list[i] if i < len(type_list) else "Unknown",
                "cluster": int(cluster_list[i]) if i < len(cluster_list) else 0,
                "embedding": [round(float(x), 6) for x in emb[i]],
            }
        )

    trunc_entities, orig_entities = truncate_array(entities_rows, limit=50)
    trunc_edges, orig_edges = truncate_array(edges, limit=100)
    bundle_payload = {
        "entity_count": len(ids),
        "edge_count": len(edges),
        "dim": int(bundle.embeddings.shape[1]),
        "metadata": {
            k: v for k, v in bundle.metadata.items() if k != "cluster_assignments"
        },
        "entities": trunc_entities,
        "edges": trunc_edges,
    }
    if orig_entities is not None:
        bundle_payload["entities_truncated_from"] = orig_entities
    if orig_edges is not None:
        bundle_payload["edges_truncated_from"] = orig_edges

    p_bundle = out_dir / "bundle_semiconductor.json"
    write_json(p_bundle, round_floats(bundle_payload))
    add_file(entry, p_bundle, "input", "100-entity 8D semiconductor supply-chain bundle")

    # Build module-like inputs for intelligence generation
    modules = []
    cluster_names = {
        0: "Companies",
        1: "Chips",
        2: "Tools",
        3: "Materials",
        4: "Processes",
    }
    for cid, cname in cluster_names.items():
        members = [ids[i] for i, c in enumerate(cluster_list) if c == cid]
        if members:
            modules.append({"id": f"cluster_{cid}", "name": cname, "members": members})

    intelligence = generate_demo_intelligence(bundle, modules)
    p_intel = out_dir / "intelligence_cache.json"
    # Truncate each list of insights for readability
    intel_trunc = {k: v[:20] for k, v in intelligence.items()}
    write_json(
        p_intel,
        {
            "categories": list(intelligence.keys()),
            "insight_counts": {k: len(v) for k, v in intelligence.items()},
            "insights_sample": round_floats(intel_trunc),
        },
    )
    add_file(entry, p_intel, "output", "TCD-JEPA demo intelligence insights (real generator)")

    crystal = {
        "version": "1.0",
        "dim": int(bundle.embeddings.shape[1]),
        "entity_count": len(ids),
        "cluster_count": len(set(cluster_list)) if cluster_list else 0,
        "training_steps": 0,
        "mode": "cpu_metadata_only",
        "parents": {"bundle": "bundle_semiconductor.json"},
        "notes": "Real demo bundle + real intelligence generator. "
        "Full GPU training happens via demo_runner on RunPod.",
    }
    p_crystal = out_dir / "crystal_8d.json"
    write_json(p_crystal, crystal)
    add_file(entry, p_crystal, "output", "Crystal checkpoint metadata for the bundle")

    add_interact(
        entry,
        "Read the semiconductor bundle",
        "Read",
        "data/samples/crystallization/bundle_semiconductor.json",
    )
    add_interact(
        entry,
        "Grep for TSMC",
        "Grep",
        args={"pattern": "TSMC", "path": "data/samples/crystallization"},
    )
    add_interact(
        entry, "Read intelligence sample", "Read", "data/samples/crystallization/intelligence_cache.json"
    )
    return entry
