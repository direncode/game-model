#!/usr/bin/env python
"""Benchmark suite: all sources through the unified ocean pipeline.

Produces:
  scripts/exports/benchmark/benchmark_<timestamp>.json
  scripts/exports/benchmark/benchmark_<timestamp>.md
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.services.data_layer.orchestrator import OceanOrchestrator  # noqa: E402


BENCH_DIR = REPO_ROOT / "scripts" / "exports" / "benchmark"


def _build_json_report(manifest, wall_seconds: float) -> dict:
    """Build a JSON-serializable benchmark report."""
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "wall_seconds": round(wall_seconds, 2),
        "total_cost_usd": manifest.total_cost_usd,
        "n_sources": len(manifest.sources),
        "n_active_sources": sum(
            1 for sr in manifest.sources.values() if sr.n_survivors > 0
        ),
        "total_survivors": len(manifest.unified_survivors),
        "total_cross_links": sum(cl.n_links for cl in manifest.cross_links),
        "per_source": manifest.benchmark,
        "cross_links_summary": [
            {
                "pair": list(cl.pair),
                "n_links": cl.n_links,
                "links_by_signal": cl.links_by_signal,
            }
            for cl in manifest.cross_links
        ],
        "link_matrix": manifest.link_matrix,
    }
    return report


def _build_md_report(report: dict) -> str:
    """Build a Markdown benchmark report from the JSON dict."""
    lines = []
    lines.append(f"# Latent Ocean Benchmark")
    lines.append(f"")
    lines.append(f"**Timestamp:** {report['timestamp']}")
    lines.append(f"**Wall time:** {report['wall_seconds']}s")
    lines.append(f"**Total cost:** ${report['total_cost_usd']:.6f}")
    lines.append(f"**Sources:** {report['n_active_sources']}/{report['n_sources']} active")
    lines.append(f"**Survivors:** {report['total_survivors']}")
    lines.append(f"**Cross-links:** {report['total_cross_links']}")
    lines.append("")

    # Per-source table.
    lines.append("## Per-source results")
    lines.append("")
    lines.append("| Source | Input | Survivors | Reduction | Coverage | Cost |")
    lines.append("|--------|------:|----------:|----------:|---------:|-----:|")
    for row in report["per_source"]:
        red = f"{row['reduction_ratio']}x" if row["reduction_ratio"] else "-"
        cov = f"{row['coverage_at_1_0']:.3f}" if row["coverage_at_1_0"] else "-"
        lines.append(
            f"| {row['source']} | {row['n_input']} | {row['n_survivors']} "
            f"| {red} | {cov} | ${row['cost_usd']:.6f} |"
        )
    lines.append("")

    # Cross-links summary.
    if report["cross_links_summary"]:
        lines.append("## Cross-links")
        lines.append("")
        lines.append("| Pair | Links | Signals |")
        lines.append("|------|------:|---------|")
        for cl in report["cross_links_summary"]:
            pair = " x ".join(cl["pair"])
            signals = ", ".join(
                f"{k}={v}" for k, v in sorted(cl["links_by_signal"].items())
            )
            lines.append(f"| {pair} | {cl['n_links']} | {signals} |")
        lines.append("")

    lines.append(
        f"Pipeline processed {report['n_sources']} sources into "
        f"{report['total_survivors']} unified survivors with "
        f"{report['total_cross_links']} cross-source links in "
        f"{report['wall_seconds']}s at a total cost of "
        f"${report['total_cost_usd']:.6f}."
    )
    return "\n".join(lines)


def main() -> None:
    print("[benchmark] Starting full ocean benchmark...")
    t0 = time.time()

    orch = OceanOrchestrator(target_survivors=100, log_callback=print)
    manifest = orch.build_ocean(default_limit=500)

    wall = time.time() - t0

    # Build reports.
    json_report = _build_json_report(manifest, wall)
    md_report = _build_md_report(json_report)

    # Write files.
    BENCH_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    json_path = BENCH_DIR / f"benchmark_{ts}.json"
    json_path.write_text(json.dumps(json_report, indent=2), encoding="utf-8")

    md_path = BENCH_DIR / f"benchmark_{ts}.md"
    md_path.write_text(md_report, encoding="utf-8")

    print(f"[benchmark] JSON -> {json_path}")
    print(f"[benchmark] MD   -> {md_path}")
    print(f"[benchmark] Done in {wall:.1f}s.")


if __name__ == "__main__":
    main()
