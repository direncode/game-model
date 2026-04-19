"""Cross-dimensional analyzers for BTUT survivor corpora.

Migrated from scripts/publish_legends.py. Deterministic, offline,
no external dependencies beyond stdlib.
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from typing import Any

from lo_core.schemas import (
    ConvergenceEntry,
    ConvergentCluster,
    CrossEraAnchor,
    Findings,
    SurvivorRank,
)


# ─── Structured-name parsing ─────────────────────────────────────────────────

_MODERN_PREFIXES = ("modern_", "arxiv_", "witricity_", "conway_", "wolfram_", "chomsky_")
_MODERN_MARKERS = ("_usrpto_", "_nsf_", "_indiana_university_", "_santa_fe_", "ias_", "_arxiv_")
_CHUNK_RE = re.compile(r"__c\d{2,4}$")

# Default paradigm roles. Customers override via `role_map` argument.
DEFAULT_PARADIGM_ROLES: dict[str, dict[str, str]] = {
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


def parse_entity_name(name: str) -> dict:
    """Parse a structured BTUT entity name into {corpus, subcorpus, kind, slug, era_class}."""
    if not isinstance(name, str) or not name:
        return {"corpus": "unknown", "subcorpus": "unknown", "kind": "unknown",
                "slug": name or "", "era_class": "unknown"}

    lower = name.lower()
    era_class = "historical"
    if lower.startswith(_MODERN_PREFIXES):
        era_class = "modern"
    elif any(m in lower for m in _MODERN_MARKERS):
        era_class = "modern"
    elif _CHUNK_RE.search(name):
        era_class = "chunk"

    parts = name.split("__")
    if len(parts) >= 3:
        corpus_sub = parts[0]
        kind = parts[1]
        slug = "__".join(parts[2:])
        bits = corpus_sub.split("_", 1)
        corpus = bits[0]
        subcorpus = bits[1] if len(bits) > 1 else ""
        return {"corpus": corpus, "subcorpus": subcorpus, "kind": kind, "slug": slug,
                "era_class": era_class}

    if _CHUNK_RE.search(name):
        return {"corpus": "chunk", "subcorpus": "", "kind": "chunk", "slug": name,
                "era_class": "chunk"}
    return {"corpus": name.split("_", 1)[0] if "_" in name else name, "subcorpus": "",
            "kind": "unknown", "slug": name, "era_class": era_class}


def _role_for(
    corpus: str, subcorpus: str, role_map: dict[str, dict[str, str]] | None
) -> str:
    roles = (role_map or {}).get(corpus) or {}
    if subcorpus in roles:
        return roles[subcorpus]
    for key, role in roles.items():
        if subcorpus.startswith(key) or key.startswith(subcorpus):
            return role
    return "other"


# ─── Per-corpus analyzers ────────────────────────────────────────────────────


def paradigm_distribution(
    survivors: list[dict], role_map: dict[str, dict[str, str]] | None = None
) -> dict:
    """Count entities by (corpus, subcorpus, role). Hypothesis-test forgotten > competitors.

    Only declared corpora (those in role_map) receive a hypothesis test; name-pattern
    artifacts like 'chunk' and 'modern' are counted for display but not tested.
    """
    roles_source = role_map if role_map is not None else DEFAULT_PARADIGM_ROLES
    counts: Counter[tuple[str, str, str]] = Counter()
    role_counts: Counter[str] = Counter()
    by_corpus: dict[str, Counter[str]] = defaultdict(Counter)

    for s in survivors:
        name = ((s.get("entity") or {}).get("name")) or ""
        parsed = parse_entity_name(name)
        corpus = parsed["corpus"]
        sub = parsed["subcorpus"]
        role = _role_for(corpus, sub, roles_source)
        counts[(corpus, sub, role)] += 1
        role_counts[role] += 1
        by_corpus[corpus][role] += 1

    hypothesis: dict[str, dict] = {}
    for corpus, rc in by_corpus.items():
        if corpus not in roles_source:
            continue
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


def within_cluster_rank(survivors: list[dict]) -> dict[str, SurvivorRank]:
    by_cluster: dict[int, list[dict]] = defaultdict(list)
    for s in survivors:
        by_cluster[int(s.get("cluster", 0))].append(s)

    rank_map: dict[str, SurvivorRank] = {}
    for cluster, members in by_cluster.items():
        members_sorted = sorted(
            members, key=lambda m: float(((m.get("scores") or {}).get("anomaly")) or 0.0),
            reverse=True,
        )
        total = len(members_sorted)
        for i, m in enumerate(members_sorted):
            name = ((m.get("entity") or {}).get("name")) or ""
            if not name:
                continue
            rank_map[name] = SurvivorRank(
                cluster=cluster,
                rank=i + 1,
                total_in_cluster=total,
                percentile=(round(1.0 - i / max(1, total - 1), 4) if total > 1 else 1.0),
            )
    return rank_map


def convergent_clusters(
    survivors: list[dict], anomaly_threshold: float = 0.85
) -> list[ConvergentCluster]:
    by_cluster: dict[int, list[dict]] = defaultdict(list)
    for s in survivors:
        by_cluster[int(s.get("cluster", 0))].append(s)

    out: list[ConvergentCluster] = []
    for cluster, members in by_cluster.items():
        hot = [m for m in members
               if float(((m.get("scores") or {}).get("anomaly")) or 0.0) >= anomaly_threshold]
        if not hot:
            continue
        paradigm_counts: Counter[str] = Counter()
        for m in hot:
            name = ((m.get("entity") or {}).get("name")) or ""
            p = parse_entity_name(name)
            paradigm_counts[f"{p['corpus']}_{p['subcorpus']}"] += 1
        dominant, dominant_n = (
            paradigm_counts.most_common(1)[0] if paradigm_counts else ("", 0)
        )
        out.append(ConvergentCluster(
            cluster=cluster,
            hot_count=len(hot),
            total=len(members),
            hot_fraction=round(len(hot) / max(1, len(members)), 3),
            dominant_paradigm=dominant,
            dominant_paradigm_share=dominant_n,
        ))
    out.sort(key=lambda x: x.hot_count, reverse=True)
    return out


def cross_era_anchors(
    survivors: list[dict], top_k: int = 15
) -> list[CrossEraAnchor]:
    survivors_meta: list[dict] = []
    for s in survivors:
        name = ((s.get("entity") or {}).get("name")) or ""
        parsed = parse_entity_name(name)
        survivors_meta.append({
            "name": name,
            "cluster": int(s.get("cluster", 0)),
            "era_class": parsed["era_class"],
            "corpus": parsed["corpus"],
            "subcorpus": parsed["subcorpus"],
            "anomaly": float(((s.get("scores") or {}).get("anomaly")) or 0.0),
        })

    by_cluster: dict[int, Counter[str]] = defaultdict(Counter)
    for m in survivors_meta:
        if m["era_class"] in ("chunk", "unknown"):
            continue
        by_cluster[m["cluster"]][m["era_class"]] += 1

    anchors: list[CrossEraAnchor] = []
    for m in survivors_meta:
        if m["era_class"] in ("chunk", "unknown"):
            continue
        cluster_eras = by_cluster.get(m["cluster"])
        if not cluster_eras or len(cluster_eras) < 2:
            continue
        majority, majority_n = cluster_eras.most_common(1)[0]
        if m["era_class"] == majority:
            continue
        anchors.append(CrossEraAnchor(
            name=m["name"],
            era_class=m["era_class"],
            cluster_majority_era=majority,
            cluster_majority_count=majority_n,
            cluster_size_named=sum(cluster_eras.values()),
            cluster=m["cluster"],
            corpus=m["corpus"],
            subcorpus=m["subcorpus"],
            anomaly=round(m["anomaly"], 4),
        ))
    anchors.sort(key=lambda a: a.anomaly, reverse=True)
    return anchors[:top_k]


def convergence_index(
    survivors: list[dict],
    within_rank: dict[str, SurvivorRank],
    cross_era: list[CrossEraAnchor],
    fingerprints: dict[str, str],
    global_fp_count: dict[str, int],
    top_k: int = 20,
) -> list[ConvergenceEntry]:
    """Per-entity score across 4 independent tests: anomaly / cluster-rank /
    cross-era / rare-fingerprint. Convergence on multiple dimensions is signal;
    single-dimension hits are usually noise."""
    era_names = {a.name for a in cross_era}

    scored: list[ConvergenceEntry] = []
    for s in survivors:
        name = ((s.get("entity") or {}).get("name")) or ""
        scores = s.get("scores") or {}
        anom = float(scores.get("anomaly") or 0.0)

        # D1: raw anomaly
        d_anom = anom

        # D2: within-cluster percentile
        rk = within_rank.get(name)
        d_cluster = rk.percentile if rk else 0.0

        # D3: cross-era anchor?
        d_cross_era = 1.0 if name in era_names else 0.0

        # D4: rare-fingerprint membership (gc=2 peaks, dense zone penalized)
        fp = fingerprints.get(name, "")
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
            d_rare_fp = 0.2
        else:
            d_rare_fp = 0.0

        convergence = round(
            0.35 * d_anom + 0.25 * d_cluster + 0.2 * d_cross_era + 0.2 * d_rare_fp, 4
        )
        scored.append(ConvergenceEntry(
            name=name,
            type=((s.get("entity") or {}).get("type")) or "Unknown",
            convergence=convergence,
            dimensions={
                "anomaly": round(d_anom, 4),
                "cluster_percentile": round(d_cluster, 4),
                "cross_era": d_cross_era,
                "rare_fingerprint": round(d_rare_fp, 4),
            },
        ))
    scored.sort(key=lambda r: r.convergence, reverse=True)
    return scored[:top_k]


# ─── Cross-legend analyzers ──────────────────────────────────────────────────


def compute_bridges(
    legend_fingerprints: dict[str, dict[str, str]],
    density_threshold_pct: float = 5.0,
) -> tuple[list[dict], dict]:
    """Pairwise 48-bit-fingerprint intersections across legends.

    - Drops dense zone (fingerprints present in >density_threshold_pct of legends).
    - Weights each match by 1/log(2 + global_count). Rare matches count more.
    - Ranks bridges by weighted_score.
    """
    global_fp: dict[str, int] = {}
    total_survivors = 0
    for fps in legend_fingerprints.values():
        unique = set(fps.values())
        for fp in unique:
            global_fp[fp] = global_fp.get(fp, 0) + 1
        total_survivors += len(fps)

    density_cutoff = max(2, int(len(legend_fingerprints) * density_threshold_pct / 100.0))
    dense_fps = {fp for fp, c in global_fp.items() if c > density_cutoff}

    legend_unique_fps: dict[str, dict[str, str]] = {}
    for legend_id, fps in legend_fingerprints.items():
        unique: dict[str, str] = {}
        for name, fp in fps.items():
            if fp in dense_fps:
                continue
            unique.setdefault(fp, name)
        legend_unique_fps[legend_id] = unique

    legend_ids = sorted(legend_unique_fps.keys())
    bridges: list[dict] = []
    for i, a in enumerate(legend_ids):
        fp_a = legend_unique_fps[a]
        for b in legend_ids[i + 1:]:
            fp_b = legend_unique_fps[b]
            shared = set(fp_a.keys()) & set(fp_b.keys())
            if not shared:
                continue
            samples: list[dict] = []
            weighted = 0.0
            for fp in sorted(shared, key=lambda f: global_fp[f]):
                gc = global_fp[fp]
                w = 1.0 / math.log(2 + gc)
                weighted += w
                samples.append({
                    "fp": fp,
                    "a_name": fp_a[fp],
                    "b_name": fp_b[fp],
                    "global_count": gc,
                    "weight": round(w, 4),
                })
            bridges.append({
                "a": a, "b": b,
                "shared_count": len(shared),
                "weighted_score": round(weighted, 4),
                "samples": samples[:10],
            })
    bridges.sort(key=lambda br: br["weighted_score"], reverse=True)

    stats = {
        "total_unique_fingerprints": len(global_fp),
        "total_survivors": total_survivors,
        "dense_fingerprints_dropped": len(dense_fps),
        "density_threshold_legend_count": density_cutoff,
        "density_threshold_pct": density_threshold_pct,
    }
    return bridges, stats


def triple_bridges(
    legend_fingerprints: dict[str, dict[str, str]],
    global_fp_count: dict[str, int],
    density_threshold_pct: float = 5.0,
) -> list[dict]:
    """Fingerprints appearing in ≥3 legends, after density filtering."""
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
            continue
        triples.append({
            "fingerprint": fp,
            "legend_count": n,
            "legends": sorted(legend_names.keys()),
            "entities": [{"legend": lg, "name": nm} for lg, nm in sorted(legend_names.items())],
        })
    triples.sort(key=lambda t: t["legend_count"])
    return triples


def global_fingerprint_count(
    legend_fingerprints: dict[str, dict[str, str]],
) -> dict[str, int]:
    out: dict[str, int] = {}
    for fps in legend_fingerprints.values():
        for fp in set(fps.values()):
            out[fp] = out.get(fp, 0) + 1
    return out


def extract_fingerprints(survivors: list[dict]) -> dict[str, str]:
    out: dict[str, str] = {}
    for s in survivors:
        name = ((s.get("entity") or {}).get("name")) or ""
        fp = s.get("fingerprint_48bit")
        if name and fp:
            out[name] = fp
    return out


# ─── Top-level facade ────────────────────────────────────────────────────────


def analyze_corpus(
    survivors: list[dict],
    corpus_id: str = "corpus",
    role_map: dict[str, dict[str, str]] | None = None,
    fingerprints: dict[str, str] | None = None,
    global_fp_count: dict[str, int] | None = None,
    anomaly_threshold: float = 0.85,
    top_convergence_k: int = 20,
) -> Findings:
    """Run all per-corpus analyzers and return a Findings document."""
    fps = fingerprints if fingerprints is not None else extract_fingerprints(survivors)
    gfc = global_fp_count if global_fp_count is not None else {fp: 1 for fp in set(fps.values())}

    paradigm = paradigm_distribution(survivors, role_map=role_map)
    rank_map = within_cluster_rank(survivors)
    clusters = convergent_clusters(survivors, anomaly_threshold=anomaly_threshold)
    eras = cross_era_anchors(survivors)
    convergence = convergence_index(
        survivors, rank_map, eras, fps, gfc, top_k=top_convergence_k,
    )

    n_clusters = len({int(s.get("cluster", 0)) for s in survivors})
    return Findings(
        corpus_id=corpus_id,
        survivor_count=len(survivors),
        cluster_count=n_clusters,
        paradigm_distribution=paradigm,
        convergent_clusters=clusters,
        cross_era_anchors=eras,
        convergence_index=convergence,
        within_cluster_rank=rank_map,
    )
