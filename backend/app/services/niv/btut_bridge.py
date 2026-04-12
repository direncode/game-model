"""Optional BTUT feature-selection bridge."""
from __future__ import annotations

import logging
from dataclasses import dataclass

import pandas as pd

from .config import NIVConfig

logger = logging.getLogger(__name__)


@dataclass
class BTUTThinningResult:
    survivors: list[str]
    manifest: list[dict]
    original_pool_size: int


def thin_features(
    candidate_pool: list,
    niv_frame: pd.DataFrame | None,
    cfg: NIVConfig | None = None,
) -> BTUTThinningResult | None:
    """Select features via BTUT lattice threading. Returns None if disabled."""
    if cfg is None:
        cfg = NIVConfig()
    if not cfg.btut_thinning:
        return None
    if not candidate_pool:
        logger.warning("BTUT thinning enabled but candidate pool is empty")
        return None

    try:
        from app.services.btut.pipeline import run_btut_pipeline
    except ImportError:
        logger.error("BTUT pipeline not available — falling back to base features")
        return None

    entities = []
    for i, spec in enumerate(candidate_pool):
        entities.append({
            "name": spec.name if hasattr(spec, "name") else f"feature_{i}",
            "type": "macro_feature",
            "attributes": spec.metadata if hasattr(spec, "metadata") else {},
        })

    result = run_btut_pipeline(
        entities, [],
        unique_types=["macro_feature"],
        target_survivors=cfg.btut_target_features,
        budget_dollars=cfg.btut_budget_dollars,
    )

    survivors = []
    manifest = []
    for s in result.get("survivors", []):
        name = s["entity"]["name"]
        survivors.append(name)
        manifest.append({
            "name": name,
            "diversity": s["scores"]["diversity"],
            "reconstruction": s["scores"]["reconstruction"],
            "anomaly": s["scores"]["anomaly"],
            "composite": s["scores"]["composite"],
        })

    return BTUTThinningResult(survivors=survivors, manifest=manifest, original_pool_size=len(candidate_pool))
