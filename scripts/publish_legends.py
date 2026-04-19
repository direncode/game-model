"""Publish pre-cached BTUT legend runs to frontend/data/legends/.

Reads existing BTUT outputs from `scripts/cross_era_analysis/output/` and
`scripts/results/`, transforms each to the `ConnectResult` shape consumed
by `frontend/components/connect/ConnectFlow.tsx`, and writes them to
`frontend/data/legends/<id>.json` alongside a `manifest.json` index.

Run: `python scripts/publish_legends.py`
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "frontend" / "data" / "legends"

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("publish_legends")


@dataclass
class Legend:
    id: str
    display_name: str
    description: str
    source: Path


LEGENDS: list[Legend] = [
    Legend("edgar", "SEC EDGAR", "SEC 10-K filings corpus",
           REPO_ROOT / "scripts/cross_era_analysis/output/edgar_btut_result_v2.json"),
    Legend("heterogeneous", "Cross-Era Heterogeneous",
           "1,851-entity cross-era corpus (25/25 canonical markers)",
           REPO_ROOT / "scripts/cross_era_analysis/output/heterogeneous_btut_result_v2.json"),
    Legend("polymath", "Polymath (Newton / VN / Leonardo)",
           "Historical polymath archives - BTUT anomaly detection layer",
           REPO_ROOT / "scripts/cross_era_analysis/output/polymath_btut_result_v2.json"),
    Legend("latk_physics", "LATK Physics arXiv",
           "Physics arXiv corpus for LATK novelty queries",
           REPO_ROOT / "scripts/cross_era_analysis/output/latk_physics_btut_result_v2.json"),
    Legend("latk_mini", "LATK Mini", "Mini cross-era corpus",
           REPO_ROOT / "scripts/cross_era_analysis/output/latk_mini_btut_result_v2.json"),
    Legend("linguistics", "Linguistics", "Linguistics corpus",
           REPO_ROOT / "scripts/cross_era_analysis/output/linguistics_btut_result_v2.json"),
    Legend("patents", "Patents Superpower", "Patent corpus",
           REPO_ROOT / "scripts/results/patents_superpower_result.json"),
    Legend("tesla", "Tesla Superpower", "Nikola Tesla patent corpus (Wardenclyffe anomaly)",
           REPO_ROOT / "scripts/results/tesla_superpower_result.json"),
    Legend("pubmed", "PubMed Superpower", "Biomedical abstracts corpus",
           REPO_ROOT / "scripts/results/pubmed_superpower_result.json"),
    Legend("climate", "Climate Superpower", "Climate science corpus",
           REPO_ROOT / "scripts/results/climate_superpower_result.json"),
    Legend("comtrade", "Comtrade Superpower", "UN Comtrade trade data corpus",
           REPO_ROOT / "scripts/results/comtrade_superpower_result.json"),
]


def _round(x: Any, d: int = 4) -> Any:
    if isinstance(x, float):
        return round(x, d)
    if isinstance(x, list):
        return [_round(v, d) for v in x]
    if isinstance(x, dict):
        return {k: _round(v, d) for k, v in x.items()}
    return x


def _survivor_to_frontend(s: dict) -> dict:
    """Map a BTUT survivor to the frontend `Survivor` shape the UI consumes."""
    entity = s.get("entity") or {}
    scores = s.get("scores") or {}
    return {
        "name": entity.get("name") or s.get("name") or "?",
        "type": entity.get("type") or s.get("type") or "Unknown",
        "score": round(float(scores.get("composite") or s.get("composite") or 0.0), 4),
        "anomaly_score": round(float(scores.get("anomaly") or s.get("anomaly_score") or 0.0), 4),
    }


def _survivor_cluster(s: dict) -> int:
    return int(s.get("cluster", 0))


def _derive_connections(survivors_src: list[dict], survivors_fe: list[dict], max_out: int = 40) -> list[dict]:
    """Synthesize connections from cluster co-membership (first ~40)."""
    by_cluster: dict[int, list[str]] = {}
    for s_src, s_fe in zip(survivors_src, survivors_fe):
        by_cluster.setdefault(_survivor_cluster(s_src), []).append(s_fe["name"])
    out: list[dict] = []
    for _, members in by_cluster.items():
        for i in range(len(members) - 1):
            if len(out) >= max_out:
                return out
            out.append(
                {
                    "source": members[i],
                    "target": members[i + 1],
                    "signal_type": "cluster_co_membership",
                    "strength": 0.8,
                }
            )
    return out


def _transform(legend: Legend, src: dict) -> dict:
    summary = src.get("summary", {})
    survivors_src_all = src.get("survivors", []) or []
    survivors_src = survivors_src_all[:300]
    survivors_fe = [_survivor_to_frontend(s) for s in survivors_src]
    truncated_from = len(survivors_src_all) if len(survivors_src_all) > 300 else None

    reconstruction = summary.get("reconstruction") or {}
    coverages = reconstruction.get("coverages") or {}
    coverage = float(coverages.get("1.0") or coverages.get("1", 0.0) or 0.0)

    out = {
        "legend_id": legend.id,
        "database_name": legend.display_name,
        "description": legend.description,
        "survivors": survivors_fe,
        "clusters": int(summary.get("clusters", 0)),
        "coverage": round(coverage, 4),
        "cost": "$0.00",
        "wall_time": f"{float(summary.get('wall_seconds', 0.0)):.1f}s",
        "total_entities": int(summary.get("total_entities", 0)),
        "connections": _derive_connections(survivors_src, survivors_fe),
    }
    if truncated_from is not None:
        out["survivors_truncated_from"] = truncated_from
    return out


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    entries: list[dict] = []
    for legend in LEGENDS:
        if not legend.source.exists():
            log.warning("MISSING %s -> %s", legend.id, legend.source)
            continue
        try:
            src = json.loads(legend.source.read_text(encoding="utf-8"))
            transformed = _transform(legend, src)
        except Exception as e:
            log.error("FAILED %s: %s", legend.id, e)
            continue

        dst = OUT_DIR / f"{legend.id}.json"
        dst.write_text(
            json.dumps(transformed, indent=2, sort_keys=True, default=str),
            encoding="utf-8",
        )
        size_kb = dst.stat().st_size // 1024
        entries.append(
            {
                "id": legend.id,
                "display_name": legend.display_name,
                "description": legend.description,
                "path": f"legends/{legend.id}.json",
                "survivors": len(transformed["survivors"]),
                "total_entities": transformed["total_entities"],
                "clusters": transformed["clusters"],
                "size_kb": size_kb,
            }
        )
        log.info("%s (%d survivors, %d KB)", legend.id, len(transformed["survivors"]), size_kb)

    manifest = {"legends": entries, "count": len(entries)}
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True, default=str), encoding="utf-8"
    )
    log.info("Published %d legends to %s", len(entries), OUT_DIR)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
