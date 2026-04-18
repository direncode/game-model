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
