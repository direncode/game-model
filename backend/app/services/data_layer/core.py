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

from .costs import estimate_run_cost
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
        ingest_max_retries: int = 3,
        ingest_backoff_seconds: float = 2.0,
    ) -> None:
        self.budget_dollars = budget_dollars
        self.target_survivors = target_survivors
        self.compute_3d_display = compute_3d_display
        self._log_cb = log_callback
        self.ingest_max_retries = ingest_max_retries
        self.ingest_backoff_seconds = ingest_backoff_seconds

        # Per-run state — reset on each ingest().
        self.ingest_result: IngestResult | None = None
        self.btut_result: BTUTRunResult | None = None
        self.manifold: ManifoldCoords | None = None
        self.survivors: list[Survivor] | None = None
        self.quality_metrics: QualityMetrics | None = None
        # Accumulated bytes written to disk this run (for cost model).
        self._bytes_written: int = 0
        # Adapter reference held between stages so we can resolve display names.
        self._adapter: BaseDatasetAdapter | None = None

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
        self._bytes_written = 0
        self._adapter = None

    # ── Stage 1: ingest ─────────────────────────────────────────────────
    def _fetch_with_retry(
        self,
        adapter: BaseDatasetAdapter,
        limit: int,
    ) -> tuple[list[dict], list[dict]]:
        """Call adapter.fetch_entities + fetch_edges with exponential backoff.

        Retries on any exception — we don't know upfront whether an
        adapter raises urllib.HTTPError, requests.ConnectionError,
        socket.timeout, or something else. Total attempts =
        ``ingest_max_retries``. Waits ``backoff * 2^(attempt-1)``
        between attempts, so with default (3 retries, 2.0s) the
        schedule is: fail → wait 2s → fail → wait 4s → fail → raise.
        """
        last_exc: Exception | None = None
        for attempt in range(1, self.ingest_max_retries + 1):
            try:
                entities = adapter.fetch_entities(limit=limit)
                edges = adapter.fetch_edges(entities)
                return entities, edges
            except Exception as e:  # noqa: BLE001 — adapter exceptions are opaque
                last_exc = e
                if attempt >= self.ingest_max_retries:
                    break
                wait = self.ingest_backoff_seconds * (2 ** (attempt - 1))
                self._log(
                    f"[data_layer] ingest attempt {attempt} failed "
                    f"({type(e).__name__}: {e}); retrying in {wait:.1f}s"
                )
                time.sleep(wait)
        assert last_exc is not None
        raise last_exc

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

        Retries network/adapter failures with exponential backoff up
        to ``ingest_max_retries`` attempts. The final exception after
        all retries propagates unchanged.
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

        self._adapter = adapter
        meta = adapter.get_meta()
        entities, edges = self._fetch_with_retry(adapter, limit)
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

    # ── Display name resolution ─────────────────────────────────────────
    def _resolve_display_name(self, entity: dict) -> str:
        """Human-friendly label for an entity, using the adapter's
        EntityTypeConfig.primary_field when possible.

        Falls back to ``entity["name"]`` if no adapter is attached or
        the primary field is missing/empty. Parses json-string
        attributes transparently (matches the linking module's
        behavior).
        """
        name = str(entity.get("name", ""))
        if self._adapter is None:
            return name

        # Figure out primary_field for this entity's type.
        try:
            meta = self._adapter.get_meta()
        except Exception:  # noqa: BLE001
            return name
        etype = entity.get("type", "")
        primary_field = ""
        for tc in meta.entity_types:
            if tc.name == etype:
                primary_field = tc.primary_field
                break
        if not primary_field:
            return name

        # Attributes may be a dict or a json-dumps string (adapters vary).
        raw_attrs = entity.get("attributes") or {}
        if isinstance(raw_attrs, str):
            try:
                raw_attrs = json.loads(raw_attrs)
            except (ValueError, TypeError):
                return name
        if not isinstance(raw_attrs, dict):
            return name

        val = raw_attrs.get(primary_field)
        if val in (None, "", 0, "0"):
            return name
        return str(val)

    def _hydrate_survivors(self) -> None:
        """Build typed Survivor objects from btut_result + manifold coords."""
        assert self.btut_result is not None
        assert self.manifold is not None
        out: list[Survivor] = []
        for i, s in enumerate(self.btut_result.survivors):
            ent = s["entity"]
            out.append(
                Survivor(
                    entity=ent,
                    cluster=int(s.get("cluster", 0)),
                    scores=s.get("scores", {}),
                    fingerprint=s.get("fingerprint_48bit", ""),
                    coord_8d=self.manifold.coords_8d_unit[i].tolist(),
                    coord_3d=(
                        self.manifold.coords_3d_s2[i].tolist()
                        if self.manifold.coords_3d_s2 is not None
                        else None
                    ),
                    display_name=self._resolve_display_name(ent),
                )
            )
        self.survivors = out

    def _compute_quality_metrics(self) -> None:
        """Compute QualityMetrics from btut_result + ingest_result.

        Surfaces BTUT's own summary stats rather than synthesizing new
        numbers, so there's no risk of the facade disagreeing with the
        engine. Cost is computed via the real ``costs.estimate_run_cost``
        model using the wall times we captured at each stage.

        The metric previously called ``variance_preservation`` was
        actually ``var(survivors) / var(input)`` in 8D space — values
        > 1.0 mean BTUT over-sampled outliers (correct but misnamed).
        It's now reported honestly as ``variance_ratio`` with
        ``coverage_at_1_0`` and ``reconstruction_median_nn`` as the
        actual "can I reconstruct the population" signals.
        """
        assert self.btut_result is not None
        assert self.ingest_result is not None
        summary = self.btut_result.summary
        reconstruction = summary.get("reconstruction", {}) or {}
        coverages = reconstruction.get("coverages", {}) or {}

        n_input = int(summary.get("total_entities", len(self.ingest_result.entities)))
        n_surv = int(summary.get("survivors", len(self.btut_result.survivors)))

        # BTUT's "variance_preservation" is the ratio var(survivors)/var(all),
        # not a preservation fraction. Re-export it under the honest name.
        variance_ratio = float(reconstruction.get("variance_preservation", 0.0))

        # BTUT reports coverage at thresholds {0.5, 1.0, 1.5, 2.0}. We
        # pick 1.0 as the "most useful single number".
        coverage_at_1_0 = float(coverages.get("1.0", coverages.get(1.0, 0.0)))
        median_nn = float(reconstruction.get("median_nn", 0.0))

        # Real cost model, documented coefficients in costs.py.
        cost = estimate_run_cost(
            ingest_wall_seconds=self.ingest_result.fetch_seconds,
            btut_wall_seconds=self.btut_result.wall_seconds,
            manifold_wall_seconds=0.0,  # accounted in btut+write phases
            output_bytes=self._bytes_written,
        )

        self.quality_metrics = QualityMetrics(
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
                summary.get("wall_seconds", self.btut_result.wall_seconds)
            ),
            estimated_cost_usd=round(cost.total_usd, 6),
            cost_breakdown=cost.as_dict(),
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
            self._bytes_written += size
            # Refresh cost/quality now that storage bytes are known.
            self._compute_quality_metrics()
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
        q = self.quality_metrics
        return {
            "dataset_id": self.ingest_result.source_id,
            "n_input": q.n_input,
            "n_survivors": q.n_survivors,
            "reduction_ratio": q.reduction_ratio,
            "variance_ratio": q.variance_ratio,
            "coverage_at_1_0": q.coverage_at_1_0,
            "reconstruction_median_nn": q.reconstruction_median_nn,
            "n_clusters": q.n_clusters,
            "wall_seconds": q.wall_seconds,
            "estimated_cost_usd": q.estimated_cost_usd,
            "cost_breakdown": q.cost_breakdown,
        }

    # ── Chunked / streaming pipeline ────────────────────────────────────
    def run_chunked(
        self,
        source: str | BaseDatasetAdapter,
        limit: int,
        chunk_size: int,
        vertical: str | None = None,
        write_path: Path | None = None,
    ) -> dict:
        """Two-pass cascade for large inputs: chunked BTUT + final BTUT.

        Strategy (forward-only, no checkpoint required):

          1. Ingest the full ``limit`` of entities in one pass.
          2. Split into chunks of ``chunk_size`` entities each.
          3. Run BTUT on each chunk (with a proportionally smaller
             target_survivors) to get per-chunk survivors.
          4. Union the per-chunk survivors back into a single "second-
             pass" entity list.
          5. Run BTUT once more on the unioned survivors at the full
             ``target_survivors`` to get final survivors.
          6. Project to manifold, optionally export.

        This is the simplest correct two-pass cascade: each chunk's
        survivors are already a representative sample of that chunk,
        so the union preserves diversity across the whole input, and
        the final BTUT pass re-ranks them against each other. Memory
        footprint is O(chunk_size) in the embedding phase instead of
        O(limit), which is what you actually need at 100k+ scale.

        Not a full streaming ingest (entities are still fetched in one
        HTTP call) — that requires adapter-side cursor support which
        none of the current adapters expose. What this *does* enable
        is making BTUT on huge inputs memory-bounded.
        """
        # Reuse existing ingest + retry machinery.
        self.ingest(source, limit=limit)
        assert self.ingest_result is not None

        all_entities = self.ingest_result.entities
        all_edges = self.ingest_result.edges
        unique_types = self.ingest_result.unique_types
        n_total = len(all_entities)
        n_chunks = max(1, (n_total + chunk_size - 1) // chunk_size)
        per_chunk_target = max(
            10, (self.target_survivors * 3) // n_chunks
        )
        self._log(
            f"[data_layer] stage=chunked n_total={n_total} chunk_size={chunk_size} "
            f"n_chunks={n_chunks} per_chunk_target={per_chunk_target}"
        )

        union_survivors: list[dict] = []
        union_wall = 0.0
        for ci in range(n_chunks):
            lo = ci * chunk_size
            hi = min(lo + chunk_size, n_total)
            chunk = all_entities[lo:hi]
            # Keep edges that both endpoints live inside this chunk.
            chunk_names = {e.get("name") for e in chunk}
            chunk_edges = [
                ed for ed in all_edges
                if ed.get("source") in chunk_names and ed.get("target") in chunk_names
            ]
            t0 = time.time()
            raw = run_btut_pipeline(
                entities=chunk,
                edges=chunk_edges,
                unique_types=unique_types,
                target_survivors=per_chunk_target,
                budget_dollars=self.budget_dollars,
                progress_callback=None,  # suppress inner-loop logs
            )
            union_wall += time.time() - t0
            chunk_survivors = raw.get("survivors", [])
            # Each survivor's "entity" is the original entity dict, so
            # we can just re-feed it into the second BTUT pass as-is.
            union_survivors.extend(s["entity"] for s in chunk_survivors)
            self._log(
                f"[data_layer] chunk {ci+1}/{n_chunks} "
                f"{lo}-{hi} -> {len(chunk_survivors)} survivors"
            )

        # Second pass: run BTUT over the union of per-chunk survivors.
        self._log(
            f"[data_layer] stage=chunked-final n_input={len(union_survivors)} "
            f"target={self.target_survivors}"
        )
        t0 = time.time()
        final_raw = run_btut_pipeline(
            entities=union_survivors,
            edges=[],  # edges don't round-trip across chunks; drop them
            unique_types=unique_types,
            target_survivors=self.target_survivors,
            budget_dollars=self.budget_dollars,
            progress_callback=self._log_cb,
        )
        final_wall = time.time() - t0

        # Overwrite the state with the final-pass result so the rest of
        # the facade (manifold / export / quality) sees a coherent view.
        flat = final_raw.get("embeddings_8d") or []
        n_final = len(final_raw.get("survivors", []))
        if n_final > 0 and len(flat) == n_final * 8:
            embeddings_8d = np.asarray(flat, dtype=np.float32).reshape(n_final, 8)
        else:
            embeddings_8d = np.zeros((n_final, 8), dtype=np.float32)
        self.btut_result = BTUTRunResult(
            summary=final_raw.get("summary", {}),
            survivors=final_raw.get("survivors", []),
            embeddings_8d=embeddings_8d,
            wall_seconds=union_wall + final_wall,
        )
        # Fudge the summary so the facade's cost + reduction ratio are
        # computed against the ORIGINAL input (n_total) rather than the
        # second-pass input (union_survivors).
        self.btut_result.summary["total_entities"] = n_total
        self.btut_result.summary["reduction"] = n_total // max(n_final, 1)

        self.project_to_manifold()
        if vertical is not None:
            return self.export_for_vertical(vertical, write_path=write_path)

        assert self.quality_metrics is not None
        q = self.quality_metrics
        return {
            "dataset_id": self.ingest_result.source_id,
            "n_input": q.n_input,
            "n_survivors": q.n_survivors,
            "reduction_ratio": q.reduction_ratio,
            "variance_ratio": q.variance_ratio,
            "coverage_at_1_0": q.coverage_at_1_0,
            "n_clusters": q.n_clusters,
            "wall_seconds": q.wall_seconds,
            "estimated_cost_usd": q.estimated_cost_usd,
            "cost_breakdown": q.cost_breakdown,
            "n_chunks": n_chunks,
            "chunk_size": chunk_size,
        }
