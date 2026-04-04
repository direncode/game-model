"""BTUT Query Engine -- shared business logic for CLI and API.

Loads superpower result JSON, builds O(1) indexes, and serves all queries.
Generates rule-based anomaly narratives from scores + fingerprints.
"""

from __future__ import annotations

import json
import logging
import os
from collections import defaultdict
from pathlib import Path

logger = logging.getLogger(__name__)

# Search multiple locations for result files (local dev + Docker container)
def _find_file(filename: str) -> str:
    """Search common locations for a BTUT result file."""
    candidates = [
        # Docker container: /app/data/
        Path("/app/data") / filename,
        # Repo root (local dev): 4 levels up from this file
        Path(__file__).resolve().parents[4] / "scripts" / filename,
        # Repo root (local dev): 3 levels up (if running from backend/)
        Path(__file__).resolve().parents[3] / "scripts" / filename,
        # Current working directory
        Path.cwd() / "scripts" / filename,
        Path.cwd() / filename,
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    # Return first candidate as default (will log warning if missing)
    return str(candidates[0])

_DEFAULT_RESULT = _find_file("edgar_superpower_result.json")
_DEFAULT_CACHE = _find_file("edgar_cache.json")


class BTUTQueryEngine:
    """Shared query engine for BTUT results.

    Loads the superpower result JSON at init, parses all survivors,
    builds in-memory indexes for O(1) lookups by ticker/name/cluster/type.
    """

    def __init__(
        self,
        result_path: str | None = None,
        cache_path: str | None = None,
    ):
        self._result_path = result_path or str(_DEFAULT_RESULT)
        self._cache_path = cache_path or str(_DEFAULT_CACHE)

        self._summary: dict = {}
        self._survivors: list[dict] = []
        self._by_ticker: dict[str, dict] = {}
        self._by_name: dict[str, dict] = {}
        self._by_cluster: dict[int, list[dict]] = defaultdict(list)
        self._by_type: dict[str, list[dict]] = defaultdict(list)
        self._cache_entities: list[dict] | None = None

        self._load()

    def _load(self):
        """Load and index the result JSON."""
        if not os.path.exists(self._result_path):
            logger.warning("No result file at %s", self._result_path)
            return

        with open(self._result_path) as f:
            data = json.load(f)

        self._summary = data.get("summary", {})
        raw_survivors = data.get("survivors", [])

        for s in raw_survivors:
            # Parse entity attributes from JSON string
            entity = s.get("entity", {})
            attrs_raw = entity.get("attributes", "{}")
            if isinstance(attrs_raw, str):
                try:
                    attrs = json.loads(attrs_raw)
                except (json.JSONDecodeError, TypeError):
                    attrs = {}
            else:
                attrs = attrs_raw

            record = {
                "name": entity.get("name", ""),
                "type": entity.get("type", ""),
                "ticker": attrs.get("ticker", ""),
                "company_name": attrs.get("company_name", ""),
                "cik": attrs.get("cik", ""),
                "attributes": attrs,
                "cluster": s.get("cluster", -1),
                "fingerprint": s.get("fingerprint_48bit", ""),
                "flips": s.get("flips", 0),
                "scores": s.get("scores", {}),
                "is_anchor": s.get("is_anchor", False),
            }

            # Generate anomaly story
            record["anomaly_story"] = self._generate_anomaly_story(record)

            self._survivors.append(record)

            # Index by ticker
            ticker = record["ticker"].upper()
            if ticker:
                self._by_ticker[ticker] = record

            # Index by name
            self._by_name[record["name"]] = record

            # Index by cluster
            self._by_cluster[record["cluster"]].append(record)

            # Index by type
            self._by_type[record["type"]].append(record)

        logger.info(
            "QueryEngine loaded: %d survivors, %d tickers, %d clusters, %d types",
            len(self._survivors), len(self._by_ticker),
            len(self._by_cluster), len(self._by_type),
        )

    def _load_cache(self):
        """Lazy-load the entity cache for search."""
        if self._cache_entities is not None:
            return
        if not os.path.exists(self._cache_path):
            self._cache_entities = []
            return
        with open(self._cache_path) as f:
            cache = json.load(f)
        self._cache_entities = cache.get("entities", [])
        logger.info("Cache loaded: %d entities", len(self._cache_entities))

    # ------------------------------------------------------------------
    # Anomaly Story Generator
    # ------------------------------------------------------------------

    def _generate_anomaly_story(self, record: dict) -> str:
        """Rule-based narrative from scores + fingerprint + type."""
        scores = record.get("scores", {})
        anomaly = scores.get("anomaly", 0)
        diversity = scores.get("diversity", 0)
        reconstruction = scores.get("reconstruction", 0)
        composite = scores.get("composite", 0)
        flips = record.get("flips", 0)
        total_rotations = 48  # Multi-resolution: 3 x 16
        entity_type = record.get("type", "")
        cluster = record.get("cluster", -1)
        cluster_size = len(self._by_cluster.get(cluster, []))

        parts = []

        # Anomaly-based narrative
        if anomaly > 0.95:
            parts.append(
                "Extreme structural outlier. This entity's profile diverges from "
                "99%+ of its type in the EDGAR dataset."
            )
        elif anomaly > 0.85:
            parts.append(
                "High structural anomaly. Occupies a rare region of the data geometry "
                "with few similar entities."
            )
        elif anomaly > 0.7:
            parts.append(
                "Moderate structural anomaly. Distinct from the bulk of the dataset "
                "but not maximally isolated."
            )
        else:
            parts.append(
                "Representative entity. Structurally similar to many others in the dataset."
            )

        # Flip-based narrative
        flip_pct = flips / total_rotations * 100
        if flip_pct < 75:
            parts.append(
                f"Lattice-stable ({flips}/{total_rotations} flips, {flip_pct:.0f}%). "
                "Maintains structural identity across most dimensional rotations."
            )
        elif flip_pct > 95:
            parts.append(
                f"Highly dynamic ({flips}/{total_rotations} flips, {flip_pct:.0f}%). "
                "Sensitive to dimensional perturbations, indicating a boundary position."
            )

        # Diversity-based
        if diversity >= 1.0:
            parts.append(
                "Unique fingerprint -- no other entity in the dataset shares this "
                "exact multi-resolution trajectory pattern."
            )

        # Reconstruction-based
        if reconstruction > 0.8:
            parts.append(
                f"High reconstruction value ({reconstruction:.3f}). Removing this entity "
                "would leave a significant gap in dataset coverage."
            )

        # Type-specific
        if entity_type == "company":
            ticker = record.get("ticker", "")
            if ticker:
                parts.append(f"[{ticker}]")
        elif entity_type == "filing":
            form = record["attributes"].get("form", "")
            date = record["attributes"].get("date", "")
            if form:
                parts.append(f"Filing type: {form}" + (f" ({date})" if date else ""))
        elif entity_type == "financial_fact":
            concept = record["attributes"].get("concept", record.get("name", ""))
            if concept:
                parts.append(f"XBRL concept: {concept}")

        return " ".join(parts)

    # ------------------------------------------------------------------
    # Query Methods
    # ------------------------------------------------------------------

    def status(self) -> dict:
        """Pipeline status and key metrics."""
        s = self._summary
        return {
            "pipeline_status": "ready" if self._survivors else "no_data",
            "total_entities": s.get("total_entities", 0),
            "total_clusters": s.get("clusters", 0),
            "unique_fingerprints": s.get("unique_48bit_fingerprints", 0),
            "survivor_count": s.get("survivors", 0),
            "reduction_ratio": s.get("reduction", 0),
            "survivor_types": s.get("survivor_types", {}),
            "reconstruction": s.get("reconstruction", {}),
            "wall_seconds": s.get("wall_seconds", 0),
            "result_file": self._result_path,
        }

    def summary(self) -> dict:
        """Full dataset overview with all key statistics."""
        s = self._summary

        # Compute per-type score distributions
        type_stats = {}
        for t, survivors in self._by_type.items():
            scores = [sv["scores"].get("composite", 0) for sv in survivors]
            anomalies = [sv["scores"].get("anomaly", 0) for sv in survivors]
            type_stats[t] = {
                "count": len(survivors),
                "avg_composite": round(sum(scores) / max(len(scores), 1), 4),
                "avg_anomaly": round(sum(anomalies) / max(len(anomalies), 1), 4),
                "max_composite": round(max(scores) if scores else 0, 4),
                "max_anomaly": round(max(anomalies) if anomalies else 0, 4),
            }

        # Top 5 by composite
        sorted_all = sorted(self._survivors, key=lambda x: -x["scores"].get("composite", 0))
        top_5 = [
            {"name": sv["company_name"] or sv["name"], "ticker": sv["ticker"],
             "type": sv["type"], "composite": sv["scores"].get("composite", 0)}
            for sv in sorted_all[:5]
        ]

        return {
            "total_entities": s.get("total_entities", 0),
            "total_clusters": s.get("clusters", 0),
            "unique_fingerprints": s.get("unique_48bit_fingerprints", 0),
            "survivor_count": s.get("survivors", 0),
            "reduction_ratio": s.get("reduction", 0),
            "survivor_types": s.get("survivor_types", {}),
            "reconstruction": s.get("reconstruction", {}),
            "type_statistics": type_stats,
            "top_5_overall": top_5,
            "wall_seconds": s.get("wall_seconds", 0),
            "extrapolation_3000tb": {
                "entities": 3_000_000_000,
                "estimated_survivors": 3_000_000_000 // max(s.get("reduction", 1), 1),
                "estimated_hours": round(s.get("wall_seconds", 0) / max(s.get("total_entities", 1), 1) * 3e9 / 3600, 0),
            },
        }

    def survivors(
        self,
        top_n: int = 20,
        entity_type: str | None = None,
        sort_by: str = "composite",
    ) -> list[dict]:
        """List survivors ranked by score."""
        pool = self._survivors
        if entity_type:
            pool = self._by_type.get(entity_type, [])

        sort_key = lambda x: -x["scores"].get(sort_by, 0)
        sorted_pool = sorted(pool, key=sort_key)

        results = []
        for sv in sorted_pool[:top_n]:
            results.append({
                "rank": len(results) + 1,
                "name": sv["company_name"] or sv["name"],
                "ticker": sv["ticker"],
                "type": sv["type"],
                "cik": sv["cik"],
                "cluster": sv["cluster"],
                "flips": sv["flips"],
                "fingerprint": sv["fingerprint"],
                "scores": sv["scores"],
                "anomaly_story": sv["anomaly_story"],
            })

        return results

    def analyze(self, ticker: str) -> dict | None:
        """Full analysis for a specific company by ticker."""
        record = self._by_ticker.get(ticker.upper())
        if not record:
            return None

        # Find cluster peers
        cluster_id = record["cluster"]
        cluster_members = self._by_cluster.get(cluster_id, [])
        peers = [
            {"name": p["company_name"] or p["name"], "ticker": p["ticker"],
             "type": p["type"], "composite": p["scores"].get("composite", 0)}
            for p in cluster_members if p["name"] != record["name"]
        ][:10]

        # Score breakdown
        scores = record["scores"]

        # Fingerprint analysis
        fp = record["fingerprint"]
        coarse_fp = fp[:16] if len(fp) >= 16 else fp
        medium_fp = fp[16:32] if len(fp) >= 32 else ""
        fine_fp = fp[32:48] if len(fp) >= 48 else ""

        return {
            "ticker": record["ticker"],
            "company_name": record["company_name"],
            "cik": record["cik"],
            "entity_type": record["type"],
            "anomaly_story": record["anomaly_story"],
            "scores": {
                "composite": scores.get("composite", 0),
                "diversity": scores.get("diversity", 0),
                "reconstruction": scores.get("reconstruction", 0),
                "anomaly": scores.get("anomaly", 0),
            },
            "lattice_profile": {
                "total_flips": record["flips"],
                "total_rotations": 48,
                "flip_rate": round(record["flips"] / 48, 3),
                "fingerprint_48bit": record["fingerprint"],
                "coarse_resolution": coarse_fp,
                "medium_resolution": medium_fp,
                "fine_resolution": fine_fp,
            },
            "cluster": {
                "id": cluster_id,
                "total_members": len(cluster_members),
                "peers": peers,
            },
            "attributes": record["attributes"],
        }

    def clusters(self, min_size: int = 1, top_n: int = 30) -> list[dict]:
        """List clusters with member counts and type distribution."""
        cluster_list = []

        for cluster_id, members in self._by_cluster.items():
            if len(members) < min_size:
                continue

            type_dist = defaultdict(int)
            scores = []
            for m in members:
                type_dist[m["type"]] += 1
                scores.append(m["scores"].get("composite", 0))

            cluster_list.append({
                "cluster_id": cluster_id,
                "member_count": len(members),
                "type_distribution": dict(type_dist),
                "avg_composite": round(sum(scores) / max(len(scores), 1), 4),
                "max_composite": round(max(scores) if scores else 0, 4),
                "sample_members": [
                    {"name": m["company_name"] or m["name"], "ticker": m["ticker"], "type": m["type"]}
                    for m in sorted(members, key=lambda x: -x["scores"].get("composite", 0))[:5]
                ],
            })

        cluster_list.sort(key=lambda x: -x["member_count"])
        return cluster_list[:top_n]

    def magnitude(self, ticker: str) -> dict | None:
        """Magnitude profile details for a specific entity."""
        record = self._by_ticker.get(ticker.upper())
        if not record:
            return None

        scores = record["scores"]
        fp = record["fingerprint"]

        # Decode multi-resolution fingerprint into per-resolution flip analysis
        coarse = fp[:16] if len(fp) >= 16 else ""
        medium = fp[16:32] if len(fp) >= 32 else ""
        fine = fp[32:48] if len(fp) >= 48 else ""

        coarse_flips = sum(int(c) for c in coarse) if coarse else 0
        medium_flips = sum(int(c) for c in medium) if medium else 0
        fine_flips = sum(int(c) for c in fine) if fine else 0

        return {
            "ticker": record["ticker"],
            "company_name": record["company_name"],
            "magnitude_profile": {
                "anomaly_score": scores.get("anomaly", 0),
                "diversity_score": scores.get("diversity", 0),
                "reconstruction_score": scores.get("reconstruction", 0),
                "composite_score": scores.get("composite", 0),
            },
            "multi_resolution_analysis": {
                "coarse_resolution_4bins": {
                    "fingerprint": coarse,
                    "flips": coarse_flips,
                    "flip_rate": round(coarse_flips / 16, 3) if coarse else 0,
                    "interpretation": "Mega-cluster level structure",
                },
                "medium_resolution_8bins": {
                    "fingerprint": medium,
                    "flips": medium_flips,
                    "flip_rate": round(medium_flips / 16, 3) if medium else 0,
                    "interpretation": "Sub-cluster level structure",
                },
                "fine_resolution_16bins": {
                    "fingerprint": fine,
                    "flips": fine_flips,
                    "flip_rate": round(fine_flips / 16, 3) if fine else 0,
                    "interpretation": "Boundary-level structure",
                },
            },
            "total_flips": record["flips"],
            "anomaly_story": record["anomaly_story"],
        }

    # ------------------------------------------------------------------
    # Advanced Query Methods
    # ------------------------------------------------------------------

    def query(
        self,
        types: list[str] | None = None,
        min_composite: float | None = None,
        max_composite: float | None = None,
        min_anomaly: float | None = None,
        max_anomaly: float | None = None,
        min_flips: int | None = None,
        max_flips: int | None = None,
        clusters: list[int] | None = None,
        has_ticker: bool | None = None,
        sort_by: str = "composite",
        sort_order: str = "desc",
        limit: int = 100,
        offset: int = 0,
    ) -> dict:
        """Advanced multi-filter query across all survivors.

        Returns {results: [...], total: int, filters_applied: {...}}.
        """
        pool = list(self._survivors)
        filters = {}

        if types:
            pool = [s for s in pool if s["type"] in types]
            filters["types"] = types

        if min_composite is not None:
            pool = [s for s in pool if s["scores"].get("composite", 0) >= min_composite]
            filters["min_composite"] = min_composite
        if max_composite is not None:
            pool = [s for s in pool if s["scores"].get("composite", 0) <= max_composite]
            filters["max_composite"] = max_composite

        if min_anomaly is not None:
            pool = [s for s in pool if s["scores"].get("anomaly", 0) >= min_anomaly]
            filters["min_anomaly"] = min_anomaly
        if max_anomaly is not None:
            pool = [s for s in pool if s["scores"].get("anomaly", 0) <= max_anomaly]
            filters["max_anomaly"] = max_anomaly

        if min_flips is not None:
            pool = [s for s in pool if s["flips"] >= min_flips]
            filters["min_flips"] = min_flips
        if max_flips is not None:
            pool = [s for s in pool if s["flips"] <= max_flips]
            filters["max_flips"] = max_flips

        if clusters:
            pool = [s for s in pool if s["cluster"] in clusters]
            filters["clusters"] = clusters

        if has_ticker is True:
            pool = [s for s in pool if s["ticker"]]
            filters["has_ticker"] = True
        elif has_ticker is False:
            pool = [s for s in pool if not s["ticker"]]
            filters["has_ticker"] = False

        # Sort
        reverse = sort_order == "desc"
        if sort_by == "flips":
            pool.sort(key=lambda x: x["flips"], reverse=reverse)
        elif sort_by == "cluster":
            pool.sort(key=lambda x: x["cluster"], reverse=reverse)
        else:
            pool.sort(key=lambda x: x["scores"].get(sort_by, 0), reverse=reverse)

        total = len(pool)
        page = pool[offset:offset + limit]

        results = []
        for i, sv in enumerate(page):
            results.append({
                "rank": offset + i + 1,
                "name": sv["company_name"] or sv["name"],
                "ticker": sv["ticker"],
                "type": sv["type"],
                "cik": sv["cik"],
                "cluster": sv["cluster"],
                "flips": sv["flips"],
                "fingerprint": sv["fingerprint"],
                "scores": sv["scores"],
                "anomaly_story": sv["anomaly_story"],
            })

        return {"results": results, "total": total, "filters_applied": filters}

    def compare(self, tickers: list[str]) -> dict:
        """Side-by-side comparison of multiple entities."""
        entities = []
        for t in tickers:
            record = self._by_ticker.get(t.upper())
            if not record:
                continue

            cluster_members = self._by_cluster.get(record["cluster"], [])
            fp = record["fingerprint"]

            entities.append({
                "ticker": record["ticker"],
                "company_name": record["company_name"],
                "type": record["type"],
                "scores": record["scores"],
                "flips": record["flips"],
                "cluster": record["cluster"],
                "cluster_size": len(cluster_members),
                "fingerprint": fp,
                "anomaly_story": record["anomaly_story"],
            })

        if not entities:
            return {"entities": [], "comparison": {}}

        # Compute comparison metrics
        score_keys = ["composite", "diversity", "reconstruction", "anomaly"]
        comparison = {}
        for key in score_keys:
            values = [e["scores"].get(key, 0) for e in entities]
            comparison[key] = {
                "values": {e["ticker"]: e["scores"].get(key, 0) for e in entities},
                "max": max(values),
                "min": min(values),
                "spread": round(max(values) - min(values), 4),
                "leader": entities[values.index(max(values))]["ticker"],
            }

        # Fingerprint similarity (Hamming distance)
        if len(entities) >= 2:
            fp_similarities = {}
            for i in range(len(entities)):
                for j in range(i + 1, len(entities)):
                    fp_a = entities[i]["fingerprint"]
                    fp_b = entities[j]["fingerprint"]
                    min_len = min(len(fp_a), len(fp_b))
                    if min_len > 0:
                        matches = sum(1 for a, b in zip(fp_a[:min_len], fp_b[:min_len]) if a == b)
                        similarity = round(matches / min_len, 3)
                    else:
                        similarity = 0
                    pair_key = f"{entities[i]['ticker']}_vs_{entities[j]['ticker']}"
                    fp_similarities[pair_key] = similarity
            comparison["fingerprint_similarity"] = fp_similarities

        # Same cluster?
        cluster_ids = [e["cluster"] for e in entities]
        comparison["same_cluster"] = len(set(cluster_ids)) == 1

        return {"entities": entities, "comparison": comparison}

    def distributions(self) -> dict:
        """Score distributions and aggregate analytics across all survivors."""
        if not self._survivors:
            return {}

        scores_by_axis = {"composite": [], "diversity": [], "reconstruction": [], "anomaly": []}
        for sv in self._survivors:
            for axis in scores_by_axis:
                scores_by_axis[axis].append(sv["scores"].get(axis, 0))

        import numpy as np

        distributions = {}
        for axis, values in scores_by_axis.items():
            arr = np.array(values)
            # Histogram: 10 bins from 0 to 1
            hist, edges = np.histogram(arr, bins=10, range=(0, 1))
            distributions[axis] = {
                "mean": round(float(arr.mean()), 4),
                "std": round(float(arr.std()), 4),
                "min": round(float(arr.min()), 4),
                "max": round(float(arr.max()), 4),
                "p25": round(float(np.percentile(arr, 25)), 4),
                "p50": round(float(np.percentile(arr, 50)), 4),
                "p75": round(float(np.percentile(arr, 75)), 4),
                "histogram": {
                    "counts": hist.tolist(),
                    "edges": [round(float(e), 2) for e in edges.tolist()],
                },
            }

        # Flip distribution
        flips = np.array([sv["flips"] for sv in self._survivors])
        flip_hist, flip_edges = np.histogram(flips, bins=10, range=(0, 48))
        distributions["flips"] = {
            "mean": round(float(flips.mean()), 1),
            "std": round(float(flips.std()), 1),
            "min": int(flips.min()),
            "max": int(flips.max()),
            "histogram": {
                "counts": flip_hist.tolist(),
                "edges": [round(float(e), 1) for e in flip_edges.tolist()],
            },
        }

        # Type breakdown with score stats
        type_breakdown = {}
        for t, members in self._by_type.items():
            composites = [m["scores"].get("composite", 0) for m in members]
            anomalies = [m["scores"].get("anomaly", 0) for m in members]
            type_breakdown[t] = {
                "count": len(members),
                "pct": round(len(members) / max(len(self._survivors), 1) * 100, 1),
                "composite_avg": round(sum(composites) / max(len(composites), 1), 4),
                "anomaly_avg": round(sum(anomalies) / max(len(anomalies), 1), 4),
            }

        # Cluster size distribution
        cluster_sizes = [len(members) for members in self._by_cluster.values()]
        size_arr = np.array(cluster_sizes)
        distributions["cluster_sizes"] = {
            "total_clusters": len(cluster_sizes),
            "mean_size": round(float(size_arr.mean()), 1),
            "median_size": round(float(np.median(size_arr)), 1),
            "max_size": int(size_arr.max()),
            "singleton_clusters": int((size_arr == 1).sum()),
        }

        return {
            "score_distributions": distributions,
            "type_breakdown": type_breakdown,
            "total_survivors": len(self._survivors),
        }

    def top_anomalies(self, n: int = 20, entity_type: str | None = None) -> list[dict]:
        """Top N most anomalous entities ranked by anomaly score."""
        pool = self._survivors
        if entity_type:
            pool = self._by_type.get(entity_type, [])

        ranked = sorted(pool, key=lambda x: -x["scores"].get("anomaly", 0))

        return [
            {
                "rank": i + 1,
                "name": sv["company_name"] or sv["name"],
                "ticker": sv["ticker"],
                "type": sv["type"],
                "anomaly_score": sv["scores"].get("anomaly", 0),
                "composite_score": sv["scores"].get("composite", 0),
                "cluster": sv["cluster"],
                "flips": sv["flips"],
                "anomaly_story": sv["anomaly_story"],
            }
            for i, sv in enumerate(ranked[:n])
        ]

    def cluster_detail(self, cluster_id: int) -> dict | None:
        """Full detail for a specific cluster."""
        members = self._by_cluster.get(cluster_id)
        if not members:
            return None

        type_dist = defaultdict(int)
        composites = []
        anomalies = []
        for m in members:
            type_dist[m["type"]] += 1
            composites.append(m["scores"].get("composite", 0))
            anomalies.append(m["scores"].get("anomaly", 0))

        sorted_members = sorted(members, key=lambda x: -x["scores"].get("composite", 0))

        return {
            "cluster_id": cluster_id,
            "member_count": len(members),
            "type_distribution": dict(type_dist),
            "score_stats": {
                "avg_composite": round(sum(composites) / len(composites), 4),
                "max_composite": round(max(composites), 4),
                "min_composite": round(min(composites), 4),
                "avg_anomaly": round(sum(anomalies) / len(anomalies), 4),
            },
            "members": [
                {
                    "name": m["company_name"] or m["name"],
                    "ticker": m["ticker"],
                    "type": m["type"],
                    "scores": m["scores"],
                    "flips": m["flips"],
                    "anomaly_story": m["anomaly_story"],
                }
                for m in sorted_members
            ],
        }

    def search(self, keyword: str, field: str | None = None) -> list[dict]:
        """Search across entities by keyword."""
        keyword_lower = keyword.lower()
        results = []

        # Search survivors first
        for sv in self._survivors:
            match = False
            matched_field = ""

            if field:
                value = str(sv.get(field, "") or sv["attributes"].get(field, "")).lower()
                if keyword_lower in value:
                    match = True
                    matched_field = field
            else:
                # Search all text fields
                for f in ["ticker", "company_name", "name"]:
                    if keyword_lower in str(sv.get(f, "")).lower():
                        match = True
                        matched_field = f
                        break
                if not match:
                    for k, v in sv["attributes"].items():
                        if keyword_lower in str(v).lower():
                            match = True
                            matched_field = f"attributes.{k}"
                            break

            if match:
                results.append({
                    "name": sv["company_name"] or sv["name"],
                    "ticker": sv["ticker"],
                    "type": sv["type"],
                    "matched_field": matched_field,
                    "composite": sv["scores"].get("composite", 0),
                    "is_survivor": True,
                })

        # Also search the cache if loaded
        if not results or len(results) < 10:
            self._load_cache()
            if self._cache_entities:
                for ent in self._cache_entities[:50000]:  # Cap for speed
                    attrs = ent.get("attributes", "{}")
                    if isinstance(attrs, str):
                        try:
                            attrs = json.loads(attrs)
                        except (json.JSONDecodeError, TypeError):
                            attrs = {}

                    searchable = " ".join([
                        str(attrs.get("company_name", "")),
                        str(attrs.get("ticker", "")),
                        str(attrs.get("description", "")),
                        str(attrs.get("concept", "")),
                        ent.get("name", ""),
                    ]).lower()

                    if keyword_lower in searchable:
                        name = attrs.get("company_name", attrs.get("description", attrs.get("concept", ent.get("name", ""))))
                        ticker = attrs.get("ticker", "")
                        # Skip if already in survivor results
                        if any(r["ticker"] == ticker and ticker for r in results):
                            continue
                        results.append({
                            "name": name,
                            "ticker": ticker,
                            "type": ent.get("type", ""),
                            "matched_field": "cache_search",
                            "composite": 0,
                            "is_survivor": False,
                        })
                        if len(results) >= 50:
                            break

        return results


# Singleton instance
_engine: BTUTQueryEngine | None = None


def get_query_engine(
    result_path: str | None = None,
    cache_path: str | None = None,
) -> BTUTQueryEngine:
    """Get or create the singleton query engine."""
    global _engine
    if _engine is None:
        _engine = BTUTQueryEngine(result_path, cache_path)
    return _engine
