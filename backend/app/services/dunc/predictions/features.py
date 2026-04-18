"""Feature engineering for football match prediction.

Builds features from historical match data: rolling team averages,
ELO ratings, xG proxy, fatigue/rest-day factors, head-to-head history,
and bookmaker odds normalization.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


class FeatureEngineer:
    """Compute rolling-window features for each team."""

    def __init__(self, window: int = 5) -> None:
        self.window = window

    def compute_team_stats(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.sort_values("Date").copy()

        col_names = [
            "Date", "Team", "GF", "GA",
            "Shots", "ShotsAgainst", "SoT", "SoTAgainst",
            "Corners", "CornersAgainst", "Fouls", "FoulsAgainst",
        ]

        home_records = df[["Date", "HomeTeam", "FTHG", "FTAG",
                           "HS", "AS", "HST", "AST",
                           "HC", "AC", "HF", "AF"]].copy()
        home_records.columns = col_names
        home_records["IsHome"] = 1

        away_records = df[["Date", "AwayTeam", "FTAG", "FTHG",
                           "AS", "HS", "AST", "HST",
                           "AC", "HC", "AF", "HF"]].copy()
        away_records.columns = col_names
        away_records["IsHome"] = 0

        all_records = pd.concat([home_records, away_records]).sort_values("Date")

        stats_cols = [
            "GF", "GA", "Shots", "ShotsAgainst",
            "SoT", "SoTAgainst", "Corners", "CornersAgainst",
            "Fouls", "FoulsAgainst",
        ]

        parts = []
        for team in all_records["Team"].unique():
            td = all_records[all_records["Team"] == team].copy()
            for col in stats_cols:
                td[f"avg_{col}"] = (
                    td[col].shift(1)
                    .rolling(window=self.window, min_periods=3)
                    .mean()
                )
            td["Points"] = td.apply(
                lambda r: 3 if r["GF"] > r["GA"]
                else (1 if r["GF"] == r["GA"] else 0),
                axis=1,
            )
            td["Form"] = (
                td["Points"].shift(1)
                .rolling(window=self.window, min_periods=3)
                .mean()
            )
            parts.append(td)

        return pd.concat(parts)

    def build_match_features(self, df: pd.DataFrame) -> pd.DataFrame:
        team_stats = self.compute_team_stats(df)
        stat_features = [c for c in team_stats.columns if c.startswith("avg_")]
        stat_features.append("Form")

        features_list = []
        for idx, match in df.iterrows():
            home, away, date = match["HomeTeam"], match["AwayTeam"], match["Date"]

            home_stats = team_stats[
                (team_stats["Team"] == home) & (team_stats["Date"] == date) & (team_stats["IsHome"] == 1)
            ]
            away_stats = team_stats[
                (team_stats["Team"] == away) & (team_stats["Date"] == date) & (team_stats["IsHome"] == 0)
            ]

            if home_stats.empty or away_stats.empty:
                continue

            row: dict = {"match_idx": idx}
            for feat in stat_features:
                h_val = home_stats[feat].values[0]
                a_val = away_stats[feat].values[0]
                row[f"home_{feat}"] = h_val
                row[f"away_{feat}"] = a_val
                row[f"diff_{feat}"] = h_val - a_val
            features_list.append(row)

        if not features_list:
            return df

        features_df = pd.DataFrame(features_list).set_index("match_idx")
        result = df.join(features_df, how="inner")
        return result.dropna(subset=[c for c in features_df.columns])


def add_odds_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if all(c in df.columns for c in ["B365H", "B365D", "B365A"]):
        df["odds_prob_H"] = 1 / df["B365H"]
        df["odds_prob_D"] = 1 / df["B365D"]
        df["odds_prob_A"] = 1 / df["B365A"]
        total = df["odds_prob_H"] + df["odds_prob_D"] + df["odds_prob_A"]
        df["norm_prob_H"] = df["odds_prob_H"] / total
        df["norm_prob_D"] = df["odds_prob_D"] / total
        df["norm_prob_A"] = df["odds_prob_A"] / total
        df["odds_spread"] = df["norm_prob_H"] - df["norm_prob_A"]
    return df


def compute_xg_proxy(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    SOT_CONV, SHOT_CONV = 0.30, 0.03
    if "HST" in df.columns and "HS" in df.columns:
        df["home_xG_proxy"] = df["HST"] * SOT_CONV + (df["HS"] - df["HST"]).clip(lower=0) * SHOT_CONV
        df["away_xG_proxy"] = df["AST"] * SOT_CONV + (df["AS"] - df["AST"]).clip(lower=0) * SHOT_CONV
        df["home_xG_overperf"] = df["FTHG"] - df["home_xG_proxy"]
        df["away_xG_overperf"] = df["FTAG"] - df["away_xG_proxy"]
    return df


def compute_fatigue_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values("Date").copy()
    rest_home, rest_away = [], []
    last_match: dict[str, pd.Timestamp] = {}

    for _, row in df.iterrows():
        home, away, date = row["HomeTeam"], row["AwayTeam"], row["Date"]
        rest_home.append(min((date - last_match[home]).days, 30) if home in last_match else 14)
        rest_away.append(min((date - last_match[away]).days, 30) if away in last_match else 14)
        last_match[home] = date
        last_match[away] = date

    df["home_rest_days"] = rest_home
    df["away_rest_days"] = rest_away
    df["rest_advantage"] = df["home_rest_days"] - df["away_rest_days"]
    df["home_fatigued"] = (df["home_rest_days"] <= 3).astype(int)
    df["away_fatigued"] = (df["away_rest_days"] <= 3).astype(int)
    df["is_midweek"] = df["Date"].dt.dayofweek.isin([1, 2]).astype(int)
    return df


def compute_h2h_features(df: pd.DataFrame, n_last: int = 5) -> pd.DataFrame:
    df = df.sort_values("Date").copy()
    h2h_features = []

    for _, row in df.iterrows():
        home, away, date = row["HomeTeam"], row["AwayTeam"], row["Date"]
        prev = df[
            (df["Date"] < date)
            & (
                ((df["HomeTeam"] == home) & (df["AwayTeam"] == away))
                | ((df["HomeTeam"] == away) & (df["AwayTeam"] == home))
            )
        ].tail(n_last)

        if len(prev) < 2:
            h2h_features.append({"h2h_home_wins": np.nan, "h2h_draws": np.nan, "h2h_total_goals_avg": np.nan})
            continue

        home_wins, draws, total_goals = 0, 0, 0
        for _, p in prev.iterrows():
            if p["HomeTeam"] == home:
                if p["FTR"] == "H": home_wins += 1
                elif p["FTR"] == "D": draws += 1
            else:
                if p["FTR"] == "A": home_wins += 1
                elif p["FTR"] == "D": draws += 1
            total_goals += p["FTHG"] + p["FTAG"]

        n = len(prev)
        h2h_features.append({
            "h2h_home_wins": home_wins / n,
            "h2h_draws": draws / n,
            "h2h_total_goals_avg": total_goals / n,
        })

    return pd.concat([df, pd.DataFrame(h2h_features, index=df.index)], axis=1)
