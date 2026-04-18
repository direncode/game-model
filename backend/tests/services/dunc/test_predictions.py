"""Tests for the D-U-N-C prediction engine."""

import numpy as np
import pandas as pd
import pytest


class TestArtifactCache:
    def test_save_and_load_json(self, tmp_path):
        from app.services.dunc.predictions.cache import ArtifactCache
        cache = ArtifactCache(cache_dir=tmp_path)
        data = {"teams": ["Arsenal", "Chelsea"], "accuracy": 0.54}
        cache.save_json("test_data", data)
        loaded = cache.load_json("test_data")
        assert loaded == data

    def test_load_missing_returns_none(self, tmp_path):
        from app.services.dunc.predictions.cache import ArtifactCache
        cache = ArtifactCache(cache_dir=tmp_path)
        assert cache.load_json("nonexistent") is None

    def test_is_stale_when_missing(self, tmp_path):
        from app.services.dunc.predictions.cache import ArtifactCache
        cache = ArtifactCache(cache_dir=tmp_path)
        assert cache.is_stale("nonexistent", max_age_hours=24) is True

    def test_is_stale_when_fresh(self, tmp_path):
        from app.services.dunc.predictions.cache import ArtifactCache
        cache = ArtifactCache(cache_dir=tmp_path)
        cache.save_json("fresh", {"x": 1})
        assert cache.is_stale("fresh", max_age_hours=24) is False


class TestFootballDataLoader:
    def test_columns_to_keep_are_defined(self):
        from app.services.dunc.predictions.data_loader import FootballDataLoader
        loader = FootballDataLoader(seasons=["2324"], leagues=["E0"])
        assert "FTHG" in loader.COLUMNS_TO_KEEP
        assert "B365H" in loader.COLUMNS_TO_KEEP

    def test_leagues_dict(self):
        from app.services.dunc.predictions.data_loader import FootballDataLoader
        loader = FootballDataLoader(seasons=["2324"])
        assert "E0" in loader.LEAGUES
        assert loader.LEAGUES["E0"] == "Premier League"


class TestDataCleaner:
    def test_clean_encodes_results(self):
        from app.services.dunc.predictions.cleaner import DataCleaner
        df = pd.DataFrame({
            "Date": ["01/01/2024", "02/01/2024"],
            "HomeTeam": ["Arsenal", "Chelsea"],
            "AwayTeam": ["Chelsea", "Arsenal"],
            "FTHG": [2, 1], "FTAG": [1, 1], "FTR": ["H", "D"],
            "B365H": [1.8, 2.5], "B365D": [3.5, 3.2], "B365A": [4.0, 2.8],
        })
        result = DataCleaner.clean(df)
        assert list(result["Result"]) == [2, 1]
        assert result["Date"].dtype == "datetime64[ns]"

    def test_clean_drops_missing_result(self):
        from app.services.dunc.predictions.cleaner import DataCleaner
        df = pd.DataFrame({
            "Date": ["01/01/2024"], "HomeTeam": ["Arsenal"],
            "AwayTeam": ["Chelsea"], "FTHG": [2], "FTAG": [1], "FTR": [None],
        })
        result = DataCleaner.clean(df)
        assert len(result) == 0


class TestFootballELO:
    def test_initial_rating(self):
        from app.services.dunc.predictions.elo import FootballELO
        elo = FootballELO()
        assert elo.get_rating("NewTeam") == 1500.0

    def test_winner_gains_rating(self):
        from app.services.dunc.predictions.elo import FootballELO
        elo = FootballELO()
        elo.update("Arsenal", "Brighton", home_goals=3, away_goals=0)
        assert elo.get_rating("Arsenal") > 1500.0
        assert elo.get_rating("Brighton") < 1500.0

    def test_draw_pulls_toward_center(self):
        from app.services.dunc.predictions.elo import FootballELO
        elo = FootballELO()
        for _ in range(5):
            elo.update("Arsenal", "Weak", 3, 0)
        pre_draw = elo.get_rating("Arsenal")
        elo.update("Arsenal", "Weak", 1, 1)
        post_draw = elo.get_rating("Arsenal")
        assert post_draw < pre_draw

    def test_compute_elo_features_shape(self):
        from app.services.dunc.predictions.elo import FootballELO
        elo = FootballELO()
        df = pd.DataFrame({
            "Date": pd.to_datetime(["2024-01-01", "2024-01-08"]),
            "HomeTeam": ["Arsenal", "Chelsea"],
            "AwayTeam": ["Chelsea", "Arsenal"],
            "FTHG": [2, 1], "FTAG": [1, 1],
        })
        result = elo.compute_elo_features(df)
        assert "elo_home" in result.columns
        assert "elo_diff" in result.columns
        assert len(result) == 2


class TestFeatureEngineer:
    def _make_sample_df(self):
        from app.services.dunc.predictions.cleaner import DataCleaner
        rows = []
        teams = ["Arsenal", "Chelsea", "Liverpool", "ManCity"]
        dates = pd.date_range("2024-01-01", periods=20, freq="7D")
        np.random.seed(42)
        for i, date in enumerate(dates):
            h, a = teams[i % 4], teams[(i + 1) % 4]
            hg, ag = np.random.randint(0, 4), np.random.randint(0, 3)
            ftr = "H" if hg > ag else ("A" if ag > hg else "D")
            rows.append({
                "Date": date, "HomeTeam": h, "AwayTeam": a,
                "FTHG": hg, "FTAG": ag, "FTR": ftr,
                "HS": np.random.randint(8, 20), "AS": np.random.randint(5, 18),
                "HST": np.random.randint(3, 10), "AST": np.random.randint(2, 8),
                "HF": np.random.randint(8, 16), "AF": np.random.randint(8, 16),
                "HC": np.random.randint(3, 12), "AC": np.random.randint(2, 10),
                "HY": np.random.randint(0, 4), "AY": np.random.randint(0, 4),
                "HR": 0, "AR": 0,
                "B365H": round(np.random.uniform(1.5, 4.0), 2),
                "B365D": round(np.random.uniform(3.0, 4.0), 2),
                "B365A": round(np.random.uniform(1.8, 5.0), 2),
            })
        return DataCleaner.clean(pd.DataFrame(rows))

    def test_build_match_features_adds_columns(self):
        from app.services.dunc.predictions.features import FeatureEngineer
        df = self._make_sample_df()
        eng = FeatureEngineer(window=3)
        result = eng.build_match_features(df)
        feature_cols = [c for c in result.columns if c.startswith(("home_", "away_", "diff_"))]
        assert len(feature_cols) > 10

    def test_odds_features_normalized(self):
        from app.services.dunc.predictions.features import add_odds_features
        df = pd.DataFrame({"B365H": [1.8], "B365D": [3.5], "B365A": [4.5]})
        result = add_odds_features(df)
        total = result["norm_prob_H"].iloc[0] + result["norm_prob_D"].iloc[0] + result["norm_prob_A"].iloc[0]
        assert abs(total - 1.0) < 0.01

    def test_xg_proxy_positive(self):
        from app.services.dunc.predictions.features import compute_xg_proxy
        df = pd.DataFrame({"HST": [5], "HS": [12], "AST": [3], "AS": [8], "FTHG": [2], "FTAG": [1]})
        result = compute_xg_proxy(df)
        assert result["home_xG_proxy"].iloc[0] > 0

    def test_fatigue_features_rest_days(self):
        from app.services.dunc.predictions.features import compute_fatigue_features
        df = pd.DataFrame({
            "Date": pd.to_datetime(["2024-01-01", "2024-01-04", "2024-01-07"]),
            "HomeTeam": ["Arsenal", "Arsenal", "Chelsea"],
            "AwayTeam": ["Chelsea", "Liverpool", "Arsenal"],
        })
        result = compute_fatigue_features(df)
        assert "home_rest_days" in result.columns
        assert result.iloc[1]["home_rest_days"] == 3


class TestPolymarketClient:
    def test_football_keywords_defined(self):
        from app.services.dunc.predictions.polymarket import PolymarketClient
        client = PolymarketClient()
        assert "premier league" in client.FOOTBALL_KEYWORDS

    def test_extract_match_odds_binary(self):
        from app.services.dunc.predictions.polymarket import PolymarketClient
        client = PolymarketClient()
        market = {
            "outcomes": ["Yes", "No"],
            "outcomePrices": '["0.65", "0.35"]',
            "liquidity": "10000", "volume24hr": "5000",
            "slug": "test", "updatedAt": "2024-01-01",
        }
        odds = client.extract_match_odds(market)
        assert odds is not None
        assert abs(odds.home_win - 0.65) < 0.01

    def test_extract_match_odds_handles_missing(self):
        from app.services.dunc.predictions.polymarket import PolymarketClient
        client = PolymarketClient()
        assert client.extract_match_odds({"outcomes": [], "outcomePrices": "[]"}) is None


class TestTripleLayer:
    def test_divergence_features_keys(self):
        from app.services.dunc.predictions.triple_layer import TripleLayerFeatures
        bk = {"home": 0.55, "draw": 0.25, "away": 0.20}
        poly = {"home": 0.48, "draw": 0.22, "away": 0.30}
        features = TripleLayerFeatures.compute_divergence_features(bk, poly)
        assert "kl_div_bk_poly" in features
        assert "sources_agree" in features

    def test_sources_agree_when_same_favorite(self):
        from app.services.dunc.predictions.triple_layer import TripleLayerFeatures
        bk = {"home": 0.55, "draw": 0.25, "away": 0.20}
        poly = {"home": 0.52, "draw": 0.23, "away": 0.25}
        features = TripleLayerFeatures.compute_divergence_features(bk, poly)
        assert features["sources_agree"] == 1

    def test_triple_blend_with_ml(self):
        from app.services.dunc.predictions.triple_layer import TripleLayerFeatures
        bk = {"home": 0.55, "draw": 0.25, "away": 0.20}
        poly = {"home": 0.48, "draw": 0.22, "away": 0.30}
        ml = {"home": 0.52, "draw": 0.23, "away": 0.25}
        features = TripleLayerFeatures.compute_divergence_features(bk, poly, ml)
        assert "triple_blend_H" in features
        assert 0.45 <= features["triple_blend_H"] <= 0.56


class TestModelTrainer:
    def test_train_produces_predictions(self):
        from sklearn.datasets import make_classification
        from app.services.dunc.predictions.models import ModelTrainer
        X, y = make_classification(n_samples=200, n_features=10, n_informative=5, n_classes=3, random_state=42)
        trainer = ModelTrainer()
        trainer.train(pd.DataFrame(X, columns=[f"f{i}" for i in range(10)]), pd.Series(y))
        proba = trainer.predict_proba(pd.DataFrame(X[:5], columns=[f"f{i}" for i in range(10)]))
        assert proba.shape == (5, 3)
        for row in proba:
            assert abs(sum(row) - 1.0) < 0.01

    def test_evaluate_returns_accuracy(self):
        from sklearn.datasets import make_classification
        from app.services.dunc.predictions.models import ModelTrainer
        X, y = make_classification(n_samples=300, n_features=10, n_informative=5, n_classes=3, random_state=42)
        trainer = ModelTrainer()
        results = trainer.train_and_evaluate(pd.DataFrame(X, columns=[f"f{i}" for i in range(10)]), pd.Series(y))
        assert 0.0 < results["accuracy"] < 1.0


class TestClaudeAnalyst:
    def test_analyst_initializes_without_key(self):
        import os
        from app.services.dunc.predictions.claude_analyst import ClaudeAnalyst
        saved = os.environ.get("ANTHROPIC_API_KEY")
        os.environ.pop("ANTHROPIC_API_KEY", None)
        try:
            analyst = ClaudeAnalyst()
            assert analyst.available is False
        finally:
            if saved:
                os.environ["ANTHROPIC_API_KEY"] = saved

    def test_build_matchup_prompt(self):
        from app.services.dunc.predictions.claude_analyst import ClaudeAnalyst
        analyst = ClaudeAnalyst()
        prompt = analyst._build_matchup_prompt(
            home_team="Arsenal", away_team="Brighton",
            home_form={"avg_GF": 1.8, "avg_GA": 0.6, "Form": 2.4},
            away_form={"avg_GF": 1.2, "avg_GA": 1.4, "Form": 1.2},
            league="Premier League",
        )
        assert "Arsenal" in prompt
        assert "Brighton" in prompt
