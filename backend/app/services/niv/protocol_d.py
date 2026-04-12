"""Protocol D — frozen forward test.

Fit once on data <= freeze_date, predict forward with zero retraining.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, roc_auc_score


@dataclass
class ProtocolDResult:
    freeze_date: str
    horizons: tuple[int, ...]
    auc_by_horizon: dict[int, float]
    brier_by_horizon: dict[int, float]
    predictions: list[dict]
    n_retrain: int = 0
    n_forward_months: int = 0
    warnings: list[str] = field(default_factory=list)


def protocol_d(
    frame: pd.DataFrame,
    freeze_date: str,
    ensemble,
    horizons: tuple[int, ...] = (3, 6, 12, 18),
    feature_cols: list[str] | None = None,
    label_col: str = "recession",
) -> ProtocolDResult:
    """Fit once, freeze, predict forward with zero retraining."""
    if feature_cols is None:
        feature_cols = [c for c in frame.columns if c != label_col]

    freeze_ts = pd.Timestamp(freeze_date)
    train_mask = frame.index <= freeze_ts
    test_mask = frame.index > freeze_ts

    X_train = frame.loc[train_mask, feature_cols].values
    y_train = frame.loc[train_mask, label_col].values
    X_test = frame.loc[test_mask, feature_cols].values
    y_test = frame.loc[test_mask, label_col].values
    test_dates = frame.loc[test_mask].index

    warnings: list[str] = []
    if not np.any(y_train == 1):
        warnings.append("No positive class in training data")
    if len(X_test) == 0:
        return ProtocolDResult(
            freeze_date=freeze_date, horizons=horizons,
            auc_by_horizon={}, brier_by_horizon={},
            predictions=[], warnings=["No test data after freeze date"],
        )

    ensemble.fit(X_train, y_train)
    probs = ensemble.predict_proba(X_test)

    predictions = []
    for i, (date, prob) in enumerate(zip(test_dates, probs)):
        predictions.append({"date": str(date), "prob": float(prob), "actual": int(y_test[i])})

    n = len(y_test)
    auc_by_h: dict[int, float] = {}
    brier_by_h: dict[int, float] = {}
    for h in horizons:
        ya = y_test[h:] if h < n else np.array([])
        yp = probs[:n - h] if h < n else np.array([])
        if len(ya) > 0 and len(set(ya)) > 1:
            auc_by_h[h] = float(roc_auc_score(ya, yp))
            brier_by_h[h] = float(brier_score_loss(ya, yp))
        else:
            auc_by_h[h] = 0.5
            brier_by_h[h] = 0.25

    return ProtocolDResult(
        freeze_date=freeze_date, horizons=horizons,
        auc_by_horizon=auc_by_h, brier_by_horizon=brier_by_h,
        predictions=predictions, n_retrain=0,
        n_forward_months=len(X_test), warnings=warnings,
    )
