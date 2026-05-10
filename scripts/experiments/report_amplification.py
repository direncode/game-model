"""
Read embedder_amplification_local_*.json and BTUT compression frontier
JSON, produce a single human-readable report + a unified campaign JSON
suitable for BENCHMARKS.md.

Usage:
    python scripts/experiments/report_amplification.py
"""
from __future__ import annotations

import glob
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import numpy as np


def load_latest(pattern: str):
    paths = sorted(glob.glob(pattern))
    if not paths:
        return None
    return json.loads(Path(paths[-1]).read_text(encoding="utf-8"))


def per_archive_amplification(amp):
    """Return {archive: {embedder: (mean, std)}} from per-run dispersion data."""
    by_arch_emb = defaultdict(lambda: defaultdict(list))
    for run in amp["runs"]:
        emb = run["embedder"]
        for row in run["dispersion_per_archive"]:
            by_arch_emb[row["archive"]][emb].append(row["self_basin_share"])
    out = {}
    for arch, by_emb in by_arch_emb.items():
        out[arch] = {
            emb: (round(float(np.mean(v)), 4), round(float(np.std(v)), 4))
            for emb, v in by_emb.items()
        }
    return out


def fmt_table(rows, headers):
    widths = [max(len(str(h)), max((len(str(r[i])) for r in rows), default=0))
              for i, h in enumerate(headers)]
    line = "  ".join(h.ljust(widths[i]) for i, h in enumerate(headers))
    sep = "-" * len(line)
    body = "\n".join(
        "  ".join(str(r[i]).ljust(widths[i]) for i in range(len(headers)))
        for r in rows
    )
    return f"{line}\n{sep}\n{body}"


def main():
    amp = load_latest("data/validation/embedder_amplification_local_*.json")
    btut = load_latest("data/validation/btut_compression_frontier_local_*.json")

    print("=" * 80)
    print("AI SUBSTRATE CAMPAIGN — local phase report")
    print("=" * 80)
    print()

    if amp:
        print("[ Test 1 — Embedder Amplification Curve ]")
        print(f"  source: data/validation/embedder_amplification_local_*.json")
        print(f"  corpus: {amp['config']['corpus_path']}")
        print(f"  seeds:  {amp['config']['seeds']}")
        print(f"  pipeline: load -> embed -> kmeans({amp['config']['k_clusters']}) -> "
              f"dispersion (held constant)")
        print()

        rows = []
        for s in amp["summary_by_embedder"]:
            rows.append([
                s["embedder"],
                f"{s['mteb_avg']:.2f}",
                f"{s['params_M']:.0f}M",
                s["n_seeds"],
                f"{s['mean_self_basin_mean']:.4f}",
                f"±{s['mean_self_basin_std']:.4f}",
                f"{s['min_self_basin_mean']:.4f}",
                f"±{s['min_self_basin_std']:.4f}",
            ])
        print(fmt_table(
            rows,
            ["embedder", "MTEB", "params", "seeds",
             "mean", "(std)", "worst-min", "(std)"],
        ))
        print()

        print("[ Test 1 — Per-archive amplification ]")
        per_arch = per_archive_amplification(amp)
        embs = [s["embedder"] for s in amp["summary_by_embedder"]]
        embs.sort(key=lambda e: next(s["mteb_avg"] for s in amp["summary_by_embedder"] if s["embedder"] == e))
        rows = []
        for arch in sorted(per_arch.keys()):
            row = [arch]
            for emb in embs:
                m, s = per_arch[arch].get(emb, (None, None))
                row.append(f"{m:.3f}±{s:.3f}" if m is not None else "—")
            rows.append(row)
        print(fmt_table(rows, ["archive"] + embs))
        print()

        # The headline amplification numbers
        ranked = sorted(amp["summary_by_embedder"], key=lambda s: s["mteb_avg"])
        if len(ranked) >= 2:
            best = ranked[-1]
            worst = ranked[0]
            delta_mean = best["mean_self_basin_mean"] - worst["mean_self_basin_mean"]
            delta_std = worst["mean_self_basin_std"] - best["mean_self_basin_std"]
            print(f"  AMPLIFICATION HEADLINE:")
            print(f"    {worst['embedder']} (MTEB {worst['mteb_avg']}) -> {best['embedder']} (MTEB {best['mteb_avg']})")
            print(f"    mean self_basin: +{delta_mean:.4f} ({delta_mean/max(0.001, worst['mean_self_basin_mean'])*100:+.1f}%)")
            print(f"    std reduction:   {delta_std:+.4f} (lower std = more stable)")

            # check monotonicity
            means = [s["mean_self_basin_mean"] for s in ranked]
            mteb = [s["mteb_avg"] for s in ranked]
            monotonic = all(means[i] <= means[i+1] + 0.01 for i in range(len(means) - 1))
            print(f"    monotonic in MTEB: {monotonic}")
        print()

    if btut:
        print("[ Test 2 — BTUT Compression Frontier ]")
        print(f"  source: data/validation/btut_compression_frontier_local_*.json")
        print(f"  embedder: {btut['config']['embedder']}")
        print(f"  seeds:    {btut['config']['seeds']}")
        print(f"  pipeline: embed (MiniLM) -> kNN edges -> BTUT(target ratio) -> kmeans on survivors")
        print()
        rows = []
        for s in btut["summary_by_ratio"]:
            rows.append([
                f"{s['compression_ratio_target']}x",
                f"{s['compression_ratio_actual_mean']:.2f}x",
                s["n_survivors_mean"],
                s["n_seeds"],
                f"{s['mean_self_basin_mean']:.4f}",
                f"±{s['mean_self_basin_std']:.4f}",
            ])
        print(fmt_table(
            rows,
            ["target", "actual", "survivors", "seeds", "mean", "(std)"],
        ))
        print()

    # write unified campaign artifact
    if amp or btut:
        unified = {
            "campaign": "ai_substrate_local_phase",
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "tests": {},
        }
        if amp:
            unified["tests"]["test_1_embedder_amplification"] = amp
        if btut:
            unified["tests"]["test_2_btut_compression_frontier"] = btut
        out = Path(f"data/validation/ai_substrate_campaign_{datetime.utcnow():%Y%m%d}.json")
        out.write_text(json.dumps(unified, indent=2), encoding="utf-8")
        print(f"unified artifact saved: {out}")


if __name__ == "__main__":
    main()
