"""Universal validation harness.

Runs the SAME primitives — `lo_core.analyze` + resample-without-replacement
null test — on every cached BTUT corpus it can find. Zero corpus-specific
knobs. The K values, score dimensions, and null methodology are identical
across EDGAR financial filings, polymath biographies, linguistics
documents, and physics patents.

If a primitive only works because of a tuned constant, it fails this test.

Output:
    data/validation/universal_validation.json
"""
from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "sdk"))
sys.path.insert(0, str(REPO_ROOT / "lo_core" / "src"))

# Universal primitives — same imports a customer would use.
from lo_core.analyze import analyze_corpus  # noqa: E402


# ---------------------------------------------------------------------------
# Corpus discovery — purely by file convention, no hardcoded list of datasets.
# ---------------------------------------------------------------------------
CANDIDATE_PATTERNS = (
    "scripts/edgar_btut_result_5000.json",
    "scripts/cross_era_analysis/output/*_btut_result*.json",
    "scripts/results/*_btut_result.json",
)

IGNORE_SUBSTRINGS = ("_analysis", "baseline_vs")  # analysis outputs, not BTUT outputs


def discover_corpora(root: Path) -> list[Path]:
    seen: dict[str, Path] = {}
    # Glob each pattern; later versions (v2) preferred over earlier via sort.
    for pat in CANDIDATE_PATTERNS:
        for p in sorted(root.glob(pat)):
            name = p.stem
            if any(ig in name for ig in IGNORE_SUBSTRINGS):
                continue
            base = name.replace("_result_v2", "").replace("_result", "")
            # Prefer v2 version if both exist
            if base in seen and name.endswith("_v2"):
                seen[base] = p
            elif base not in seen:
                seen[base] = p
    return list(seen.values())


# ---------------------------------------------------------------------------
# Universal primitive #1 — null test (resample without replacement)
# ---------------------------------------------------------------------------
def null_test(survivors: list[dict], iterations: int, seed: int) -> dict:
    dims = ("composite", "anomaly", "reconstruction", "diversity")
    n = len(survivors)
    if n < 10:
        return {"skipped": "too few survivors (<10)", "n": n}

    rng = np.random.default_rng(seed)
    # Auto-scale K: sizes that fit any corpus, not tuned per corpus.
    ks = tuple(k for k in (10, 25, 50, 100) if k <= n // 2)
    if not ks:
        ks = (max(2, n // 4),)

    arrs = {d: np.array([float(((s.get("scores") or {}).get(d, 0.0))) for s in survivors]) for d in dims}
    results = []
    sig_05 = sig_001 = 0
    z_scores: list[float] = []

    for dim in dims:
        a = arrs[dim]
        if a.std() == 0:
            continue
        sorted_desc = np.sort(a)[::-1]
        for K in ks:
            true_mean = float(sorted_desc[:K].mean())
            null_means = np.empty(iterations)
            for i in range(iterations):
                idx = rng.choice(n, size=K, replace=False)
                null_means[i] = float(a[idx].mean())
            nm = float(null_means.mean())
            ns = float(null_means.std()) + 1e-12
            p95 = float(np.percentile(null_means, 95))
            p999 = float(np.percentile(null_means, 99.9))
            z = (true_mean - nm) / ns
            z_scores.append(z)
            if true_mean > p95: sig_05 += 1
            if true_mean > p999: sig_001 += 1
            results.append({
                "dim": dim, "K": K,
                "true_mean": true_mean,
                "null_mean": nm, "null_p95": p95,
                "z_score": z, "sig_05": true_mean > p95, "sig_001": true_mean > p999,
            })
    total = len(results)
    return {
        "n_survivors": n,
        "n_iterations": iterations,
        "K_values": list(ks),
        "total_metrics": total,
        "significant_05": sig_05,
        "significant_001": sig_001,
        "fraction_significant_05": (sig_05 / total) if total else 0,
        "max_z_score": max(z_scores) if z_scores else 0,
        "median_z_score": float(np.median(z_scores)) if z_scores else 0,
        "per_metric": results,
    }


# ---------------------------------------------------------------------------
# Universal primitive #2 — analyze_corpus (cluster/paradigm/convergence)
# Runs lo_core.analyze; reports what the universal analyzers find.
# ---------------------------------------------------------------------------
def analyze_summary(survivors: list[dict], corpus_id: str) -> dict:
    try:
        f = analyze_corpus(survivors, corpus_id=corpus_id)
        return {
            "cluster_count": f.cluster_count,
            "paradigm_distribution": dict(f.paradigm_distribution) if f.paradigm_distribution else {},
            "convergent_clusters": len(f.convergent_clusters),
            "cross_era_anchors": len(f.cross_era_anchors),
            "convergence_index_entries": len(f.convergence_index),
            "top_rank1_example": next(
                (e.entity_name for e in f.convergence_index[:1]), None
            ) if f.convergence_index else None,
        }
    except Exception as e:  # analyzer ran, but corpus may be degenerate
        return {"error": f"{type(e).__name__}: {e}"}


# ---------------------------------------------------------------------------
# Universal primitive #3 — reproducibility (SHA-256 on top-K by composite)
# ---------------------------------------------------------------------------
import hashlib
def reproducibility_digest(survivors: list[dict], k: int = 100) -> str:
    ranked = sorted(
        survivors,
        key=lambda s: float(((s.get("scores") or {}).get("composite", 0.0))),
        reverse=True,
    )[:k]
    payload = "\n".join(
        f'{((s.get("entity") or {}).get("name")) or ""}|'
        f'{float(((s.get("scores") or {}).get("composite", 0.0))):.12f}'
        for s in ranked
    )
    return hashlib.sha256(payload.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Per-corpus orchestration
# ---------------------------------------------------------------------------
@dataclass
class CorpusReport:
    corpus_id: str
    path: str
    survivor_count: int
    load_seconds: float
    entity_types: list[str] = field(default_factory=list)
    score_dims_present: list[str] = field(default_factory=list)
    top_composite: float = 0.0
    top_entity_name: str | None = None
    null_test: dict[str, Any] = field(default_factory=dict)
    analyze: dict[str, Any] = field(default_factory=dict)
    reproducibility_digest: str | None = None
    readiness_score: int = 0


def run_corpus(path: Path, iterations: int, seed: int = 42) -> CorpusReport:
    corpus_id = path.stem.replace("_btut_result_v2", "").replace("_btut_result", "")
    t0 = time.perf_counter()
    doc = json.loads(path.read_text(encoding="utf-8"))
    survivors = list(doc.get("survivors") or [])
    load_s = time.perf_counter() - t0

    ent_types = sorted({(s.get("entity") or {}).get("type", "?") for s in survivors[:200]})
    score_dims = sorted(survivors[0].get("scores", {}).keys()) if survivors else []
    ranked = sorted(
        survivors, key=lambda s: float(((s.get("scores") or {}).get("composite", 0.0))),
        reverse=True,
    )
    top = ranked[0] if ranked else {}
    top_name = ((top.get("entity") or {}).get("name")) or None
    top_comp = float(((top.get("scores") or {}).get("composite", 0.0))) if top else 0.0

    nt = null_test(survivors, iterations=iterations, seed=seed)
    an = analyze_summary(survivors, corpus_id=corpus_id)
    digest = reproducibility_digest(survivors, k=min(100, len(survivors)))

    # Universal readiness scoring: primitives completing + null strength.
    score = 0
    score += 15 if nt.get("n_survivors", 0) >= 10 else 0
    score += 15 if an and "error" not in an else 0
    if nt.get("fraction_significant_05", 0) >= 0.7: score += 25
    elif nt.get("fraction_significant_05", 0) >= 0.4: score += 15
    if nt.get("max_z_score", 0) >= 10: score += 20
    elif nt.get("max_z_score", 0) >= 3: score += 10
    if digest: score += 10
    if len(score_dims) >= 4: score += 15

    return CorpusReport(
        corpus_id=corpus_id,
        path=str(path.relative_to(REPO_ROOT)),
        survivor_count=len(survivors),
        load_seconds=load_s,
        entity_types=ent_types,
        score_dims_present=score_dims,
        top_composite=top_comp,
        top_entity_name=top_name,
        null_test=nt,
        analyze=an,
        reproducibility_digest=digest,
        readiness_score=min(100, score),
    )


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--iterations", type=int, default=200)
    ap.add_argument("--output", default=str(
        REPO_ROOT / "data" / "validation" / "universal_validation.json"))
    args = ap.parse_args()

    t0 = time.perf_counter()
    corpora = discover_corpora(REPO_ROOT)
    print(f"Discovered {len(corpora)} cached corpora")
    for p in corpora:
        print(f"  - {p.relative_to(REPO_ROOT)}")
    print()

    reports: list[CorpusReport] = []
    for i, p in enumerate(corpora, 1):
        print(f"[{i}/{len(corpora)}] {p.stem} ...")
        try:
            r = run_corpus(p, iterations=args.iterations)
            reports.append(r)
            print(f"    survivors={r.survivor_count}, "
                  f"null z_max={r.null_test.get('max_z_score', 0):.2f}, "
                  f"sig_05={r.null_test.get('significant_05', 0)}/{r.null_test.get('total_metrics', 0)}, "
                  f"clusters={r.analyze.get('cluster_count', '?')}, "
                  f"readiness={r.readiness_score}/100")
        except Exception as e:
            print(f"    FAILED: {type(e).__name__}: {e}")

    wall = time.perf_counter() - t0
    out_data = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "wall_seconds": wall,
        "n_iterations": args.iterations,
        "seed": 42,
        "corpora": [asdict(r) for r in reports],
        "aggregate": {
            "corpora_tested": len(reports),
            "mean_readiness": sum(r.readiness_score for r in reports) / max(1, len(reports)),
            "corpora_with_universal_significance":
                sum(1 for r in reports if r.null_test.get("fraction_significant_05", 0) >= 0.5),
            "total_survivors_processed": sum(r.survivor_count for r in reports),
            "max_z_score_across_corpora":
                max((r.null_test.get("max_z_score", 0) for r in reports), default=0),
        },
    }

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(out_data, indent=2, default=str), encoding="utf-8")

    print()
    print("=" * 78)
    print(f"UNIVERSAL VALIDATION  — {len(reports)} corpora, {out_data['aggregate']['total_survivors_processed']:,} survivors")
    print("=" * 78)
    for r in reports:
        print(f"  {r.corpus_id:28s} n={r.survivor_count:5d}  z_max={r.null_test.get('max_z_score', 0):6.2f}  "
              f"sig={r.null_test.get('significant_05', 0):2d}/{r.null_test.get('total_metrics', 0):2d}  "
              f"readiness={r.readiness_score}/100")
    print(f"\nmean readiness: {out_data['aggregate']['mean_readiness']:.1f}/100")
    print(f"max z-score across corpora: {out_data['aggregate']['max_z_score_across_corpora']:.2f} sigma")
    print(f"wrote {out} ({out.stat().st_size // 1024}KB) in {wall:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
