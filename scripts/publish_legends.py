"""Publish pre-cached BTUT legend runs to frontend/data/legends/.

Thin orchestrator: reads cached BTUT outputs from
`scripts/cross_era_analysis/output/` and `scripts/results/`, transforms each
to the `ConnectResult` shape consumed by
`frontend/components/connect/ConnectFlow.tsx`, runs lo_core analyzers,
and writes per-legend JSONs + `bridges.json` + `manifest.json`.

All analytics logic lives in `lo_core`. This file only orchestrates the
I/O and legacy UI-shape mapping.

Run: `python scripts/publish_legends.py`
"""
from __future__ import annotations

import json
import logging
from collections import defaultdict
from dataclasses import asdict, dataclass, is_dataclass
from pathlib import Path
from typing import Any

from dataclasses import asdict as _asdict, is_dataclass as _is_dataclass

from lo_core.analyze import (
    DEFAULT_PARADIGM_ROLES,
    analyze_corpus,
    compute_bridges,
    extract_fingerprints,
    global_fingerprint_count,
    parse_entity_name,
    triple_bridges,
)
from lo_core.validate import validate_corpora


def _to_jsonable(obj):
    if _is_dataclass(obj):
        return _to_jsonable(_asdict(obj))
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_jsonable(v) for v in obj]
    return obj

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "frontend" / "data" / "legends"
XERA = REPO_ROOT / "scripts" / "cross_era_analysis" / "output"

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


# ─── Discriminator lookup (stays local; it's a legacy hook for the UI) ───────


def _discriminator_lookup() -> dict[str, dict]:
    out: dict[str, dict] = {}
    reports = {
        "physics": XERA / "physics_discriminator_report.json",
        "crypto": XERA / "crypto_discriminator_report.json",
        "info_theory": XERA / "info_theory_discriminator_report.json",
    }
    for regime, path in reports.items():
        if not path.exists():
            continue
        try:
            d = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        rows = d.get("scored_documents", []) if isinstance(d, dict) else d
        for row in rows:
            if not isinstance(row, dict):
                continue
            doc_id = row.get("id")
            if doc_id and doc_id not in out:
                out[doc_id] = {
                    "regime": regime,
                    "scores": {k: v for k, v in row.items() if k != "id"},
                }
    return out


def _apply_discriminator(survivors_src: list[dict], disc_by_id: dict[str, dict]) -> dict:
    hits: dict[str, int] = {}
    examples: list[dict] = []
    for s in survivors_src[:300]:
        name = ((s.get("entity") or {}).get("name")) or ""
        row = disc_by_id.get(name)
        if row:
            hits[row["regime"]] = hits.get(row["regime"], 0) + 1
            if len(examples) < 8:
                examples.append({
                    "name": name, "regime": row["regime"],
                    "scores": {k: (round(v, 3) if isinstance(v, float) else v)
                               for k, v in row["scores"].items()},
                })
    return {"regime_counts": hits, "examples": examples, "total_matched": sum(hits.values())}


# ─── Legacy UI shape mapping ────────────────────────────────────────────────


def _survivor_to_frontend(s: dict) -> dict:
    entity = s.get("entity") or {}
    scores = s.get("scores") or {}
    return {
        "name": entity.get("name") or s.get("name") or "?",
        "type": entity.get("type") or s.get("type") or "Unknown",
        "score": round(float(scores.get("composite") or s.get("composite") or 0.0), 4),
        "anomaly_score": round(float(scores.get("anomaly") or s.get("anomaly_score") or 0.0), 4),
    }


def _real_connections(
    survivors_src: list[dict], survivors_fe: list[dict], max_out: int = 30,
) -> list[dict]:
    """Derive cluster-local flip-proximity edges from real BTUT flip counts."""
    if not survivors_src:
        return []
    max_flips = max((int(s.get("flips", 0)) for s in survivors_src), default=0) or 1
    by_cluster: dict[int, list[int]] = defaultdict(list)
    for idx, s in enumerate(survivors_src):
        by_cluster[int(s.get("cluster", 0))].append(idx)

    pairs: list[tuple[int, int, float]] = []
    for members in by_cluster.values():
        sorted_idx = sorted(members, key=lambda i: int(survivors_src[i].get("flips", 0)))
        for i in range(len(sorted_idx) - 1):
            a, b = sorted_idx[i], sorted_idx[i + 1]
            fa = int(survivors_src[a].get("flips", 0))
            fb = int(survivors_src[b].get("flips", 0))
            strength = round(1.0 - abs(fa - fb) / max_flips, 4)
            pairs.append((a, b, strength))
    pairs.sort(key=lambda p: p[2], reverse=True)
    return [
        {
            "source": survivors_fe[a]["name"] if a < len(survivors_fe) else "?",
            "target": survivors_fe[b]["name"] if b < len(survivors_fe) else "?",
            "signal_type": "flip_proximity",
            "strength": strength,
        }
        for a, b, strength in pairs[:max_out]
    ]


def _to_jsonable(obj: Any) -> Any:
    if is_dataclass(obj):
        return _to_jsonable(asdict(obj))
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_jsonable(v) for v in obj]
    return obj


def _transform(legend: Legend, src: dict, disc_by_id: dict[str, dict],
               global_fp: dict[str, int], legend_fps: dict[str, str]) -> dict:
    summary = src.get("summary", {})
    survivors_src_all = src.get("survivors") or []
    survivors_src = survivors_src_all[:300]
    survivors_fe = [_survivor_to_frontend(s) for s in survivors_src]
    truncated_from = len(survivors_src_all) if len(survivors_src_all) > 300 else None

    reconstruction = summary.get("reconstruction") or {}
    coverages = reconstruction.get("coverages") or {}
    coverage = float(coverages.get("1.0") or coverages.get("1", 0.0) or 0.0)

    findings = analyze_corpus(
        survivors=survivors_src,
        corpus_id=legend.id,
        fingerprints={k: v for k, v in legend_fps.items() if k in {
            ((s.get("entity") or {}).get("name")) or "" for s in survivors_src
        }},
        global_fp_count=global_fp,
    )

    # Attach within-cluster rank onto each frontend survivor
    for fe in survivors_fe:
        rk = findings.within_cluster_rank.get(fe["name"])
        if rk:
            fe["cluster_rank"] = rk.rank
            fe["cluster_total"] = rk.total_in_cluster
            fe["cluster_percentile"] = rk.percentile

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
        "connections": _real_connections(survivors_src, survivors_fe),
        "paradigm_distribution": findings.paradigm_distribution,
        "paradigm": _apply_discriminator(survivors_src, disc_by_id),
        "convergent_clusters": _to_jsonable(findings.convergent_clusters),
        "cross_era_anchors": _to_jsonable(findings.cross_era_anchors),
        "convergence_index": _to_jsonable(findings.convergence_index),
    }
    if truncated_from is not None:
        out["survivors_truncated_from"] = truncated_from
    return out


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    disc_by_id = _discriminator_lookup()
    log.info("Loaded %d discriminator rows", len(disc_by_id))

    survivors_by_id: dict[str, list[dict]] = {}
    legend_fingerprints: dict[str, dict[str, str]] = {}
    srcs: dict[str, dict] = {}

    for legend in LEGENDS:
        if not legend.source.exists():
            log.warning("MISSING %s -> %s", legend.id, legend.source)
            continue
        try:
            src = json.loads(legend.source.read_text(encoding="utf-8"))
        except Exception as e:
            log.error("FAILED to read %s: %s", legend.id, e)
            continue
        srcs[legend.id] = src
        survs = (src.get("survivors") or [])[:300]
        survivors_by_id[legend.id] = survs
        legend_fingerprints[legend.id] = extract_fingerprints(survs)

    global_fp = global_fingerprint_count(legend_fingerprints)

    entries: list[dict] = []
    for legend in LEGENDS:
        src = srcs.get(legend.id)
        if src is None:
            continue
        transformed = _transform(
            legend, src, disc_by_id, global_fp, legend_fingerprints.get(legend.id, {}),
        )
        dst = OUT_DIR / f"{legend.id}.json"
        dst.write_text(json.dumps(transformed, indent=2, sort_keys=True, default=str), encoding="utf-8")
        size_kb = dst.stat().st_size // 1024
        paradigm = transformed.get("paradigm") or {}
        hypotheses = (transformed.get("paradigm_distribution") or {}).get("hypothesis_by_corpus", {})
        confirmed_count = sum(1 for h in hypotheses.values() if h.get("confirmed"))
        entries.append({
            "id": legend.id,
            "display_name": legend.display_name,
            "description": legend.description,
            "path": f"legends/{legend.id}.json",
            "survivors": len(transformed["survivors"]),
            "total_entities": transformed["total_entities"],
            "clusters": transformed["clusters"],
            "paradigm_matched": paradigm.get("total_matched", 0),
            "convergent_cluster_count": len(transformed.get("convergent_clusters") or []),
            "cross_era_anchor_count": len(transformed.get("cross_era_anchors") or []),
            "hypothesis_corpora_confirmed": confirmed_count,
            "top_convergence": (
                transformed.get("convergence_index", [{}])[0].get("convergence", 0.0)
                if transformed.get("convergence_index") else 0.0
            ),
            "size_kb": size_kb,
        })
        log.info(
            "%s (%d surv, cc=%d, xe=%d, conv=%.2f, %d KB)",
            legend.id,
            len(transformed["survivors"]),
            len(transformed.get("convergent_clusters") or []),
            len(transformed.get("cross_era_anchors") or []),
            entries[-1]["top_convergence"],
            size_kb,
        )

    # Cross-legend analyses
    bridges, bridge_stats = compute_bridges(legend_fingerprints)
    triples = triple_bridges(legend_fingerprints, global_fp)

    # Pre-compute the null-test validation report so the UI can surface it
    # without running python at view time (the "Prove It" badge).
    log.info("Running null-test validation (N=30) for prove-it surfacing...")
    validation_report = validate_corpora(
        survivors_by_id,
        focus_corpus="polymath",
        n_iterations=30,
        held_out=("polymath", "tesla", "heterogeneous"),
    )
    validation_jsonable = _to_jsonable(validation_report)
    (OUT_DIR / "validation.json").write_text(
        json.dumps(validation_jsonable, indent=2, sort_keys=True, default=str),
        encoding="utf-8",
    )
    significant_count = sum(
        1 for t in validation_report.null_tests if t.significant_at_0_05
    )
    log.info(
        "Validation: %d/%d metrics SIGNIFICANT under null permutation (alpha=0.05)",
        significant_count, len(validation_report.null_tests),
    )

    (OUT_DIR / "bridges.json").write_text(
        json.dumps({
            "bridges": bridges,
            "count": len(bridges),
            "stats": bridge_stats,
            "triple_bridges": triples,
            "triple_bridges_count": len(triples),
        }, indent=2, sort_keys=True, default=str),
        encoding="utf-8",
    )
    log.info(
        "Bridges: %d pairwise, %d triple (dropped %d dense / %d unique)",
        len(bridges), len(triples),
        bridge_stats["dense_fingerprints_dropped"],
        bridge_stats["total_unique_fingerprints"],
    )

    manifest = {
        "legends": entries,
        "count": len(entries),
        "bridges_count": len(bridges),
        "triple_bridges_count": len(triples),
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True, default=str), encoding="utf-8",
    )
    log.info("Published %d legends to %s", len(entries), OUT_DIR)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
