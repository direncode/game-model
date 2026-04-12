"""TCDJEPAVertical — top-level orchestrator.

Composes existing services (TCDJEPAWrapper, interpretation_pipeline,
ModuleRegistryService) and new services (routing, export, online)
into a single facade. Zero edits to any existing service.

Pipeline: ingest_btut → crystallize → interpret → register → {route | export}
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import numpy as np

from .presets import PresetConfig, get_preset
from .vertical_types import (
    BTUTSurvivorBundle,
    CrystallizedModule,
    RoutingDecision,
    TCDVerticalError,
    VerticalPreset,
)

logger = logging.getLogger(__name__)


class TCDJEPAVertical:
    """Facade over BTUT → TCD-JEPA → interpretation → registry → routing."""

    def __init__(
        self,
        *,
        preset: VerticalPreset = VerticalPreset.GENERIC,
        wrapper: Any | None = None,
        registry_service: Any | None = None,
        interpretation_fn: Any | None = None,
    ) -> None:
        self.preset: VerticalPreset = preset
        self.config: PresetConfig = get_preset(preset)
        self.current_bundle: BTUTSurvivorBundle | None = None
        self._wrapper = wrapper
        self._registry = registry_service
        self._interpret_fn = interpretation_fn

    # ──────────────────────── stage 1: ingest ────────────────────────
    def ingest_btut(self, bundle: BTUTSurvivorBundle) -> None:
        """Stage 1 — accept a BTUT survivor bundle."""
        if bundle.embeddings.shape[0] == 0:
            raise TCDVerticalError(
                "empty BTUT bundle — nothing to crystallize",
                stage="ingest",
            )
        self.current_bundle = bundle
        logger.info(
            "TCDJEPAVertical ingested %d survivors (preset=%s)",
            bundle.embeddings.shape[0],
            self.preset.value,
        )

    # ──────────────────────── stage 2: crystallize ────────────────────────
    async def crystallize(
        self,
        *,
        job_id: str | None = None,
        progress_callback: Any | None = None,
    ) -> list[CrystallizedModule]:
        """Stage 2 — run TCD-JEPA crystallization.

        Execution strategy (mirrors job_manager.py):
        1. Try RunPod GPU if configured (budget + cooldown enforced).
        2. Fall back to local TCDJEPAWrapper (GPU or CPU).
        3. Extract modules from whichever path succeeded.
        """
        if self.current_bundle is None:
            raise TCDVerticalError(
                "must ingest a BTUTSurvivorBundle before crystallize()",
                stage="crystallize",
            )

        bundle = self.current_bundle
        provenance = (bundle.metadata or {}).get("provenance_job_id")
        effective_job_id = job_id or provenance or "tcd-adhoc"

        try:
            training_result = await self._try_runpod(
                bundle, effective_job_id, progress_callback
            )
        except Exception as exc:
            raise TCDVerticalError(str(exc), stage="crystallize") from exc

        raw_modules = training_result.get("modules", [])

        modules: list[CrystallizedModule] = []
        for i, raw in enumerate(raw_modules):
            modules.append(
                CrystallizedModule(
                    id=str(raw.get("id", f"mod-{i}")),
                    vertical=self.preset,
                    module_type=raw.get("module_type", "attractor"),
                    centroid=np.asarray(raw.get("centroid", []), dtype=np.float32),
                    members=list(raw.get("members", [])),
                    purity=float(raw.get("purity", 0.0)),
                    quality_score=float(raw.get("quality_score", 0.0)),
                    provenance_job_id=provenance,
                    created_at=datetime.utcnow(),
                )
            )
        return modules

    async def _try_runpod(
        self,
        bundle: BTUTSurvivorBundle,
        job_id: str,
        progress_callback: Any | None,
    ) -> dict:
        """Try RunPod first, fall back to local wrapper.

        Matches the same RunPod → local → simulation cascade that
        job_manager.py uses, but adapted for the vertical's bundle
        input format.
        """
        from .bundle_serializer import serialize_bundle
        from .runpod_client import is_runpod_configured

        # Prepare the config + entities/edges for both RunPod and local paths.
        config_path, data_dir = serialize_bundle(bundle, self.config)

        import yaml
        with open(config_path) as f:
            config = yaml.safe_load(f)

        # Build entity/edge lists in the format RunPodClient expects.
        entities = [
            {"name": eid, "index": i}
            for i, eid in enumerate(bundle.ids)
        ]
        edges = [
            {"source": bundle.ids[s], "target": bundle.ids[t], "weight": w}
            for s, t, w in bundle.edges
            if s < len(bundle.ids) and t < len(bundle.ids)
        ]

        # ── Path 1: RunPod GPU ───────────────────────────────────────
        training_result = None
        if is_runpod_configured():
            try:
                from .runpod_client import RunPodClient

                client = RunPodClient()
                logger.info(
                    "TCD vertical: dispatching to RunPod (job=%s, %d entities)",
                    job_id, len(entities),
                )
                training_result = await client.run_and_poll(
                    entities=entities,
                    edges=edges,
                    config=config,
                    dataset_id=f"tcd-vertical-{self.preset.value}",
                    job_id=job_id,
                    progress_callback=progress_callback,
                    poll_interval=2.0,
                    timeout=3600,
                )
                logger.info(
                    "TCD vertical: RunPod completed (job=%s, modules=%d)",
                    job_id,
                    len(training_result.get("modules", [])),
                )
            except Exception as runpod_exc:
                logger.warning(
                    "TCD vertical: RunPod failed (%s), falling back to local",
                    runpod_exc,
                )

        # ── Path 2: Local wrapper (GPU or CPU) ───────────────────────
        if training_result is None:
            if self._wrapper is None:
                raise TCDVerticalError(
                    "no TCDJEPAWrapper configured and RunPod unavailable",
                    stage="crystallize",
                )
            logger.info(
                "TCD vertical: running locally (job=%s, %d entities)",
                job_id, len(entities),
            )
            result = await self._wrapper.run_training(
                config_path=config_path,
                data_path=data_dir,
                callback=progress_callback,
            )
            checkpoint = result.get("checkpoint_path", "(latest)")
            raw_modules = await self._wrapper.extract_modules(
                checkpoint_path=checkpoint
            )
            training_result = {"modules": raw_modules}

        return training_result

    # ──────────────────────── stage 3: interpret ────────────────────────
    async def interpret(self, modules: list[Any]) -> list[dict]:
        """Stage 3 — annotate modules via the existing interpretation pipeline."""
        if self._interpret_fn is None:
            logger.warning(
                "no interpretation_fn configured; returning modules unchanged"
            )
            from dataclasses import asdict

            def _to_dict(m: Any) -> dict:
                if isinstance(m, dict):
                    return m
                try:
                    return asdict(m)
                except TypeError:
                    return vars(m)

            return [_to_dict(m) for m in modules]
        try:
            return await self._interpret_fn(modules)
        except Exception as exc:
            raise TCDVerticalError(str(exc), stage="interpret") from exc

    # ──────────────────────── stage 4: register ────────────────────────
    async def register(self, modules: list[Any]) -> list[Any]:
        """Stage 4 — persist modules to the registry."""
        if self._registry is None:
            raise TCDVerticalError(
                "no ModuleRegistryService configured on this vertical",
                stage="register",
            )
        try:
            return await self._registry.register_many(modules)
        except Exception as exc:
            raise TCDVerticalError(str(exc), stage="register") from exc

    # ──────────────────────── stage 5a: route ────────────────────────
    def route(
        self,
        signal: np.ndarray,
        *,
        known_modules: list[Any],
        top_k: int = 1,
    ) -> list[RoutingDecision]:
        """Stage 5a — route a signal against a list of modules."""
        from .routing import route_signal

        try:
            return route_signal(signal, known_modules, top_k=top_k)
        except Exception as exc:
            raise TCDVerticalError(str(exc), stage="route") from exc

    # ──────────────────────── stage 5b: export ────────────────────────
    def export(self, module: Any, *, format: str = "json") -> bytes:
        """Stage 5b — export a module to a portable format."""
        from .export import ExportFormat, to_json, to_onnx, to_pytorch_bundle

        try:
            fmt = ExportFormat(format)
        except ValueError as exc:
            raise TCDVerticalError(
                f"unknown export format: {format}", stage="export"
            ) from exc

        try:
            if fmt == ExportFormat.JSON:
                return to_json(module)
            if fmt == ExportFormat.PYTORCH:
                return to_pytorch_bundle(module)
            if fmt == ExportFormat.ONNX:
                return to_onnx(module)
        except Exception as exc:
            raise TCDVerticalError(str(exc), stage="export") from exc

        raise TCDVerticalError(
            f"unreachable export format: {format}", stage="export"
        )
