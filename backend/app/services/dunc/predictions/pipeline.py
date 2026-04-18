"""Prediction pipeline orchestrator.

Ties together data loading, feature engineering, model training,
Polymarket fetching, triple-layer fusion, and Claude interpretation.
Auto-fetches and trains on cold start, caches for subsequent requests.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from app.services.dunc.predictions.cache import ArtifactCache
from app.services.dunc.predictions.cleaner import DataCleaner
from app.services.dunc.predictions.claude_analyst import ClaudeAnalyst
from app.services.dunc.predictions.data_loader import FootballDataLoader
from app.services.dunc.predictions.elo import FootballELO
from app.services.dunc.predictions.features import (
    FeatureEngineer,
    add_odds_features,
    compute_fatigue_features,
    compute_h2h_features,
    compute_xg_proxy,
)
from app.services.dunc.predictions.models import ModelTrainer
from app.services.dunc.predictions.polymarket import PolymarketClient
from app.services.dunc.predictions.triple_layer import TripleLayerFeatures

logger = logging.getLogger(__name__)


class PredictionPipeline:
    """Orchestrates the full prediction workflow."""

    def __init__(self) -> None:
        self.cache = ArtifactCache()
        self.loader = FootballDataLoader()
        self.elo = FootballELO()
        self.feature_eng = FeatureEngineer(window=5)
        self.trainer = ModelTrainer()
        self.polymarket = PolymarketClient()
        self.claude = ClaudeAnalyst()
        self._status = "cold"
        self._accuracy: float | None = None
        self._log_loss: float | None = None
        self._last_trained: str | None = None
        self._matches_count = 0
        self._leagues: list[str] = []
        self._featured_data: pd.DataFrame | None = None
        self._feature_cols: list[str] = []

    @property
    def status(self) -> dict:
        return {
            "status": self._status,
            "accuracy": self._accuracy,
            "log_loss": self._log_loss,
            "last_trained": self._last_trained,
            "matches_in_dataset": self._matches_count,
            "leagues": self._leagues,
        }

    def initialize(self) -> None:
        """Cold-start: fetch data, engineer features, train model, cache."""
        if self._status == "ready":
            return

        self._status = "training"
        logger.info("Prediction pipeline initializing (cold start)...")

        # 1. Load data
        cached_data = self.cache.load_json("match_data_meta")
        if cached_data and not self.cache.is_stale("match_data_meta", max_age_hours=24):
            logger.info("Using cached match data")
            model = self.cache.load_pickle("trained_model")
            if model:
                self.trainer = model  # type: ignore
                meta = cached_data
                self._accuracy = meta.get("accuracy")
                self._log_loss = meta.get("log_loss")
                self._last_trained = meta.get("last_trained")
                self._matches_count = meta.get("matches_count", 0)
                self._leagues = meta.get("leagues", [])
                self._status = "ready"
                logger.info("Loaded cached model (accuracy=%.4f)", self._accuracy or 0)
                return

        # 2. Fetch fresh data
        raw = self.loader.load_all()
        if raw.empty:
            logger.error("No data loaded — prediction pipeline cannot initialize")
            self._status = "cold"
            return

        # 3. Clean
        clean = DataCleaner.clean(raw)
        self._matches_count = len(clean)
        self._leagues = clean["League"].unique().tolist() if "League" in clean.columns else []

        # 4. Feature engineering pipeline
        featured = self.feature_eng.build_match_features(clean)
        featured = add_odds_features(featured)
        featured = compute_xg_proxy(featured)
        featured = compute_fatigue_features(featured)
        featured = compute_h2h_features(featured)

        # 5. ELO features
        elo = FootballELO()
        featured = elo.compute_elo_features(featured)
        self.elo = elo

        self._featured_data = featured

        # 6. Prepare training data
        self._feature_cols = [
            c for c in featured.columns
            if c.startswith(("home_", "away_", "diff_", "norm_prob_", "odds_spread",
                             "elo_", "h2h_", "rest_", "home_xG", "away_xG",
                             "home_fatigued", "away_fatigued", "is_midweek"))
        ]

        X = featured[self._feature_cols].copy().fillna(0)
        y = featured["Result"].copy()

        if len(X) < 100:
            logger.warning("Insufficient data for training: %d matches", len(X))
            self._status = "cold"
            return

        # 7. Train and evaluate
        results = self.trainer.train_and_evaluate(X, y)
        self._accuracy = results["accuracy"]
        self._log_loss = results["log_loss"]
        self._last_trained = datetime.now(timezone.utc).isoformat()

        # 8. Cache
        self.cache.save_pickle("trained_model", self.trainer)
        self.cache.save_json("match_data_meta", {
            "accuracy": self._accuracy,
            "log_loss": self._log_loss,
            "last_trained": self._last_trained,
            "matches_count": self._matches_count,
            "leagues": self._leagues,
        })

        self._status = "ready"
        logger.info(
            "Pipeline ready: %d matches, accuracy=%.4f, log_loss=%.4f",
            self._matches_count, self._accuracy, self._log_loss,
        )

    def predict_match(
        self,
        home_team: str,
        away_team: str,
        league: str = "Premier League",
        include_claude: bool = True,
    ) -> dict[str, Any]:
        """Generate a full prediction for a single match."""
        if self._status != "ready":
            self.initialize()
        if self._status != "ready":
            return {"error": "Pipeline not ready"}

        # Get team stats from most recent data
        home_form = self._get_team_form(home_team)
        away_form = self._get_team_form(away_team)

        # ML prediction (using team form as features)
        ml_proba = self._predict_from_form(home_form, away_form)
        ml_probs = {"home": float(ml_proba[2]), "draw": float(ml_proba[1]), "away": float(ml_proba[0])}

        # Bookmaker odds (from most recent data if available)
        bk_probs = self._get_bookmaker_probs(home_team, away_team)

        # Polymarket (live)
        poly_probs = self._fetch_polymarket_probs(home_team, away_team)

        # Triple-layer fusion
        poly_for_fusion = poly_probs or bk_probs  # fallback
        features = TripleLayerFeatures.compute_divergence_features(bk_probs, poly_for_fusion, ml_probs)

        # Confidence assessment
        confidence = self._assess_confidence(features, poly_probs is not None)

        # Claude report
        claude_report = None
        if include_claude and self.claude.available:
            stats = {**{f"home_{k}": v for k, v in home_form.items()},
                     **{f"away_{k}": v for k, v in away_form.items()}}
            claude_report = self.claude.generate_match_report(
                home_team, away_team, ml_probs, stats, league,
            )

        match_key = f"{home_team.lower().replace(' ', '_')}_vs_{away_team.lower().replace(' ', '_')}"

        return {
            "match_key": match_key,
            "home_team": home_team,
            "away_team": away_team,
            "league": league,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "bookmaker": bk_probs,
            "polymarket": poly_probs,
            "ml_model": ml_probs,
            "kl_divergence_bk_poly": features.get("kl_div_bk_poly"),
            "max_divergence": features.get("max_divergence"),
            "sources_agree": bool(features.get("sources_agree", True)),
            "blended": {
                "home": features.get("triple_blend_H", ml_probs["home"]),
                "draw": features.get("triple_blend_D", ml_probs["draw"]),
                "away": features.get("triple_blend_A", ml_probs["away"]),
            },
            "claude_report": claude_report,
            "confidence": confidence,
            "model_accuracy": self._accuracy or 0,
            "model_last_trained": self._last_trained or "",
        }

    def _get_team_form(self, team: str) -> dict:
        if self._featured_data is None:
            return {"avg_GF": 1.3, "avg_GA": 1.1, "Form": 1.5}
        team_data = self._featured_data[
            (self._featured_data["HomeTeam"] == team) | (self._featured_data["AwayTeam"] == team)
        ].tail(5)
        if team_data.empty:
            return {"avg_GF": 1.3, "avg_GA": 1.1, "Form": 1.5}
        form_cols = [c for c in team_data.columns if c.startswith("home_avg_") or c == "home_Form"]
        if form_cols:
            return {c.replace("home_", ""): float(team_data[c].iloc[-1]) for c in form_cols if pd.notna(team_data[c].iloc[-1])}
        return {"avg_GF": 1.3, "avg_GA": 1.1, "Form": 1.5}

    def _predict_from_form(self, home_form: dict, away_form: dict) -> np.ndarray:
        """Build a feature vector from form stats and predict."""
        feature_vector = {}
        for key, val in home_form.items():
            feature_vector[f"home_{key}"] = val
        for key, val in away_form.items():
            feature_vector[f"away_{key}"] = val
        for key in home_form:
            if key in away_form:
                feature_vector[f"diff_{key}"] = home_form[key] - away_form[key]

        # Pad missing features
        df = pd.DataFrame([feature_vector])
        for col in self._feature_cols:
            if col not in df.columns:
                df[col] = 0
        df = df[self._feature_cols]
        return self.trainer.predict_proba(df)[0]

    def _get_bookmaker_probs(self, home_team: str, away_team: str) -> dict:
        if self._featured_data is not None and "norm_prob_H" in self._featured_data.columns:
            match = self._featured_data[
                (self._featured_data["HomeTeam"] == home_team) & (self._featured_data["AwayTeam"] == away_team)
            ].tail(1)
            if not match.empty:
                return {
                    "home": float(match["norm_prob_H"].iloc[0]),
                    "draw": float(match["norm_prob_D"].iloc[0]),
                    "away": float(match["norm_prob_A"].iloc[0]),
                }
        return {"home": 0.45, "draw": 0.27, "away": 0.28}

    def _fetch_polymarket_probs(self, home_team: str, away_team: str) -> dict | None:
        try:
            markets = self.polymarket.search_football_markets(limit=50)
            search = f"{home_team.lower()} {away_team.lower()}"
            for market in markets:
                q = market.get("question", "").lower()
                if any(t in q for t in [home_team.lower(), away_team.lower()]):
                    odds = self.polymarket.extract_match_odds(market)
                    if odds:
                        return {
                            "home": odds.home_win,
                            "draw": odds.draw or 0.25,
                            "away": odds.away_win,
                        }
        except Exception as e:
            logger.warning("Polymarket fetch failed: %s", e)
        return None

    def _assess_confidence(self, features: dict, has_polymarket: bool) -> str:
        if features.get("all_three_agree") and has_polymarket:
            return "high"
        if features.get("sources_agree"):
            return "medium"
        return "low"


# Singleton
_pipeline: PredictionPipeline | None = None


def get_pipeline() -> PredictionPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = PredictionPipeline()
    return _pipeline
