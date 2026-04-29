"""BTUT pipeline runner + sklearn baselines for the megatest.

Wraps `run_btut_pipeline` with a normalized return shape and provides
Isolation Forest and Local Outlier Factor as comparison rankers operating
on the same entity set.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import Any

import numpy as np

# Make backend.engine.reduce importable
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def run_btut(
    entities: list[dict],
    edges: list[dict],
    unique_types: list[str] | None = None,
    target_survivors: int = 200,
    budget_dollars: float = 25.0,
) -> dict[str, Any]:
    """Run BTUT and return ranked names + raw result.

    Survivors are returned in composite-score-descending order. Entities
    NOT in the survivor list are ranked at the bottom (composite=0).
    """
    from backend.engine.reduce.pipeline import run_btut_pipeline

    t0 = time.perf_counter()
    raw = run_btut_pipeline(
        entities=entities,
        edges=edges,
        unique_types=unique_types,
        target_survivors=target_survivors,
        budget_dollars=budget_dollars,
    )
    wall_s = time.perf_counter() - t0

    survivors = raw["survivors"]
    survivors_sorted = sorted(
        survivors,
        key=lambda s: -float(s["scores"]["composite"]),
    )
    ranked_names = [s["entity"]["name"] for s in survivors_sorted]
    survivor_set = set(ranked_names)

    # Append non-survivors at the bottom (deterministic order: input order)
    for ent in entities:
        if ent["name"] not in survivor_set:
            ranked_names.append(ent["name"])

    return {
        "ranked_names": ranked_names,
        "survivor_set": survivor_set,
        "n_entities_in": len(entities),
        "n_survivors": len(survivors),
        "n_clusters": raw["summary"].get("clusters", 0),
        "wall_seconds": round(wall_s, 3),
        "entities_per_second": round(len(entities) / max(1e-6, wall_s), 1),
        "summary": raw["summary"],
    }


def _flatten_attrs(entities: list[dict]) -> tuple[np.ndarray, list[str]]:
    """Flatten entity attributes to a numeric matrix for sklearn.

    Numeric attributes pass through. Categorical attributes are hashed
    to integer features (sklearn-compatible). Text attributes are summarized
    by length and word count. Missing values become 0.

    Returns (matrix, ranked_entity_names_in_input_order).
    """
    # Discover the union of attribute keys
    keys = set()
    for e in entities:
        keys.update((e.get("attributes") or {}).keys())
    keys = sorted(keys)

    rows = []
    names = []
    for e in entities:
        attrs = e.get("attributes") or {}
        row = []
        for k in keys:
            v = attrs.get(k)
            if v is None:
                row.append(0.0)
            elif isinstance(v, (int, float)) and not isinstance(v, bool):
                row.append(float(v))
            elif isinstance(v, bool):
                row.append(1.0 if v else 0.0)
            elif isinstance(v, str):
                # Hash to a stable small integer feature
                row.append(float(abs(hash(v)) % 10_000))
            elif isinstance(v, (list, tuple)):
                row.append(float(len(v)))
            else:
                row.append(0.0)
        rows.append(row)
        names.append(e["name"])

    return np.array(rows, dtype=np.float64), names


def run_isolation_forest(
    entities: list[dict],
    contamination: float = 0.05,
    seed: int = 42,
) -> dict[str, Any]:
    """Rank entities by Isolation Forest anomaly score (more negative = more anomalous)."""
    from sklearn.ensemble import IsolationForest

    X, names = _flatten_attrs(entities)
    if X.shape[0] < 2 or X.shape[1] == 0:
        return {"ranked_names": names, "wall_seconds": 0.0, "available": False}

    t0 = time.perf_counter()
    clf = IsolationForest(
        contamination=contamination,
        random_state=seed,
        n_estimators=100,
    )
    clf.fit(X)
    scores = clf.score_samples(X)  # higher = more normal; we want low = anomalous
    wall_s = time.perf_counter() - t0

    order = np.argsort(scores)  # ascending: most anomalous first
    ranked_names = [names[i] for i in order]

    return {
        "ranked_names": ranked_names,
        "wall_seconds": round(wall_s, 3),
        "entities_per_second": round(len(entities) / max(1e-6, wall_s), 1),
        "available": True,
    }


def run_local_outlier_factor(
    entities: list[dict],
    n_neighbors: int = 20,
) -> dict[str, Any]:
    """Rank entities by Local Outlier Factor (negative_outlier_factor: lower = more anomalous)."""
    from sklearn.neighbors import LocalOutlierFactor

    X, names = _flatten_attrs(entities)
    if X.shape[0] < n_neighbors + 1 or X.shape[1] == 0:
        return {"ranked_names": names, "wall_seconds": 0.0, "available": False}

    t0 = time.perf_counter()
    nn = min(n_neighbors, max(2, X.shape[0] - 1))
    clf = LocalOutlierFactor(n_neighbors=nn, novelty=False)
    clf.fit_predict(X)
    scores = clf.negative_outlier_factor_  # lower = more anomalous
    wall_s = time.perf_counter() - t0

    order = np.argsort(scores)  # ascending: most anomalous first
    ranked_names = [names[i] for i in order]

    return {
        "ranked_names": ranked_names,
        "wall_seconds": round(wall_s, 3),
        "entities_per_second": round(len(entities) / max(1e-6, wall_s), 1),
        "available": True,
    }


def run_baselines(
    entities: list[dict],
    seed: int = 42,
) -> dict[str, dict[str, Any]]:
    """Run all open baselines and return their rankings."""
    out = {}
    try:
        out["isolation_forest"] = run_isolation_forest(entities, seed=seed)
    except Exception as e:
        out["isolation_forest"] = {"available": False, "error": str(e), "ranked_names": []}
    try:
        out["local_outlier_factor"] = run_local_outlier_factor(entities)
    except Exception as e:
        out["local_outlier_factor"] = {"available": False, "error": str(e), "ranked_names": []}
    return out
