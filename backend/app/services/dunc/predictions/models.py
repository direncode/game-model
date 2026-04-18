"""ML model training and prediction for football match outcomes.

Soft-voting ensemble of Logistic Regression, Random Forest, and XGBoost.
XGBoost is weighted 2x because it consistently outperforms on tabular
sports data (Razali et al., 2022).
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

logger = logging.getLogger(__name__)


class ModelTrainer:
    def __init__(self) -> None:
        self.scaler = StandardScaler()
        self.ensemble = VotingClassifier(
            estimators=[
                ("lr", LogisticRegression(max_iter=1000, multi_class="multinomial", C=0.5)),
                ("rf", RandomForestClassifier(n_estimators=200, max_depth=8, min_samples_leaf=10, random_state=42)),
                ("xgb", XGBClassifier(
                    n_estimators=200, max_depth=5, learning_rate=0.05,
                    subsample=0.8, colsample_bytree=0.8, random_state=42,
                    eval_metric="mlogloss",
                )),
            ],
            voting="soft",
            weights=[1, 1, 2],
        )
        self._trained = False

    def train(self, X: pd.DataFrame, y: pd.Series) -> None:
        X_scaled = self.scaler.fit_transform(X.fillna(X.median()))
        self.ensemble.fit(X_scaled, y)
        self._trained = True
        logger.info("Ensemble trained on %d samples, %d features", len(X), X.shape[1])

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        if not self._trained:
            raise RuntimeError("Model not trained yet")
        X_scaled = self.scaler.transform(X.fillna(X.median()))
        return self.ensemble.predict_proba(X_scaled)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        if not self._trained:
            raise RuntimeError("Model not trained yet")
        X_scaled = self.scaler.transform(X.fillna(X.median()))
        return self.ensemble.predict(X_scaled)

    def train_and_evaluate(self, X: pd.DataFrame, y: pd.Series, n_splits: int = 5) -> dict:
        tscv = TimeSeriesSplit(n_splits=n_splits)
        accuracies, log_losses = [], []

        for train_idx, test_idx in tscv.split(X):
            X_train = X.iloc[train_idx].fillna(X.iloc[train_idx].median())
            X_test = X.iloc[test_idx].fillna(X.iloc[train_idx].median())
            y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

            scaler = StandardScaler()
            X_train_s = scaler.fit_transform(X_train)
            X_test_s = scaler.transform(X_test)

            self.ensemble.fit(X_train_s, y_train)
            preds = self.ensemble.predict(X_test_s)
            proba = self.ensemble.predict_proba(X_test_s)

            accuracies.append(accuracy_score(y_test, preds))
            log_losses.append(log_loss(y_test, proba))

        # Final train on all data
        self.train(X, y)

        return {
            "accuracy": float(np.mean(accuracies)),
            "accuracy_std": float(np.std(accuracies)),
            "log_loss": float(np.mean(log_losses)),
            "log_loss_std": float(np.std(log_losses)),
        }
