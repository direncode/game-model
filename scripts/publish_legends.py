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
import re
from collections import Counter, defaultdict
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


# ─── Structured-name parsing & paradigm analysis ──────────────────────────────

_MODERN_PREFIXES = ("modern_", "arxiv_", "witricity_", "conway_", "wolfram_", "chomsky_")
_MODERN_MARKERS = ("_usrpto_", "_nsf_", "_indiana_university_", "_santa_fe_", "ias_", "_arxiv_")
_CHUNK_RE = re.compile(r"__c\d{2,4}$")


def _parse_entity_name(name: str) -> dict:
    """Parse a structured BTUT entity name into {corpus, subcorpus, kind, slug, era_class}.

    Examples:
      newton_alchemy__event__keynes_auctions_newton_alchemical_manuscripts
        -> corpus=newton, subcorpus=alchemy, kind=event, slug=keynes_auctions..., era_class=historical
      modern_complexity__location__santa_fe_institute
        -> corpus=modern, subcorpus=complexity, kind=location, era_class=modern
      patent_chunk_US424036_5
        -> corpus=patent, subcorpus=chunk, kind=chunk, era_class=unknown
    """
    if not isinstance(name, str) or not name:
        return {"corpus": "unknown", "subcorpus": "unknown", "kind": "unknown", "slug": name or "", "era_class": "unknown"}

    lower = name.lower()
    era_class = "historical"
    if lower.startswith(_MODERN_PREFIXES):
        era_class = "modern"
    elif any(m in lower for m in _MODERN_MARKERS):
        era_class = "modern"
    elif _CHUNK_RE.search(name):
        era_class = "chunk"

    # Structured names use `__` between corpus/kind/slug
    parts = name.split("__")
    if len(parts) >= 3:
        corpus_sub = parts[0]
        kind = parts[1]
        slug = "__".join(parts[2:])
        # corpus_sub like "newton_alchemy" or "leonardo_flight" or "vn_cellular_automata"
        bits = corpus_sub.split("_", 1)
        corpus = bits[0]
        subcorpus = bits[1] if len(bits) > 1 else ""
        return {"corpus": corpus, "subcorpus": subcorpus, "kind": kind, "slug": slug, "era_class": era_class}

    # Fallback: simple patent/concept/chunk names
    if _CHUNK_RE.search(name):
        return {"corpus": "chunk", "subcorpus": "", "kind": "chunk", "slug": name, "era_class": "chunk"}
    return {"corpus": name.split("_", 1)[0] if "_" in name else name, "subcorpus": "", "kind": "unknown", "slug": name, "era_class": era_class}


# Per-corpus classification of subcorpora into {forgotten, control, other}.
# Based on docs/plans/2026-04-11-niv-vertical-design.md + polymath-secret-detection design.
_PARADIGM_ROLES: dict[str, dict[str, str]] = {
    "newton": {
        "alchemy": "forgotten",
        "alchemy_clavis": "forgotten",
        "alchemy_index": "forgotten",
        "alchemy_praxis": "forgotten",
        "mechanics": "mainstream",
        "principia": "mainstream",
        "optics": "mainstream",
        "opticks": "mainstream",
        "theology": "control",
        "theology_prophecies": "control",
    },
    "leonardo": {
        "flight": "forgotten",
        "flight_of_birds": "forgotten",
        "fluids": "forgotten",
        "hydraulics": "forgotten",
        "water_motion": "forgotten",
        "art_control": "control",
        "optics_perspective": "mainstream",
        "anatomy": "mainstream",
    },
    "vn": {
        "cellular_automata": "forgotten",
        "cellular_automata_transitions": "forgotten",
        "self_reproducing_automata": "forgotten",
        "computing": "forgotten",
        "edvac_report": "forgotten",
        "game_theory": "mainstream",
        "theory_of_games": "mainstream",
        "mathematical_foundations_qm": "mainstream",
        "quantum": "mainstream",
        "monte_carlo": "mainstream",
        "monte_carlo_control": "control",
    },
}


def _role_for(corpus: str, subcorpus: str) -> str:
    """Classify a (corpus, subcorpus) into forgotten/mainstream/control/other."""
    roles = _PARADIGM_ROLES.get(corpus) or {}
    # Try exact match, then prefix match
    if subcorpus in roles:
        return roles[subcorpus]
    for key, role in roles.items():
        if subcorpus.startswith(key) or key.startswith(subcorpus):
            return role
    return "other"


def _paradigm_distribution(survivors_src: list[dict]) -> dict:
    """Count entities by (corpus, subcorpus, role). Hypothesis-test forgotten > control.

    Only emit hypotheses for corpora that have explicit role definitions in
    _PARADIGM_ROLES (newton, leonardo, vn). Name-pattern artifacts like
    'chunk' and 'modern' get counted for display but not tested.
    """
    counts: Counter[tuple[str, str, str]] = Counter()
    role_counts: Counter[str] = Counter()
    by_corpus: dict[str, Counter[str]] = defaultdict(Counter)

    for s in survivors_src:
        name = ((s.get("entity") or {}).get("name")) or ""
        parsed = _parse_entity_name(name)
        corpus = parsed["corpus"]
        sub = parsed["subcorpus"]
        role = _role_for(corpus, sub)
        counts[(corpus, sub, role)] += 1
        role_counts[role] += 1
        by_corpus[corpus][role] += 1

    hypothesis: dict[str, dict] = {}
    for corpus, rc in by_corpus.items():
        if corpus not in _PARADIGM_ROLES:
            continue  # skip declared-role corpora only
        forgotten = rc.get("forgotten", 0)
        control = rc.get("control", 0)
        mainstream = rc.get("mainstream", 0)
        competitors = control + mainstream
        sample_size = forgotten + mainstream + control
        hypothesis[corpus] = {
            "forgotten": forgotten,
            "mainstream": mainstream,
            "control": control,
            "sample_size": sample_size,
            "ratio_forgotten_to_competitors": (
                round(forgotten / competitors, 3) if competitors else (forgotten and 999.0 or 0.0)
            ),
            "confirmed": forgotten > competitors and sample_size >= 10,
            "sample_size_warning": sample_size < 10,
        }

    return {
        "by_corpus_subcorpus_role": [
            {"corpus": c, "subcorpus": s, "role": r, "count": n}
            for (c, s, r), n in sorted(counts.items(), key=lambda kv: -kv[1])
        ],
        "role_counts": dict(role_counts),
        "hypothesis_by_corpus": hypothesis,
    }


def _within_cluster_rank(survivors_src: list[dict]) -> dict:
    """Rank each survivor within its cluster by anomaly score.

    Returns {name -> {rank, total_in_cluster, percentile}}.
    """
    by_cluster: dict[int, list[dict]] = defaultdict(list)
    for s in survivors_src:
        cluster = int(s.get("cluster", 0))
        by_cluster[cluster].append(s)

    rank_map: dict[str, dict] = {}
    for cluster, members in by_cluster.items():
        members_sorted = sorted(
            members, key=lambda m: float(((m.get("scores") or {}).get("anomaly")) or 0.0), reverse=True
        )
        total = len(members_sorted)
        for i, m in enumerate(members_sorted):
            name = ((m.get("entity") or {}).get("name")) or ""
            if not name:
                continue
            rank_map[name] = {
                "cluster": cluster,
                "rank": i + 1,
                "total_in_cluster": total,
                "percentile": round(1.0 - i / max(1, total - 1), 4) if total > 1 else 1.0,
            }
    return rank_map


def _convergent_clusters(survivors_src: list[dict], anomaly_threshold: float = 0.85) -> list[dict]:
    """Find clusters where many entities score >= threshold on anomaly.

    Returns sorted list of {cluster, hot_count, total, paradigm_dominant}.
    """
    by_cluster: dict[int, list[dict]] = defaultdict(list)
    for s in survivors_src:
        by_cluster[int(s.get("cluster", 0))].append(s)

    out: list[dict] = []
    for cluster, members in by_cluster.items():
        hot = [
            m for m in members
            if float(((m.get("scores") or {}).get("anomaly")) or 0.0) >= anomaly_threshold
        ]
        if not hot:
            continue
        # Dominant paradigm label in hot set
        paradigm_counts: Counter[str] = Counter()
        for m in hot:
            name = ((m.get("entity") or {}).get("name")) or ""
            p = _parse_entity_name(name)
            paradigm_counts[f"{p['corpus']}_{p['subcorpus']}"] += 1
        dominant, dominant_n = paradigm_counts.most_common(1)[0] if paradigm_counts else ("", 0)
        out.append({
            "cluster": cluster,
            "hot_count": len(hot),
            "total": len(members),
            "hot_fraction": round(len(hot) / max(1, len(members)), 3),
            "dominant_paradigm": dominant,
            "dominant_paradigm_share": dominant_n,
        })
    out.sort(key=lambda x: x["hot_count"], reverse=True)
    return out


def _real_connections(survivors_src: list[dict], survivors_fe: list[dict], max_out: int = 30) -> list[dict]:
    """Replace fake 80% strength with real co-flip proximity.

    Uses BTUT `flips` field: survivors with similar flip counts AND same cluster
    are genuinely structurally adjacent. Strength = 1 - |flips_a - flips_b| / max_flips.
    """
    if not survivors_src:
        return []

    pairs: list[tuple[int, int, float]] = []
    max_flips = max((int(s.get("flips", 0)) for s in survivors_src), default=0) or 1
    by_cluster: dict[int, list[int]] = defaultdict(list)
    for idx, s in enumerate(survivors_src):
        by_cluster[int(s.get("cluster", 0))].append(idx)

    for cluster_members in by_cluster.values():
        # sort by flip count so adjacent survivors are structural neighbors
        sorted_idx = sorted(
            cluster_members,
            key=lambda i: int(survivors_src[i].get("flips", 0)),
        )
        for i in range(len(sorted_idx) - 1):
            a, b = sorted_idx[i], sorted_idx[i + 1]
            fa = int(survivors_src[a].get("flips", 0))
            fb = int(survivors_src[b].get("flips", 0))
            strength = round(1.0 - abs(fa - fb) / max_flips, 4)
            pairs.append((a, b, strength))

    pairs.sort(key=lambda p: p[2], reverse=True)
    out: list[dict] = []
    for a, b, strength in pairs[:max_out]:
        out.append({
            "source": survivors_fe[a]["name"] if a < len(survivors_fe) else "?",
            "target": survivors_fe[b]["name"] if b < len(survivors_fe) else "?",
            "signal_type": "flip_proximity",
            "strength": strength,
        })
    return out


def _cross_era_anchors(survivors_src: list[dict], top_k: int = 15) -> list[dict]:
    """Find entities where era_class != majority of their cluster, excluding
    the trivial case where the cluster is dominated by chunk-fragments.

    Real signal: a `modern_*` entity appearing in a cluster where the
    non-chunk majority is `historical`, or vice versa. We exclude `chunk`
    from the majority computation because chunk fragments dominate clusters
    by mass and make every named entity trivially "disagree."
    """
    survivors_meta: list[dict] = []
    for s in survivors_src:
        name = ((s.get("entity") or {}).get("name")) or ""
        parsed = _parse_entity_name(name)
        survivors_meta.append({
            "name": name,
            "cluster": int(s.get("cluster", 0)),
            "era_class": parsed["era_class"],
            "corpus": parsed["corpus"],
            "subcorpus": parsed["subcorpus"],
            "anomaly": float(((s.get("scores") or {}).get("anomaly")) or 0.0),
        })

    # Cluster majority era — excluding `chunk` and `unknown`.
    by_cluster: dict[int, Counter[str]] = defaultdict(Counter)
    for m in survivors_meta:
        if m["era_class"] in ("chunk", "unknown"):
            continue
        by_cluster[m["cluster"]][m["era_class"]] += 1

    anchors: list[dict] = []
    for m in survivors_meta:
        if m["era_class"] in ("chunk", "unknown"):
            continue
        cluster_eras = by_cluster.get(m["cluster"])
        if not cluster_eras or len(cluster_eras) < 2:
            # Cluster has only one named era — no disagreement possible
            continue
        majority, majority_n = cluster_eras.most_common(1)[0]
        if m["era_class"] == majority:
            continue
        # True anachronism: named era disagrees with a mixed-era cluster's majority
        anchors.append({
            "name": m["name"],
            "era_class": m["era_class"],
            "cluster_majority_era": majority,
            "cluster_majority_count": majority_n,
            "cluster_size_named": sum(cluster_eras.values()),
            "cluster": m["cluster"],
            "corpus": m["corpus"],
            "subcorpus": m["subcorpus"],
            "anomaly": round(m["anomaly"], 4),
        })
    anchors.sort(key=lambda a: a["anomaly"], reverse=True)
    return anchors[:top_k]


def _convergence_index(
    survivors_fe: list[dict],
    survivors_src: list[dict],
    within_rank: dict[str, dict],
    cross_era: list[dict],
    this_legend_fingerprints: dict[str, str],
    global_fp_count: dict[str, int],
    top_k: int = 20,
) -> list[dict]:
    """Per-entity score across 4 dimensions: anomaly, cluster-top, cross-era, rare-fingerprint.

    Entities that score high across multiple dimensions are the most
    "convergent" — structurally significant from every angle.
    """
    era_names = {a["name"] for a in cross_era}
    # Reverse-lookup: name -> fingerprint
    name_to_fp = dict(this_legend_fingerprints.items())

    scored: list[dict] = []
    for i, fe in enumerate(survivors_fe):
        name = fe["name"]
        anom = float(fe["anomaly_score"])
        comp = float(fe["score"])

        # Dimension 1: raw anomaly
        d_anom = anom

        # Dimension 2: within-cluster percentile
        rk = within_rank.get(name)
        d_cluster = rk["percentile"] if rk else 0.0

        # Dimension 3: cross-era anchor
        d_cross_era = 1.0 if name in era_names else 0.0

        # Dimension 4: rare-fingerprint membership.
        # Inverted from first pass: legend-unique (gc=1) is the default state,
        # not signal. Real signal is gc=2 (shared with exactly one other legend),
        # tapering off as the fingerprint goes denser.
        fp = name_to_fp.get(name, "")
        gc = global_fp_count.get(fp, 0) if fp else 0
        if gc == 2:
            d_rare_fp = 1.0
        elif gc == 3:
            d_rare_fp = 0.7
        elif gc == 4:
            d_rare_fp = 0.4
        elif gc >= 5:
            d_rare_fp = 0.1
        elif gc == 1:
            d_rare_fp = 0.2  # baseline — unique to this legend
        else:
            d_rare_fp = 0.0

        convergence = round(0.35 * d_anom + 0.25 * d_cluster + 0.2 * d_cross_era + 0.2 * d_rare_fp, 4)

        scored.append({
            "name": name,
            "type": fe["type"],
            "dimensions": {
                "anomaly": round(d_anom, 4),
                "cluster_percentile": round(d_cluster, 4),
                "cross_era": d_cross_era,
                "rare_fingerprint": round(d_rare_fp, 4),
            },
            "convergence": convergence,
        })

    scored.sort(key=lambda r: r["convergence"], reverse=True)
    return scored[:top_k]


def _triple_bridges(
    legend_fingerprints: dict[str, dict[str, str]],
    global_fp_count: dict[str, int],
    density_threshold_pct: float = 5.0,
) -> list[dict]:
    """Fingerprints appearing in ≥3 distinct legends, after density filtering.

    Reuses the same density logic as _compute_bridges so we don't surface
    matches on the all-1s generic zone. A fingerprint that's in >5% of
    legends is dense; drop it.
    """
    density_cutoff = max(2, int(len(legend_fingerprints) * density_threshold_pct / 100.0))

    fp_presence: dict[str, dict[str, str]] = defaultdict(dict)
    for legend_id, fps in legend_fingerprints.items():
        for name, fp in fps.items():
            fp_presence[fp].setdefault(legend_id, name)

    triples: list[dict] = []
    for fp, legend_names in fp_presence.items():
        n = len(legend_names)
        if n < 3:
            continue
        if global_fp_count.get(fp, 0) > density_cutoff:
            continue  # dense zone
        triples.append({
            "fingerprint": fp,
            "legend_count": n,
            "legends": sorted(legend_names.keys()),
            "entities": [{"legend": lg, "name": nm} for lg, nm in sorted(legend_names.items())],
        })
    triples.sort(key=lambda t: t["legend_count"])
    return triples


def _paradigm_convergence_matrix(
    legend_fingerprints: dict[str, dict[str, str]],
    survivors_by_legend: dict[str, list[dict]],
    global_fp_count: dict[str, int],
    dense_threshold: int = 2,
) -> list[dict]:
    """For each rare fingerprint shared cross-legend, map the sub-paradigms it links."""
    # name -> (legend, parsed)
    parsed_cache: dict[tuple[str, str], dict] = {}
    for legend_id, survivors in survivors_by_legend.items():
        for s in survivors:
            name = ((s.get("entity") or {}).get("name")) or ""
            if name:
                parsed_cache[(legend_id, name)] = _parse_entity_name(name)

    fp_presence: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for legend_id, fps in legend_fingerprints.items():
        seen_names: set[str] = set()
        for name, fp in fps.items():
            if name in seen_names:
                continue
            seen_names.add(name)
            fp_presence[fp].append((legend_id, name))

    # Aggregate subcorpus links from rare fingerprints (present in exactly 2 or 3 legends)
    subcorpus_pair_counts: Counter[tuple[str, str]] = Counter()
    for fp, presence in fp_presence.items():
        if not (2 <= len(presence) <= 3):
            continue
        if global_fp_count.get(fp, 99) > dense_threshold + 1:
            continue
        parsed_list = [
            parsed_cache.get((lg, nm), {"corpus": "?", "subcorpus": ""}) for lg, nm in presence
        ]
        tags = sorted({f"{p['corpus']}.{p['subcorpus']}" if p['subcorpus'] else p['corpus'] for p in parsed_list})
        for i in range(len(tags)):
            for j in range(i + 1, len(tags)):
                subcorpus_pair_counts[(tags[i], tags[j])] += 1

    rows: list[dict] = []
    for (a, b), n in subcorpus_pair_counts.most_common(50):
        rows.append({"a": a, "b": b, "shared_fingerprints": n})
    return rows


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

    # New cross-dimensional analyzers
    within_rank = _within_cluster_rank(survivors_src)
    paradigm = _paradigm_distribution(survivors_src)
    convergent_clusters = _convergent_clusters(survivors_src)
    cross_era = _cross_era_anchors(survivors_src)

    # Attach within-cluster rank onto each survivor
    for fe in survivors_fe:
        rk = within_rank.get(fe["name"])
        if rk:
            fe["cluster_rank"] = rk["rank"]
            fe["cluster_total"] = rk["total_in_cluster"]
            fe["cluster_percentile"] = rk["percentile"]

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
        "paradigm_distribution": paradigm,
        "paradigm": _apply_discriminator(survivors_src, disc_by_id),
        "convergent_clusters": convergent_clusters,
        "cross_era_anchors": cross_era,
    }
    # Stash reference material used later by _enrich_post_global
    out["_within_rank"] = within_rank
    out["_cross_era"] = cross_era

    if truncated_from is not None:
        out["survivors_truncated_from"] = truncated_from
    return out


def _enrich_post_global(
    transformed: dict,
    legend_fingerprints: dict[str, dict[str, str]],
    global_fp_count: dict[str, int],
) -> None:
    """Attach convergence_index — needs global fingerprint counts."""
    legend_id = transformed["legend_id"]
    this_fps = legend_fingerprints.get(legend_id, {})
    convergence = _convergence_index(
        transformed["survivors"],
        survivors_src=[],  # not needed here, use FE
        within_rank=transformed.pop("_within_rank", {}),
        cross_era=transformed.pop("_cross_era", []),
        this_legend_fingerprints=this_fps,
        global_fp_count=global_fp_count,
    )
    transformed["convergence_index"] = convergence


def _compute_bridges(
    legend_fingerprints: dict[str, dict[str, str]],
    density_threshold_pct: float = 5.0,
) -> tuple[list[dict], dict]:
    """Pairwise 48-bit-fingerprint intersections across legends.

    Signal-rich definition of a bridge:
      - Exclude high-density "dense zone" fingerprints (present in >N% of total corpus).
      - Don't cap per-pair counts.
      - Weight matches by rarity: w = 1 / log(2 + global_count(fp)).
      - Rank bridges by total weighted_score, not raw_count.

    Returns (bridges, stats) where stats carries the density summary.
    """
    import math

    # 1. Global fingerprint frequency across all legends (dedup within legend).
    global_fp_count: dict[str, int] = {}
    total_survivors = 0
    for legend_id, fps in legend_fingerprints.items():
        unique_in_legend = set(fps.values())
        for fp in unique_in_legend:
            global_fp_count[fp] = global_fp_count.get(fp, 0) + 1
        total_survivors += len(fps)

    # 2. Density filter threshold.
    density_cutoff = max(2, int(len(legend_fingerprints) * density_threshold_pct / 100.0))
    dense_fps = {fp for fp, c in global_fp_count.items() if c > density_cutoff}

    # 3. Build per-legend deduplicated fingerprint -> representative name.
    legend_unique_fps: dict[str, dict[str, str]] = {}
    for legend_id, fps in legend_fingerprints.items():
        unique: dict[str, str] = {}
        for name, fp in fps.items():
            if fp in dense_fps:
                continue
            unique.setdefault(fp, name)
        legend_unique_fps[legend_id] = unique

    # 4. Pairwise compare.
    legend_ids = sorted(legend_unique_fps.keys())
    bridges: list[dict] = []
    for i, a in enumerate(legend_ids):
        fp_a = legend_unique_fps[a]
        for b in legend_ids[i + 1:]:
            fp_b = legend_unique_fps[b]
            shared_fps = set(fp_a.keys()) & set(fp_b.keys())
            if not shared_fps:
                continue
            samples: list[dict] = []
            weighted_score = 0.0
            for fp in sorted(shared_fps, key=lambda f: global_fp_count[f]):
                gc = global_fp_count[fp]
                weight = 1.0 / math.log(2 + gc)
                weighted_score += weight
                samples.append({
                    "fp": fp,
                    "a_name": fp_a[fp],
                    "b_name": fp_b[fp],
                    "global_count": gc,
                    "weight": round(weight, 4),
                })
            bridges.append({
                "a": a,
                "b": b,
                "shared_count": len(shared_fps),
                "weighted_score": round(weighted_score, 4),
                "samples": samples[:10],  # keep 10 rarest for display
            })
    bridges.sort(key=lambda br: br["weighted_score"], reverse=True)

    stats = {
        "total_unique_fingerprints": len(global_fp_count),
        "total_survivors": total_survivors,
        "dense_fingerprints_dropped": len(dense_fps),
        "density_threshold_legend_count": density_cutoff,
        "density_threshold_pct": density_threshold_pct,
    }
    return bridges, stats


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    disc_by_id = _discriminator_lookup()
    log.info("Loaded %d discriminator rows", len(disc_by_id))

    entries: list[dict] = []
    legend_fingerprints: dict[str, dict[str, str]] = {}
    transformed_by_id: dict[str, dict] = {}
    survivors_by_legend: dict[str, list[dict]] = {}

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
        survivors_by_legend[legend.id] = (src.get("survivors") or [])[:300]
        transformed_by_id[legend.id] = transformed

    # Global fingerprint counts (dedup within legend)
    global_fp_count: dict[str, int] = {}
    for legend_id, fps in legend_fingerprints.items():
        for fp in set(fps.values()):
            global_fp_count[fp] = global_fp_count.get(fp, 0) + 1

    # Enrich each legend with convergence_index now that we know global counts
    for legend_id, transformed in transformed_by_id.items():
        _enrich_post_global(transformed, legend_fingerprints, global_fp_count)

    # Write per-legend JSONs
    for legend in LEGENDS:
        transformed = transformed_by_id.get(legend.id)
        if not transformed:
            continue
        dst = OUT_DIR / f"{legend.id}.json"
        dst.write_text(
            json.dumps(transformed, indent=2, sort_keys=True, default=str),
            encoding="utf-8",
        )
        size_kb = dst.stat().st_size // 1024
        paradigm = transformed.get("paradigm", {})
        dist = transformed.get("paradigm_distribution", {})
        top_hypothesis = dist.get("hypothesis_by_corpus", {}) if isinstance(dist, dict) else {}
        confirmed_count = sum(1 for h in top_hypothesis.values() if h.get("confirmed"))
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
            "%s (%d surv, convergent_clusters=%d, cross_era=%d, top_conv=%.2f, %d KB)",
            legend.id,
            len(transformed["survivors"]),
            len(transformed.get("convergent_clusters") or []),
            len(transformed.get("cross_era_anchors") or []),
            entries[-1]["top_convergence"],
            size_kb,
        )

    # Global cross-legend analytics
    bridges, bridge_stats = _compute_bridges(legend_fingerprints)
    triples = _triple_bridges(legend_fingerprints, global_fp_count)
    paradigm_matrix = _paradigm_convergence_matrix(
        legend_fingerprints, survivors_by_legend, global_fp_count
    )

    (OUT_DIR / "bridges.json").write_text(
        json.dumps(
            {
                "bridges": bridges,
                "count": len(bridges),
                "stats": bridge_stats,
                "triple_bridges": triples,
                "triple_bridges_count": len(triples),
                "paradigm_convergence_matrix": paradigm_matrix,
            },
            indent=2, sort_keys=True, default=str,
        ),
        encoding="utf-8",
    )
    log.info(
        "Bridges: %d pairwise, %d triple+, %d paradigm-pair rows (dropped %d dense / %d unique)",
        len(bridges),
        len(triples),
        len(paradigm_matrix),
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
        json.dumps(manifest, indent=2, sort_keys=True, default=str), encoding="utf-8"
    )
    log.info("Published %d legends to %s", len(entries), OUT_DIR)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
