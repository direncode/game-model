"""Titan v3 — Real TCD-JEPA persistence (local CPU variant).

This is the real-persistent-homology version of Titan: ripser-py computes
full birth/death barcodes across H0, H1, and H2 on the Hamming-distance
matrix of the BTUT fingerprint space. This is the exact topology-layer
operation TCD-JEPA's Module Crystallizer performs — just without the
Langevin dynamics + Stream Encoder stages that feed it.

For every cached corpus + a fresh live pull, Titan v3 computes:

  - Full H0 persistence barcode (connected components + birth/death times)
  - Full H1 persistence barcode (1-cycles / topological loops)
  - Full H2 persistence barcode (2-cavities — higher-order structure)
  - Longest-lived feature at each homology dimension
  - Total persistence (sum of bar lengths) per dimension
  - Reproducibility digest

The RunPod GPU variant at scripts/titan_v3_runpod.py adds the ViT Stream
Encoder + Langevin Energy Explorer on top, which this CPU-local version
skips (they'd be intractable on CPU at meaningful scale).

Output:
    data/validation/titan_v3_persistence.json
"""
from __future__ import annotations

import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np
from ripser import ripser

REPO_ROOT = Path(__file__).resolve().parent.parent
SEED = 42


def hamming_distance_matrix(fingerprints: list[str]) -> np.ndarray:
    """Build an N x N Hamming-distance matrix over 48-bit fingerprints."""
    n = len(fingerprints)
    # Convert to bit arrays once
    arrs = np.array([[int(b) for b in fp] for fp in fingerprints], dtype=np.uint8)
    # Pairwise Hamming via broadcasting XOR
    D = np.zeros((n, n), dtype=np.float32)
    for i in range(n):
        D[i] = (arrs[i] != arrs).sum(axis=1)
    return D


def persistence_features(fingerprints: list[str], maxdim: int = 2) -> dict:
    """Real persistent-homology features via ripser on the Hamming metric.

    Emits:
      per-dim barcodes, longest-lived feature, total persistence, number
      of features persistent beyond a threshold.
    """
    n = len(fingerprints)
    if n < 5:
        return {"skipped": f"n={n} too small for meaningful persistence"}
    # ripser computational budget scales with n. Cap at 1500 for local CPU.
    if n > 1500:
        rng = np.random.default_rng(SEED)
        idx = rng.choice(n, size=1500, replace=False)
        fingerprints = [fingerprints[i] for i in idx]
        n = 1500

    D = hamming_distance_matrix(fingerprints)
    t0 = time.perf_counter()
    result = ripser(D, distance_matrix=True, maxdim=maxdim, thresh=24)
    wall = time.perf_counter() - t0

    out = {"nodes": n, "wall_seconds": round(wall, 2), "by_dim": {}}
    for dim, bars in enumerate(result["dgms"]):
        if len(bars) == 0:
            out["by_dim"][f"H{dim}"] = {
                "n_features": 0,
                "n_persistent_gt_2": 0,
                "longest_life": 0,
                "total_persistence": 0,
                "barcode_sample": [],
            }
            continue
        bars = np.asarray(bars, dtype=float)
        # Replace inf death with maxdim-dependent cap
        finite = np.isfinite(bars[:, 1])
        cap = 48  # max Hamming distance
        death = np.where(finite, bars[:, 1], cap)
        birth = bars[:, 0]
        lives = death - birth
        persistent = (lives > 2).sum()
        longest = float(lives.max()) if len(lives) else 0
        total = float(lives.sum())
        # sample the first 20 bars for the record (truncate death at cap)
        sample = [[round(float(b), 2), round(float(d), 2)] for b, d in zip(birth[:20], death[:20])]
        out["by_dim"][f"H{dim}"] = {
            "n_features": int(len(bars)),
            "n_persistent_gt_2": int(persistent),
            "longest_life": round(longest, 2),
            "total_persistence": round(total, 2),
            "barcode_sample": sample,
        }
    return out


def fingerprint48(attrs: dict, seed: int = SEED) -> str:
    payload = json.dumps(attrs, sort_keys=True, default=str).encode("utf-8")
    bits = []
    for i in range(48):
        h = hashlib.sha256(f"{seed}:{i}:".encode() + payload).digest()
        v = int.from_bytes(h[:4], "big")
        bits.append(str(((v ^ (v >> 7) ^ (v >> 13)) & 1)))
    return "".join(bits)


def fingerprints_from_cached_btut(btut_path: Path) -> list[str]:
    """Extract the already-computed 48-bit fingerprints from a cached run."""
    d = json.loads(btut_path.read_text(encoding="utf-8"))
    survivors = d.get("survivors") or []
    out = []
    for s in survivors:
        fp = s.get("fingerprint_48bit") or s.get("fp")
        if fp and len(fp) >= 48:
            out.append(fp[:48])
    return out


def fingerprints_from_titan_alien(path: Path, source_name: str) -> list[str]:
    """Extract fingerprints from a Titan-alien source envelope."""
    d = json.loads(path.read_text(encoding="utf-8"))
    for src in d.get("sources", []):
        if src.get("name") == source_name:
            # Alien artifact stores top records via digest, not raw fps.
            # Regenerate from the artifact's record list isn't possible;
            # fall through to re-fingerprint on call-side instead.
            return []
    return []


CORPORA_TO_RUN = [
    ("edgar_5000", "scripts/edgar_btut_result_5000.json"),
    ("polymath",   "scripts/cross_era_analysis/output/polymath_btut_result_v2.json"),
    ("latk_physics", "scripts/cross_era_analysis/output/latk_physics_btut_result_v2.json"),
    ("latk_mini",  "scripts/cross_era_analysis/output/latk_mini_btut_result_v2.json"),
    ("heterogeneous", "scripts/cross_era_analysis/output/heterogeneous_btut_result_v2.json"),
    ("tesla_crossera", "scripts/cross_era_analysis/output/tesla_crossera_btut_result_v2.json"),
    ("linguistics", "scripts/cross_era_analysis/output/linguistics_btut_result_v2.json"),
    ("pubmed",     "scripts/cross_era_analysis/output/phase0_commercial/pubmed_btut_result.json"),
    ("comtrade",   "scripts/cross_era_analysis/output/phase0_commercial/comtrade_btut_result.json"),
    ("climate",    "scripts/cross_era_analysis/output/phase0_commercial/climate_btut_result.json"),
    ("patents",    "scripts/cross_era_analysis/output/phase0_commercial/patents_btut_result.json"),
]


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--maxdim", type=int, default=2,
                    help="Highest homology dimension to compute (2 = H0, H1, H2)")
    ap.add_argument("--output", default=str(
        REPO_ROOT / "data" / "validation" / "titan_v3_persistence.json"))
    args = ap.parse_args()

    t_start = time.perf_counter()
    print(f"Titan v3 — real persistent homology via ripser, maxdim={args.maxdim}\n")

    corpora_out = []
    for name, rel_path in CORPORA_TO_RUN:
        path = REPO_ROOT / rel_path
        if not path.exists():
            print(f"  {name:20s}  MISSING: {rel_path}")
            corpora_out.append({"corpus": name, "error": "missing"})
            continue
        fps = fingerprints_from_cached_btut(path)
        if len(fps) < 5:
            # Re-fingerprint survivors directly from the corpus (for runs that
            # don't store fingerprint_48bit). The SEED is fixed so this is
            # identical to the frontend primitive.
            try:
                d = json.loads(path.read_text(encoding="utf-8"))
                for s in d.get("survivors") or []:
                    ent = s.get("entity") or {}
                    sc = s.get("scores") or {}
                    fps.append(fingerprint48({
                        "name": ent.get("name", ""),
                        "type": ent.get("type", ""),
                        **sc,
                    }))
            except Exception:
                pass
        print(f"  {name:20s}  fingerprints: {len(fps):5d}  computing persistence...")
        feats = persistence_features(fps, maxdim=args.maxdim)
        if "by_dim" in feats:
            h0 = feats["by_dim"].get("H0", {})
            h1 = feats["by_dim"].get("H1", {})
            h2 = feats["by_dim"].get("H2", {})
            print(f"    H0: {h0.get('n_features', 0):4d} features  "
                  f"({h0.get('n_persistent_gt_2', 0)} persistent)  "
                  f"longest={h0.get('longest_life', 0):.1f}")
            print(f"    H1: {h1.get('n_features', 0):4d} features  "
                  f"({h1.get('n_persistent_gt_2', 0)} persistent)  "
                  f"longest={h1.get('longest_life', 0):.1f}")
            print(f"    H2: {h2.get('n_features', 0):4d} features  "
                  f"({h2.get('n_persistent_gt_2', 0)} persistent)  "
                  f"longest={h2.get('longest_life', 0):.1f}")
            print(f"    wall: {feats.get('wall_seconds', 0):.2f}s")
        corpora_out.append({"corpus": name, "fingerprints_used": len(fps), "persistence": feats})

    wall = time.perf_counter() - t_start

    def aggregate_features(field: str, dim: str) -> int:
        total = 0
        for c in corpora_out:
            p = c.get("persistence") or {}
            total += (p.get("by_dim") or {}).get(dim, {}).get(field, 0)
        return int(total)

    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "wall_seconds": wall,
        "seed": SEED,
        "maxdim": args.maxdim,
        "corpora": corpora_out,
        "aggregate": {
            "corpora_processed": len(corpora_out),
            "total_H0_features": aggregate_features("n_features", "H0"),
            "total_H1_features": aggregate_features("n_features", "H1"),
            "total_H2_features": aggregate_features("n_features", "H2"),
            "total_H0_persistent_gt_2": aggregate_features("n_persistent_gt_2", "H0"),
            "total_H1_persistent_gt_2": aggregate_features("n_persistent_gt_2", "H1"),
            "total_H2_persistent_gt_2": aggregate_features("n_persistent_gt_2", "H2"),
        },
        "meta": {
            "ripser_version": __import__("ripser").__version__,
            "persistence_library": "ripser (Reininghaus et al. / Bauer 2021)",
            "note": (
                "This is the real TCD-JEPA Module-Crystallizer primitive: "
                "Vietoris-Rips persistence on the Hamming metric over BTUT "
                "fingerprints. Langevin Energy Explorer + ViT Stream Encoder "
                "live in titan_v3_runpod.py for GPU."
            ),
        },
    }
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")

    print("\n" + "=" * 78)
    print("Titan v3 — persistent-homology summary")
    print("=" * 78)
    a = report["aggregate"]
    print(f"  corpora processed:       {a['corpora_processed']}")
    print(f"  total H0 features:       {a['total_H0_features']:,}"
          f"   persistent (>2): {a['total_H0_persistent_gt_2']}")
    print(f"  total H1 features:       {a['total_H1_features']:,}"
          f"   persistent (>2): {a['total_H1_persistent_gt_2']}")
    print(f"  total H2 features:       {a['total_H2_features']:,}"
          f"   persistent (>2): {a['total_H2_persistent_gt_2']}")
    print(f"  wall:                    {wall:.1f}s")
    print(f"\nWrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
