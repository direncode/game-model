"""Bridge between LatentOceanDataLayer and TCD-JEPA vertical.

Converts a ``tcd_jepa`` vertical export dict into a
``BTUTSurvivorBundle`` that ``TCDJEPAVertical.ingest_btut()`` can
consume. Also provides a convenience function that runs the full
data_layer pipeline and feeds the result directly into the vertical.

This file is the only coupling point between data_layer and
crystallization. Neither side imports the other's internals.
"""
from __future__ import annotations

import logging
from typing import Any

import numpy as np

from app.services.crystallization.vertical import TCDJEPAVertical
from app.services.crystallization.vertical_types import (
    BTUTSurvivorBundle,
    VerticalPreset,
)

from . import LatentOceanDataLayer

logger = logging.getLogger(__name__)


def export_to_bundle(
    tcd_jepa_payload: dict,
    *,
    provenance_job_id: str | None = None,
) -> BTUTSurvivorBundle:
    """Convert a ``tcd_jepa`` vertical export dict into a BTUTSurvivorBundle.

    Args:
        tcd_jepa_payload: The dict returned by
            ``LatentOceanDataLayer.export_for_vertical("tcd_jepa")``.
        provenance_job_id: Optional job id for lineage tracking.

    Returns:
        BTUTSurvivorBundle ready for ``TCDJEPAVertical.ingest_btut()``.
    """
    embeddings = np.asarray(tcd_jepa_payload["embeddings_8d"], dtype=np.float32)
    ids = tcd_jepa_payload["entity_ids"]
    # TCD-JEPA expects edges as (src_idx, dst_idx, weight) tuples.
    # The tcd_jepa export doesn't carry edges (they're dropped during
    # BTUT's stratified selection), so we pass an empty list. The
    # vertical's crystallizer handles this gracefully.
    edges: list[tuple[int, int, float]] = []

    return BTUTSurvivorBundle(
        embeddings=embeddings,
        ids=ids,
        edges=edges,
        metadata={
            "dataset_id": tcd_jepa_payload.get("dataset_id", ""),
            "provenance_job_id": provenance_job_id,
            "entity_types": tcd_jepa_payload.get("entity_types", []),
            "clusters": tcd_jepa_payload.get("clusters", []),
        },
    )


def data_layer_to_vertical(
    source: str,
    *,
    limit: int = 10_000,
    target_survivors: int = 300,
    budget_dollars: float = 50.0,
    preset: VerticalPreset = VerticalPreset.GENERIC,
    wrapper: Any | None = None,
    registry_service: Any | None = None,
    interpretation_fn: Any | None = None,
    provenance_job_id: str | None = None,
) -> tuple[TCDJEPAVertical, BTUTSurvivorBundle]:
    """Convenience: run the data layer pipeline and produce a ready-to-
    crystallize TCDJEPAVertical + ingested bundle.

    Usage:
        vertical, bundle = data_layer_to_vertical("edgar", limit=5000)
        modules = await vertical.crystallize()
        modules = await vertical.interpret(modules)
        modules = await vertical.register(modules)
    """
    layer = LatentOceanDataLayer(
        budget_dollars=budget_dollars,
        target_survivors=target_survivors,
        compute_3d_display=False,
    )
    layer.ingest(source, limit=limit)
    layer.apply_btut_tuner()
    layer.project_to_manifold()
    payload = layer.export_for_vertical("tcd_jepa")

    bundle = export_to_bundle(payload, provenance_job_id=provenance_job_id)

    vertical = TCDJEPAVertical(
        preset=preset,
        wrapper=wrapper,
        registry_service=registry_service,
        interpretation_fn=interpretation_fn,
    )
    vertical.ingest_btut(bundle)

    logger.info(
        "data_layer → TCD-JEPA: %d survivors ingested (source=%s, preset=%s)",
        bundle.embeddings.shape[0],
        source,
        preset.value,
    )
    return vertical, bundle
