"""Expanding-window walk-forward validation harness.

Extracted from NIV's walkforward.py. Ensemble-agnostic.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Tuple

import numpy as np
from sklearn.metrics import brier_score_loss, f1_score, roc_auc_score

from .conformal import ConformalPredictor

logger = logging.getLogger(__name__)


@dataclass
class WalkForwardConfig:
    warmup_frac: float = 0.20
    retrain_every: int = 5
    horizons: Tuple[int, ...] = (3, 6, 12, 18)
    expanding: bool = True
    fixed_window: int = 180
    conformal_alpha: float = 0.1
    conformal_window: int = 100


@dataclass
class WalkForwardResult:
    horizons: Tuple[int, ...]
    auc_by_horizon: Dict[int, float]
    brier_by_horizon: Dict[int, float]
    f1_by_horizon: Dict[int, float]
    predictions: List[Dict[str, Any]]
    n_folds: int
    n_skipped: int
    warnings: List[str] = field(default_factory=list)


def walk_forward(
    X: np.ndarray,
    y: np.ndarray,
    model_factory: Callable[[], Any],
    cfg: WalkForwardConfig = WalkForwardConfig(),
) -> WalkForwardResult:
    n = len(y)
    warmup = max(2, int(n * cfg.warmup_frac))

    conformal = ConformalPredictor(alpha=cfg.conformal_alpha, window=cfg.conformal_window)
    model = model_factory()
    predictions: List[Dict[str, Any]] = []
    step_count = 0

    for i in range(warmup, n):
        if step_count % cfg.retrain_every == 0 or step_count == 0:
            start = 0 if cfg.expanding else max(0, i - cfg.fixed_window)
            X_train, y_train = X[start:i], y[start:i]
            if len(np.unique(y_train)) < 2:
                step_count += 1
                continue
            model.fit(X_train, y_train)

        proba = model.predict_proba(X[i:i+1])
        prob = float(proba[0, 1])
        lo, hi = conformal.bands(prob)
        conformal.update(prob, float(y[i]))

        predictions.append({
            "index": i,
            "probability": prob,
            "actual": int(y[i]),
            "conformal_lower": lo,
            "conformal_upper": hi,
            "retrained": (step_count % cfg.retrain_every == 0),
        })
        step_count += 1

    auc: Dict[int, float] = {}
    brier: Dict[int, float] = {}
    f1: Dict[int, float] = {}
    n_skipped = 0

    for h in cfg.horizons:
        actuals = []
        probs = []
        for p in predictions:
            future_idx = p["index"] + h
            if future_idx < n:
                actuals.append(int(y[future_idx]))
                probs.append(p["probability"])
        if len(actuals) < 2 or len(set(actuals)) < 2:
            n_skipped += 1
            continue
        auc[h] = float(roc_auc_score(actuals, probs))
        brier[h] = float(brier_score_loss(actuals, probs))
        preds_binary = [1 if p > 0.5 else 0 for p in probs]
        f1[h] = float(f1_score(actuals, preds_binary, zero_division=0))

    return WalkForwardResult(
        horizons=cfg.horizons, auc_by_horizon=auc, brier_by_horizon=brier,
        f1_by_horizon=f1, predictions=predictions, n_folds=step_count, n_skipped=n_skipped,
    )
