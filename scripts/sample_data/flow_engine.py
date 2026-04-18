"""Flow Engine: real walk_forward over a 180-day synthetic signal.

Uses the sklearn-style `walk_forward` API with a logistic-regression factory.
Alerts produced from real `alert_from_metric` with NIV-shaped metric value.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from sample_data._common import (
    ManifestEntry,
    add_file,
    add_interact,
    round_floats,
    write_json,
)


def _make_series(n: int = 180) -> tuple[np.ndarray, np.ndarray, list[dict]]:
    rng = np.random.RandomState(42)
    t = np.arange(n)
    u = 0.5 + 0.2 * np.sin(t / 10.0) + 0.05 * rng.randn(n)
    p = 1.0 + 0.3 * np.cos(t / 14.0) + 0.05 * rng.randn(n)
    x = 1.0 + 0.1 * (t / n) + 0.05 * rng.randn(n)
    X = np.stack([u, p, x], axis=1)
    metric = (u * p**2) / np.clip(x, 1e-3, None)
    y = (metric > np.median(metric)).astype(int)
    series = [
        {
            "t": int(i),
            "u": float(u[i]),
            "P": float(p[i]),
            "X": float(x[i]),
            "metric": float(metric[i]),
            "y": int(y[i]),
        }
        for i in range(n)
    ]
    return X, y, series


def run(out_dir: Path) -> ManifestEntry:
    entry = ManifestEntry(name="flow_engine", mode="real")
    X, y, series = _make_series(180)

    p_series = out_dir / "time_series.json"
    write_json(p_series, round_floats({"series": series, "n": len(series), "seed": 42}))
    add_file(entry, p_series, "input", "180-day synthetic (u, P, X) signals with target y")

    from sklearn.linear_model import LogisticRegression

    from app.services.flow_engine.walkforward import WalkForwardConfig, walk_forward

    def factory():
        return LogisticRegression(max_iter=500, solver="lbfgs")

    cfg = WalkForwardConfig()
    result = walk_forward(X, y, factory, cfg)

    preds = result.predictions
    p_preds = out_dir / "walkforward_predictions.json"
    pred_payload = {
        "predictions_tail_50": round_floats(preds[-50:]),
        "n_predictions_total": len(preds),
        "n_folds": result.n_folds,
        "n_skipped": result.n_skipped,
        "auc_by_horizon": round_floats(result.auc_by_horizon),
        "brier_by_horizon": round_floats(result.brier_by_horizon),
        "f1_by_horizon": round_floats(result.f1_by_horizon),
        "horizons": result.horizons,
        "config": {
            "retrain_every": cfg.retrain_every,
            "conformal_alpha": cfg.conformal_alpha,
            "warmup_frac": cfg.warmup_frac,
        },
    }
    write_json(p_preds, pred_payload)
    add_file(
        entry, p_preds, "output", "Walk-forward predictions (tail 50) + horizon metrics"
    )

    from app.services.flow_engine.alerts import AlertThresholds, alert_from_metric

    thresholds = AlertThresholds()
    recent_metric = float(series[-1]["metric"])
    envelope = alert_from_metric(value=recent_metric, thresholds=thresholds)
    p_alerts = out_dir / "alerts.json"
    write_json(
        p_alerts,
        round_floats(
            {
                "latest_metric": recent_metric,
                "alert": {"level": envelope.level.value, "severity": envelope.severity},
                "thresholds": {
                    "elevated": thresholds.elevated,
                    "warning": thresholds.warning,
                    "critical": thresholds.critical,
                    "hysteresis_band": thresholds.hysteresis_band,
                },
            }
        ),
    )
    add_file(entry, p_alerts, "output", "Current alert envelope from latest metric value")

    ensemble = {
        "members": [
            {
                "name": "walkforward_logreg",
                "weight": 1.0,
                "latest_auc": result.auc_by_horizon.get(result.horizons[0]) if result.horizons else None,
            }
        ],
        "aggregate": {
            "probability": float(preds[-1]["probability"]) if preds else None,
            "conformal_lower": float(preds[-1]["conformal_lower"]) if preds else None,
            "conformal_upper": float(preds[-1]["conformal_upper"]) if preds else None,
        },
    }
    p_ens = out_dir / "ensemble_output.json"
    write_json(p_ens, round_floats(ensemble))
    add_file(entry, p_ens, "output", "Ensemble aggregate (single-member demo)")

    add_interact(entry, "Read latest alert", "Read", "data/samples/flow_engine/alerts.json")
    add_interact(
        entry,
        "Read walk-forward preds",
        "Read",
        "data/samples/flow_engine/walkforward_predictions.json",
    )
    return entry
