"""Generate real SEC EDGAR reduction for the landing page Live Demo.

Fetches real public companies from EDGAR, runs the engine reduction,
and exports the result as static JSON consumed by the frontend.

Usage:
    cd backend
    python scripts/generate_sample_data.py --output ../frontend/data/edgar-sample.json
"""
from __future__ import annotations
import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from engine import EngineConfig, LatentOceanEngine
from app.services.btut.adapters.edgar import EdgarAdapter

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def generate(output_path: Path, limit: int = 500, budget_dollars: float = 50.0) -> None:
    logger.info("Fetching %d entities from SEC EDGAR...", limit)
    adapter = EdgarAdapter()
    entities = adapter.fetch_entities(limit=limit)
    edges = adapter.fetch_edges(entities)
    types = sorted({e.get("type", "unknown") for e in entities})

    logger.info("Fetched %d entities, %d edges, types=%s", len(entities), len(edges), types)

    logger.info("Running engine reduction (budget=$%.2f)...", budget_dollars)
    engine = LatentOceanEngine(EngineConfig(
        budget_dollars=budget_dollars,
        target_survivors=150,
        compute_3d_display=True,
    ))
    reduction = engine.reduce(entities, edges, types)
    manifold = engine.represent(reduction)

    # Shape for frontend consumption
    survivors_out = []
    for i, s in enumerate(reduction.survivors):
        entity = s.get("entity", {})
        scores = s.get("scores", {})
        survivors_out.append({
            "id": entity.get("name", f"entity_{i}"),
            "name": entity.get("name", ""),
            "type": entity.get("type", ""),
            "attributes": entity.get("attributes", {}),
            "cluster": s.get("cluster", 0),
            "fingerprint": s.get("fingerprint_48bit", ""),
            "scores": {
                "composite": scores.get("composite", 0.0),
                "diversity": scores.get("diversity", 0.0),
                "reconstruction": scores.get("reconstruction", 0.0),
                "anomaly": scores.get("anomaly", 0.0),
            },
            "coord_8d": manifold.coords_8d_unit[i].tolist() if i < len(manifold.coords_8d_unit) else [],
            "coord_3d": (
                manifold.coords_3d_s2[i].tolist()
                if manifold.coords_3d_s2 is not None and i < len(manifold.coords_3d_s2)
                else None
            ),
        })

    anomalies_out = [
        {
            "id": s["id"],
            "name": s["name"],
            "type": s["type"],
            "score": s["scores"]["anomaly"],
            "narrative": f"{s['name']} shows unusual structural position: composite {s['scores']['composite']:.2f}, anomaly {s['scores']['anomaly']:.2f}.",
        }
        for s in survivors_out
        if s["scores"]["anomaly"] > 0.7
    ][:30]

    # Build cluster summaries
    cluster_map: dict[int, list[dict]] = {}
    for s in survivors_out:
        cluster_map.setdefault(s["cluster"], []).append(s)

    clusters_out = [
        {
            "id": cid,
            "member_count": len(members),
            "dominant_type": max({m["type"] for m in members}, key=lambda t: sum(1 for m in members if m["type"] == t)),
            "sample_members": [m["name"] for m in members[:5]],
        }
        for cid, members in sorted(cluster_map.items())
    ]

    out = {
        "metadata": {
            "source": "SEC EDGAR",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "n_input": reduction.summary.get("total_entities", len(entities)),
            "n_survivors": len(survivors_out),
            "n_clusters": len(clusters_out),
            "reduction_ratio": reduction.summary.get("reduction", 1),
            "wall_seconds": reduction.summary.get("wall_seconds", 0),
            "unique_fingerprints": reduction.summary.get("unique_48bit_fingerprints", 0),
        },
        "survivors": survivors_out,
        "anomalies": anomalies_out,
        "clusters": clusters_out,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    logger.info("Wrote %s (%.1f KB)", output_path, output_path.stat().st_size / 1024)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("../frontend/data/edgar-sample.json"))
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--budget", type=float, default=50.0)
    args = parser.parse_args()
    generate(args.output, limit=args.limit, budget_dollars=args.budget)
