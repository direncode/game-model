"""Expanding-window walk-forward harness.

Ensemble-agnostic: takes any factory returning an object with fit/predict_proba.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Callable

import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, f1_score, roc_auc_score

from .conformal import SplitConformal

logger = logging.getLogger(__name__)


@dataclass
class WalkForwardConfig:
    warmup_frac: float = 0.20
    warmup_months: int | None = None
    retrain_every: int = 5
    horizons: tuple[int, ...] = (3, 6, 12, 18)
    expanding: bool = True
    fixed_window_months: int = 180
    min_positive_class: int = 1
    conformal_alpha: float = 0.1
    conformal_window: int = 100


@dataclass
class WalkForwardResult:
    horizons: tuple[int, ...]
    auc_by_horizon: dict[int, float]
    brier_by_horizon: dict[int, float]
    f1_by_horizon: dict[int, float]
    predictions: list[dict]
    n_folds: int
    n_skipped: int
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "horizons": list(self.horizons),
            "auc_by_horizon": {str(k): v for k, v in self.auc_by_horizon.items()},
            "brier_by_horizon": {str(k): v for k, v in self.brier_by_horizon.items()},
            "f1_by_horizon": {str(k): v for k, v in self.f1_by_horizon.items()},
            "n_folds": self.n_folds,
            "n_skipped": self.n_skipped,
            "warnings": self.warnings,
        }


def walkforward(
    frame: pd.DataFrame,
    ensemble_factory: Callable,
    config: WalkForwardConfig,
    feature_cols: list[str] | None = None,
    label_col: str = "recession",
) -> WalkForwardResult:
    """Run expanding-window walk-forward evaluation."""
    n = len(frame)
    if feature_cols is None:
        feature_cols = [c for c in frame.columns if c != label_col]

    X_all = frame[feature_cols].values
    y_all = frame[label_col].values
    dates = frame.index

    warmup = config.warmup_months if config.warmup_months else int(n * config.warmup_frac)
    start_idx = max(warmup, 1)

    all_predictions: list[dict] = []
    horizon_actuals: dict[int, list] = {h: [] for h in config.horizons}
    horizon_preds: dict[int, list] = {h: [] for h in config.horizons}

    cached_ensemble = None
    steps_since_start = 0
    n_skipped = 0
    conformal = SplitConformal(config.conformal_alpha, config.conformal_window)
    warnings: list[str] = []

    for i in range(start_idx, n):
        train_start = 0 if config.expanding else max(0, i - config.fixed_window_months)
        X_train = X_all[train_start:i]
        y_train = y_all[train_start:i]

        has_pos = bool(np.any(y_train == 1))
        has_neg = bool(np.any(y_train == 0))
        if not has_pos or not has_neg:
            n_skipped += 1
            continue

        should_retrain = cached_ensemble is None or steps_since_start % config.retrain_every == 0
        if should_retrain:
            cached_ensemble = ensemble_factory()
            try:
                cached_ensemble.fit(X_train, y_train)
            except Exception as e:
                warnings.append(f"Retrain failed at step {i}: {e}")
                n_skipped += 1
                continue

        X_test = X_all[i: i + 1]
        try:
            prob = float(cached_ensemble.predict_proba(X_test)[0])
        except Exception:
            prob = 0.5

        lower, upper = conformal.bands(prob)
        pred_record: dict = {
            "date": str(dates[i]),
            "prob": prob,
            "lower": lower,
            "upper": upper,
            "retrained": should_retrain,
        }

        for h in config.horizons:
            target_idx = i + h
            if target_idx < n:
                horizon_actuals[h].append(int(y_all[target_idx]))
                horizon_preds[h].append(prob)

        all_predictions.append(pred_record)
        conformal.update(prob, int(y_all[i]))
        steps_since_start += 1

    auc_by_h: dict[int, float] = {}
    brier_by_h: dict[int, float] = {}
    f1_by_h: dict[int, float] = {}
    for h in config.horizons:
        ya = np.array(horizon_actuals[h])
        yp = np.array(horizon_preds[h])
        if len(ya) > 0 and len(set(ya)) > 1:
            auc_by_h[h] = float(roc_auc_score(ya, yp))
            brier_by_h[h] = float(brier_score_loss(ya, yp))
            f1_by_h[h] = float(f1_score(ya, (yp > 0.5).astype(int), zero_division=0))
        else:
            auc_by_h[h] = 0.5
            brier_by_h[h] = 0.25
            f1_by_h[h] = 0.0
            warnings.append(f"Horizon {h}m: insufficient class diversity for metrics")

    return WalkForwardResult(
        horizons=config.horizons,
        auc_by_horizon=auc_by_h,
        brier_by_horizon=brier_by_h,
        f1_by_horizon=f1_by_h,
        predictions=all_predictions,
        n_folds=len(all_predictions),
        n_skipped=n_skipped,
        warnings=warnings,
    )
