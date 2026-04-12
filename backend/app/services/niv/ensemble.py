"""NIV L2-regularized ensemble: LR + AdaBoost + MLP.

Default combiner: log-odds averaging (matches regenerationism.ai dashboard).
Opt-in: stacking with LR meta-learner via NIVConfig(combiner="stacking").
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import AdaBoostClassifier, StackingClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.tree import DecisionTreeClassifier

from .config import NIVConfig

logger = logging.getLogger(__name__)

_CFG = NIVConfig()


def logit(p: float) -> float:
    """Log-odds, clamped."""
    clamped = max(1e-7, min(1 - 1e-7, p))
    return float(np.log(clamped / (1 - clamped)))


def sigmoid(z: float) -> float:
    """Sigmoid, clamped."""
    z = max(-500, min(500, z))
    return float(1.0 / (1.0 + np.exp(-z)))


def log_odds_average(p1: float, p2: float, p3: float) -> float:
    """Average in log-odds space, then invert. Matches oosTests.ts."""
    return sigmoid((logit(p1) + logit(p2) + logit(p3)) / 3)


@dataclass
class EnsembleExplanation:
    per_learner: dict[str, np.ndarray]
    combined: np.ndarray
    lr_coefficients: np.ndarray | None = None


class NIVEnsemble:
    """Ensemble of L2-LR + AdaBoost(15 stumps) + MLP(8 hidden)."""

    def __init__(
        self,
        combiner: str = "log_odds",
        calibrate: str = "last_30pct",
        cfg: NIVConfig | None = None,
    ):
        self.cfg = cfg or _CFG
        self.combiner = combiner
        self.calibrate = calibrate
        self._lr = None
        self._ada = None
        self._mlp = None
        self._stacker = None
        self._iso = None
        self._fitted = False

    def _make_learners(self):
        cfg = self.cfg
        lr = LogisticRegression(
            C=cfg.lr_C, class_weight="balanced", penalty="l2",
            max_iter=cfg.lr_max_iter, solver="lbfgs", random_state=42,
        )
        ada = AdaBoostClassifier(
            n_estimators=cfg.ada_n_estimators,
            estimator=DecisionTreeClassifier(max_depth=1),
            algorithm="SAMME",
            random_state=42,
        )
        mlp = MLPClassifier(
            hidden_layer_sizes=cfg.mlp_hidden,
            activation="relu",
            solver="adam",
            max_iter=cfg.mlp_max_iter,
            early_stopping=True,
            random_state=42,
        )
        return lr, ada, mlp

    def fit(self, X: np.ndarray, y: np.ndarray) -> "NIVEnsemble":
        self._lr, self._ada, self._mlp = self._make_learners()

        if self.combiner == "stacking":
            self._stacker = StackingClassifier(
                estimators=[("lr", self._lr), ("ada", self._ada), ("mlp", self._mlp)],
                final_estimator=LogisticRegression(C=1.0, random_state=42),
                cv=3,
                stack_method="predict_proba",
                passthrough=False,
            )
            self._stacker.fit(X, y)
        else:
            self._lr.fit(X, y)
            self._ada.fit(X, y)
            self._mlp.fit(X, y)

        if self.calibrate == "last_30pct" and self.combiner != "stacking":
            cal_start = int(len(X) * 0.7)
            if cal_start < len(X) - 10:
                cal_X = X[cal_start:]
                cal_y = y[cal_start:]
                cal_preds = self._raw_predict(cal_X)
                self._iso = IsotonicRegression(y_min=0, y_max=1, out_of_bounds="clip")
                self._iso.fit(cal_preds, cal_y)

        self._fitted = True
        return self

    def _raw_predict(self, X: np.ndarray) -> np.ndarray:
        p1 = self._lr.predict_proba(X)[:, 1]
        p2 = self._ada.predict_proba(X)[:, 1]
        p3 = self._mlp.predict_proba(X)[:, 1]
        result = np.zeros(len(X))
        for i in range(len(X)):
            result[i] = log_odds_average(p1[i], p2[i], p3[i])
        return result

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self._fitted:
            raise RuntimeError("Call fit() before predict_proba()")
        if self.combiner == "stacking":
            return self._stacker.predict_proba(X)[:, 1]
        raw = self._raw_predict(X)
        if self._iso is not None:
            raw = self._iso.transform(raw)
        return np.clip(raw, 0, 1)

    def predict_per_learner(self, X: np.ndarray) -> dict[str, np.ndarray]:
        if self.combiner == "stacking":
            return {
                name: est.predict_proba(X)[:, 1]
                for name, est in self._stacker.estimators_
            }
        return {
            "lr": self._lr.predict_proba(X)[:, 1],
            "ada": self._ada.predict_proba(X)[:, 1],
            "mlp": self._mlp.predict_proba(X)[:, 1],
        }

    def explain(self, X: np.ndarray) -> EnsembleExplanation:
        per_learner = self.predict_per_learner(X)
        combined = self.predict_proba(X)
        lr_coef = self._lr.coef_[0] if self._lr is not None else None
        return EnsembleExplanation(per_learner=per_learner, combined=combined, lr_coefficients=lr_coef)
