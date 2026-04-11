"""LatentOceanDataLayer — thin stateful facade over the full data pipeline.

The facade does not own any business logic: every stage is routed to
existing code in ``app.services.btut`` (the BTUT engine) or the
adapter registry at ``app.services.btut.adapters``. The value it adds
is:

  1. A single stateful entry point with the six requested methods
     (ingest / apply_btut_tuner / project_to_manifold / get_survivors
     / export_for_vertical / run).
  2. Manifold projection (L2-normalized 8D hypersphere for compute,
     optional 3D S² for display) glued between BTUT and the verticals.
  3. Typed dataclass results between stages, so downstream callers get
     a clear schema instead of raw dicts.
  4. Cross-layer causal linking (``link_causally``) using the same
     four-signal scaffold module.

State reset model: each call to ``ingest()`` wipes all downstream
per-run state. This makes it safe to reuse a single ``LatentOceanDataLayer``
instance across multiple datasets without leakage.
"""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Callable, Literal

import numpy as np

from app.services.btut.adapters import get_adapter
from app.services.btut.adapters.base import BaseDatasetAdapter
from app.services.btut.pipeline import run_btut_pipeline

from .errors import (
    NoBTUTResultError,
    NoIngestError,
    NoManifoldError,
    UnknownSourceError,
    UnknownVerticalError,
)
from .linking import link_all
from .manifold import project_8d_to_s2, project_8d_to_unit_sphere
from .types import (
    BTUTRunResult,
    CausalLink,
    IngestResult,
    ManifoldCoords,
    QualityMetrics,
    Survivor,
)
from .verticals import EXPORTERS

logger = logging.getLogger(__name__)


class LatentOceanDataLayer:
    """Unified spine over ingestion → BTUT → manifold → vertical export.

    Example:
        >>> layer = LatentOceanDataLayer(target_survivors=300)
        >>> layer.ingest("edgar", limit=10_000)
        >>> layer.apply_btut_tuner()
        >>> layer.project_to_manifold()
        >>> payload = layer.export_for_vertical("niv")

    Or the one-shot form:

        >>> layer.run("edgar", vertical="niv", limit=10_000)
    """

    def __init__(
        self,
        budget_dollars: float = 50.0,
        target_survivors: int = 300,
        compute_3d_display: bool = True,
        log_callback: Callable[[str], None] | None = None,
    ) -> None:
        self.budget_dollars = budget_dollars
        self.target_survivors = target_survivors
        self.compute_3d_display = compute_3d_display
        self._log_cb = log_callback

        # Per-run state — reset on each ingest().
        self.ingest_result: IngestResult | None = None
        self.btut_result: BTUTRunResult | None = None
        self.manifold: ManifoldCoords | None = None
        self.survivors: list[Survivor] | None = None
        self.quality_metrics: QualityMetrics | None = None

    # ── Internal helpers ────────────────────────────────────────────────
    def _log(self, msg: str) -> None:
        logger.info(msg)
        if self._log_cb is not None:
            self._log_cb(msg)

    def _reset_state(self) -> None:
        """Wipe per-run state. Called at the start of each ingest()."""
        self.ingest_result = None
        self.btut_result = None
        self.manifold = None
        self.survivors = None
        self.quality_metrics = None

    # ── Stage 1: ingest ─────────────────────────────────────────────────
    def ingest(
        self,
        source: str | BaseDatasetAdapter,
        limit: int = 10_000,
    ) -> IngestResult:
        """Fetch entities + edges from a dataset adapter.

        Args:
            source: Dataset id (e.g. ``"edgar"``), or a concrete
                ``BaseDatasetAdapter`` instance for custom sources.
            limit: Max entities to fetch.
        """
        self._reset_state()
        wall_start = time.time()

        if isinstance(source, str):
            try:
                adapter = get_adapter(source)
            except ValueError as e:
                raise UnknownSourceError(str(e)) from e
        else:
            adapter = source

        meta = adapter.get_meta()
        entities = adapter.fetch_entities(limit=limit)
        edges = adapter.fetch_edges(entities)
        unique_types = sorted({e.get("type", "unknown") for e in entities})

        fetch_seconds = time.time() - wall_start
        result = IngestResult(
            source_id=meta.dataset_id,
            entities=entities,
            edges=edges,
            unique_types=unique_types,
            fetch_seconds=fetch_seconds,
        )
        self.ingest_result = result
        self._log(
            f"[data_layer] stage=ingest source={meta.dataset_id} "
            f"n_entities={len(entities)} n_edges={len(edges)} "
            f"wall={fetch_seconds:.1f}s"
        )
        return result

    # ── Stage 2: BTUT ───────────────────────────────────────────────────
    def apply_btut_tuner(
        self,
        ingest_result: IngestResult | None = None,
    ) -> BTUTRunResult:
        """Run the full BTUT pipeline on the most recent (or given) ingest.

        Wraps ``btut.pipeline.run_btut_pipeline`` and reshapes its flat
        ``embeddings_8d`` list into an ``(n_survivors, 8)`` matrix.
        """
        ir = ingest_result or self.ingest_result
        if ir is None:
            raise NoIngestError("apply_btut_tuner() called before ingest()")

        wall_start = time.time()
        raw = run_btut_pipeline(
            entities=ir.entities,
            edges=ir.edges,
            unique_types=ir.unique_types,
            target_survivors=self.target_survivors,
            budget_dollars=self.budget_dollars,
            progress_callback=self._log_cb,
        )
        wall = time.time() - wall_start

        flat = raw.get("embeddings_8d") or []
        n_surv = len(raw.get("survivors", []))
        if n_surv > 0 and len(flat) == n_surv * 8:
            embeddings_8d = np.asarray(flat, dtype=np.float32).reshape(n_surv, 8)
        else:
            # Either no survivors, or BTUT didn't attach embeddings for this run.
            embeddings_8d = np.zeros((n_surv, 8), dtype=np.float32)

        result = BTUTRunResult(
            summary=raw.get("summary", {}),
            survivors=raw.get("survivors", []),
            embeddings_8d=embeddings_8d,
            wall_seconds=wall,
        )
        self.btut_result = result
        summary = result.summary
        self._log(
            f"[data_layer] stage=btut n_survivors={n_surv} "
            f"reduction={summary.get('reduction', '?')}x wall={wall:.1f}s "
            f"variance={summary.get('reconstruction', {}).get('variance_preservation', '?')}"
        )
        return result

    # ── Stage 3: manifold projection ────────────────────────────────────
    def project_to_manifold(
        self,
        btut_result: BTUTRunResult | None = None,
    ) -> ManifoldCoords:
        """L2-normalize survivor 8D embeddings; optionally compute 3D S².

        Populates ``self.manifold``, hydrates ``self.survivors`` with
        attached manifold coords, and computes ``self.quality_metrics``.
        """
        br = btut_result or self.btut_result
        if br is None:
            raise NoBTUTResultError(
                "project_to_manifold() called before apply_btut_tuner()"
            )

        wall_start = time.time()
        coords_8d_unit = project_8d_to_unit_sphere(br.embeddings_8d)
        coords_3d_s2 = (
            project_8d_to_s2(coords_8d_unit) if self.compute_3d_display else None
        )
        method = "l2_normalize_8d" + ("+pca_s2" if coords_3d_s2 is not None else "")
        manifold = ManifoldCoords(
            coords_8d_unit=coords_8d_unit,
            coords_3d_s2=coords_3d_s2,
            projection_method=method,
        )
        self.manifold = manifold
        self._hydrate_survivors()
        self._compute_quality_metrics()
        wall = time.time() - wall_start
        self._log(
            f"[data_layer] stage=manifold coords_8d={coords_8d_unit.shape} "
            f"coords_3d={None if coords_3d_s2 is None else coords_3d_s2.shape} "
            f"wall={wall:.1f}s"
        )
        return manifold

    def _hydrate_survivors(self) -> None:
        """Build typed Survivor objects from btut_result + manifold coords."""
        assert self.btut_result is not None
        assert self.manifold is not None
        out: list[Survivor] = []
        for i, s in enumerate(self.btut_result.survivors):
            out.append(
                Survivor(
                    entity=s["entity"],
                    cluster=int(s.get("cluster", 0)),
                    scores=s.get("scores", {}),
                    fingerprint=s.get("fingerprint_48bit", ""),
                    coord_8d=self.manifold.coords_8d_unit[i].tolist(),
                    coord_3d=(
                        self.manifold.coords_3d_s2[i].tolist()
                        if self.manifold.coords_3d_s2 is not None
                        else None
                    ),
                )
            )
        self.survivors = out

    def _compute_quality_metrics(self) -> None:
        """Compute QualityMetrics from btut_result + ingest_result."""
        assert self.btut_result is not None
        assert self.ingest_result is not None
        summary = self.btut_result.summary
        n_input = int(summary.get("total_entities", len(self.ingest_result.entities)))
        n_surv = int(summary.get("survivors", 0))
        self.quality_metrics = QualityMetrics(
            n_input=n_input,
            n_survivors=n_surv,
            reduction_ratio=int(
                summary.get("reduction", max(n_input // max(n_surv, 1), 1))
            ),
            variance_preservation=float(
                summary.get("reconstruction", {}).get("variance_preservation", 0.0)
            ),
            wall_seconds=float(
                summary.get("wall_seconds", self.btut_result.wall_seconds)
            ),
            # Cost model: flat overhead + per-entity marginal. Conservative.
            estimated_cost_usd=round(0.01 + n_input * 1e-6, 4),
        )

    # ── Stage 4: accessors ──────────────────────────────────────────────
    def get_survivors(self) -> list[Survivor]:
        if self.survivors is None:
            raise NoManifoldError(
                "get_survivors() called before project_to_manifold()"
            )
        return self.survivors

    def get_quality_metrics(self) -> QualityMetrics:
        if self.quality_metrics is None:
            raise NoManifoldError(
                "get_quality_metrics() called before project_to_manifold()"
            )
        return self.quality_metrics

    # ── Stage 5: vertical export ────────────────────────────────────────
    def export_for_vertical(
        self,
        vertical_name: Literal["niv", "tcd_jepa", "data"] | str,
        write_path: Path | None = None,
    ) -> dict:
        """Format current state into the handoff contract for a vertical.

        Args:
            vertical_name: One of ``"niv"``, ``"tcd_jepa"``, ``"data"``.
            write_path: Optional path — if given, also writes the dict
                as JSON (UTF-8, ``indent=2``) at that path. Parent dirs
                are created as needed.

        Returns:
            The payload dict.
        """
        if self.manifold is None or self.survivors is None:
            raise NoManifoldError(
                "export_for_vertical() called before project_to_manifold()"
            )
        if vertical_name not in EXPORTERS:
            raise UnknownVerticalError(
                f"Unknown vertical '{vertical_name}'. "
                f"Available: {sorted(EXPORTERS.keys())}"
            )
        payload = EXPORTERS[vertical_name](self)

        if write_path is not None:
            p = Path(write_path)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(
                json.dumps(payload, indent=2, default=str), encoding="utf-8"
            )
            size = p.stat().st_size
            self._log(
                f"[data_layer] stage=export vertical={vertical_name} "
                f"bytes={size} path={p}"
            )
        else:
            self._log(
                f"[data_layer] stage=export vertical={vertical_name} (in-memory)"
            )
        return payload

    # ── Stage 6: cross-layer causal linking ─────────────────────────────
    def link_causally(
        self,
        other: "LatentOceanDataLayer",
        threshold: float = 0.75,
    ) -> list[CausalLink]:
        """Link survivors across two layers via the four-signal scaffold.

        Only cosine is fully wired; foreign-key / semantic-field /
        url-hierarchy are stubs. Both layers must have completed
        ``project_to_manifold`` before calling.
        """
        if self.manifold is None or self.survivors is None:
            raise NoManifoldError(
                "link_causally() called on self before project_to_manifold()"
            )
        if other.manifold is None or other.survivors is None:
            raise NoManifoldError(
                "link_causally() called on other before other.project_to_manifold()"
            )
        assert self.btut_result is not None
        assert other.btut_result is not None
        return link_all(
            survivors_a=self.btut_result.survivors,
            embeds_a_8d_unit=self.manifold.coords_8d_unit,
            survivors_b=other.btut_result.survivors,
            embeds_b_8d_unit=other.manifold.coords_8d_unit,
            cosine_threshold=threshold,
        )

    # ── Convenience: one-shot ───────────────────────────────────────────
    def run(
        self,
        source: str | BaseDatasetAdapter,
        vertical: str | None = None,
        limit: int = 10_000,
        write_path: Path | None = None,
    ) -> dict:
        """One-shot: ingest → btut → manifold → (optional) export.

        If ``vertical`` is given, returns the vertical's payload dict
        (and optionally writes it to ``write_path``). Otherwise returns
        a small summary dict with quality metrics and counts.
        """
        self.ingest(source, limit=limit)
        self.apply_btut_tuner()
        self.project_to_manifold()

        if vertical is not None:
            return self.export_for_vertical(vertical, write_path=write_path)

        assert self.quality_metrics is not None
        assert self.ingest_result is not None
        return {
            "dataset_id": self.ingest_result.source_id,
            "n_input": self.quality_metrics.n_input,
            "n_survivors": self.quality_metrics.n_survivors,
            "reduction_ratio": self.quality_metrics.reduction_ratio,
            "variance_preservation": self.quality_metrics.variance_preservation,
            "wall_seconds": self.quality_metrics.wall_seconds,
        }
