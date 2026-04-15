"""BTUT Query Engine -- standalone version with constructor injection.

Accepts pre-loaded data via constructor instead of reading from files/DB.
Builds O(1) indexes and serves all queries. Generates rule-based anomaly
narratives from scores + fingerprints.

Ported from app.services.btut.query_engine. Changes from original:
  - Removed _find_file, _result_file_for_dataset (file-system coupling).
  - Removed _load_from_db (app.config / SQLAlchemy coupling).
  - Removed _load_from_file (file-system coupling).
  - Constructor accepts (summary, survivors) dicts directly.
  - Removed adapter dependency (get_adapter); callers supply display_fn
    and lookup_field if needed.
  - Removed _load_cache / entity cache (file-system coupling).
  - search() operates only on the in-memory survivor index.
  - Removed module-level _engines registry; callers manage instances.
"""

from __future__ import annotations

import json
import logging
import math
from collections import defaultdict
from typing import Any, Callable

import numpy as np

logger = logging.getLogger(__name__)


class BTUTQueryEngine:
    """Standalone query engine for BTUT results.

    Accepts pre-parsed data at construction time. No file or database
    access -- the caller is responsible for loading/parsing data and
    passing it here.

    Parameters
    ----------
    summary : dict
        The ``summary`` section from a superpower result.
    survivors : list[dict]
        The ``survivors`` list from a superpower result.
    dataset_id : str
        Identifier for the dataset (used in output, not for loading).
    lookup_field : str
        Which attribute key to use as the primary lookup (default ``"ticker"``).
    display_fn : callable or None
        ``(entity_dict) -> {"primary": str, "secondary": str}`` for
        resolving human-readable display names. Falls back to
        ``company_name`` / ``ticker`` attributes.
    anomaly_tag_fn : callable or None
        ``(survivor, scores, cluster_size, flips) -> list[dict]`` for
        domain-specific anomaly tags.
    quality_fn : callable or None
        ``(survivor) -> list[str]`` for domain-specific data-quality signals.
    """

    def __init__(
        self,
        summary: dict,
        survivors: list[dict],
        dataset_id: str = "default",
        lookup_field: str = "ticker",
        display_fn: Callable[[dict], dict] | None = None,
        anomaly_tag_fn: Callable[..., list[dict]] | None = None,
        quality_fn: Callable[[dict], list[str]] | None = None,
    ):
        self._dataset_id = dataset_id
        self._lookup_field = lookup_field
        self._display_fn = display_fn
        self._anomaly_tag_fn = anomaly_tag_fn
        self._quality_fn = quality_fn

        self._summary: dict = summary or {}
        self._survivors: list[dict] = []
        self._by_ticker: dict[str, dict] = {}
        self._by_name: dict[str, dict] = {}
        self._by_cluster: dict[int, list[dict]] = defaultdict(list)
        self._by_type: dict[str, list[dict]] = defaultdict(list)

        self._index(survivors or [])

    # ------------------------------------------------------------------
    # Indexing
    # ------------------------------------------------------------------

    def _index(self, raw_survivors: list[dict]) -> None:
        """Parse and index all survivors."""
        for s in raw_survivors:
            entity = s.get("entity", {})
            attrs_raw = entity.get("attributes", "{}")
            if isinstance(attrs_raw, str):
                try:
                    attrs = json.loads(attrs_raw)
                except (json.JSONDecodeError, TypeError):
                    attrs = {}
            else:
                attrs = attrs_raw

            if self._display_fn:
                display = self._display_fn({"type": entity.get("type", ""), "attributes": attrs})
            else:
                display = {"primary": attrs.get("company_name", ""), "secondary": attrs.get("ticker", "")}

            record = {
                "name": entity.get("name", ""),
                "type": entity.get("type", ""),
                "ticker": attrs.get(self._lookup_field, "") or attrs.get("ticker", ""),
                "company_name": display.get("primary", "") or attrs.get("company_name", ""),
                "cik": attrs.get("cik", "") or attrs.get(self._lookup_field, ""),
                "attributes": attrs,
                "cluster": s.get("cluster", -1),
                "fingerprint": s.get("fingerprint_48bit", ""),
                "flips": s.get("flips", 0),
                "scores": s.get("scores", {}),
                "is_anchor": s.get("is_anchor", False),
            }

            record["anomaly_story"] = self._generate_anomaly_story(record)

            self._survivors.append(record)

            ticker = record["ticker"].upper()
            if ticker:
                self._by_ticker[ticker] = record

            self._by_name[record["name"]] = record
            self._by_cluster[record["cluster"]].append(record)
            self._by_type[record["type"]].append(record)

        logger.info(
            "QueryEngine loaded: %d survivors, %d tickers, %d clusters, %d types",
            len(self._survivors), len(self._by_ticker),
            len(self._by_cluster), len(self._by_type),
        )

        self._metadata_cache: dict[int, dict] = {}

    # ------------------------------------------------------------------
    # Lazy metadata
    # ------------------------------------------------------------------

    def _get_metadata(self, idx: int) -> dict:
        """Lazy-compute metadata for a single survivor on demand."""
        if idx in self._metadata_cache:
            return self._metadata_cache[idx]

        sv = self._survivors[idx]

        if not hasattr(self, "_global_stats"):
            all_composites = [s["scores"].get("composite", 0) for s in self._survivors]
            n = len(self._survivors)
            mean_c = sum(all_composites) / n if n else 0
            std_c = (sum((x - mean_c)**2 for x in all_composites) / n) ** 0.5 if n else 1
            all_anomalies = [s["scores"].get("anomaly", 0) for s in self._survivors]
            mean_a = sum(all_anomalies) / n if n else 0
            std_a = (sum((x - mean_a)**2 for x in all_anomalies) / n) ** 0.5 if n else 1
            self._global_stats = {
                "composite_mean": mean_c, "composite_std": std_c,
                "anomaly_mean": mean_a, "anomaly_std": std_a,
                "total_survivors": n,
            }

        metadata = self._compute_metadata(sv, idx, self._global_stats, {})
        self._metadata_cache[idx] = metadata
        return metadata

    def _compute_metadata(
        self, sv: dict, idx: int, global_stats: dict, fp_index: dict,
    ) -> dict:
        """Compute 12 enriched metadata fields for a single survivor."""
        scores = sv.get("scores", {})
        fp = sv.get("fingerprint", "")
        flips = sv.get("flips", 0)
        cluster_id = sv.get("cluster", -1)
        cluster_members = self._by_cluster.get(cluster_id, [])
        entity_type = sv.get("type", "")

        meta: dict[str, Any] = {}

        # 1. Structural Role Classification
        composite = scores.get("composite", 0)
        anomaly = scores.get("anomaly", 0)
        diversity = scores.get("diversity", 0)

        if diversity >= 1.0 and anomaly > 0.9:
            role = "PIONEER"
            role_desc = "Unique structural fingerprint with extreme anomaly. Defines an entirely new region of the data geometry."
        elif diversity >= 1.0 and len(cluster_members) <= 3:
            role = "ISOLATE"
            role_desc = "Occupies a sparsely populated micro-cluster. Structurally distinct from the bulk of the dataset."
        elif flips < 40 and composite > 0.7:
            role = "ANCHOR"
            role_desc = "Lattice-stable with high signal. Maintains structural identity across rotations. Core representative."
        elif flips >= 46:
            role = "BOUNDARY"
            role_desc = "Extremely sensitive to dimensional rotations. Sits at the edge between structural regions."
        elif len(cluster_members) >= 10 and composite > global_stats["composite_mean"]:
            role = "HUB"
            role_desc = "Member of a large cluster with above-average signal. Represents a major structural grouping."
        elif anomaly > 0.8 and scores.get("reconstruction", 0) > 0.7:
            role = "BRIDGE"
            role_desc = "High anomaly combined with high reconstruction value. Connects otherwise distant regions of the data."
        else:
            role = "MEMBER"
            role_desc = "Standard cluster member contributing to coverage."

        meta["structural_role"] = {"role": role, "description": role_desc}

        # 2. Peer Network
        peers = []
        cluster_peers = self._by_cluster.get(cluster_id, [])

        for other in cluster_peers:
            if other is sv:
                continue
            fp_other = other.get("fingerprint", "")
            min_len = min(len(fp), len(fp_other))
            similarity = sum(1 for a, b in zip(fp[:min_len], fp_other[:min_len]) if a == b) / max(min_len, 1) if min_len > 0 else 0
            peers.append({
                "ticker": other.get("ticker", ""),
                "name": other.get("company_name", "") or other.get("name", ""),
                "type": other.get("type", ""),
                "similarity": round(similarity, 3),
                "shared_cluster": True,
            })

        if len(peers) < 5:
            sample_count = 0
            for other in self._survivors:
                if other is sv or other.get("cluster", -1) == cluster_id:
                    continue
                fp_other = other.get("fingerprint", "")
                min_len = min(len(fp), len(fp_other))
                similarity = sum(1 for a, b in zip(fp[:min_len], fp_other[:min_len]) if a == b) / max(min_len, 1) if min_len > 0 else 0
                peers.append({
                    "ticker": other.get("ticker", ""),
                    "name": other.get("company_name", "") or other.get("name", ""),
                    "type": other.get("type", ""),
                    "similarity": round(similarity, 3),
                    "shared_cluster": False,
                })
                sample_count += 1
                if sample_count >= 50:
                    break

        peers.sort(key=lambda x: -x["similarity"])
        meta["peer_network"] = peers[:5]

        # 3. Cross-Resolution Stability
        coarse = fp[:16] if len(fp) >= 16 else ""
        medium = fp[16:32] if len(fp) >= 32 else ""
        fine = fp[32:48] if len(fp) >= 48 else ""

        coarse_flips = sum(int(c) for c in coarse) if coarse else 0
        medium_flips = sum(int(c) for c in medium) if medium else 0
        fine_flips = sum(int(c) for c in fine) if fine else 0

        stability_profile = {
            "coarse_flip_rate": round(coarse_flips / 16, 3) if coarse else 0,
            "medium_flip_rate": round(medium_flips / 16, 3) if medium else 0,
            "fine_flip_rate": round(fine_flips / 16, 3) if fine else 0,
            "most_stable_resolution": (
                "coarse" if coarse_flips <= medium_flips and coarse_flips <= fine_flips else
                "medium" if medium_flips <= fine_flips else "fine"
            ),
            "cross_resolution_variance": round(
                ((coarse_flips/16 - flips/48)**2 + (medium_flips/16 - flips/48)**2 + (fine_flips/16 - flips/48)**2) / 3, 4
            ) if coarse else 0,
        }
        meta["resolution_stability"] = stability_profile

        # 4. Fingerprint Analytics
        if fp:
            ones = fp.count("1")
            zeros = fp.count("0")
            total_bits = len(fp)
            p = ones / total_bits if total_bits > 0 else 0.5

            entropy = 0
            if 0 < p < 1:
                entropy = -(p * math.log2(p) + (1-p) * math.log2(1-p))

            runs = 1
            for k in range(1, len(fp)):
                if fp[k] != fp[k-1]:
                    runs += 1
            avg_run_length = total_bits / runs if runs > 0 else total_bits

            transitions = sum(1 for k in range(1, len(fp)) if fp[k] != fp[k-1])

            meta["fingerprint_analytics"] = {
                "total_bits": total_bits,
                "ones": ones,
                "zeros": zeros,
                "flip_ratio": round(ones / total_bits, 3),
                "entropy": round(entropy, 4),
                "entropy_interpretation": (
                    "Maximum entropy -- equiprobable flipping" if entropy > 0.95 else
                    "High entropy -- near-random flip pattern" if entropy > 0.8 else
                    "Moderate entropy -- structured flip pattern" if entropy > 0.5 else
                    "Low entropy -- highly ordered flip pattern"
                ),
                "runs": runs,
                "avg_run_length": round(avg_run_length, 2),
                "transitions": transitions,
                "transition_density": round(transitions / max(total_bits - 1, 1), 3),
            }
        else:
            meta["fingerprint_analytics"] = {}

        # 5. Signal Decomposition
        weights = {"diversity": 0.35, "reconstruction": 0.40, "anomaly": 0.25}
        decomposition = {}
        for axis, weight in weights.items():
            val = scores.get(axis, 0)
            contribution = val * weight
            decomposition[axis] = {
                "raw_score": round(val, 4),
                "weight": weight,
                "contribution": round(contribution, 4),
                "pct_of_composite": round(contribution / max(composite, 0.001) * 100, 1),
                "rank_in_axis": 0,
            }

        for axis in weights:
            sorted_by_axis = sorted(self._survivors, key=lambda x: -x["scores"].get(axis, 0))
            for rank, s in enumerate(sorted_by_axis):
                if s is sv:
                    decomposition[axis]["rank_in_axis"] = rank + 1
                    decomposition[axis]["percentile"] = round((1 - rank / max(len(self._survivors) - 1, 1)) * 100, 1)
                    break

        meta["signal_decomposition"] = decomposition

        # 6. Anomaly Taxonomy
        anomaly_tags = []

        if anomaly > 0.9:
            anomaly_tags.append({
                "tag": "EXTREME_OUTLIER",
                "description": "Top 10% anomaly score. Structural profile diverges from 90%+ of its type.",
                "severity": "critical",
            })

        if diversity >= 1.0:
            anomaly_tags.append({
                "tag": "UNIQUE_FINGERPRINT",
                "description": "No other entity shares this exact 48-bit multi-resolution trajectory pattern.",
                "severity": "high",
            })

        if len(cluster_members) == 1:
            anomaly_tags.append({
                "tag": "SINGLETON_CLUSTER",
                "description": "Only entity in its micro-cluster. Completely isolated in structural space.",
                "severity": "high",
            })

        if flips >= 46:
            anomaly_tags.append({
                "tag": "HYPER_DYNAMIC",
                "description": f"Flips in {flips}/48 rotations (96%+). Maximum sensitivity to dimensional perturbation.",
                "severity": "medium",
            })

        if flips <= 38:
            anomaly_tags.append({
                "tag": "LATTICE_STABLE",
                "description": f"Only {flips}/48 flips. Resistant to dimensional rotations -- deep structural stability.",
                "severity": "info",
            })

        if stability_profile.get("cross_resolution_variance", 0) > 0.01:
            anomaly_tags.append({
                "tag": "RESOLUTION_SENSITIVE",
                "description": "Behavior varies significantly across coarse/medium/fine resolutions.",
                "severity": "medium",
            })

        if scores.get("reconstruction", 0) > 0.8:
            anomaly_tags.append({
                "tag": "HIGH_COVERAGE_VALUE",
                "description": "Removing this entity would leave a significant gap in dataset reconstruction.",
                "severity": "high",
            })

        # Domain-specific tags via injected function
        if self._anomaly_tag_fn:
            try:
                domain_tags = self._anomaly_tag_fn(
                    sv, scores, len(cluster_members), flips,
                )
                anomaly_tags.extend(domain_tags)
            except Exception:
                pass

        meta["anomaly_taxonomy"] = anomaly_tags

        # 7. Cluster Context
        if cluster_members:
            cluster_composites = [m["scores"].get("composite", 0) for m in cluster_members]
            cluster_types: dict[str, int] = defaultdict(int)
            for m in cluster_members:
                cluster_types[m["type"]] += 1

            rank_in_cluster = sorted(cluster_composites, reverse=True).index(composite) + 1

            meta["cluster_context"] = {
                "cluster_id": cluster_id,
                "cluster_size": len(cluster_members),
                "rank_in_cluster": rank_in_cluster,
                "is_cluster_leader": rank_in_cluster == 1,
                "cluster_avg_composite": round(sum(cluster_composites) / len(cluster_composites), 4),
                "above_cluster_avg": composite > sum(cluster_composites) / len(cluster_composites),
                "type_distribution": dict(cluster_types),
                "type_homogeneity": round(max(cluster_types.values()) / len(cluster_members), 3),
                "dominant_type": max(cluster_types, key=cluster_types.get),
            }
        else:
            meta["cluster_context"] = {}

        # 8. Relative Position
        composite_z = (composite - global_stats["composite_mean"]) / max(global_stats["composite_std"], 0.001)
        anomaly_z = (anomaly - global_stats["anomaly_mean"]) / max(global_stats["anomaly_std"], 0.001)

        sorted_global = sorted(self._survivors, key=lambda x: -x["scores"].get("composite", 0))
        global_rank = next((r + 1 for r, s in enumerate(sorted_global) if s is sv), 0)

        type_members = self._by_type.get(entity_type, [])
        sorted_type = sorted(type_members, key=lambda x: -x["scores"].get("composite", 0))
        type_rank = next((r + 1 for r, s in enumerate(sorted_type) if s is sv), 0)

        meta["relative_position"] = {
            "global_rank": global_rank,
            "global_percentile": round((1 - global_rank / max(len(self._survivors), 1)) * 100, 1),
            "type_rank": type_rank,
            "type_total": len(type_members),
            "type_percentile": round((1 - type_rank / max(len(type_members), 1)) * 100, 1),
            "composite_z_score": round(composite_z, 2),
            "anomaly_z_score": round(anomaly_z, 2),
            "sigma_label": (
                f"+{composite_z:.1f}sigma" if composite_z > 0 else f"{composite_z:.1f}sigma"
            ),
        }

        # 9. Data Quality Signals
        if self._quality_fn:
            quality_signals = self._quality_fn(sv)
        else:
            attrs = sv.get("attributes", {})
            quality_signals = []
            if entity_type == "company" and not attrs.get("ticker"):
                quality_signals.append("MISSING_TICKER: No ticker symbol")
            quality_signals = quality_signals or ["CLEAN: All expected attributes present"]

        meta["data_quality"] = quality_signals

        # 10. Confidence Assessment
        confidence_factors = []
        confidence_score = 0.5

        if diversity >= 1.0:
            confidence_factors.append(("unique_fingerprint", +0.15))
            confidence_score += 0.15
        if anomaly > 0.8:
            confidence_factors.append(("high_anomaly", +0.10))
            confidence_score += 0.10
        if scores.get("reconstruction", 0) > 0.6:
            confidence_factors.append(("good_reconstruction", +0.10))
            confidence_score += 0.10
        if len(cluster_members) >= 3:
            confidence_factors.append(("cluster_support", +0.10))
            confidence_score += 0.10
        if not quality_signals or quality_signals[0].startswith("CLEAN"):
            confidence_factors.append(("clean_data", +0.05))
            confidence_score += 0.05
        if stability_profile.get("cross_resolution_variance", 0) < 0.005:
            confidence_factors.append(("stable_across_resolutions", +0.05))
            confidence_score += 0.05

        meta["confidence"] = {
            "score": round(min(confidence_score, 1.0), 3),
            "level": (
                "very_high" if confidence_score >= 0.9 else
                "high" if confidence_score >= 0.75 else
                "medium" if confidence_score >= 0.6 else
                "low"
            ),
            "factors": [{"factor": f, "impact": round(v, 2)} for f, v in confidence_factors],
        }

        return meta

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
        total_rotations = 48
        entity_type = record.get("type", "")
        cluster = record.get("cluster", -1)
        cluster_size = len(self._by_cluster.get(cluster, []))

        parts = []

        if anomaly > 0.95:
            parts.append(
                "Extreme structural outlier. This entity's profile diverges from "
                "99%+ of its type in the dataset."
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

        if diversity >= 1.0:
            parts.append(
                "Unique fingerprint -- no other entity in the dataset shares this "
                "exact multi-resolution trajectory pattern."
            )

        if reconstruction > 0.8:
            parts.append(
                f"High reconstruction value ({reconstruction:.3f}). Removing this entity "
                "would leave a significant gap in dataset coverage."
            )

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
            "dataset_id": self._dataset_id,
            "pipeline_status": "ready" if self._survivors else "no_data",
            "total_entities": s.get("total_entities", 0),
            "total_clusters": s.get("clusters", 0),
            "unique_fingerprints": s.get("unique_48bit_fingerprints", 0),
            "survivor_count": s.get("survivors", 0),
            "reduction_ratio": s.get("reduction", 0),
            "survivor_types": s.get("survivor_types", {}),
            "reconstruction": s.get("reconstruction", {}),
            "wall_seconds": s.get("wall_seconds", 0),
        }

    def summary(self) -> dict:
        """Full dataset overview with all key statistics."""
        s = self._summary

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
                "metadata": {},
            })

        return results

    def analyze(self, key: str) -> dict | None:
        """Full analysis for a specific entity by ticker, name, or partial match."""
        record = None

        record = self._by_ticker.get(key.upper()) or self._by_ticker.get(key)

        if not record:
            record = self._by_name.get(key)

        if not record:
            for sv in self._survivors:
                if sv.get("company_name") == key or sv.get("name") == key:
                    record = sv
                    break

        if not record:
            key_lower = key.lower()
            for sv in self._survivors:
                if key_lower in sv.get("name", "").lower() or key_lower in sv.get("company_name", "").lower():
                    record = sv
                    break

        if not record:
            return None

        cluster_id = record["cluster"]
        cluster_members = self._by_cluster.get(cluster_id, [])
        peers = [
            {"name": p["company_name"] or p["name"], "ticker": p["ticker"],
             "type": p["type"], "composite": p["scores"].get("composite", 0)}
            for p in cluster_members if p["name"] != record["name"]
        ][:10]

        scores = record["scores"]

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
            "metadata": self._get_metadata(next((i for i, s in enumerate(self._survivors) if s is record), 0)),
        }

    def clusters(self, min_size: int = 1, top_n: int = 30) -> list[dict]:
        """List clusters with member counts and type distribution."""
        cluster_list = []

        for cluster_id, members in self._by_cluster.items():
            if len(members) < min_size:
                continue

            type_dist: dict[str, int] = defaultdict(int)
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

    def magnitude(self, key: str) -> dict | None:
        """Magnitude profile details for a specific entity."""
        analysis = self.analyze(key)
        if not analysis:
            return None
        record = self._by_ticker.get(analysis.get("ticker", "").upper())
        if not record:
            record = self._by_name.get(key)
        if not record:
            for sv in self._survivors:
                if sv.get("name") == key or sv.get("company_name") == key:
                    record = sv
                    break
        if not record:
            return None

        scores = record["scores"]
        fp = record["fingerprint"]

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
        """Advanced multi-filter query across all survivors."""
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
                "metadata": {},
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

        score_keys = ["composite", "diversity", "reconstruction", "anomaly"]
        comparison: dict[str, Any] = {}
        for key in score_keys:
            values = [e["scores"].get(key, 0) for e in entities]
            comparison[key] = {
                "values": {e["ticker"]: e["scores"].get(key, 0) for e in entities},
                "max": max(values),
                "min": min(values),
                "spread": round(max(values) - min(values), 4),
                "leader": entities[values.index(max(values))]["ticker"],
            }

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

        distributions: dict[str, Any] = {}
        for axis, values in scores_by_axis.items():
            arr = np.array(values)
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
                "metadata": {},
            }
            for i, sv in enumerate(ranked[:n])
        ]

    def cluster_detail(self, cluster_id: int) -> dict | None:
        """Full detail for a specific cluster."""
        members = self._by_cluster.get(cluster_id)
        if not members:
            return None

        type_dist: dict[str, int] = defaultdict(int)
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
        """Search across in-memory survivors by keyword."""
        keyword_lower = keyword.lower()
        results = []

        for sv in self._survivors:
            match = False
            matched_field = ""

            if field:
                value = str(sv.get(field, "") or sv["attributes"].get(field, "")).lower()
                if keyword_lower in value:
                    match = True
                    matched_field = field
            else:
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

        return results
