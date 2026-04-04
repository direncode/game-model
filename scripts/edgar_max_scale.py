#!/usr/bin/env python3
"""EDGAR Maximum Scale — push BTUT to the absolute limit with real data.

Strategy:
- 10,426 companies (instant, no API)
- 2,000 companies filing metadata (20 filings each = ~40K filings) ~3.5 min
- 1,000 companies XBRL facts (all concepts = ~20K facts) ~1.7 min
- Dense edge graph: SIC + temporal + shared_concept
- Total target: 70K+ real entities
- Tuned threading: quantile binning, 8D projection, 16 rotations, 28+ clusters
- Target: 100-200 diverse survivors

Total time: ~7 minutes (5 min API + 2 min BTUT)
"""

import sys, os, json, time
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, os.path.join(ROOT_DIR, "backend"))
sys.path.insert(0, SCRIPT_DIR)
os.chdir(ROOT_DIR)

from edgar_deep_pull import EdgarThrottler, fetch_all_tickers, process_company


def main():
    print("=" * 70)
    print("EDGAR MAXIMUM SCALE - BTUT PUSHED TO THE LIMIT")
    print("=" * 70)

    wall_start = time.time()
    throttler = EdgarThrottler()
    companies = fetch_all_tickers(throttler)
    if not companies:
        print("ERROR: no tickers")
        return

    total_companies = len(companies)

    # Phase 1: All companies as entities (instant)
    print(f"\nPhase 1: {total_companies} company entities (instant)")
    entities = []
    for comp in companies:
        entities.append({
            "name": f"company_{comp['cik']}",
            "type": "company",
            "attributes": json.dumps({
                "cik": comp["cik"],
                "ticker": comp["ticker"],
                "company_name": comp["name"],
            }),
        })

    # Phase 2: Fetch filings + XBRL (with disk cache)
    n_filing_companies = 2000
    n_xbrl_companies = 1000
    cache_path = os.path.join(SCRIPT_DIR, "edgar_cache.json")

    edges = []
    sic_groups = {}
    concept_groups = {}
    filing_count = 0
    fact_count = 0
    api_time = 0

    if os.path.exists(cache_path):
        print(f"\nPhase 2: Loading cached EDGAR data from {cache_path}")
        t0 = time.time()
        with open(cache_path, "r") as f:
            cache = json.load(f)
        cached_entities = cache["entities"]
        edges = cache["edges"]
        sic_groups = cache["sic_groups"]
        concept_groups = cache["concept_groups"]
        entities.extend(cached_entities)
        filing_count = sum(1 for e in cached_entities if e["type"] == "filing")
        fact_count = sum(1 for e in cached_entities if e["type"] == "financial_fact")
        api_time = time.time() - t0
        print(f"  Loaded {len(cached_entities):,} cached entities, {len(edges):,} edges in {api_time:.1f}s")
    else:
        est_api_time = (n_filing_companies + n_xbrl_companies) * 0.11
        print(f"\nPhase 2: Fetching {n_filing_companies} companies' filings + {n_xbrl_companies} XBRL")
        print(f"  Estimated: {est_api_time:.0f}s ({est_api_time/60:.1f} min)")
        print(f"  Will cache to: {cache_path}")

        cached_entities = []
        api_start = time.time()

        for i in range(n_filing_companies):
            comp = companies[i]
            fetch_xbrl = (i < n_xbrl_companies)

            ents, edgs, sic = process_company(comp, throttler, 20, fetch_xbrl)
            entities.extend(ents)
            cached_entities.extend(ents)
            edges.extend(edgs)

            if sic:
                sic_groups.setdefault(sic, []).append(f"company_{comp['cik']}")

            for e in ents:
                if e["type"] == "filing":
                    filing_count += 1
                elif e["type"] == "financial_fact":
                    fact_count += 1
                    attrs = json.loads(e.get("attributes", "{}"))
                    concept = attrs.get("concept", "")
                    cik = attrs.get("company_cik", "")
                    if concept and cik:
                        concept_groups.setdefault(concept, []).append(f"company_{cik}")

            elapsed = time.time() - api_start
            if i % 200 == 0 or (i < 100 and i % 50 == 0):
                rate = (i + 1) / max(elapsed, 0.1)
                remaining = (n_filing_companies - i - 1) / max(rate, 0.01)
                print(
                    f"  [{i+1:>5}/{n_filing_companies}] "
                    f"{len(entities):>7} entities | "
                    f"{filing_count:>6} filings | "
                    f"{fact_count:>6} facts | "
                    f"{len(edges):>7} edges | "
                    f"{rate:.1f}/sec | "
                    f"~{remaining/60:.1f}m left"
                )

        api_time = time.time() - api_start

        # Save cache
        print(f"\n  Saving cache ({len(cached_entities):,} entities)...")
        with open(cache_path, "w") as f:
            json.dump({
                "entities": cached_entities,
                "edges": edges,
                "sic_groups": sic_groups,
                "concept_groups": concept_groups,
            }, f)
        print(f"  Cached to {cache_path}")

    # Phase 3: Dense edge graph
    print(f"\nPhase 3: Building dense edge graph...")

    # SIC industry edges
    industry_edges = 0
    for sic, members in sic_groups.items():
        for i in range(min(len(members), 40)):
            for j in range(i + 1, min(len(members), 40)):
                edges.append({
                    "source": members[i], "target": members[j],
                    "type": "same_sic", "weight": 0.7,
                })
                industry_edges += 1
    print(f"  SIC edges: {industry_edges} from {len(sic_groups)} codes")

    # Shared concept edges
    concept_edges = 0
    for concept, members in concept_groups.items():
        unique = list(set(members))
        for i in range(min(len(unique), 30)):
            for j in range(i + 1, min(len(unique), 30)):
                edges.append({
                    "source": unique[i], "target": unique[j],
                    "type": "shared_concept", "weight": 0.5,
                })
                concept_edges += 1
    print(f"  Concept edges: {concept_edges} from {len(concept_groups)} concepts")

    # Summary
    type_counts = {}
    for e in entities:
        t = e["type"]
        type_counts[t] = type_counts.get(t, 0) + 1
    edge_type_counts = {}
    for e in edges:
        t = e["type"]
        edge_type_counts[t] = edge_type_counts.get(t, 0) + 1

    print(f"\n{'=' * 70}")
    print(f"EDGAR GRAPH: {len(entities):,} entities, {len(edges):,} edges")
    print(f"{'=' * 70}")
    for t, c in sorted(type_counts.items()):
        print(f"  {t}: {c:,}")
    for t, c in sorted(edge_type_counts.items()):
        print(f"  {t}: {c:,}")
    print(f"  API time: {api_time:.0f}s ({api_time/60:.1f} min)")

    # Phase 4: BTUT with tuned parameters
    print(f"\n{'=' * 70}")
    print(f"BTUT PIPELINE - TUNED THREADING")
    print(f"{'=' * 70}")

    from app.services.btut.config import BTUTConfig
    from app.services.btut.embedder import EntityEmbedder
    from app.services.btut.dedup import PreFilter
    from app.services.btut.streaming import random_project
    from app.services.btut.threading import LatticeThreader, ThreadingConfig
    from app.services.btut.magnitude import MagnitudeParser

    config = BTUTConfig.auto_scale(len(entities), 50)

    # PreFilter
    t0 = time.time()
    prefilter = PreFilter(config)
    filtered, _ = prefilter.run(entities)
    pf_time = time.time() - t0
    print(f"\nPreFilter: {len(entities):,} -> {len(filtered):,} ({pf_time:.1f}s)")
    print(f"  Bloom dedup: {prefilter.bloom.duplicate_count:,}")

    # Embed
    t0 = time.time()
    embedder = EntityEmbedder(config)
    embeddings_32d = embedder.embed(filtered, edges)
    emb_time = time.time() - t0
    print(f"Embedding: {embeddings_32d.shape} ({emb_time:.1f}s)")

    # Project to 8D
    embeddings_8d = random_project(embeddings_32d, 8, seed=42)
    print(f"Projected: -> {embeddings_8d.shape}")

    # Tuned threading: quantile binning
    n, d = embeddings_8d.shape
    rng = np.random.RandomState(42)

    # Per-dimension ranks
    ranks = np.zeros_like(embeddings_8d)
    for dim in range(d):
        order = np.argsort(embeddings_8d[:, dim])
        ranks[order, dim] = np.linspace(0, 1, n)

    n_rotations = 16
    base_resolution = 8
    base_cells = np.floor(ranks * (base_resolution - 1)).astype(np.int32)

    t0 = time.time()
    trajectory_matrix = np.zeros((n, n_rotations), dtype=np.uint8)
    rotated_cells_list = []
    rotated_embeddings_list = []
    flip_rates = []

    threader = LatticeThreader(ThreadingConfig())

    for k in range(n_rotations):
        res_jitter = rng.randint(max(3, base_resolution - 3), base_resolution + 4, size=d)
        n_dims_use = rng.randint(5, d + 1)
        dim_mask = np.zeros(d, dtype=bool)
        dim_mask[rng.choice(d, n_dims_use, replace=False)] = True

        noise = rng.uniform(-0.5 / base_resolution, 0.5 / base_resolution, size=(n, d))
        jittered_ranks = np.clip(ranks + noise, 0, 1)

        rotated_cells = np.zeros_like(base_cells)
        for dim in range(d):
            if dim_mask[dim]:
                rotated_cells[:, dim] = np.floor(jittered_ranks[:, dim] * (res_jitter[dim] - 1)).astype(np.int32)
            else:
                rotated_cells[:, dim] = 0

        rotated_cells_list.append(rotated_cells)

        perm = rng.permutation(d)
        rotated_emb = embeddings_8d[:, perm] + noise * 0.1
        rotated_embeddings_list.append(rotated_emb)

        base_masked = base_cells.copy()
        base_masked[:, ~dim_mask] = 0
        flips = (base_masked != rotated_cells).any(axis=1)
        trajectory_matrix[:, k] = flips.astype(np.uint8)
        flip_rates.append(float(flips.mean()))

    thread_time = time.time() - t0

    fingerprints_set = set()
    for i in range(n):
        fingerprints_set.add(trajectory_matrix[i].tobytes())

    print(f"\nThreading ({thread_time:.1f}s):")
    print(f"  Flip rates: min={min(flip_rates):.3f}, max={max(flip_rates):.3f}, mean={np.mean(flip_rates):.3f}")
    print(f"  Unique fingerprints: {len(fingerprints_set)}")

    # Cluster
    tc = ThreadingConfig()
    tc.min_thread_size = 3
    micro_clusters = threader._cluster_by_fingerprint(trajectory_matrix, embeddings_8d, base_resolution)
    threader._score_threads(micro_clusters, embeddings_8d)

    sorted_clusters = sorted(micro_clusters, key=lambda c: c.size, reverse=True)
    print(f"  Micro-clusters: {len(micro_clusters)}")
    for ci, mc in enumerate(sorted_clusters[:15]):
        fp_str = "".join(str(x) for x in mc.fingerprint[:16])
        print(f"    #{ci}: {mc.size:>6} members | stability={mc.stability_score:.3f} | fp={fp_str}")

    # Magnitude
    t0 = time.time()
    base_center = embeddings_8d.mean(axis=0)
    base_norms = np.linalg.norm(embeddings_8d - base_center, axis=1)
    sigma_est = np.std(base_norms) + 1e-8
    base_densities = np.exp(-base_norms**2 / (2 * sigma_est**2))

    tc.magnitude_enabled = True
    tc.magnitude_max_refinements = 3
    parser = MagnitudeParser.from_threading_config(tc)
    mag_result = parser.run(
        embeddings=embeddings_8d,
        rotated_embeddings_list=rotated_embeddings_list,
        base_cells=base_cells,
        rotated_cells_list=rotated_cells_list,
        micro_clusters=micro_clusters,
        base_densities=base_densities,
    )
    mag_time = time.time() - t0

    tags = mag_result.tags
    class_counts = {}
    for t_tag in tags:
        class_counts[t_tag.magnitude_class] = class_counts.get(t_tag.magnitude_class, 0) + 1
    print(f"\n  Magnitude ({mag_time:.1f}s):")
    print(f"    Classes: {class_counts}")
    print(f"    Splits: {mag_result.n_splits}")
    print(f"    Final clusters: {len(mag_result.refined_clusters)}")

    final_clusters = mag_result.refined_clusters if mag_result.refined_clusters else micro_clusters

    # Select survivors: diverse per-cluster representatives
    kept_indices = set()
    target_survivors = 150
    target_per_cluster = max(3, target_survivors // max(len(final_clusters), 1))

    for mc in final_clusters:
        if mc.size < 2 or mc.stability_score < 0.1:
            continue
        members = mc.member_indices
        if mc.centroid is not None:
            dists = np.sum((embeddings_8d[members] - mc.centroid)**2, axis=1)
            sorted_members = [members[j] for j in np.argsort(dists)]
            for idx in sorted_members[:target_per_cluster]:
                kept_indices.add(idx)

        # Also add most dynamic members
        if mc.size >= 5:
            member_tags = [(idx, tags[idx]) for idx in members if idx < len(tags)]
            member_tags.sort(key=lambda x: -x[1].stability)
            for idx, _ in member_tags[:2]:
                kept_indices.add(idx)

    # Add anchors (never-flipped entities)
    anchor_count = 0
    for k_extra in range(4):
        res_j = rng.randint(max(3, base_resolution - 2), base_resolution + 3, size=d)
        noise_a = rng.uniform(-0.3 / base_resolution, 0.3 / base_resolution, size=(n, d))
        jr = np.clip(ranks + noise_a, 0, 1)
        anchor_cells = np.zeros_like(base_cells)
        for dim in range(d):
            anchor_cells[:, dim] = np.floor(jr[:, dim] * (res_j[dim] - 1)).astype(np.int32)
        flipped = (base_cells != anchor_cells).any(axis=1)
        if k_extra == 0:
            never_flipped = ~flipped
        else:
            never_flipped &= ~flipped
    anchors = np.where(never_flipped)[0].tolist()
    kept_indices.update(anchors[:50])  # Cap anchors at 50
    print(f"  Anchors: {len(anchors)}")

    kept_list = sorted(kept_indices)
    survivors = [filtered[i] for i in kept_list]

    # Final output
    btut_total = pf_time + emb_time + thread_time + mag_time
    wall_total = time.time() - wall_start

    print(f"\n{'=' * 70}")
    print(f"RESULTS: {len(survivors)} SURVIVORS from {len(filtered):,} entities ({len(filtered)//max(len(survivors),1)}x)")
    print(f"{'=' * 70}")

    type_counts_surv = {}
    for ent in survivors:
        t = ent["type"]
        type_counts_surv[t] = type_counts_surv.get(t, 0) + 1
    print(f"\n  Survivor types: {type_counts_surv}")

    # Cluster membership
    cluster_map = {}
    for ci, mc in enumerate(final_clusters):
        for idx in mc.member_indices:
            cluster_map[idx] = (ci, mc)

    # Print survivors grouped by cluster
    survivors_by_cluster = {}
    for idx in kept_list:
        ci_info = cluster_map.get(idx, (-1, None))
        ci_idx = ci_info[0]
        survivors_by_cluster.setdefault(ci_idx, []).append(idx)

    for ci_idx in sorted(survivors_by_cluster.keys()):
        members = survivors_by_cluster[ci_idx]
        mc = cluster_map.get(members[0], (0, None))[1]
        fp_str = "".join(str(x) for x in mc.fingerprint[:16]) if mc else "?"
        mc_size = mc.size if mc else 0
        mc_stab = mc.stability_score if mc else 0

        print(f"\n  --- Cluster {ci_idx} (size={mc_size}, stability={mc_stab:.3f}, fp={fp_str}) ---")

        for idx in members[:10]:  # Cap display at 10 per cluster
            ent = filtered[idx]
            attrs = json.loads(ent.get("attributes", "{}"))
            tag = tags[idx] if idx < len(tags) else None

            name = attrs.get("company_name", attrs.get("description", attrs.get("concept", ent["name"])))[:45]
            ticker = attrs.get("ticker", "")
            etype = ent["type"]
            trajectory = trajectory_matrix[idx]
            flip_count = int(trajectory.sum())
            mag_class = tag.magnitude_class if tag else "?"
            stab = f"{tag.stability:.2f}" if tag else "?"
            is_anchor = idx in set(anchors)

            print(
                f"    {etype:<16} | {name:<45} | "
                f"{'['+ticker+']':<8} | "
                f"flips={flip_count:>2}/{n_rotations} | "
                f"mag={mag_class:<7} stab={stab}"
                f"{' *ANCHOR*' if is_anchor else ''}"
            )

        if len(members) > 10:
            print(f"    ... and {len(members) - 10} more")

    print(f"\n{'=' * 70}")
    print(f"TIMING")
    print(f"{'=' * 70}")
    print(f"  EDGAR API:     {api_time:>7.0f}s ({api_time/60:.1f} min)")
    print(f"  PreFilter:     {pf_time:>7.1f}s")
    print(f"  Embedding:     {emb_time:>7.1f}s")
    print(f"  Threading:     {thread_time:>7.1f}s")
    print(f"  Magnitude:     {mag_time:>7.1f}s")
    print(f"  BTUT total:    {btut_total:>7.1f}s")
    print(f"  Wall clock:    {wall_total:>7.0f}s ({wall_total/60:.1f} min)")

    print(f"\n{'=' * 70}")
    print(f"SCALE ANALYSIS")
    print(f"{'=' * 70}")
    print(f"  Input:         {len(filtered):,} entities")
    print(f"  Clusters:      {len(final_clusters)}")
    print(f"  Survivors:     {len(survivors)}")
    print(f"  Reduction:     {len(filtered)//max(len(survivors),1)}x")
    print(f"  Entity types:  {type_counts_surv}")
    print(f"  Magnitude:     {class_counts}")

    # 3,000 TB extrapolation
    btut_per_entity = btut_total / max(len(filtered), 1)
    cost_per_entity = btut_per_entity * (1.44 / 3600)  # A100 cost
    cost_3000tb = cost_per_entity * 3e9
    print(f"\n  3,000 TB extrapolation:")
    print(f"    BTUT time per entity: {btut_per_entity*1000:.4f} ms")
    print(f"    3B entities time:     {btut_per_entity * 3e9 / 3600:.0f} hours")
    print(f"    3B entities cost:     ${cost_3000tb:.2f}")
    print(f"    At {len(filtered)//max(len(survivors),1)}x reduction: ~{3e9 // max(len(filtered)//max(len(survivors),1), 1):,} survivors")

    # Save
    log_path = os.path.join(SCRIPT_DIR, "edgar_max_result.json")
    survivor_data = []
    for idx in kept_list:
        ent = filtered[idx]
        tag = tags[idx] if idx < len(tags) else None
        ci = cluster_map.get(idx, (-1, None))[0]
        survivor_data.append({
            "entity": ent,
            "cluster": ci,
            "magnitude_class": tag.magnitude_class if tag else None,
            "stability": tag.stability if tag else None,
            "flips": int(trajectory_matrix[idx].sum()),
            "fingerprint": "".join(str(x) for x in trajectory_matrix[idx]),
            "is_anchor": idx in set(anchors),
        })

    with open(log_path, "w") as f:
        json.dump({
            "summary": {
                "total_entities": len(filtered),
                "total_edges": len(edges),
                "clusters": len(final_clusters),
                "survivors": len(survivors),
                "reduction": len(filtered) // max(len(survivors), 1),
                "btut_seconds": round(btut_total, 1),
                "api_seconds": round(api_time, 0),
                "type_counts": type_counts,
                "survivor_types": type_counts_surv,
                "magnitude_classes": class_counts,
            },
            "survivors": survivor_data,
        }, f, indent=2)
    print(f"\nSaved to: {log_path}")

    print(f"\n{'=' * 70}")
    print(f"DONE")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
