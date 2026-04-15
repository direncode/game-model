"""LatentOceanEngine — pure computational engine, zero application dependencies.

The engine orchestrates the full data-intelligence pipeline:

    reduce  ->  represent  ->  discover  ->  monitor

It never imports from ``app.*``. All external data flows in through
connectors (``engine.connectors.base.BaseConnector``).

Usage:
    >>> from engine import LatentOceanEngine, EngineConfig
    >>> engine = LatentOceanEngine(EngineConfig(budget_dollars=50.0))
    >>> result = engine.run(my_connector, limit=10_000)
    >>> print(result.quality.reduction_ratio)
"""
from __future__ import annotations

import logging
import time
from typing import Any, Callable

import numpy as np

from .config import EngineConfig
from .types import (
    BTUTRunResult,
    CausalLink,
    FullResult,
    ManifoldResult,
    MonitorResult,
    QualityMetrics,
    ReductionResult,
    Survivor,
)

logger = logging.getLogger(__name__)


class LatentOceanEngine:
    """Standalone computational engine for structural intelligence.

    Takes an ``EngineConfig`` at construction time and exposes pure
    methods that transform data without touching databases, caches,
    or web frameworks.

    Example (step-by-step):
        >>> engine = LatentOceanEngine(EngineConfig())
        >>> reduction = engine.reduce(entities, edges, types)
        >>> manifold  = engine.represent(reduction)

    Example (one-shot via connector):
        >>> engine = LatentOceanEngine(EngineConfig())
        >>> result  = engine.run(my_connector, limit=10_000)
    """

    def __init__(self, config: EngineConfig | None = None) -> None:
        self.config = config or EngineConfig()

    # ── helpers ─────────────────────────────────────────────────────────

    def _log(self, msg: str) -> None:
        logger.info(msg)

    # ── Stage 1: reduce ────────────────────────────────────────────────

    def reduce(
        self,
        entities: list[dict],
        edges: list[dict],
        types: list[str],
        callback: Callable[[str], None] | None = None,
    ) -> ReductionResult:
        """Run the full BTUT reduction pipeline.

        Args:
            entities: List of ``{name, type, attributes}`` dicts.
            edges: List of ``{source, target, type, weight}`` dicts.
            types: Sorted list of unique entity type strings.
            callback: Optional progress callback ``(msg) -> None``.

        Returns:
            A ``ReductionResult`` with survivors, embeddings, and timing.
        """
        from .reduce import run_btut_pipeline

        wall_start = time.time()
        raw = run_btut_pipeline(
            entities=entities,
            edges=edges,
            unique_types=types,
            target_survivors=self.config.target_survivors,
            budget_dollars=self.config.budget_dollars,
            progress_callback=callback,
        )
        wall = time.time() - wall_start

        flat = raw.get("embeddings_8d") or []
        n_surv = len(raw.get("survivors", []))
        if n_surv > 0 and len(flat) == n_surv * 8:
            embeddings_8d = np.asarray(flat, dtype=np.float32).reshape(n_surv, 8)
        else:
            embeddings_8d = np.zeros((n_surv, 8), dtype=np.float32)

        self._log(
            f"[engine] stage=reduce n_input={len(entities)} "
            f"n_survivors={n_surv} wall={wall:.1f}s"
        )
        return ReductionResult(
            summary=raw.get("summary", {}),
            survivors=raw.get("survivors", []),
            embeddings_8d=embeddings_8d,
            wall_seconds=wall,
            embed_context={
                "n_input": len(entities),
                "n_edges": len(edges),
                "n_types": len(types),
                "budget": self.config.budget_dollars,
            },
        )

    # ── Stage 2: represent ─────────────────────────────────────────────

    def represent(self, reduction: ReductionResult) -> ManifoldResult:
        """Project survivor embeddings onto the unit hypersphere.

        Always produces 8D unit-sphere coordinates. Optionally computes
        3D S2 display coordinates if ``config.compute_3d_display`` is set.

        Args:
            reduction: Output of ``reduce()``.

        Returns:
            A ``ManifoldResult`` with 8D (and optionally 3D) coordinates.
        """
        # L2-normalize to unit sphere (inline — avoids app dependency)
        embeddings = reduction.embeddings_8d
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1.0, norms)
        coords_8d_unit = embeddings / norms

        coords_3d_s2 = None
        if self.config.compute_3d_display and coords_8d_unit.shape[0] >= 3:
            # PCA down to 3D, then normalize to S2
            centered = coords_8d_unit - coords_8d_unit.mean(axis=0)
            try:
                _, _, vt = np.linalg.svd(centered, full_matrices=False)
                proj_3d = centered @ vt[:3].T
                norms_3d = np.linalg.norm(proj_3d, axis=1, keepdims=True)
                norms_3d = np.where(norms_3d == 0, 1.0, norms_3d)
                coords_3d_s2 = proj_3d / norms_3d
            except np.linalg.LinAlgError:
                coords_3d_s2 = None

        method = "l2_normalize_8d" + ("+pca_s2" if coords_3d_s2 is not None else "")
        self._log(
            f"[engine] stage=represent coords_8d={coords_8d_unit.shape} "
            f"coords_3d={None if coords_3d_s2 is None else coords_3d_s2.shape}"
        )
        return ManifoldResult(
            coords_8d_unit=coords_8d_unit,
            coords_3d_s2=coords_3d_s2,
            projection_method=method,
        )

    # ── Stage 3: discover ──────────────────────────────────────────────

    def discover(
        self,
        manifold_a: ManifoldResult,
        manifold_b: ManifoldResult,
        threshold: float = 0.75,
    ) -> list[CausalLink]:
        """Find causal links between two manifold layers via cosine similarity.

        Computes dot products between all pairs of 8D unit vectors from
        ``manifold_a`` and ``manifold_b``, returning links above
        ``threshold``.

        Args:
            manifold_a: First manifold (e.g. EDGAR companies).
            manifold_b: Second manifold (e.g. PubMed papers).
            threshold: Minimum cosine similarity to emit a link.

        Returns:
            List of ``CausalLink`` objects sorted by strength descending.
        """
        coords_a = manifold_a.coords_8d_unit
        coords_b = manifold_b.coords_8d_unit

        # Cosine similarity matrix (unit vectors => dot product)
        sim_matrix = coords_a @ coords_b.T

        links: list[CausalLink] = []
        rows, cols = np.where(sim_matrix >= threshold)
        for r, c in zip(rows, cols):
            links.append(
                CausalLink(
                    source_a=f"a_{r}",
                    source_b=f"b_{c}",
                    signal="cosine",
                    strength=float(sim_matrix[r, c]),
                )
            )

        links.sort(key=lambda lk: lk.strength, reverse=True)
        self._log(
            f"[engine] stage=discover n_links={len(links)} "
            f"threshold={threshold}"
        )
        return links

    # ── Stage 4: monitor ───────────────────────────────────────────────

    def monitor(
        self,
        wells: list[dict],
        wires: list[dict],
    ) -> MonitorResult:
        """Build a flow graph and compute health metrics.

        This is a forward pass through the flow-engine monitoring
        subsystem. ``wells`` and ``wires`` describe the graph topology;
        the method computes circulation, friction, saturation, and
        resilience metrics.

        Args:
            wells: List of well-state dicts (nodes in the flow graph).
            wires: List of wire-state dicts (edges in the flow graph).

        Returns:
            A ``MonitorResult`` with scalar metrics and per-node/edge states.
        """
        # Compute basic flow metrics from well/wire topology
        n_wells = len(wells)
        n_wires = len(wires)

        # Circulation rate: fraction of wells with active flow
        active_wells = sum(1 for w in wells if w.get("active", False))
        circulation_rate = active_wells / max(n_wells, 1)

        # Friction index: average wire resistance
        resistances = [w.get("resistance", 0.0) for w in wires]
        friction_index = sum(resistances) / max(len(resistances), 1)

        # Saturation pressure: fraction of wells at capacity
        saturated = sum(1 for w in wells if w.get("pressure", 0) >= w.get("capacity", 1))
        saturation_pressure = saturated / max(n_wells, 1)

        # Resilience: 1 - (fraction of degraded components)
        degraded = sum(
            1 for w in wells if w.get("health", "ok") != "ok"
        ) + sum(
            1 for w in wires if w.get("health", "ok") != "ok"
        )
        total_components = n_wells + n_wires
        resilience = 1.0 - (degraded / max(total_components, 1))

        # Detect alerts
        alerts: list[dict] = []
        for w in wells:
            if w.get("health", "ok") == "critical":
                alerts.append({
                    "type": "well_critical",
                    "well_id": w.get("id", "unknown"),
                    "message": f"Well {w.get('id', '?')} in critical state",
                })
        for w in wires:
            if w.get("health", "ok") == "critical":
                alerts.append({
                    "type": "wire_critical",
                    "wire_id": w.get("id", "unknown"),
                    "message": f"Wire {w.get('id', '?')} in critical state",
                })

        self._log(
            f"[engine] stage=monitor wells={n_wells} wires={n_wires} "
            f"circulation={circulation_rate:.2f} alerts={len(alerts)}"
        )
        return MonitorResult(
            circulation_rate=circulation_rate,
            friction_index=friction_index,
            saturation_pressure=saturation_pressure,
            resilience=resilience,
            well_states=wells,
            wire_states=wires,
            alerts=alerts,
        )

    # ── Query (placeholder) ────────────────────────────────────────────

    def query(
        self,
        reduction: ReductionResult,
        query_text: str,
    ) -> dict[str, Any]:
        """Placeholder for semantic query over reduced data.

        Will be implemented when the query engine is extracted.
        Currently returns an empty result stub.

        Args:
            reduction: A completed reduction result.
            query_text: Natural language query string.

        Returns:
            Dict with query results (currently a stub).
        """
        self._log(f"[engine] stage=query text={query_text!r} (stub)")
        return {
            "query": query_text,
            "matches": [],
            "n_searched": len(reduction.survivors),
            "status": "stub",
        }

    # ── Hydration helpers ──────────────────────────────────────────────

    def _hydrate_survivors(
        self,
        reduction: ReductionResult,
        manifold: ManifoldResult,
    ) -> list[Survivor]:
        """Build typed Survivor objects from reduction + manifold coords."""
        out: list[Survivor] = []
        for i, s in enumerate(reduction.survivors):
            ent = s["entity"]
            out.append(
                Survivor(
                    entity=ent,
                    cluster=int(s.get("cluster", 0)),
                    scores=s.get("scores", {}),
                    fingerprint=s.get("fingerprint_48bit", ""),
                    coord_8d=manifold.coords_8d_unit[i].tolist(),
                    coord_3d=(
                        manifold.coords_3d_s2[i].tolist()
                        if manifold.coords_3d_s2 is not None
                        else None
                    ),
                    display_name=str(ent.get("name", "")),
                )
            )
        return out

    def _compute_quality(
        self,
        reduction: ReductionResult,
    ) -> QualityMetrics:
        """Compute quality metrics from a reduction result."""
        summary = reduction.summary
        reconstruction = summary.get("reconstruction", {}) or {}
        coverages = reconstruction.get("coverages", {}) or {}
        n_input = int(summary.get("total_entities", reduction.embed_context.get("n_input", 0)))
        n_surv = int(summary.get("survivors", len(reduction.survivors)))
        variance_ratio = float(reconstruction.get("variance_preservation", 0.0))
        coverage_at_1_0 = float(coverages.get("1.0", coverages.get(1.0, 0.0)))
        median_nn = float(reconstruction.get("median_nn", 0.0))

        return QualityMetrics(
            n_input=n_input,
            n_survivors=n_surv,
            reduction_ratio=int(
                summary.get("reduction", max(n_input // max(n_surv, 1), 1))
            ),
            variance_ratio=variance_ratio,
            coverage_at_1_0=coverage_at_1_0,
            reconstruction_median_nn=median_nn,
            n_clusters=int(summary.get("clusters", 0)),
            unique_fingerprints=int(summary.get("unique_48bit_fingerprints", 0)),
            wall_seconds=float(
                summary.get("wall_seconds", reduction.wall_seconds)
            ),
            estimated_cost_usd=0.0,  # cost model lives in app layer
            cost_breakdown={},
        )

    # ── One-shot pipeline ──────────────────────────────────────────────

    def run(
        self,
        connector: Any,
        limit: int = 10_000,
    ) -> FullResult:
        """One-shot pipeline: ingest -> reduce -> represent -> (monitor).

        Args:
            connector: A ``BaseConnector`` instance that provides
                ``fetch_entities()``, ``fetch_edges()``, and ``get_meta()``.
            limit: Maximum entities to fetch from the connector.

        Returns:
            A ``FullResult`` containing reduction, manifold, survivors,
            quality metrics, and optionally monitoring results.
        """
        self._log(f"[engine] run() limit={limit}")

        # Ingest from connector
        entities = connector.fetch_entities(limit=limit)
        edges = connector.fetch_edges(entities)
        types = sorted({e.get("type", "unknown") for e in entities})

        # Reduce
        reduction = self.reduce(entities, edges, types)

        # Represent
        manifold = self.represent(reduction)

        # Hydrate survivors + quality
        survivors = self._hydrate_survivors(reduction, manifold)
        quality = self._compute_quality(reduction)

        # Optional monitoring
        monitor_result = None
        if self.config.flow_engine_enabled:
            # Build well/wire descriptions from survivor topology
            wells = [
                {"id": f"well_{i}", "active": True, "health": "ok",
                 "pressure": 0.5, "capacity": 1.0}
                for i in range(len(survivors))
            ]
            wires = []  # no wire topology without explicit edges
            monitor_result = self.monitor(wells, wires)

        self._log(
            f"[engine] run() complete: {quality.n_input} -> "
            f"{quality.n_survivors} survivors "
            f"({quality.reduction_ratio}x reduction)"
        )
        return FullResult(
            reduction=reduction,
            manifold=manifold,
            survivors=survivors,
            quality=quality,
            monitor=monitor_result,
        )

    # ── Chunked pipeline ───────────────────────────────────────────────

    def run_chunked(
        self,
        connector: Any,
        limit: int,
        chunk_size: int | None = None,
    ) -> FullResult:
        """Two-pass cascade for large datasets.

        Strategy:
          1. Fetch all entities from the connector.
          2. Split into chunks of ``chunk_size``.
          3. Run reduce() on each chunk with proportionally smaller targets.
          4. Union per-chunk survivors.
          5. Run reduce() once more on the union at full target.
          6. Represent + hydrate.

        Args:
            connector: A ``BaseConnector`` instance.
            limit: Maximum entities to fetch.
            chunk_size: Entities per chunk. Defaults to ``config.chunk_size``.

        Returns:
            A ``FullResult`` for the cascaded reduction.
        """
        chunk_size = chunk_size or self.config.chunk_size

        # Ingest
        entities = connector.fetch_entities(limit=limit)
        edges = connector.fetch_edges(entities)
        types = sorted({e.get("type", "unknown") for e in entities})

        n_total = len(entities)
        n_chunks = max(1, (n_total + chunk_size - 1) // chunk_size)
        per_chunk_target = max(10, (self.config.target_survivors * 3) // n_chunks)
        self._log(
            f"[engine] run_chunked() n_total={n_total} "
            f"chunk_size={chunk_size} n_chunks={n_chunks}"
        )

        # First pass: per-chunk reduction
        union_entities: list[dict] = []
        total_wall = 0.0
        for ci in range(n_chunks):
            lo = ci * chunk_size
            hi = min(lo + chunk_size, n_total)
            chunk = entities[lo:hi]
            chunk_names = {e.get("name") for e in chunk}
            chunk_edges = [
                ed for ed in edges
                if ed.get("source") in chunk_names and ed.get("target") in chunk_names
            ]

            # Temporarily override target for this chunk
            saved_target = self.config.target_survivors
            self.config.target_survivors = per_chunk_target
            try:
                chunk_reduction = self.reduce(chunk, chunk_edges, types)
            finally:
                self.config.target_survivors = saved_target

            total_wall += chunk_reduction.wall_seconds
            union_entities.extend(s["entity"] for s in chunk_reduction.survivors)
            self._log(
                f"[engine] chunk {ci + 1}/{n_chunks} "
                f"{lo}-{hi} -> {len(chunk_reduction.survivors)} survivors"
            )

        # Second pass: final reduction on union
        self._log(
            f"[engine] run_chunked() final pass "
            f"n_input={len(union_entities)} target={self.config.target_survivors}"
        )
        final_reduction = self.reduce(union_entities, [], types)
        total_wall += final_reduction.wall_seconds

        # Patch summary to reflect original input size
        final_reduction.summary["total_entities"] = n_total
        n_final = len(final_reduction.survivors)
        final_reduction.summary["reduction"] = n_total // max(n_final, 1)
        final_reduction.embed_context["n_input"] = n_total

        # Represent + hydrate
        manifold = self.represent(final_reduction)
        survivors = self._hydrate_survivors(final_reduction, manifold)
        quality = self._compute_quality(final_reduction)

        # Optional monitoring
        monitor_result = None
        if self.config.flow_engine_enabled:
            wells = [
                {"id": f"well_{i}", "active": True, "health": "ok",
                 "pressure": 0.5, "capacity": 1.0}
                for i in range(len(survivors))
            ]
            monitor_result = self.monitor(wells, [])

        self._log(
            f"[engine] run_chunked() complete: {n_total} -> "
            f"{quality.n_survivors} survivors via {n_chunks} chunks"
        )
        return FullResult(
            reduction=final_reduction,
            manifold=manifold,
            survivors=survivors,
            quality=quality,
            monitor=monitor_result,
        )
