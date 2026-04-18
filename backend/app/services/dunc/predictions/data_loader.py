"""Historical football match data loader.

Primary source: football-data.co.uk (free CSV files).
"""

from __future__ import annotations

import logging

import pandas as pd

logger = logging.getLogger(__name__)


class FootballDataLoader:
    BASE_URL = "https://www.football-data.co.uk/mmz4281"

    LEAGUES = {
        "E0": "Premier League",
        "SP1": "La Liga",
        "D1": "Bundesliga",
        "I1": "Serie A",
        "F1": "Ligue 1",
    }

    COLUMNS_TO_KEEP = [
        "Date", "HomeTeam", "AwayTeam",
        "FTHG", "FTAG", "FTR",
        "HTHG", "HTAG", "HTR",
        "HS", "AS", "HST", "AST",
        "HF", "AF", "HC", "AC",
        "HY", "AY", "HR", "AR",
        "B365H", "B365D", "B365A",
    ]

    def __init__(self, seasons: list[str] | None = None, leagues: list[str] | None = None) -> None:
        self.seasons = seasons or ["2425", "2324", "2223", "2122", "2021"]
        self.leagues = leagues or ["E0", "SP1", "D1"]

    def load_season(self, league: str, season: str) -> pd.DataFrame:
        url = f"{self.BASE_URL}/{season}/{league}.csv"
        try:
            df = pd.read_csv(url, encoding="utf-8", on_bad_lines="skip")
            available = [c for c in self.COLUMNS_TO_KEEP if c in df.columns]
            df = df[available].dropna(subset=["HomeTeam", "AwayTeam", "FTR"])
            df["League"] = self.LEAGUES.get(league, league)
            df["Season"] = season
            return df
        except Exception as e:
            logger.warning("Failed to load %s/%s: %s", league, season, e)
            return pd.DataFrame()

    def load_all(self) -> pd.DataFrame:
        frames = []
        for league in self.leagues:
            for season in self.seasons:
                df = self.load_season(league, season)
                if not df.empty:
                    frames.append(df)
                    logger.info("Loaded %s %s: %d matches", self.LEAGUES.get(league, league), season, len(df))
        if not frames:
            return pd.DataFrame()
        result = pd.concat(frames, ignore_index=True)
        logger.info("Total loaded: %d matches", len(result))
        return result
