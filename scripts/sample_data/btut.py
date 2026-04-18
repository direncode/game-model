"""BTUT: real pipeline over 20 synthetic cross-era documents.

Invokes `app.services.btut.pipeline.run_btut_pipeline` (local numpy, no GPU).
Produces survivor bundle + lattice. LATK consumes the lattice later.
"""
from __future__ import annotations

from pathlib import Path

from sample_data._common import (
    ManifestEntry,
    add_file,
    add_interact,
    round_floats,
    truncate_array,
    write_json,
)


def _synthetic_entities() -> tuple[list[dict], list[dict], list[str]]:
    eras = [1920, 1950, 1980, 2010]
    sources = ["lab_notebook", "patent", "paper", "press_release"]
    types = ["Concept", "Inventor", "Material", "Venue"]
    entities: list[dict] = []
    for i in range(20):
        entities.append(
            {
                "name": f"entity_{i:03d}",
                "type": types[i % len(types)],
                "attributes": {
                    "era": eras[i % len(eras)],
                    "source": sources[i % len(sources)],
                    "text": f"Sample document {i} describing entity_{i:03d} in era {eras[i % len(eras)]}.",
                },
            }
        )
    edges: list[dict] = []
    for i in range(19):
        edges.append(
            {
                "source": entities[i]["name"],
                "target": entities[i + 1]["name"],
                "type": "succeeds",
                "weight": 1.0,
            }
        )
    unique_types = sorted({e["type"] for e in entities})
    return entities, edges, unique_types


def run(out_dir: Path) -> ManifestEntry:
    entry = ManifestEntry(name="btut", mode="real")
    entities, edges, unique_types = _synthetic_entities()

    p_input = out_dir / "input_documents.json"
    write_json(
        p_input,
        {"entities": entities, "edges": edges, "unique_types": unique_types},
    )
    add_file(entry, p_input, "input", "20 synthetic cross-era documents + succession edges")

    from app.services.btut.pipeline import run_btut_pipeline

    result = run_btut_pipeline(
        entities=entities,
        edges=edges,
        unique_types=unique_types,
        target_survivors=10,
        budget_dollars=1.0,
        resolutions=[4, 8],
        n_rotations=4,
    )

    summary = dict(result.get("summary", {}))
    summary["input_count"] = len(entities)
    summary["seed"] = 42
    p_sum = out_dir / "pipeline_summary.json"
    write_json(p_sum, summary)
    add_file(entry, p_sum, "metadata", "BTUT pipeline summary: counts, timings, reduction ratio")

    survivors = result.get("survivors", [])
    trunc_survivors, orig = truncate_array(survivors, limit=50)
    payload: dict = {"survivors": round_floats(trunc_survivors)}
    if orig is not None:
        payload["truncated_from"] = orig
    p_surv = out_dir / "survivor_bundle.json"
    write_json(p_surv, payload)
    add_file(entry, p_surv, "output", "BTUT survivors with 8D embeddings and metadata")

    def _score_vector(scores: dict) -> list[float]:
        keys = ("anomaly", "composite", "diversity", "reconstruction")
        return [float(scores.get(k, 0.0)) for k in keys]

    lattice_entities: list[dict] = []
    for i, s in enumerate(trunc_survivors):
        ent = s.get("entity", {}) if isinstance(s, dict) else {}
        attrs = ent.get("attributes", {}) if isinstance(ent, dict) else {}
        lattice_entities.append(
            {
                "name": ent.get("name", f"e_{i}"),
                "type": ent.get("type", "Unknown"),
                "embedding": _score_vector(s.get("scores", {})),
                "fingerprint": s.get("fingerprint_48bit", ""),
                "cluster": s.get("cluster", 0),
                "era": attrs.get("era"),
            }
        )
    lattice = {
        "entities": lattice_entities,
        "clusters": summary.get("n_clusters", 0),
        "embedding_dim": 4,
        "embedding_fields": ["anomaly", "composite", "diversity", "reconstruction"],
        "seed": 42,
    }
    p_lat = out_dir / "lattice.json"
    write_json(p_lat, round_floats(lattice))
    add_file(entry, p_lat, "output", "BTUT lattice (consumed by LATK populator)")

    sample_query = {
        "query": "material innovation from 1980",
        "expected_top_types": ["Material", "Concept"],
        "run_command": "python -c \"from app.services.btut.pipeline import run_btut_pipeline; ...\"",
    }
    p_q = out_dir / "sample_query.json"
    write_json(p_q, sample_query)
    add_file(entry, p_q, "query", "Example query users can run against a real lattice")

    add_interact(entry, "Read pipeline summary", "Read", "data/samples/btut/pipeline_summary.json")
    add_interact(entry, "Read survivor bundle", "Read", "data/samples/btut/survivor_bundle.json")
    add_interact(
        entry,
        "Grep for Material entities",
        "Grep",
        args={"pattern": '"type": "Material"', "path": "data/samples/btut"},
    )
    return entry
