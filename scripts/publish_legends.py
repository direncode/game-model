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
XERA = REPO_ROOT / "scripts" / "cross_era_analysis" / "output"

# Standard novelty query: emphasize anomaly and diversity axes
NOVELTY_QUERY = [0.9, 0.7, 0.95, 0.5]  # [anomaly, composite, diversity, reconstruction]

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


def _score_vector(s: dict) -> list[float]:
    sc = s.get("scores") or {}
    return [
        float(sc.get("anomaly", 0.0)),
        float(sc.get("composite", 0.0)),
        float(sc.get("diversity", 0.0)),
        float(sc.get("reconstruction", 0.0)),
    ]


def _cosine(a: list[float], b: list[float]) -> float:
    import math
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(x * x for x in b)) or 1.0
    return dot / (na * nb)


def _novelty(survivors_src: list[dict], top_k: int = 8) -> dict:
    """Cosine novelty over the 4D score vector against NOVELTY_QUERY."""
    scored = []
    for s in survivors_src:
        entity = s.get("entity") or {}
        sim = _cosine(NOVELTY_QUERY, _score_vector(s))
        scored.append({
            "name": entity.get("name") or "?",
            "type": entity.get("type") or "Unknown",
            "similarity": round(sim, 4),
            "anomaly": round(float((s.get("scores") or {}).get("anomaly", 0.0)), 4),
        })
    scored.sort(key=lambda r: r["similarity"], reverse=True)
    top = scored[:top_k]
    top_sim = top[0]["similarity"] if top else 0.0
    return {
        "query": "high anomaly + high diversity probe",
        "query_vector": NOVELTY_QUERY,
        "top": top,
        "novelty_score": round(1.0 - top_sim, 4),
        "probed": len(scored),
    }


def _discriminator_lookup() -> dict[str, dict]:
    """Read cached discriminator reports. Returns {doc_id -> {regime, scores}}."""
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
                out[doc_id] = {"regime": regime, "scores": {
                    k: v for k, v in row.items() if k not in ("id",)
                }}
    return out


def _apply_discriminator(survivors_src: list[dict], disc_by_id: dict[str, dict]) -> dict:
    """Return discriminator classifications for any survivors we recognize."""
    hits: dict[str, int] = {}
    examples: list[dict] = []
    for s in survivors_src[:300]:
        name = ((s.get("entity") or {}).get("name")) or ""
        row = disc_by_id.get(name)
        if row:
            hits[row["regime"]] = hits.get(row["regime"], 0) + 1
            if len(examples) < 8:
                examples.append({
                    "name": name,
                    "regime": row["regime"],
                    "scores": {k: (round(v, 3) if isinstance(v, float) else v) for k, v in row["scores"].items()},
                })
    return {"regime_counts": hits, "examples": examples, "total_matched": sum(hits.values())}


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


def _transform(legend: Legend, src: dict, disc_by_id: dict[str, dict]) -> dict:
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
        "novelty": _novelty(survivors_src),
        "paradigm": _apply_discriminator(survivors_src, disc_by_id),
    }
    if truncated_from is not None:
        out["survivors_truncated_from"] = truncated_from
    return out


def _compute_bridges(legend_fingerprints: dict[str, dict[str, str]]) -> list[dict]:
    """Pairwise 48-bit-fingerprint intersections across legends.

    `legend_fingerprints[legend_id][name] = fingerprint`.
    Returns a list of {a, b, shared_count, samples}.
    """
    legend_ids = sorted(legend_fingerprints.keys())
    bridges: list[dict] = []
    for i, a in enumerate(legend_ids):
        fp_a = legend_fingerprints[a]
        fp_a_set: dict[str, str] = {}
        for name, fp in fp_a.items():
            fp_a_set.setdefault(fp, name)
        for b in legend_ids[i + 1:]:
            shared: list[dict] = []
            for name_b, fp_b in legend_fingerprints[b].items():
                if fp_b in fp_a_set:
                    shared.append({"fp": fp_b, "a_name": fp_a_set[fp_b], "b_name": name_b})
                if len(shared) >= 15:
                    break
            if shared:
                bridges.append({
                    "a": a, "b": b,
                    "shared_count": len(shared),
                    "samples": shared[:8],
                })
    bridges.sort(key=lambda br: br["shared_count"], reverse=True)
    return bridges


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    disc_by_id = _discriminator_lookup()
    log.info("Loaded %d discriminator rows", len(disc_by_id))

    entries: list[dict] = []
    legend_fingerprints: dict[str, dict[str, str]] = {}

    for legend in LEGENDS:
        if not legend.source.exists():
            log.warning("MISSING %s -> %s", legend.id, legend.source)
            continue
        try:
            src = json.loads(legend.source.read_text(encoding="utf-8"))
            transformed = _transform(legend, src, disc_by_id)
        except Exception as e:
            log.error("FAILED %s: %s", legend.id, e)
            continue

        # Collect fingerprints for bridge computation
        fps: dict[str, str] = {}
        for s in (src.get("survivors") or [])[:300]:
            name = ((s.get("entity") or {}).get("name")) or ""
            fp = s.get("fingerprint_48bit")
            if name and fp:
                fps[name] = fp
        legend_fingerprints[legend.id] = fps

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
                "paradigm_matched": transformed["paradigm"]["total_matched"],
                "novelty_score": transformed["novelty"]["novelty_score"],
                "size_kb": size_kb,
            }
        )
        log.info(
            "%s (%d survivors, paradigm=%d, novelty=%.2f, %d KB)",
            legend.id,
            len(transformed["survivors"]),
            transformed["paradigm"]["total_matched"],
            transformed["novelty"]["novelty_score"],
            size_kb,
        )

    bridges = _compute_bridges(legend_fingerprints)
    (OUT_DIR / "bridges.json").write_text(
        json.dumps({"bridges": bridges, "count": len(bridges)}, indent=2, sort_keys=True, default=str),
        encoding="utf-8",
    )
    log.info("Computed %d cross-legend bridges", len(bridges))

    manifest = {"legends": entries, "count": len(entries), "bridges_count": len(bridges)}
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True, default=str), encoding="utf-8"
    )
    log.info("Published %d legends to %s", len(entries), OUT_DIR)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
