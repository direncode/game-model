"""LATK: novelty + ancestor routing over the BTUT-produced lattice.

Hard dependency on BTUT: if `data/samples/btut/lattice.json` is missing,
mark skipped with skip_reason='btut_prerequisite_failed'.

The BTUT sample uses a 4D "score vector" (anomaly, composite, diversity,
reconstruction) as each entity's embedding — cosine similarity still works.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from sample_data._common import (
    ManifestEntry,
    SAMPLES_ROOT,
    add_file,
    add_interact,
    round_floats,
    write_json,
)


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(x * x for x in b)) or 1.0
    return dot / (na * nb)


def run(out_dir: Path) -> ManifestEntry:
    entry = ManifestEntry(name="latk", mode="real")

    lattice_path = SAMPLES_ROOT / "btut" / "lattice.json"
    if not lattice_path.exists():
        entry.status = "skipped"
        entry.mode = "skipped"
        entry.skip_reason = "btut_prerequisite_failed"
        return entry

    lattice = json.loads(lattice_path.read_text(encoding="utf-8"))
    entities = lattice.get("entities", [])
    emb_dim = int(lattice.get("embedding_dim", 4))

    # Query vector: emphasize "diversity" and "composite" axes.
    query_emb = [0.3, 0.9, 0.8, 0.5][:emb_dim]
    scored: list[dict] = []
    for e in entities:
        emb = e.get("embedding") or []
        if len(emb) != emb_dim:
            continue
        scored.append(
            {
                "name": e.get("name"),
                "type": e.get("type"),
                "era": e.get("era"),
                "similarity": _cosine(query_emb, emb),
                "fingerprint": e.get("fingerprint"),
            }
        )
    scored.sort(key=lambda r: r["similarity"], reverse=True)

    top_k = min(5, len(scored))
    novelty = {
        "query": "high-diversity, high-composite signal",
        "query_embedding": query_emb,
        "top_matches": round_floats(scored[:top_k]),
        "match_count": len(scored),
        "novelty_score": round_floats(
            1.0 - (scored[0]["similarity"] if scored else 0.0), 6
        ),
    }
    p_nov = out_dir / "novelty_report.json"
    write_json(p_nov, novelty)
    add_file(entry, p_nov, "output", "Novelty report over BTUT lattice")

    ancestors = [s for s in scored if (s.get("era") or 2100) < 1980][:top_k]
    p_anc = out_dir / "ancestor_routing.json"
    write_json(
        p_anc,
        round_floats(
            {
                "query": novelty["query"],
                "ancestors": ancestors,
                "ancestor_count": len(ancestors),
            }
        ),
    )
    add_file(entry, p_anc, "output", "Top historical ancestors (era < 1980)")

    p_reg = out_dir / "lattice_registry.json"
    write_json(
        p_reg,
        {
            "available": [
                {
                    "id": "btut_sample",
                    "path": "data/samples/btut/lattice.json",
                    "entity_count": len(entities),
                    "embedding_dim": emb_dim,
                }
            ]
        },
    )
    add_file(entry, p_reg, "metadata", "Registry of lattices consumable by LATK")

    add_interact(entry, "Read novelty report", "Read", "data/samples/latk/novelty_report.json")
    add_interact(entry, "Read ancestors", "Read", "data/samples/latk/ancestor_routing.json")
    return entry
