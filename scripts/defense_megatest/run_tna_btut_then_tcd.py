"""Run BTUT pre-reduction + TCD-JEPA recursive loop on the bombe TNA corpus.

Adapts scripts/defense_megatest/run_btut_then_tcd.py for *text* records.
The TNA NDJSON shape (paper_id, archive=HW-series-label, primary_category,
text) requires text->vector conversion before BTUT/TCD can consume it.

Stage 0: TF-IDF on the .text field -> stratified-by-archive sample of N
         records (or all if N >= corpus size) -> JL random projection
         -> L2-normalized D-dim embedding.
Stage 1: BTUT pre-reduction on the embedded vectors (treating each
         record's projection components as numeric attributes).
         Optional via --skip-btut.
Stage 2: TCD-JEPA recursive loop on the survivors.
Stage 3: Per-module alignment vs HW series labels (the "gold" for cluster
         purity scoring), plus plain-English narrative.

Per-module narratives surface:
  - dominant HW series in 50 nearest neighbors
  - cross-series bleed (% of NN that belong to a different series)
  - H_0 persistence + centroid stats

Usage:
  python -m scripts.defense_megatest.run_tna_btut_then_tcd \\
      --corpus tmp/bombe_tna.ndjson --target 500 --skip-btut
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

import numpy as np  # noqa: E402
import torch  # noqa: E402
from sklearn.feature_extraction.text import TfidfVectorizer  # noqa: E402

from tcd_jepa.core.recursive_loop import RecursiveLoop  # noqa: E402


def load_corpus(path: Path) -> list[dict]:
    out = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def stratified_sample(records: list[dict], target: int, seed: int = 42) -> list[dict]:
    """Take up to `target` records, balanced across archive labels."""
    if target >= len(records):
        return records
    by_arc: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        by_arc[r.get("archive", "?")].append(r)
    rng = np.random.default_rng(seed)
    for arc in by_arc:
        rng.shuffle(by_arc[arc])
    archives = sorted(by_arc.keys())
    out: list[dict] = []
    idx = 0
    while len(out) < target:
        progressed = False
        for arc in archives:
            recs = by_arc[arc]
            if idx < len(recs):
                out.append(recs[idx])
                progressed = True
                if len(out) >= target:
                    break
        if not progressed:
            break
        idx += 1
    return out


def embed_corpus(records: list[dict], embed_dim: int, seed: int = 42) -> np.ndarray:
    """TF-IDF over the `text` field -> JL projection to embed_dim -> L2 normalize."""
    texts = [r.get("text", "") or r.get("title", "") for r in records]
    vec = TfidfVectorizer(
        max_features=10_000, ngram_range=(1, 2), min_df=2, max_df=0.85,
        stop_words="english", lowercase=True, sublinear_tf=True,
        token_pattern=r"(?u)\b[a-z][a-z'-]+\b",
    )
    X = vec.fit_transform(texts).astype(np.float32).toarray()
    rng = np.random.default_rng(seed)
    proj = rng.standard_normal((X.shape[1], embed_dim)).astype(np.float32) / np.sqrt(embed_dim)
    Z = X @ proj
    Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8)
    return Z


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", required=True, type=Path)
    ap.add_argument("--target", type=int, default=500)
    ap.add_argument("--embed-dim", type=int, default=128)
    ap.add_argument("--iters", type=int, default=16)
    ap.add_argument("--max-modules", type=int, default=24)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--output", type=Path,
                    default=REPO_ROOT / "data" / "validation" / "tna_btut_then_tcd.json")
    ap.add_argument("--skip-btut", action="store_true",
                    help="Skip BTUT pre-reduction (recommended for first text run; "
                         "BTUT's structural fingerprinter assumes diverse numeric attributes "
                         "and may degenerate on TF-IDF projections).")
    args = ap.parse_args()

    print("=" * 78)
    print("STAGE 0 — load corpus, stratify, TF-IDF -> JL embedding")
    print("=" * 78)
    records = load_corpus(args.corpus)
    print(f"  loaded: {len(records)} records from {args.corpus}")
    sample = stratified_sample(records, args.target, args.seed)
    print(f"  stratified sample: {len(sample)}")

    t0 = time.perf_counter()
    Z = embed_corpus(sample, args.embed_dim, args.seed)
    embed_wall = time.perf_counter() - t0
    print(f"  embedding shape: {Z.shape}  ({embed_wall:.2f}s)")

    archives = [r.get("archive", "?") for r in sample]
    primary_cats = [r.get("primary_category", "?") for r in sample]
    archive_counts = Counter(archives)
    print(f"  archives: {len(archive_counts)} distinct, top 5: {archive_counts.most_common(5)}")

    if not args.skip_btut:
        print()
        print("=" * 78)
        print("STAGE 1 — BTUT pre-reduction on embedded vectors")
        print("=" * 78)
        try:
            from backend.engine.reduce.pipeline import run_btut_pipeline
            entities = []
            for i, (rec, vec) in enumerate(zip(sample, Z)):
                entities.append({
                    "name": rec["paper_id"],
                    "type": rec.get("archive", "?"),
                    "attributes": {f"d{j:03d}": float(vec[j]) for j in range(min(32, len(vec)))},
                })
            unique_types = sorted(set(archives))
            t0 = time.perf_counter()
            btut = run_btut_pipeline(
                entities=entities, edges=[], unique_types=unique_types,
                target_survivors=min(300, len(sample) // 2), budget_dollars=10.0,
            )
            btut_wall = time.perf_counter() - t0
            survivors = btut["survivors"]
            survivor_names = {s["entity"]["name"] for s in survivors}
            keep_idx = [i for i, r in enumerate(sample) if r["paper_id"] in survivor_names]
            Z_keep = Z[keep_idx]
            sample_keep = [sample[i] for i in keep_idx]
            archives_keep = [archives[i] for i in keep_idx]
            primary_cats_keep = [primary_cats[i] for i in keep_idx]
            print(f"  BTUT wall: {btut_wall:.2f}s")
            print(f"  output: {len(survivors)} survivors ({btut['summary']['reduction']}x reduction)")
        except Exception as e:
            print(f"  BTUT failed: {type(e).__name__}: {e}")
            print("  Continuing without BTUT (skip_btut implied by failure).")
            Z_keep, sample_keep, archives_keep, primary_cats_keep = Z, sample, archives, primary_cats
    else:
        Z_keep, sample_keep, archives_keep, primary_cats_keep = Z, sample, archives, primary_cats
        print("\n[skipping BTUT pre-reduction; running TCD on full embedded sample]")

    print()
    print("=" * 78)
    print("STAGE 2 — TCD recursive loop")
    print("=" * 78)
    z = torch.from_numpy(Z_keep).float()
    print(f"  TCD input: {tuple(z.shape)}")

    # Energy: distance to corpus centroid (mode-seeking, no label dependence).
    centroid = z.mean(dim=0).detach()

    def energy_fn(zq):
        return (zq - centroid).pow(2).sum(dim=-1)

    torch.manual_seed(args.seed)
    loop = RecursiveLoop(
        embed_dim=args.embed_dim,
        explore_every=1,
        crystallize_every=2,
        langevin_steps=30,
        max_modules=args.max_modules,
        device=torch.device("cpu"),
    )

    t0 = time.perf_counter()
    all_modules: list[dict] = []
    for ep in range(args.iters):
        ep_t0 = time.perf_counter()
        r = loop.step(z, energy_fn, epoch=ep)
        ep_wall = time.perf_counter() - ep_t0
        if r.get("crystallized"):
            for mid, mod, fts in r.get("new_module_objects", []):
                rec = loop.crystallizer.registry._modules.get(mid)
                feat = rec.feature if rec else None
                info = {
                    "iteration": r["iteration"],
                    "module_id": str(mid),
                    "module_class": mod.__class__.__name__,
                    "module_type": str(fts),
                    "topology": {
                        "homology_dim": int(feat.dim) if feat else None,
                        "birth": round(float(feat.birth), 4) if feat else None,
                        "death": round(float(feat.death), 4) if feat else None,
                        "persistence": round(float(feat.persistence), 4) if feat else None,
                    } if feat else None,
                }
                if hasattr(mod, "centroid"):
                    c = mod.centroid.detach().numpy()
                    info["centroid_stats"] = {
                        "mean":  round(float(np.mean(c)), 4),
                        "std":   round(float(np.std(c)), 4),
                        "norm":  round(float(np.linalg.norm(c)), 4),
                        "dim":   int(c.shape[0]),
                    }
                all_modules.append(info)
        print(f"  iter {ep+1:2d}: cryst={r.get('crystallized', False)} mods={loop.num_modules} {ep_wall:.2f}s")
    tcd_wall = time.perf_counter() - t0

    print()
    print("=" * 78)
    print("STAGE 3 — per-module alignment vs HW series + narrative")
    print("=" * 78)
    z_np = Z_keep
    archives_arr = np.array(archives_keep)
    primary_arr = np.array(primary_cats_keep)
    titles_arr = np.array([r.get("title", "")[:80] for r in sample_keep])
    paper_arr = np.array([r["paper_id"] for r in sample_keep])
    k_nn = min(50, len(sample_keep))

    for module_info in all_modules:
        mid = module_info["module_id"]
        rec = loop.crystallizer.registry._modules.get(mid)
        if rec is None or not hasattr(rec.module, "centroid"):
            continue
        centroid_np = rec.module.centroid.detach().numpy()
        dists = np.linalg.norm(z_np - centroid_np, axis=1)
        nn_idx = np.argsort(dists)[:k_nn]
        nn_archives = archives_arr[nn_idx]
        nn_primary = primary_arr[nn_idx]
        nn_titles = titles_arr[nn_idx]
        nn_papers = paper_arr[nn_idx]
        sc = Counter(nn_archives.tolist())
        top3 = sc.most_common(3)
        dom_archive, dom_n = top3[0] if top3 else ("?", 0)
        dom_share = dom_n / k_nn
        bleed_share = sum(c for a, c in sc.items() if a != dom_archive) / k_nn
        module_info["alignment"] = {
            "k_nearest":         k_nn,
            "dominant_archive":  dom_archive,
            "dominant_share":    round(dom_share, 3),
            "bleed_share":       round(bleed_share, 3),
            "top3_archives":     [{"archive": a, "count": c, "share": round(c / k_nn, 3)}
                                  for a, c in top3],
            "primary_cat_dist":  dict(Counter(nn_primary.tolist())),
            "sample_titles":     [{"paper_id": str(p), "archive": str(a), "title": str(t)}
                                  for p, a, t in zip(nn_papers[:5], nn_archives[:5], nn_titles[:5])],
        }
        # narrative
        if dom_share >= 0.85:
            head = (f"**{mid}** — pure-{dom_archive} basin: {int(100*dom_share)}% of "
                    f"50 nearest records are HW {nn_primary[0]}-style. ")
        elif dom_share >= 0.50:
            head = (f"**{mid}** — {dom_archive}-dominant basin ({int(100*dom_share)}%) with "
                    f"{int(100*bleed_share)}% bleed from other series. ")
        else:
            head = (f"**{mid}** — mixed basin: top archive {dom_archive} "
                    f"({int(100*dom_share)}%), heavy cross-series bleed "
                    f"({int(100*bleed_share)}%). ")
        nbr = ", ".join(f"{a}:{c}" for a, c in top3)
        topo = (f"H₀ persistence {module_info['topology']['persistence']:.2f} | "
                f"centroid norm {module_info['centroid_stats']['norm']:.3f}.")
        module_info["narrative"] = head + f"Top-3 archives among 50 NN: {nbr}. " + topo

    out = {
        "generated_at":     time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "pipeline":         "TF-IDF -> JL projection -> "
                            + ("BTUT -> " if not args.skip_btut else "")
                            + "TCD recursive loop (CPU)",
        "config": {
            "corpus":         str(args.corpus),
            "target_records": args.target,
            "embed_dim":      args.embed_dim,
            "iterations":     args.iters,
            "max_modules":    args.max_modules,
            "skip_btut":      bool(args.skip_btut),
            "seed":           args.seed,
        },
        "stage0_embed": {
            "input_records":  len(records),
            "sampled":        len(sample),
            "embedding_dim":  args.embed_dim,
            "wall_seconds":   round(embed_wall, 3),
        },
        "stage2_tcd": {
            "input_records":         len(sample_keep),
            "iterations":            args.iters,
            "modules_formed":        len(all_modules),
            "modules_active_final":  loop.num_modules,
            "wall_seconds":          round(tcd_wall, 3),
            "device":                "cpu",
        },
        "modules_formed": all_modules,
        "archive_distribution_in_input": dict(archive_counts),
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
    print(f"\n[tna+tcd] artifact: {args.output}")
    print()
    print("=== PER-MODULE NARRATIVES ===")
    print()
    for m in all_modules:
        print(m.get("narrative", "(no narrative)"))
        print()
        print("-" * 78)
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
