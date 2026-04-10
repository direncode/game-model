"""Build the LATK-mini corpus: merge all validated domain corpora.

Merges the five validated domain corpora from the cross-era detection
investigation into a single ~8000-entity heterogeneous corpus. This
is the Phase 0 scaling test input: if BTUT's Tesla medium-resolution
signature replicates on this merged corpus, the architecture is
proven to scale past the single-domain regime, which is the
precondition for Phase 1.

Sources merged:
    - linguistics_corpus.json (894 entities, 9 regimes)
    - polymath_corpus.json (3714 entities, Newton + Leonardo + vN)
    - heterogeneous_corpus.json (1851 entities, Tesla wireless)

Output:
    scripts/cross_era_analysis/output/latk_mini_corpus.json

Usage:
    python scripts/cross_era_analysis/latk_tool/scale/build_latk_mini_corpus.py
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Dict, List


SOURCES = [
    ("linguistics", "scripts/cross_era_analysis/output/linguistics_corpus.json"),
    ("polymath", "scripts/cross_era_analysis/output/polymath_corpus.json"),
    ("heterogeneous", "scripts/cross_era_analysis/output/heterogeneous_corpus.json"),
]

OUTPUT = "scripts/cross_era_analysis/output/latk_mini_corpus.json"

# Unify the two chunk sub-types so BTUT sees a consistent `chunk` type
# across all domains. This preserves heterogeneity (6 types total) while
# not artificially inflating the type count.
TYPE_NORMALIZATION = {
    "document_chunk": "chunk",
    "patent_chunk": "chunk",
}


def _normalize_type(t: str) -> str:
    return TYPE_NORMALIZATION.get(t, t)


def _prefixed_name(name: str, domain: str) -> str:
    return f"latk_{domain}__{name}" if not name.startswith(f"latk_{domain}__") else name


def _load(path: str) -> Dict:
    with Path(path).open("r", encoding="utf-8") as fp:
        return json.load(fp)


def _merge_entity(
    ent: Dict,
    domain: str,
    seen_names: Dict[str, str],
) -> Dict:
    out = copy.deepcopy(ent)
    original_name = out.get("name", "")
    new_name = _prefixed_name(original_name, domain)
    out["name"] = new_name
    out["type"] = _normalize_type(out.get("type", "unknown"))

    attrs = out.setdefault("attributes", {})
    attrs["latk_domain"] = domain
    attrs["original_name"] = original_name

    seen_names[original_name] = new_name
    return out


def _merge_edge(
    edge: Dict,
    domain: str,
    seen_names: Dict[str, str],
) -> Dict:
    out = copy.deepcopy(edge)
    src = out.get("source", out.get("from", ""))
    dst = out.get("target", out.get("to", ""))
    if src in seen_names:
        new_src = seen_names[src]
    else:
        new_src = _prefixed_name(src, domain)
    if dst in seen_names:
        new_dst = seen_names[dst]
    else:
        new_dst = _prefixed_name(dst, domain)

    if "source" in out:
        out["source"] = new_src
    if "from" in out:
        out["from"] = new_src
    if "target" in out:
        out["target"] = new_dst
    if "to" in out:
        out["to"] = new_dst
    return out


def build_latk_mini() -> Dict:
    all_entities: List[Dict] = []
    all_edges: List[Dict] = []
    per_domain_counts: Dict[str, Dict[str, int]] = {}
    type_counts: Dict[str, int] = {}

    for domain, src_path in SOURCES:
        try:
            data = _load(src_path)
        except FileNotFoundError:
            print(f"  [skip] {domain}: {src_path} not found")
            continue

        entities = data.get("entities", [])
        edges = data.get("relationships", data.get("edges", []))

        seen_names: Dict[str, str] = {}
        dom_types: Dict[str, int] = {}

        for ent in entities:
            merged = _merge_entity(ent, domain, seen_names)
            all_entities.append(merged)
            t = merged["type"]
            type_counts[t] = type_counts.get(t, 0) + 1
            dom_types[t] = dom_types.get(t, 0) + 1

        for edge in edges:
            all_edges.append(_merge_edge(edge, domain, seen_names))

        per_domain_counts[domain] = {
            "entities": len(entities),
            "edges": len(edges),
            "types": dom_types,
        }
        print(
            f"  [merge] {domain}: +{len(entities)} entities, +{len(edges)} edges, "
            f"types={dom_types}"
        )

    corpus = {
        "name": "latk_mini",
        "description": (
            "LATK Phase 0 scaling test corpus: merges linguistics, polymath, "
            "and heterogeneous wireless corpora into a single heterogeneous "
            "cross-domain BTUT input."
        ),
        "entities": all_entities,
        "relationships": all_edges,
        "metadata": {
            "sources": [d for d, _ in SOURCES],
            "per_domain_counts": per_domain_counts,
            "type_counts": type_counts,
            "total_entities": len(all_entities),
            "total_edges": len(all_edges),
            "n_types": len(type_counts),
        },
    }
    return corpus


def main() -> None:
    print("Building LATK-mini scaling test corpus...")
    corpus = build_latk_mini()

    out_path = Path(OUTPUT)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fp:
        json.dump(corpus, fp, indent=2)

    meta = corpus["metadata"]
    print()
    print(f"LATK-mini corpus built: {out_path}")
    print(f"  Total entities: {meta['total_entities']}")
    print(f"  Total edges: {meta['total_edges']}")
    print(f"  Entity types ({meta['n_types']}): {meta['type_counts']}")
    print(f"  Per domain: {meta['per_domain_counts']}")


if __name__ == "__main__":
    main()
