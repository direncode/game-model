"""Baseline ablation: BTUT stratified selection vs uniform random subsampling.

The G42 / Mubadala technical diligence question is: does BTUT's
40-50x reduction preserve query routing fidelity better than the
trivial baseline of uniform random subsampling at the same reduction
ratio?

For each lattice we measure:

  1. **Random baseline**: draw N_survivors entities uniformly at random
     from the full source corpus; use those as a mock lattice.
  2. **BTUT actual**: use the v2 BTUT survivor set already on disk.
  3. For a fixed set of probe queries, rank both mock lattices by
     8D Euclidean distance (full pipeline embed + random_project)
     and count how many probe-specific 'target' entities appear
     in the top-K.

Probe definition
----------------
For each lattice we hand-pick 3-5 probes whose expected targets are
*known to exist in the source corpus*. The scoring is: how many
probe-target pairs survive the reduction and still route correctly
under 8D nearest neighbor?

For an honest baseline:
  - Random baseline: survivor set drawn at the same size as BTUT's.
  - Sampled 5 times to get a mean + std, because random is noisy.

This is the simplest ablation that answers "does BTUT's stratified
selection + clustering beat trivial sampling at query routing?".

Run::

    PYTHONPATH=backend:scripts/cross_era_analysis python \\
        scripts/cross_era_analysis/latk_tool/benchmarks/baseline_vs_btut.py
"""

from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[4]
BACKEND_DIR = REPO_ROOT / "backend"
CEA_DIR = REPO_ROOT / "scripts" / "cross_era_analysis"
for p in (BACKEND_DIR, CEA_DIR):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from app.services.btut.config import BTUTConfig  # noqa: E402
from app.services.btut.embedder import EntityEmbedder  # noqa: E402
from app.services.btut.streaming import random_project  # noqa: E402
from latk_tool.fingerprint_core import EMBED_8D, load_lattice_v2  # noqa: E402


@dataclass
class Probe:
    query: str
    target_keywords: List[str]  # case-insensitive substring match on entity_name


@dataclass
class BenchResult:
    lattice_name: str
    source_entities: int
    btut_survivors: int
    probes: int
    btut_top_k_hits: int
    btut_max_possible: int
    random_baseline_mean: float
    random_baseline_std: float
    btut_vs_random_advantage: float  # (btut - random_mean) / max(1, random_mean)


LATTICES = [
    {
        "name": "linguistics",
        "corpus_file": "linguistics_corpus.json",
        "lattice_file": "linguistics_btut_result_v2.json",
        "probes": [
            Probe(
                query="In language there are only differences and no positive terms; "
                      "each linguistic value is determined by opposition to all others",
                target_keywords=["saussure", "port_royal", "chomsky", "humboldt"],
            ),
            Probe(
                query="Recursive generative grammar with phrase-structure rules "
                      "producing an infinite set of well-formed sentences",
                target_keywords=["chomsky", "generative", "phrase_structure"],
            ),
            Probe(
                query="Distributional hypothesis word meaning context co-occurrence "
                      "statistics across large corpora",
                target_keywords=["distributional", "firth", "harris"],
            ),
            Probe(
                query="Sanskrit morphology sutra-based analysis of word formation "
                      "by Panini",
                target_keywords=["panini", "sanskrit", "patanjali"],
            ),
        ],
    },
    {
        "name": "heterogeneous",
        "corpus_file": "heterogeneous_corpus.json",
        "lattice_file": "heterogeneous_btut_result_v2.json",
        "probes": [
            Probe(
                query="Zenneck surface wave propagation at the air-ground interface "
                      "with boundary-condition coupling for wireless power transfer",
                target_keywords=["zenneck", "surface_wave", "corum"],
            ),
            Probe(
                query="Shannon information theory entropy channel capacity noisy "
                      "channel coding",
                target_keywords=["shannon", "info_", "entropy"],
            ),
            Probe(
                query="Tesla wireless electrical energy transmission through earth "
                      "and atmosphere via resonant circuits",
                target_keywords=["tesla", "1119732", "645576", "649621", "wireless"],
            ),
            Probe(
                query="Lattice-based post-quantum cryptography learning with errors",
                target_keywords=["lattice", "crypto", "lwe"],
            ),
        ],
    },
    {
        "name": "polymath",
        "corpus_file": "polymath_corpus.json",
        "lattice_file": "polymath_btut_result_v2.json",
        "probes": [
            Probe(
                query="Newton's theory of colors and prismatic decomposition of "
                      "white light as described in the Opticks",
                target_keywords=["newton", "optics", "opticks", "prism"],
            ),
            Probe(
                query="Leonardo anatomical drawings showing circulatory and "
                      "muscular systems of the human body",
                target_keywords=["leonardo", "anatomy", "circulatory"],
            ),
            Probe(
                query="Von Neumann cellular automata self-reproducing machines "
                      "universal computation",
                target_keywords=["vn_", "von_neumann", "cellular_automata"],
            ),
            Probe(
                query="Newton's alchemical writings on the philosopher's stone "
                      "and transmutation of metals",
                target_keywords=["newton", "alchemy", "alchemical"],
            ),
        ],
    },
    {
        "name": "latk_mini",
        "corpus_file": "latk_mini_corpus.json",
        "lattice_file": "latk_mini_btut_result_v2.json",
        "probes": [
            Probe(
                query="Saussure structural linguistics differential value "
                      "signifier signified arbitrary sign",
                target_keywords=["saussure", "structural", "chomsky", "humboldt"],
            ),
            Probe(
                query="Zenneck surface wave boundary coupling for wireless power "
                      "transfer through the earth",
                target_keywords=["zenneck", "surface_wave", "tesla", "corum"],
            ),
            Probe(
                query="Newton calculus fluxions method of tangents and infinite "
                      "series",
                target_keywords=["newton", "calculus", "fluxions", "principia"],
            ),
            Probe(
                query="Diffie Hellman key exchange asymmetric public key "
                      "cryptography",
                target_keywords=["diffie", "hellman", "crypto", "asymmetric"],
            ),
        ],
    },
    {
        "name": "physics_50k_arxiv",
        "corpus_file": "latk_physics_corpus.json",
        "lattice_file": "latk_physics_btut_result_v2.json",
        "probes": [
            Probe(
                query="Heisenberg uncertainty principle position momentum quantum "
                      "mechanics commutator observables",
                target_keywords=["quant_ph", "hep_th"],
            ),
            Probe(
                query="Einstein general relativity spacetime curvature metric "
                      "tensor geodesic test particle",
                target_keywords=["gr_qc", "astro_ph", "hep_th"],
            ),
            Probe(
                query="Dirac relativistic wave equation fermions spinor "
                      "antiparticle negative energy solutions",
                target_keywords=["quant_ph", "hep_th", "cond_mat_quant_gas"],
            ),
            Probe(
                query="Boltzmann statistical mechanics entropy partition function "
                      "phase transitions lattice models",
                target_keywords=["cond_mat", "stat_mech", "physics_soc_ph"],
            ),
            Probe(
                query="Feynman path integral sum over histories perturbative "
                      "scattering diagrams",
                target_keywords=["hep_th", "hep_ph", "quant_ph"],
            ),
        ],
    },
]


def embed_entities_to_8d(entities: List[dict], edges: List[dict]) -> np.ndarray:
    """Run the pipeline's text-level embedder on an arbitrary entity list.

    This is a standalone copy of the embed + random_project step from the
    BTUT pipeline. Keeps the same seeds so embeddings live in a comparable
    geometric space to the v2 lattices.
    """
    config = BTUTConfig.auto_scale(len(entities), 50.0)
    embedder = EntityEmbedder(config)
    emb_32d = embedder.embed(entities, edges)
    emb_8d = random_project(emb_32d, EMBED_8D, seed=42)
    return emb_8d


def rank_by_8d(query_8d: np.ndarray, survivor_emb: np.ndarray, top_k: int) -> List[int]:
    diffs = survivor_emb - query_8d[None, :]
    dists = np.sqrt(np.einsum("ij,ij->i", diffs, diffs))
    order = np.argsort(dists)
    return list(order[:top_k])


def embed_single_query(query_text: str, corpus_entities: List[dict], corpus_edges: List[dict]) -> np.ndarray:
    """Embed a single text query by appending it to the corpus as entity n+1.

    This is the most faithful way to place a query into the lattice geometric
    space: the same embedder, same random projection seeds, same everything,
    just with the query as one extra entity. Returns the query's 8D row.
    """
    q_entity = {"name": "__query__", "type": "_query_", "attributes": {"text": query_text}}
    all_entities = corpus_entities + [q_entity]
    emb_8d = embed_entities_to_8d(all_entities, corpus_edges)
    return emb_8d[-1]


def bench_lattice(cfg: dict, n_random_trials: int = 5, top_k: int = 20) -> BenchResult:
    print(f"\n=== benchmarking {cfg['name']} ===")
    corpus_path = CEA_DIR / "output" / cfg["corpus_file"]
    lattice_path = CEA_DIR / "output" / cfg["lattice_file"]

    with corpus_path.open("r", encoding="utf-8") as fp:
        corpus = json.load(fp)
    entities = corpus["entities"]
    edges = corpus.get("relationships", corpus.get("edges", []))

    v2 = load_lattice_v2(lattice_path)
    assert v2.has_v2, f"{cfg['name']} is not v2 format"

    print(f"  source entities : {len(entities)}")
    print(f"  BTUT survivors  : {v2.size}")
    print(f"  reduction       : {len(entities) // v2.size}x")
    print(f"  probes          : {len(cfg['probes'])}")

    # Embed all corpus entities ONCE so we can slice the full embedding matrix
    # for random sub-samples. Plus the queries together in one pass at the end.
    t0 = time.time()
    n_ent = len(entities)
    query_entities = [
        {"name": f"__query_{i}__", "type": "_query_", "attributes": {"text": p.query}}
        for i, p in enumerate(cfg["probes"])
    ]
    combined = entities + query_entities
    combined_emb_8d = embed_entities_to_8d(combined, edges)
    full_emb = combined_emb_8d[:n_ent]  # (n_ent, 8) corpus
    query_emb = combined_emb_8d[n_ent:]  # (n_probes, 8) queries
    print(f"  embed time      : {time.time() - t0:.2f}s")

    # For each probe, count how many target_keyword-matching entities
    # appear in top-K of:
    #   A. BTUT survivor 8D embeddings (already persisted in v2.embeddings_8d)
    #   B. Random subsample of the full corpus, same size as BTUT survivors

    def count_hits(query_8d: np.ndarray, pool_emb: np.ndarray, pool_names: List[str], keywords: List[str]) -> int:
        top_indices = rank_by_8d(query_8d, pool_emb, top_k)
        hits = 0
        for i in top_indices:
            name_lower = pool_names[i].lower()
            if any(kw in name_lower for kw in keywords):
                hits += 1
        return hits

    # --- BTUT condition ---
    assert v2.embeddings_8d is not None
    btut_emb = v2.embeddings_8d
    btut_names = [s.entity_name for s in v2.survivors]

    btut_hits_by_probe = []
    for i, probe in enumerate(cfg["probes"]):
        q8d = query_emb[i]
        h = count_hits(q8d, btut_emb, btut_names, probe.target_keywords)
        btut_hits_by_probe.append(h)
    btut_total = sum(btut_hits_by_probe)
    btut_max_possible = len(cfg["probes"]) * top_k

    print(f"  BTUT per-probe  : {btut_hits_by_probe} (sum={btut_total} / max={btut_max_possible})")

    # --- Random baseline ---
    entity_names = [e.get("name", f"ent_{i}") for i, e in enumerate(entities)]
    rng_master = np.random.RandomState(12345)
    random_hits_trials = []
    for trial in range(n_random_trials):
        seed = rng_master.randint(0, 2**31 - 1)
        rng = np.random.RandomState(seed)
        sample_idx = rng.choice(n_ent, v2.size, replace=False)
        rand_emb = full_emb[sample_idx]
        rand_names = [entity_names[i] for i in sample_idx]
        trial_hits = 0
        for i, probe in enumerate(cfg["probes"]):
            q8d = query_emb[i]
            trial_hits += count_hits(q8d, rand_emb, rand_names, probe.target_keywords)
        random_hits_trials.append(trial_hits)
    rand_mean = float(np.mean(random_hits_trials))
    rand_std = float(np.std(random_hits_trials))
    print(f"  random baseline: mean={rand_mean:.2f} std={rand_std:.2f} trials={random_hits_trials}")

    advantage = (btut_total - rand_mean) / max(1.0, rand_mean)

    return BenchResult(
        lattice_name=cfg["name"],
        source_entities=n_ent,
        btut_survivors=v2.size,
        probes=len(cfg["probes"]),
        btut_top_k_hits=btut_total,
        btut_max_possible=btut_max_possible,
        random_baseline_mean=rand_mean,
        random_baseline_std=rand_std,
        btut_vs_random_advantage=advantage,
    )


def main() -> None:
    print("=" * 72)
    print("LATK BTUT vs Random Baseline Ablation")
    print(f"Repo: {REPO_ROOT}")
    print("=" * 72)

    results: List[BenchResult] = []
    for cfg in LATTICES:
        r = bench_lattice(cfg, n_random_trials=5, top_k=20)
        results.append(r)

    print("\n" + "=" * 72)
    print("SUMMARY")
    print("=" * 72)
    print(
        f"{'lattice':<18} {'source':>8} {'survivors':>10} "
        f"{'BTUT hits':>10} {'random mean':>12} {'advantage':>12}"
    )
    for r in results:
        print(
            f"{r.lattice_name:<18} {r.source_entities:>8} {r.btut_survivors:>10} "
            f"{r.btut_top_k_hits:>10} {r.random_baseline_mean:>12.2f} "
            f"{100 * r.btut_vs_random_advantage:>11.1f}%"
        )

    # Save JSON report
    report = {
        "run_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "results": [
            {
                "lattice": r.lattice_name,
                "source_entities": r.source_entities,
                "btut_survivors": r.btut_survivors,
                "probes": r.probes,
                "btut_top_k_hits": r.btut_top_k_hits,
                "btut_max_possible": r.btut_max_possible,
                "random_baseline_mean": round(r.random_baseline_mean, 3),
                "random_baseline_std": round(r.random_baseline_std, 3),
                "btut_vs_random_advantage_pct": round(100 * r.btut_vs_random_advantage, 1),
            }
            for r in results
        ],
    }
    report_path = CEA_DIR / "output" / "baseline_vs_btut_report.json"
    with report_path.open("w", encoding="utf-8") as fp:
        json.dump(report, fp, indent=2)
    print(f"\nReport saved: {report_path}")


if __name__ == "__main__":
    main()
