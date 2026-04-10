"""G42 / Mubadala demo script — hits all 6 commercial lattices in one run.

Runs a single concrete query against each of the six commercial corpora,
plus a cross-era research lineage query against the latk_mini research
lattice, and prints the results in a clean terminal format suitable for
a live meeting demo.

Usage::

    python scripts/cross_era_analysis/latk_tool/benchmarks/g42_demo.py
    python scripts/cross_era_analysis/latk_tool/benchmarks/g42_demo.py --base-url http://32.192.140.145

The default base URL is the live public prod endpoint.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Tuple


DEMO_QUERIES = [
    {
        "lattice": "edgar",
        "label": "SEC Edgar -- oil & gas drilling disclosure",
        "query": "offshore drilling rig contracts oil and gas production revenue expenses",
        "top_k": 5,
        "method": "combined",
    },
    {
        "lattice": "edgar",
        "label": "SEC Edgar -- SaaS revenue recognition",
        "query": "software as a service cloud subscription revenue recognition deferred",
        "top_k": 5,
        "method": "combined",
    },
    {
        "lattice": "pubmed",
        "label": "PubMed -- CRISPR immunotherapy",
        "query": "CRISPR Cas9 gene editing immunotherapy checkpoint cancer treatment clinical trial",
        "top_k": 5,
        "method": "combined",
    },
    {
        "lattice": "patents",
        "label": "USPTO Patents -- LLM training",
        "query": "artificial intelligence neural network training large language model attention",
        "top_k": 5,
        "method": "combined",
    },
    {
        "lattice": "comtrade",
        "label": "UN Comtrade -- lithium batteries",
        "query": "lithium ion battery electric vehicle export import trade flow",
        "top_k": 5,
        "method": "combined",
    },
    {
        "lattice": "climate",
        "label": "NOAA Climate -- precipitation anomaly",
        "query": "precipitation temperature anomaly drought station record monthly",
        "top_k": 5,
        "method": "combined",
    },
    {
        "lattice": "physics",
        "label": "arXiv Physics -- Heisenberg uncertainty",
        "query": "Heisenberg uncertainty principle position momentum quantum mechanics commutator",
        "top_k": 5,
        "method": "combined",
    },
    {
        "lattice": "latk_mini",
        "label": "Research dev-set -- Saussure linguistics cross-era lineage",
        "query": "In language there are only differences and no positive terms. Each linguistic value is determined by opposition.",
        "top_k": 5,
        "method": "combined",
    },
]


def post_json(base_url: str, path: str, body: Dict[str, Any], timeout: float = 30.0) -> Tuple[int, float, Any]:
    url = base_url.rstrip("/") + path
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body_out = json.loads(resp.read().decode("utf-8"))
            return resp.status, time.monotonic() - t0, body_out
    except urllib.error.HTTPError as e:
        return e.code, time.monotonic() - t0, {"error": e.read().decode("utf-8", errors="replace")}
    except Exception as e:
        return -1, time.monotonic() - t0, {"error": str(e)}


def get_json(base_url: str, path: str, timeout: float = 10.0) -> Tuple[int, float, Any]:
    url = base_url.rstrip("/") + path
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return resp.status, time.monotonic() - t0, json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return -1, time.monotonic() - t0, {"error": str(e)}


def run_demo(base_url: str) -> int:
    print("=" * 80)
    print(f"  LATK G42 / Mubadala demo  -  {base_url}")
    print("=" * 80)

    # Health
    status, t, body = get_json(base_url, "/api/v1/latk/health")
    if status != 200:
        print(f"[FAIL] /health returned {status}: {body}")
        return 1
    print(f"  /health ({t*1000:.0f}ms): status={body['status']}, {len(body['known_lattices'])} lattices known")

    # Lattices
    status, t, lats = get_json(base_url, "/api/v1/latk/lattices")
    if status != 200:
        print(f"[FAIL] /lattices returned {status}")
        return 1
    v2_lats = [l for l in lats if l.get("has_v2")]
    print(f"  /lattices ({t*1000:.0f}ms): {len(v2_lats)} v2 lattices + {len(lats) - len(v2_lats)} legacy")
    for l in lats:
        if l.get("has_v2"):
            print(f"    v2:     {l['lattice_id']:<22} size={l['size']}")
    for l in lats:
        if not l.get("has_v2") and l.get("exists"):
            print(f"    legacy: {l['lattice_id']:<22} size={l.get('size','?')}")
    print()

    # Queries
    failed = 0
    for qcfg in DEMO_QUERIES:
        print("-" * 80)
        print(f"  [{qcfg['lattice']}] {qcfg['label']}")
        print(f"  query: {qcfg['query'][:70]}{'...' if len(qcfg['query']) > 70 else ''}")

        status, elapsed, body = post_json(
            base_url,
            "/api/v1/latk/novelty",
            {
                "query": qcfg["query"],
                "lattice_id": qcfg["lattice"],
                "top_k": qcfg["top_k"],
                "method": qcfg["method"],
            },
        )

        if status != 200:
            print(f"  [FAIL] status={status} body={body}")
            failed += 1
            continue

        method = body.get("ranking_method", "?")
        novelty = body.get("novelty_score", 0)
        lattice_size = body.get("lattice_size", 0)
        print(
            f"  ({elapsed*1000:.0f}ms) method={method}  lattice_size={lattice_size}  novelty={novelty:.3f}"
        )
        for m in body.get("nearest_entities", [])[: qcfg["top_k"]]:
            etype = m.get("entity_type", "?")
            dist = m.get("distance", 0)
            name = m.get("entity_name", "?")[:58]
            print(f"    {etype:<15} d={dist:7.3f} {name}")
        print()

    print("=" * 80)
    if failed == 0:
        print(f"  ALL {len(DEMO_QUERIES)} DEMO QUERIES PASSED")
    else:
        print(f"  FAILED: {failed}/{len(DEMO_QUERIES)}")
    print("=" * 80)
    return 0 if failed == 0 else 1


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--base-url", default="http://32.192.140.145")
    args = p.parse_args()
    sys.exit(run_demo(args.base_url))


if __name__ == "__main__":
    main()
