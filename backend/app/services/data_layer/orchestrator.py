"""OceanOrchestrator — multi-source unified manifold builder.

The moonshot: ingest ALL registered data sources (EDGAR, PubMed,
Patents, Comtrade, Climate, Tesla), run BTUT on each, fuse all
survivors into a single unified manifold, and cross-link every pair.

The result is an ``OceanManifest`` — a single artifact containing
per-source quality metrics, a unified 3D S² globe of all survivors,
an NxN cross-source link matrix, and a benchmark table. This is
what gets rendered by the OceanGlobe component and exported by the
auto-demo scripts.

Usage:
    orch = OceanOrchestrator(target_survivors=100, log_callback=print)
    manifest = orch.build_ocean(default_limit=500)
    # manifest.unified_survivors: all survivors across all sources
    # manifest.link_matrix: NxN cross-source link counts
    # manifest.benchmark: per-source comparison table
"""
from __future__ import annotations

import itertools
import logging
import time
from dataclasses import dataclass, field
from typing import Callable

import numpy as np

from app.services.btut.adapters import list_dataset_ids

from .core import LatentOceanDataLayer
from .manifold import project_8d_to_s2
from .types import CausalLink, QualityMetrics, Survivor

logger = logging.getLogger(__name__)


# ── Dataclasses ────────────────────────────────────────────────────────

@dataclass
class SourceResult:
    """Result of running one source through the data layer pipeline."""

    source_id: str
    layer: LatentOceanDataLayer
    quality: QualityMetrics
    survivors: list[Survivor]
    n_survivors: int
    wall_seconds: float


@dataclass
class CrossLinkResult:
    """Result of cross-source causal linking between two sources."""

    pair: tuple[str, str]
    n_links: int
    links_by_signal: dict[str, int]
    top_links: list[CausalLink]  # top 50 by strength


@dataclass
class OceanManifest:
    """The unified ocean — all sources, all links, one manifold."""

    sources: dict[str, SourceResult]
    unified_survivors: list[dict]  # flat dicts with source_id tag
    unified_coords_3d: np.ndarray | None  # re-PCA'd S² over the union
    cross_links: list[CrossLinkResult]
    link_matrix: dict[str, dict[str, int]]
    total_cost_usd: float
    total_wall_seconds: float
    benchmark: list[dict]  # per-source comparison rows


# ── Orchestrator ───────────────────────────────────────────────────────

class OceanOrchestrator:
    """Build a unified latent ocean from multiple heterogeneous sources."""

    def __init__(
        self,
        budget_dollars: float = 50.0,
        target_survivors: int = 300,
        cosine_threshold: float = 0.75,
        log_callback: Callable[[str], None] | None = None,
    ) -> None:
        self.budget_dollars = budget_dollars
        self.target_survivors = target_survivors
        self.cosine_threshold = cosine_threshold
        self._log_cb = log_callback

    def _log(self, msg: str) -> None:
        logger.info(msg)
        if self._log_cb is not None:
            self._log_cb(msg)

    # ── Per-source pipeline ─────────────────────────────────────────
    def _run_source(self, source_id: str, limit: int) -> SourceResult:
        """Run the full data layer pipeline on a single source."""
        self._log(f"[ocean] === Source: {source_id} (limit={limit}) ===")
        t0 = time.time()
        layer = LatentOceanDataLayer(
            budget_dollars=self.budget_dollars,
            target_survivors=self.target_survivors,
            compute_3d_display=False,  # 3D is recomputed on the union
            log_callback=self._log_cb,
        )
        try:
            layer.ingest(source_id, limit=limit)
            layer.apply_btut_tuner()
            layer.project_to_manifold()
        except Exception as e:
            self._log(f"[ocean] SKIP {source_id}: {type(e).__name__}: {e}")
            # Return an empty result so the ocean continues without this source.
            from .types import QualityMetrics as QM
            return SourceResult(
                source_id=source_id,
                layer=layer,
                quality=QM(
                    n_input=0, n_survivors=0, reduction_ratio=0,
                    variance_ratio=0, coverage_at_1_0=0,
                    reconstruction_median_nn=0, n_clusters=0,
                    unique_fingerprints=0, wall_seconds=0,
                    estimated_cost_usd=0,
                    cost_breakdown={"adapter_usd": 0, "compute_usd": 0, "storage_usd": 0, "total_usd": 0},
                ),
                survivors=[],
                n_survivors=0,
                wall_seconds=time.time() - t0,
            )

        wall = time.time() - t0
        survivors = layer.get_survivors()
        quality = layer.get_quality_metrics()
        self._log(
            f"[ocean] {source_id}: {quality.n_input} -> {quality.n_survivors} "
            f"survivors ({quality.reduction_ratio}x) in {wall:.1f}s"
        )
        return SourceResult(
            source_id=source_id,
            layer=layer,
            quality=quality,
            survivors=survivors,
            n_survivors=len(survivors),
            wall_seconds=wall,
        )

    # ── Unified manifold ────────────────────────────────────────────
    def _unify_manifold(
        self,
        source_results: dict[str, SourceResult],
    ) -> tuple[list[dict], np.ndarray | None]:
        """Concatenate all per-source survivors into a unified manifold.

        Each survivor dict gets a ``source_id`` tag for color-coding.
        The unified 3D S² coords are recomputed via PCA over the
        concatenated 8D unit vectors.
        """
        all_dicts: list[dict] = []
        all_8d: list[np.ndarray] = []

        for src_id, sr in source_results.items():
            if sr.n_survivors == 0:
                continue
            assert sr.layer.manifold is not None
            for i, surv in enumerate(sr.survivors):
                all_dicts.append({
                    "name": surv.entity.get("name", ""),
                    "type": surv.entity.get("type", ""),
                    "source_id": src_id,
                    "display_name": surv.display_name,
                    "cluster": surv.cluster,
                    "composite_score": surv.scores.get("composite", 0) if surv.scores else 0,
                    "coord_8d": surv.coord_8d,
                })
                all_8d.append(sr.layer.manifold.coords_8d_unit[i])

        if not all_8d:
            return all_dicts, None

        # Re-PCA the union to get a single 3D view.
        union_8d = np.vstack(all_8d)
        unified_3d = project_8d_to_s2(union_8d, seed=42)

        # Attach 3D coords back to the dicts.
        for i, d in enumerate(all_dicts):
            d["coord_3d"] = unified_3d[i].tolist()

        return all_dicts, unified_3d

    # ── Cross-source linking ────────────────────────────────────────
    def _cross_link_all(
        self,
        source_results: dict[str, SourceResult],
    ) -> list[CrossLinkResult]:
        """Run pairwise causal linking across all C(n,2) source pairs."""
        active = {
            k: v for k, v in source_results.items() if v.n_survivors > 0
        }
        pairs = list(itertools.combinations(sorted(active.keys()), 2))
        results: list[CrossLinkResult] = []

        for a_id, b_id in pairs:
            self._log(f"[ocean] Linking: {a_id} x {b_id}")
            sr_a = active[a_id]
            sr_b = active[b_id]
            try:
                links = sr_a.layer.link_causally(
                    sr_b.layer, threshold=self.cosine_threshold
                )
            except Exception as e:
                self._log(f"[ocean] Link {a_id}x{b_id} failed: {e}")
                links = []

            by_signal: dict[str, int] = {}
            for lk in links:
                by_signal[lk.signal] = by_signal.get(lk.signal, 0) + 1

            top = sorted(links, key=lambda x: -x.strength)[:50]
            results.append(
                CrossLinkResult(
                    pair=(a_id, b_id),
                    n_links=len(links),
                    links_by_signal=by_signal,
                    top_links=top,
                )
            )
            self._log(
                f"[ocean] {a_id} x {b_id}: {len(links)} links "
                f"({', '.join(f'{k}={v}' for k, v in sorted(by_signal.items()))})"
            )

        return results

    # ── Link matrix ─────────────────────────────────────────────────
    @staticmethod
    def _build_link_matrix(
        cross_links: list[CrossLinkResult],
        source_ids: list[str],
    ) -> dict[str, dict[str, int]]:
        """Build an NxN dict-of-dicts with link counts per pair."""
        matrix: dict[str, dict[str, int]] = {
            s: {t: 0 for t in source_ids} for s in source_ids
        }
        for cl in cross_links:
            a, b = cl.pair
            matrix[a][b] = cl.n_links
            matrix[b][a] = cl.n_links  # symmetric
        return matrix

    # ── Benchmark ───────────────────────────────────────────────────
    @staticmethod
    def _build_benchmark(
        source_results: dict[str, SourceResult],
    ) -> list[dict]:
        """Per-source comparison table for the investor deck."""
        rows = []
        for src_id, sr in sorted(source_results.items()):
            q = sr.quality
            rows.append({
                "source": src_id,
                "n_input": q.n_input,
                "n_survivors": q.n_survivors,
                "reduction_ratio": q.reduction_ratio,
                "coverage_at_1_0": round(q.coverage_at_1_0, 3),
                "variance_ratio": round(q.variance_ratio, 3),
                "n_clusters": q.n_clusters,
                "wall_seconds": round(sr.wall_seconds, 1),
                "cost_usd": round(q.estimated_cost_usd, 6),
            })
        return rows

    # ── Main entry point ────────────────────────────────────────────
    def build_ocean(
        self,
        sources: list[str] | None = None,
        limits: dict[str, int] | None = None,
        default_limit: int = 500,
    ) -> OceanManifest:
        """Build the unified latent ocean.

        Args:
            sources: Dataset IDs to include. ``None`` = all registered.
            limits: Per-source entity limits (overrides ``default_limit``).
            default_limit: Default entity limit for sources not in ``limits``.

        Returns:
            OceanManifest with per-source results, unified manifold,
            cross-links, link matrix, benchmark, and totals.
        """
        t0 = time.time()
        source_ids = sources or list_dataset_ids()
        limits = limits or {}
        self._log(
            f"[ocean] Building ocean: {len(source_ids)} sources, "
            f"target={self.target_survivors} survivors each"
        )

        # Run each source.
        source_results: dict[str, SourceResult] = {}
        for src_id in source_ids:
            limit = limits.get(src_id, default_limit)
            source_results[src_id] = self._run_source(src_id, limit)

        # Unify manifold.
        self._log("[ocean] Unifying manifold across all sources...")
        unified_survivors, unified_3d = self._unify_manifold(source_results)
        n_total = len(unified_survivors)

        # Cross-link all pairs.
        self._log("[ocean] Cross-linking all source pairs...")
        cross_links = self._cross_link_all(source_results)
        link_matrix = self._build_link_matrix(cross_links, source_ids)

        # Benchmark.
        benchmark = self._build_benchmark(source_results)

        # Totals.
        total_cost = sum(sr.quality.estimated_cost_usd for sr in source_results.values())
        total_wall = time.time() - t0
        total_links = sum(cl.n_links for cl in cross_links)

        self._log(
            f"\n[ocean] === Ocean Complete ===\n"
            f"  Sources        : {len(source_ids)}\n"
            f"  Total survivors: {n_total}\n"
            f"  Cross-links    : {total_links}\n"
            f"  Total cost     : ${total_cost:.6f}\n"
            f"  Total wall     : {total_wall:.1f}s"
        )

        return OceanManifest(
            sources=source_results,
            unified_survivors=unified_survivors,
            unified_coords_3d=unified_3d,
            cross_links=cross_links,
            link_matrix=link_matrix,
            total_cost_usd=total_cost,
            total_wall_seconds=total_wall,
            benchmark=benchmark,
        )
