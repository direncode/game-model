#!/usr/bin/env python
"""Full Latent Ocean demo -- all 6 sources, unified manifold, cross-linked.

The enterprise moonshot in one command. Ingests EDGAR (finance), PubMed
(biomedical), Patents (IP), Comtrade (trade), Climate (NOAA), Tesla
(sovereign) through the same pipeline, fuses all survivors into a
single unified manifold, and cross-links every pair.

Run from repo root:
    python scripts/demo_ocean_full.py

Writes everything to scripts/exports/ocean/.
"""
from __future__ import annotations

import csv
import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.services.data_layer.orchestrator import OceanOrchestrator  # noqa: E402


EXPORT_DIR = REPO_ROOT / "scripts" / "exports" / "ocean"


def _print_benchmark(benchmark: list[dict], total_cost: float) -> None:
    """Print an ASCII benchmark table (investor-ready, cp1252-safe)."""
    print()
    print("[ocean] === BENCHMARK =========================================")
    header = (
        f"{'Source':<12}| {'Input':>5} | {'Survivors':>9} | "
        f"{'Reduction':>9} | {'Coverage':>8} | {'Cost':>10}"
    )
    sep = "-" * 12 + "+" + "-" * 7 + "+" + "-" * 11 + "+" + "-" * 11 + "+" + "-" * 10 + "+" + "-" * 12
    print(header)
    print(sep)

    total_input = 0
    total_survivors = 0
    for row in benchmark:
        src = row["source"][:11]
        n_in = row["n_input"]
        n_surv = row["n_survivors"]
        red = f"{row['reduction_ratio']}x" if row["reduction_ratio"] else "-"
        cov = f"{row['coverage_at_1_0']:.3f}" if row["coverage_at_1_0"] else "-"
        cost = f"${row['cost_usd']:.6f}"
        total_input += n_in
        total_survivors += n_surv
        print(f"{src:<12}| {n_in:>5} | {n_surv:>9} | {red:>9} | {cov:>8} | {cost:>10}")

    print(sep)
    print(
        f"{'TOTAL':<12}| {total_input:>5} | {total_survivors:>9} | "
        f"{'':>9} | {'':>8} | ${total_cost:>.6f}"
    )
    print()


def _print_link_matrix(
    link_matrix: dict[str, dict[str, int]],
    source_ids: list[str],
) -> None:
    """Print the cross-link matrix (ASCII, cp1252-safe)."""
    active = [s for s in source_ids if s in link_matrix]
    if not active:
        print("[ocean] No cross-links (fewer than 2 active sources).")
        return

    print("[ocean] === CROSS-LINK MATRIX =================================")
    col_w = 9
    header = " " * 12 + "".join(s[:col_w].ljust(col_w) for s in active)
    print(header)
    for a in active:
        cells = []
        for b in active:
            if a == b:
                cells.append("-".center(col_w))
            else:
                cells.append(str(link_matrix[a][b]).center(col_w))
        print(f"{a[:11]:<12}{''.join(cells)}")
    print()


def _serialize_manifest(manifest) -> dict:
    """Convert OceanManifest to a JSON-safe dict."""
    data = {
        "sources": {},
        "unified_survivors": manifest.unified_survivors,
        "cross_links": [],
        "link_matrix": manifest.link_matrix,
        "total_cost_usd": manifest.total_cost_usd,
        "total_wall_seconds": manifest.total_wall_seconds,
        "benchmark": manifest.benchmark,
    }

    for src_id, sr in manifest.sources.items():
        data["sources"][src_id] = {
            "source_id": sr.source_id,
            "n_survivors": sr.n_survivors,
            "wall_seconds": sr.wall_seconds,
            "quality": {
                "n_input": sr.quality.n_input,
                "n_survivors": sr.quality.n_survivors,
                "reduction_ratio": sr.quality.reduction_ratio,
                "coverage_at_1_0": sr.quality.coverage_at_1_0,
                "variance_ratio": sr.quality.variance_ratio,
                "estimated_cost_usd": sr.quality.estimated_cost_usd,
            },
        }

    for cl in manifest.cross_links:
        data["cross_links"].append({
            "pair": list(cl.pair),
            "n_links": cl.n_links,
            "links_by_signal": cl.links_by_signal,
        })

    # Convert any numpy arrays lurking in unified_survivors to lists.
    for surv in data["unified_survivors"]:
        for k, v in surv.items():
            if hasattr(v, "tolist"):
                surv[k] = v.tolist()

    return data


def main() -> None:
    t0 = time.time()
    print("[ocean] Full Latent Ocean demo")
    print("=" * 60)

    orch = OceanOrchestrator(target_survivors=100, log_callback=print)
    manifest = orch.build_ocean(default_limit=500)

    # -- Benchmark table --
    _print_benchmark(manifest.benchmark, manifest.total_cost_usd)

    # -- Cross-link matrix --
    source_ids = sorted(manifest.sources.keys())
    _print_link_matrix(manifest.link_matrix, source_ids)

    # -- Export per-source verticals --
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    verticals = ["niv", "tcd_jepa", "data"]
    for src_id, sr in manifest.sources.items():
        if sr.n_survivors == 0:
            print(f"[ocean] Skipping exports for {src_id} (0 survivors)")
            continue
        for v in verticals:
            out_dir = EXPORT_DIR / src_id
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{v}.json"
            try:
                sr.layer.export_for_vertical(v, write_path=out_path)
                print(f"[ocean] Exported {src_id}/{v}.json")
            except Exception as e:
                print(f"[ocean] Export {src_id}/{v} failed: {e}")

    # -- Write ocean manifest JSON --
    manifest_path = EXPORT_DIR / "ocean_manifest.json"
    manifest_data = _serialize_manifest(manifest)
    manifest_path.write_text(json.dumps(manifest_data, indent=2), encoding="utf-8")
    print(f"[ocean] Manifest -> {manifest_path}")

    # -- CSV export of unified survivors --
    csv_path = EXPORT_DIR / "unified_survivors.csv"
    if manifest.unified_survivors:
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            # Flatten any numpy arrays in the dicts for CSV.
            rows = []
            for surv in manifest.unified_survivors:
                row = {}
                for k, v in surv.items():
                    if hasattr(v, "tolist"):
                        v = v.tolist()
                    if isinstance(v, list):
                        # Explode list columns (coord_8d, coord_3d).
                        for i, val in enumerate(v):
                            row[f"{k}_{i}"] = val
                    else:
                        row[k] = v
                rows.append(row)
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        print(f"[ocean] CSV -> {csv_path}")
    else:
        csv_path.write_text("", encoding="utf-8")
        print(f"[ocean] CSV -> {csv_path} (empty)")

    # -- Try Parquet (optional) --
    try:
        from app.services.data_layer.export_formats import to_parquet
        # to_parquet expects Survivor dataclass instances; collect from layers.
        all_survivors = []
        for sr in manifest.sources.values():
            all_survivors.extend(sr.survivors)
        if all_survivors:
            parquet_path = EXPORT_DIR / "unified_survivors.parquet"
            to_parquet(all_survivors, parquet_path)
            print(f"[ocean] Parquet -> {parquet_path}")
    except ImportError:
        print("[ocean] Parquet skipped (pyarrow not installed)")
    except Exception as e:
        print(f"[ocean] Parquet failed: {e}")

    # -- Totals --
    wall = time.time() - t0
    n_sources = len(manifest.sources)
    n_active = sum(1 for sr in manifest.sources.values() if sr.n_survivors > 0)
    n_surv = len(manifest.unified_survivors)
    n_links = sum(cl.n_links for cl in manifest.cross_links)

    print()
    print("[ocean] === TOTALS ============================================")
    print(f"  Sources attempted : {n_sources}")
    print(f"  Sources active    : {n_active}")
    print(f"  Total survivors   : {n_surv}")
    print(f"  Cross-links       : {n_links}")
    print(f"  Total cost        : ${manifest.total_cost_usd:.6f}")
    print(f"  Wall time         : {wall:.1f}s")
    print(f"  Exports dir       : {EXPORT_DIR}")
    print("=" * 60)
    print("[ocean] Done.")


if __name__ == "__main__":
    main()
