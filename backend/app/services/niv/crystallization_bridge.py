"""TCD-JEPA crystallization bridge for NIV walk-forward modules."""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def to_module_descriptor(fold_data: Any) -> dict:
    """Convert a walk-forward fold into a TCD-JEPA module descriptor.

    The crystallization job_manager takes a config dict with:
    - A dataset reference (what data the module represents)
    - Metadata for regime comparison (feature importances, prediction stats)
    - The module's signature vector (used for clustering into macro regimes)

    For NIV: each module represents one time window of the walk-forward.
    The signature vector is the per-prediction probability time series
    within that window, which TCD-JEPA clusters into regimes like
    "pre-recession tightening", "mid-cycle expansion", "recovery".
    """
    if fold_data is None:
        return {}

    predictions = fold_data.get("predictions", [])
    year = fold_data.get("year", "unknown")

    # Build signature: probability time series for this window
    probs = [p.get("prob", 0.5) for p in predictions]
    mean_prob = sum(probs) / len(probs) if probs else 0.5
    max_prob = max(probs) if probs else 0.5
    n_elevated = sum(1 for p in probs if p > 0.30)
    n_warning = sum(1 for p in probs if p > 0.50)

    return {
        "source": "niv_walkforward",
        "module_type": "macro_regime",
        "window": year,
        "config": {
            "n_predictions": len(predictions),
            "mean_recession_prob": round(mean_prob, 4),
            "max_recession_prob": round(max_prob, 4),
            "months_elevated": n_elevated,
            "months_warning": n_warning,
            "signature_vector": [round(p, 4) for p in probs],
        },
        "metadata": {
            "vertical": "niv",
            "dataset": "us_fred",
            "date_range": f"{predictions[0]['date']}..{predictions[-1]['date']}" if predictions else "",
        },
    }


def register_modules(
    walkforward_result,
    job_manager=None,
    granularity: str = "per_year",
) -> list[str]:
    """Register walk-forward results as crystallization modules."""
    if job_manager is None:
        logger.info("Crystallization bridge: no job_manager, skipping")
        return []

    module_ids: list[str] = []
    predictions = walkforward_result.predictions
    if not predictions:
        return []

    if granularity == "per_year":
        by_year: dict[str, list] = {}
        for p in predictions:
            year = p["date"][:4]
            by_year.setdefault(year, []).append(p)
        for year, preds in sorted(by_year.items()):
            descriptor = to_module_descriptor({"year": year, "predictions": preds})
            module_ids.append(f"niv_module_{year}")
    else:
        for i, p in enumerate(predictions):
            descriptor = to_module_descriptor(p)
            module_ids.append(f"niv_fold_{i}")

    return module_ids
