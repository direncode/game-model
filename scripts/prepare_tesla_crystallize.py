"""Transform BTUT convergent export → Latent Intelligence upload format.

Reads btut_tesla_convergent_export.json (416 survivors) and produces:
1. tesla_upload.json — entities + relationships ready for the awakening pipeline
2. Prints stats about what was extracted
"""

import json
import sys
from collections import Counter
from pathlib import Path


def transform_convergent_export(input_path: str, output_path: str) -> dict:
    """Convert convergent metadata to LI upload format."""
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    items = data["convergent_metadata"]
    print(f"Loaded {len(items)} convergent survivors from {data['dataset']}")

    entities = []
    relationships = []
    entity_names = set()

    for item in items:
        key = item["entity_key"]
        analysis = item["analysis"]
        lineage = item["lineage"]

        # Build entity
        entity = {
            "name": key,
            "type": analysis.get("entity_type", "unknown"),
            # Flatten scores + lattice into attributes
            "composite_score": analysis["scores"]["composite"],
            "diversity_score": analysis["scores"]["diversity"],
            "reconstruction_score": analysis["scores"]["reconstruction"],
            "anomaly_score": analysis["scores"]["anomaly"],
            "anomaly_story": analysis.get("anomaly_story", ""),
        }

        # Add lattice profile
        lp = analysis.get("lattice_profile", {})
        if lp:
            entity["flip_rate"] = lp.get("flip_rate", 0)
            entity["fingerprint_48bit"] = lp.get("fingerprint_48bit", "")
            entity["total_flips"] = lp.get("total_flips", 0)

        # Add original attributes
        attrs = analysis.get("attributes", {})
        if isinstance(attrs, dict):
            for k, v in attrs.items():
                if k not in entity and isinstance(v, (str, int, float, bool)):
                    entity[k] = v

        # Add metadata
        meta = analysis.get("metadata", {})
        if isinstance(meta, dict):
            for k, v in meta.items():
                if k not in entity and isinstance(v, (str, int, float, bool)):
                    entity[k] = v

        entities.append(entity)
        entity_names.add(key)

        # Extract relationships from lineage peer_survivors
        peers = lineage.get("peer_survivors", [])
        for peer in peers:
            peer_name = peer.get("name", "") if isinstance(peer, dict) else str(peer)
            if peer_name and peer_name != key:
                relationships.append({
                    "source": key,
                    "target": peer_name,
                    "type": "peer_survivor",
                    "weight": 0.8,
                })

        # Extract cluster relationships
        cluster = analysis.get("cluster", {})
        if isinstance(cluster, dict):
            cluster_peers = cluster.get("peers", [])
            for cp in cluster_peers[:5]:  # Top 5 cluster peers
                cp_name = cp.get("name", "") if isinstance(cp, dict) else str(cp)
                if cp_name and cp_name != key and cp_name in entity_names:
                    relationships.append({
                        "source": key,
                        "target": cp_name,
                        "type": "cluster_peer",
                        "weight": 0.7,
                    })

    # Deduplicate relationships
    seen_edges = set()
    deduped = []
    for rel in relationships:
        edge_key = (rel["source"], rel["target"], rel["type"])
        reverse_key = (rel["target"], rel["source"], rel["type"])
        if edge_key not in seen_edges and reverse_key not in seen_edges:
            seen_edges.add(edge_key)
            deduped.append(rel)

    # Filter relationships to only include entities that exist
    valid_edges = [r for r in deduped if r["source"] in entity_names and r["target"] in entity_names]

    output = {
        "entities": entities,
        "relationships": valid_edges,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    # Stats
    types = Counter(e["type"] for e in entities)
    rel_types = Counter(r["type"] for r in valid_edges)

    print(f"\nOutput: {output_path}")
    print(f"  Entities: {len(entities)}")
    print(f"  Relationships: {len(valid_edges)}")
    print(f"\n  Entity types: {dict(types)}")
    print(f"  Relationship types: {dict(rel_types)}")
    print(f"  File size: {Path(output_path).stat().st_size / 1024:.1f} KB")

    return {"entity_count": len(entities), "edge_count": len(valid_edges)}


if __name__ == "__main__":
    input_path = sys.argv[1] if len(sys.argv) > 1 else "C:/Users/diren/Downloads/btut_tesla_convergent_export.json"
    output_path = sys.argv[2] if len(sys.argv) > 2 else "C:/Users/diren/Desktop/lsx-latentocean/scripts/tesla_upload.json"
    transform_convergent_export(input_path, output_path)
