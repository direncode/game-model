# D-U-N-C Match Prediction Engine — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a triple-layer football match prediction engine (bookmaker odds + Polymarket crowd intelligence + ML ensemble) to the Big Dunc vertical, with Claude API interpretation and a full Next.js predictions page.

**Architecture:** New `backend/app/services/dunc/predictions/` sub-package following the additive-only Dunc vertical pattern. Data pipeline auto-fetches on first request, trains an ensemble model (XGBoost/RF/LogReg), and caches artifacts. Frontend gets a new `/dunc/predictions` page and a pre-match tab. machina-sports/sports-skills cloned for fixture data. This is a football analytics research tool — no betting functionality.

**Tech Stack:** Python 3.11, FastAPI, pandas, numpy, scikit-learn, xgboost, anthropic SDK, Next.js 14, React 18, Recharts, Tailwind CSS, Zustand.

---

### Task 1: Add xgboost Dependency

**Files:**
- Modify: `backend/pyproject.toml:38` (add xgboost to dependencies)

**Step 1: Add xgboost to pyproject.toml**

In `backend/pyproject.toml`, add `"xgboost>=2.0.0"` to the `dependencies` list after `"scikit-learn>=1.3.0"`:

```toml
    "scikit-learn>=1.3.0",
    "xgboost>=2.0.0",
    "networkx>=3.0",
```

**Step 2: Install**

Run: `cd backend && pip install -e ".[dev]"`
Expected: xgboost installs successfully

**Step 3: Commit**

```bash
git add backend/pyproject.toml
git commit -m "chore: add xgboost dependency for prediction engine"
```

---

### Task 2: Prediction Schemas

**Files:**
- Modify: `backend/app/schemas/dunc.py` (append prediction schemas)

**Step 1: Write the schemas**

Append these classes to the bottom of `backend/app/schemas/dunc.py`:

```python
# ── Prediction Engine schemas ─────────────────────────────────────────

class ProbabilitySet(BaseModel):
    home: float = Field(ge=0.0, le=1.0)
    draw: float = Field(ge=0.0, le=1.0)
    away: float = Field(ge=0.0, le=1.0)


class MatchPredictionOut(BaseModel):
    match_key: str
    home_team: str
    away_team: str
    league: str
    date: str

    bookmaker: ProbabilitySet
    polymarket: ProbabilitySet | None = None
    ml_model: ProbabilitySet

    kl_divergence_bk_poly: float | None = None
    max_divergence: float | None = None
    sources_agree: bool
    blended: ProbabilitySet

    claude_report: str | None = None
    confidence: Literal["high", "medium", "low"]

    model_accuracy: float
    model_last_trained: str


class MatchAnalysisRequest(BaseModel):
    home_team: str
    away_team: str
    league: str = Field(default="Premier League")


class ModelStatusOut(BaseModel):
    status: Literal["ready", "training", "cold"]
    accuracy: float | None = None
    log_loss: float | None = None
    last_trained: str | None = None
    matches_in_dataset: int = 0
    leagues: list[str] = Field(default_factory=list)
```

**Step 2: Verify import**

Run: `cd backend && python -c "from app.schemas.dunc import ProbabilitySet, MatchPredictionOut; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/schemas/dunc.py
git commit -m "feat(dunc): add prediction engine schemas"
```

---

### Task 3: ArtifactCache — Disk Caching for Models and Data

**Files:**
- Create: `backend/app/services/dunc/predictions/__init__.py`
- Create: `backend/app/services/dunc/predictions/cache.py`
- Create: `backend/tests/services/dunc/test_predictions.py`

**Step 1: Create package init**

```python
"""D-U-N-C match prediction engine.

Triple-layer probability fusion: bookmaker odds + Polymarket crowd
intelligence + ML ensemble, with Claude API interpretation.

This is a football analytics research tool. Not for betting.
"""
```

**Step 2: Write the failing test**

Create `backend/tests/services/dunc/test_predictions.py`:

```python
"""Tests for the D-U-N-C prediction engine."""

import json
import tempfile
from pathlib import Path

import numpy as np
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
```

**Step 3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestArtifactCache -v`
Expected: FAIL — module not found

**Step 4: Write implementation**

Create `backend/app/services/dunc/predictions/cache.py`:

```python
"""Filesystem cache for prediction model artifacts and data."""

from __future__ import annotations

import json
import logging
import pickle
import time
from pathlib import Path

logger = logging.getLogger(__name__)

_DEFAULT_DIR = Path(__file__).resolve().parents[4] / ".cache" / "dunc_predictions"


class ArtifactCache:
    """Simple filesystem cache for model weights, scalers, and data."""

    def __init__(self, cache_dir: Path | None = None) -> None:
        self.dir = cache_dir or _DEFAULT_DIR
        self.dir.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str, ext: str = ".json") -> Path:
        return self.dir / f"{key}{ext}"

    def save_json(self, key: str, data: dict | list) -> None:
        path = self._path(key)
        path.write_text(json.dumps(data, default=str), encoding="utf-8")
        logger.debug("Cached %s → %s", key, path)

    def load_json(self, key: str) -> dict | list | None:
        path = self._path(key)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def save_pickle(self, key: str, obj: object) -> None:
        path = self._path(key, ext=".pkl")
        with open(path, "wb") as f:
            pickle.dump(obj, f)

    def load_pickle(self, key: str) -> object | None:
        path = self._path(key, ext=".pkl")
        if not path.exists():
            return None
        with open(path, "rb") as f:
            return pickle.load(f)

    def is_stale(self, key: str, max_age_hours: float = 24.0) -> bool:
        for ext in (".json", ".pkl"):
            path = self._path(key, ext=ext)
            if path.exists():
                age_hours = (time.time() - path.stat().st_mtime) / 3600
                return age_hours > max_age_hours
        return True  # missing = stale
```

**Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestArtifactCache -v`
Expected: 4 PASSED

**Step 6: Commit**

```bash
git add backend/app/services/dunc/predictions/ backend/tests/services/dunc/test_predictions.py
git commit -m "feat(dunc/predictions): artifact cache for model weights and data"
```

---

### Task 4: DataLoader — Football Match History Fetcher

**Files:**
- Create: `backend/app/services/dunc/predictions/data_loader.py`
- Modify: `backend/tests/services/dunc/test_predictions.py` (append tests)

**Step 1: Write the failing test**

Append to `backend/tests/services/dunc/test_predictions.py`:

```python
import pandas as pd


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
```

**Step 2: Run to verify it fails**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestFootballDataLoader -v`
Expected: FAIL

**Step 3: Write implementation**

Create `backend/app/services/dunc/predictions/data_loader.py`:

```python
"""Historical football match data loader.

Primary source: football-data.co.uk (free CSV files).
Covers all major European leagues with match results, statistics,
and bookmaker odds.
"""

from __future__ import annotations

import logging

import pandas as pd

logger = logging.getLogger(__name__)


class FootballDataLoader:
    """Fetches and merges historical match data from football-data.co.uk."""

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

    def __init__(
        self,
        seasons: list[str] | None = None,
        leagues: list[str] | None = None,
    ) -> None:
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
                    logger.info(
                        "Loaded %s %s: %d matches",
                        self.LEAGUES.get(league, league), season, len(df),
                    )
        if not frames:
            return pd.DataFrame()
        result = pd.concat(frames, ignore_index=True)
        logger.info("Total loaded: %d matches", len(result))
        return result
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestFootballDataLoader -v`
Expected: 2 PASSED

**Step 5: Commit**

```bash
git add backend/app/services/dunc/predictions/data_loader.py backend/tests/services/dunc/test_predictions.py
git commit -m "feat(dunc/predictions): football match data loader"
```

---

### Task 5: DataCleaner — Standardization and Encoding

**Files:**
- Create: `backend/app/services/dunc/predictions/cleaner.py`
- Modify: `backend/tests/services/dunc/test_predictions.py`

**Step 1: Write the failing test**

```python
class TestDataCleaner:
    def test_clean_encodes_results(self):
        from app.services.dunc.predictions.cleaner import DataCleaner

        df = pd.DataFrame({
            "Date": ["01/01/2024", "02/01/2024"],
            "HomeTeam": ["Arsenal", "Chelsea"],
            "AwayTeam": ["Chelsea", "Arsenal"],
            "FTHG": [2, 1],
            "FTAG": [1, 1],
            "FTR": ["H", "D"],
            "B365H": [1.8, 2.5],
            "B365D": [3.5, 3.2],
            "B365A": [4.0, 2.8],
        })
        result = DataCleaner.clean(df)
        assert list(result["Result"]) == [2, 1]  # H=2, D=1
        assert result["Date"].dtype == "datetime64[ns]"

    def test_clean_drops_missing_result(self):
        from app.services.dunc.predictions.cleaner import DataCleaner

        df = pd.DataFrame({
            "Date": ["01/01/2024"],
            "HomeTeam": ["Arsenal"],
            "AwayTeam": ["Chelsea"],
            "FTHG": [2],
            "FTAG": [1],
            "FTR": [None],
        })
        result = DataCleaner.clean(df)
        assert len(result) == 0
```

**Step 2: Run to verify it fails**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestDataCleaner -v`

**Step 3: Write implementation**

Create `backend/app/services/dunc/predictions/cleaner.py`:

```python
"""Data cleaning and standardization for match data."""

from __future__ import annotations

import pandas as pd


class DataCleaner:
    """Standardizes raw match data into a clean, typed DataFrame."""

    NUMERIC_COLS = [
        "FTHG", "FTAG", "HTHG", "HTAG",
        "HS", "AS", "HST", "AST",
        "HF", "AF", "HC", "AC",
        "HY", "AY", "HR", "AR",
        "B365H", "B365D", "B365A",
    ]

    @staticmethod
    def clean(df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        # Date
        df["Date"] = pd.to_datetime(df["Date"], dayfirst=True, errors="coerce")
        df = df.dropna(subset=["Date"])
        df = df.sort_values("Date").reset_index(drop=True)

        # Numerics
        for col in DataCleaner.NUMERIC_COLS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # Result encoding: H=2, D=1, A=0
        result_map = {"H": 2, "D": 1, "A": 0}
        df["Result"] = df["FTR"].map(result_map)
        df = df.dropna(subset=["Result"])
        df["Result"] = df["Result"].astype(int)

        return df
```

**Step 4: Run to verify it passes**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestDataCleaner -v`
Expected: 2 PASSED

**Step 5: Commit**

```bash
git add backend/app/services/dunc/predictions/cleaner.py backend/tests/services/dunc/test_predictions.py
git commit -m "feat(dunc/predictions): data cleaner with result encoding"
```

---

### Task 6: FootballELO Rating System

**Files:**
- Create: `backend/app/services/dunc/predictions/elo.py`
- Modify: `backend/tests/services/dunc/test_predictions.py`

**Step 1: Write the failing test**

```python
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
        # Give Arsenal a high rating first
        for _ in range(5):
            elo.update("Arsenal", "Weak", 3, 0)
        pre_draw = elo.get_rating("Arsenal")
        elo.update("Arsenal", "Weak", 1, 1)
        post_draw = elo.get_rating("Arsenal")
        # Draw against weak team should lower Arsenal's rating
        assert post_draw < pre_draw

    def test_compute_elo_features_shape(self):
        from app.services.dunc.predictions.elo import FootballELO

        elo = FootballELO()
        df = pd.DataFrame({
            "Date": pd.to_datetime(["2024-01-01", "2024-01-08"]),
            "HomeTeam": ["Arsenal", "Chelsea"],
            "AwayTeam": ["Chelsea", "Arsenal"],
            "FTHG": [2, 1],
            "FTAG": [1, 1],
        })
        result = elo.compute_elo_features(df)
        assert "elo_home" in result.columns
        assert "elo_diff" in result.columns
        assert "elo_expected_home" in result.columns
        assert len(result) == 2
```

**Step 2: Run to verify fails**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestFootballELO -v`

**Step 3: Write implementation**

Create `backend/app/services/dunc/predictions/elo.py`:

```python
"""ELO rating system for football teams.

FIFA adopted ELO in 2018. Key property: accounts for opponent strength,
not just W/D/L. Uses margin-of-victory multiplier from FiveThirtyEight.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


class FootballELO:
    def __init__(self, k: int = 32, home_advantage: int = 65) -> None:
        self.k = k
        self.home_advantage = home_advantage
        self.ratings: dict[str, float] = {}

    def get_rating(self, team: str) -> float:
        return self.ratings.setdefault(team, 1500.0)

    def expected_score(self, rating_a: float, rating_b: float) -> float:
        return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400.0))

    def margin_multiplier(self, goal_diff: int) -> float:
        return np.log(abs(goal_diff) + 1) * (2.2 / 2.2)

    def update(
        self, home: str, away: str, home_goals: int, away_goals: int,
    ) -> tuple[float, float]:
        r_home = self.get_rating(home) + self.home_advantage
        r_away = self.get_rating(away)

        e_home = self.expected_score(r_home, r_away)

        if home_goals > away_goals:
            s_home, s_away = 1.0, 0.0
        elif home_goals < away_goals:
            s_home, s_away = 0.0, 1.0
        else:
            s_home, s_away = 0.5, 0.5

        m = self.margin_multiplier(home_goals - away_goals)

        self.ratings[home] = self.ratings.get(home, 1500.0) + self.k * m * (s_home - e_home)
        self.ratings[away] = self.ratings.get(away, 1500.0) + self.k * m * (0.5 - (1 - e_home) if s_away == 0.5 else s_away - (1 - e_home))

        return self.ratings[home], self.ratings[away]

    def compute_elo_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.sort_values("Date").copy()
        elo_features = []

        for _, row in df.iterrows():
            home, away = row["HomeTeam"], row["AwayTeam"]
            r_home = self.get_rating(home)
            r_away = self.get_rating(away)
            e_home = self.expected_score(r_home + self.home_advantage, r_away)

            elo_features.append({
                "elo_home": r_home,
                "elo_away": r_away,
                "elo_diff": r_home - r_away,
                "elo_expected_home": e_home,
                "elo_expected_away": 1 - e_home,
            })

            if pd.notna(row.get("FTHG")) and pd.notna(row.get("FTAG")):
                self.update(home, away, int(row["FTHG"]), int(row["FTAG"]))

        return pd.concat(
            [df.reset_index(drop=True), pd.DataFrame(elo_features)],
            axis=1,
        )
```

**Step 4: Run to verify passes**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestFootballELO -v`
Expected: 4 PASSED

**Step 5: Commit**

```bash
git add backend/app/services/dunc/predictions/elo.py backend/tests/services/dunc/test_predictions.py
git commit -m "feat(dunc/predictions): ELO rating system with margin-of-victory"
```

---

### Task 7: FeatureEngineer — Rolling Stats, xG Proxy, Fatigue, H2H, Odds

**Files:**
- Create: `backend/app/services/dunc/predictions/features.py`
- Modify: `backend/tests/services/dunc/test_predictions.py`

**Step 1: Write the failing test**

```python
class TestFeatureEngineer:
    def _make_sample_df(self):
        """Create a minimal but realistic match DataFrame for testing."""
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
        df = pd.DataFrame(rows)
        return DataCleaner.clean(df)

    def test_build_match_features_adds_columns(self):
        from app.services.dunc.predictions.features import FeatureEngineer

        df = self._make_sample_df()
        eng = FeatureEngineer(window=3)
        result = eng.build_match_features(df)
        # Should have rolling average columns
        feature_cols = [c for c in result.columns if c.startswith(("home_", "away_", "diff_"))]
        assert len(feature_cols) > 10

    def test_odds_features_normalized(self):
        from app.services.dunc.predictions.features import add_odds_features

        df = pd.DataFrame({
            "B365H": [1.8], "B365D": [3.5], "B365A": [4.5],
        })
        result = add_odds_features(df)
        total = result["norm_prob_H"].iloc[0] + result["norm_prob_D"].iloc[0] + result["norm_prob_A"].iloc[0]
        assert abs(total - 1.0) < 0.01

    def test_xg_proxy_positive(self):
        from app.services.dunc.predictions.features import compute_xg_proxy

        df = pd.DataFrame({"HST": [5], "HS": [12], "AST": [3], "AS": [8], "FTHG": [2], "FTAG": [1])
        result = compute_xg_proxy(df)
        assert result["home_xG_proxy"].iloc[0] > 0
        assert result["away_xG_proxy"].iloc[0] > 0

    def test_fatigue_features_rest_days(self):
        from app.services.dunc.predictions.features import compute_fatigue_features

        df = pd.DataFrame({
            "Date": pd.to_datetime(["2024-01-01", "2024-01-04", "2024-01-07"]),
            "HomeTeam": ["Arsenal", "Arsenal", "Chelsea"],
            "AwayTeam": ["Chelsea", "Liverpool", "Arsenal"],
        })
        result = compute_fatigue_features(df)
        assert "home_rest_days" in result.columns
        assert "rest_advantage" in result.columns
        # Arsenal plays again after 3 days
        assert result.iloc[1]["home_rest_days"] == 3
```

**Step 2: Run to verify fails**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestFeatureEngineer -v`

**Step 3: Write implementation**

Create `backend/app/services/dunc/predictions/features.py`:

```python
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

        home_records = df[["Date", "HomeTeam", "FTHG", "FTAG",
                           "HS", "AS", "HST", "AST",
                           "HC", "AC", "HF", "AF"]].copy()
        home_records.columns = [
            "Date", "Team", "GF", "GA",
            "Shots", "ShotsAgainst", "SoT", "SoTAgainst",
            "Corners", "CornersAgainst", "Fouls", "FoulsAgainst",
        ]
        home_records["IsHome"] = 1

        away_records = df[["Date", "AwayTeam", "FTAG", "FTHG",
                           "AS", "HS", "AST", "HST",
                           "AC", "HC", "AF", "HF"]].copy()
        away_records.columns = home_records.columns
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
```

**Step 4: Run to verify passes**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestFeatureEngineer -v`
Expected: 4 PASSED

**Step 5: Commit**

```bash
git add backend/app/services/dunc/predictions/features.py backend/tests/services/dunc/test_predictions.py
git commit -m "feat(dunc/predictions): feature engineering — rolling stats, xG proxy, fatigue, H2H, odds"
```

---

### Task 8: PolymarketClient — Prediction Market Data

**Files:**
- Create: `backend/app/services/dunc/predictions/polymarket.py`
- Modify: `backend/tests/services/dunc/test_predictions.py`

**Step 1: Write the failing test**

```python
class TestPolymarketClient:
    def test_football_keywords_defined(self):
        from app.services.dunc.predictions.polymarket import PolymarketClient

        client = PolymarketClient()
        assert "premier league" in client.FOOTBALL_KEYWORDS
        assert "champions league" in client.FOOTBALL_KEYWORDS

    def test_extract_match_odds_binary(self):
        from app.services.dunc.predictions.polymarket import PolymarketClient

        client = PolymarketClient()
        market = {
            "outcomes": ["Yes", "No"],
            "outcomePrices": '["0.65", "0.35"]',
            "liquidity": "10000",
            "volume24hr": "5000",
            "slug": "test-match",
            "updatedAt": "2024-01-01",
        }
        odds = client.extract_match_odds(market)
        assert odds is not None
        assert abs(odds.home_win - 0.65) < 0.01
        assert abs(odds.away_win - 0.35) < 0.01

    def test_extract_match_odds_handles_missing(self):
        from app.services.dunc.predictions.polymarket import PolymarketClient

        client = PolymarketClient()
        result = client.extract_match_odds({"outcomes": [], "outcomePrices": "[]"})
        assert result is None
```

**Step 2: Run to verify fails**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestPolymarketClient -v`

**Step 3: Write implementation**

Create `backend/app/services/dunc/predictions/polymarket.py`:

```python
"""Polymarket Gamma API client for crowd-sourced prediction market data.

The Gamma API is fully open — no API key or authentication required.
Contract prices = implied probabilities (price $0.65 = 65% probability).
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass

import requests

logger = logging.getLogger(__name__)

GAMMA_API = "https://gamma-api.polymarket.com"


@dataclass
class PolymarketOdds:
    home_win: float
    draw: float | None
    away_win: float
    liquidity: float
    volume_24h: float
    market_slug: str
    last_updated: str


class PolymarketClient:
    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36"
        )
    }

    FOOTBALL_KEYWORDS = [
        "soccer", "premier league", "la liga", "bundesliga",
        "serie a", "ligue 1", "champions league", "uefa",
        "manchester", "liverpool", "arsenal", "chelsea",
        "barcelona", "real madrid", "bayern", "psg",
        "epl", "football match",
    ]

    def search_football_markets(self, limit: int = 100) -> list[dict]:
        all_markets: list[dict] = []
        offset = 0

        while offset < limit:
            try:
                resp = requests.get(
                    f"{GAMMA_API}/markets",
                    params={"active": "true", "closed": "false", "limit": 50, "offset": offset},
                    headers=self.HEADERS,
                    timeout=15,
                )
                resp.raise_for_status()
                markets = resp.json()
                if not markets:
                    break

                for market in markets:
                    text = (market.get("question", "") + " " + market.get("description", "")).lower()
                    if any(kw in text for kw in self.FOOTBALL_KEYWORDS):
                        all_markets.append(market)

                offset += 50
                time.sleep(0.5)
            except requests.RequestException as e:
                logger.warning("Polymarket request error: %s", e)
                break

        logger.info("Found %d football markets on Polymarket", len(all_markets))
        return all_markets

    def extract_match_odds(self, market: dict) -> PolymarketOdds | None:
        try:
            outcomes = market.get("outcomes", [])
            prices_raw = market.get("outcomePrices", "[]")
            prices = json.loads(prices_raw) if isinstance(prices_raw, str) else prices_raw

            if len(prices) < 2:
                return None

            prices = [float(p) for p in prices]

            if len(prices) == 2:
                return PolymarketOdds(
                    home_win=prices[0], draw=None, away_win=prices[1],
                    liquidity=float(market.get("liquidity", 0) or 0),
                    volume_24h=float(market.get("volume24hr", 0) or 0),
                    market_slug=market.get("slug", ""),
                    last_updated=market.get("updatedAt", ""),
                )

            if len(prices) >= 3:
                outcomes_lower = [o.lower() for o in outcomes]
                home_idx = next((i for i, o in enumerate(outcomes_lower) if "home" in o or "win" in o), 0)
                draw_idx = next((i for i, o in enumerate(outcomes_lower) if "draw" in o or "tie" in o), 1)
                away_idx = next((i for i, o in enumerate(outcomes_lower) if "away" in o or "lose" in o), 2)

                return PolymarketOdds(
                    home_win=prices[home_idx], draw=prices[draw_idx], away_win=prices[away_idx],
                    liquidity=float(market.get("liquidity", 0) or 0),
                    volume_24h=float(market.get("volume24hr", 0) or 0),
                    market_slug=market.get("slug", ""),
                    last_updated=market.get("updatedAt", ""),
                )
        except (ValueError, IndexError, KeyError) as e:
            logger.warning("Failed to extract Polymarket prices: %s", e)

        return None
```

**Step 4: Run to verify passes**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestPolymarketClient -v`
Expected: 3 PASSED

**Step 5: Commit**

```bash
git add backend/app/services/dunc/predictions/polymarket.py backend/tests/services/dunc/test_predictions.py
git commit -m "feat(dunc/predictions): Polymarket Gamma API client for crowd intelligence"
```

---

### Task 9: TripleLayerFeatures — Divergence Analysis

**Files:**
- Create: `backend/app/services/dunc/predictions/triple_layer.py`
- Modify: `backend/tests/services/dunc/test_predictions.py`

**Step 1: Write the failing test**

```python
class TestTripleLayer:
    def test_divergence_features_keys(self):
        from app.services.dunc.predictions.triple_layer import TripleLayerFeatures

        bk = {"home": 0.55, "draw": 0.25, "away": 0.20}
        poly = {"home": 0.48, "draw": 0.22, "away": 0.30}
        features = TripleLayerFeatures.compute_divergence_features(bk, poly)
        assert "kl_div_bk_poly" in features
        assert "max_divergence" in features
        assert "sources_agree" in features
        assert "blended_prob_H" in features

    def test_sources_agree_when_same_favorite(self):
        from app.services.dunc.predictions.triple_layer import TripleLayerFeatures

        bk = {"home": 0.55, "draw": 0.25, "away": 0.20}
        poly = {"home": 0.52, "draw": 0.23, "away": 0.25}
        features = TripleLayerFeatures.compute_divergence_features(bk, poly)
        assert features["sources_agree"] == 1

    def test_sources_disagree_when_different(self):
        from app.services.dunc.predictions.triple_layer import TripleLayerFeatures

        bk = {"home": 0.55, "draw": 0.25, "away": 0.20}
        poly = {"home": 0.20, "draw": 0.25, "away": 0.55}
        features = TripleLayerFeatures.compute_divergence_features(bk, poly)
        assert features["sources_agree"] == 0

    def test_triple_blend_with_ml(self):
        from app.services.dunc.predictions.triple_layer import TripleLayerFeatures

        bk = {"home": 0.55, "draw": 0.25, "away": 0.20}
        poly = {"home": 0.48, "draw": 0.22, "away": 0.30}
        ml = {"home": 0.52, "draw": 0.23, "away": 0.25}
        features = TripleLayerFeatures.compute_divergence_features(bk, poly, ml)
        assert "triple_blend_H" in features
        assert "all_three_agree" in features
        # Blend should be between min and max of the three
        blend = features["triple_blend_H"]
        assert 0.45 <= blend <= 0.56
```

**Step 2: Run to verify fails**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestTripleLayer -v`

**Step 3: Write implementation**

Create `backend/app/services/dunc/predictions/triple_layer.py`:

```python
"""Triple-layer probability fusion and divergence analysis.

Combines bookmaker odds, Polymarket crowd intelligence, and ML model
probabilities. Divergences between layers are among the most valuable
analytical signals.
"""

from __future__ import annotations

import numpy as np


class TripleLayerFeatures:

    @staticmethod
    def compute_divergence_features(
        bookmaker_probs: dict,
        polymarket_probs: dict,
        ml_probs: dict | None = None,
    ) -> dict:
        features: dict = {}
        epsilon = 1e-6

        # Raw probabilities
        for prefix, probs in [("bk", bookmaker_probs), ("poly", polymarket_probs)]:
            for key in ("home", "draw", "away"):
                features[f"{prefix}_prob_{key[0].upper()}"] = probs.get(key, 0)

        # KL-divergence bookmaker vs Polymarket
        kl_div = 0.0
        for key in ("home", "draw", "away"):
            p = max(bookmaker_probs.get(key, epsilon), epsilon)
            q = max(polymarket_probs.get(key, epsilon), epsilon)
            kl_div += p * np.log(p / q)
        features["kl_div_bk_poly"] = kl_div

        # Absolute divergences
        for key, label in [("home", "H"), ("draw", "D"), ("away", "A")]:
            bk = bookmaker_probs.get(key, 0)
            poly = polymarket_probs.get(key, 0)
            features[f"divergence_{label}"] = bk - poly
            features[f"abs_divergence_{label}"] = abs(bk - poly)

        features["max_divergence"] = max(
            features["abs_divergence_H"],
            features["abs_divergence_D"],
            features["abs_divergence_A"],
        )

        # Favorite agreement
        bk_fav = max(bookmaker_probs, key=bookmaker_probs.get)
        poly_fav = max(polymarket_probs, key=polymarket_probs.get)
        features["sources_agree"] = int(bk_fav == poly_fav)

        # Blended (50/50 default)
        for key, label in [("home", "H"), ("draw", "D"), ("away", "A")]:
            features[f"blended_prob_{label}"] = (
                0.5 * bookmaker_probs.get(key, 0) + 0.5 * polymarket_probs.get(key, 0)
            )

        # Triple system with ML
        if ml_probs:
            for key, label in [("home", "H"), ("draw", "D"), ("away", "A")]:
                ml = ml_probs.get(key, 0)
                bk = bookmaker_probs.get(key, 0)
                poly = polymarket_probs.get(key, 0)
                features[f"ml_prob_{label}"] = ml
                features[f"ml_vs_bk_{label}"] = ml - bk
                features[f"ml_vs_poly_{label}"] = ml - poly
                features[f"triple_blend_{label}"] = 0.40 * ml + 0.35 * poly + 0.25 * bk

            ml_fav = max(ml_probs, key=ml_probs.get)
            features["all_three_agree"] = int(bk_fav == poly_fav == ml_fav)

        return features
```

**Step 4: Run to verify passes**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestTripleLayer -v`
Expected: 4 PASSED

**Step 5: Commit**

```bash
git add backend/app/services/dunc/predictions/triple_layer.py backend/tests/services/dunc/test_predictions.py
git commit -m "feat(dunc/predictions): triple-layer divergence analysis"
```

---

### Task 10: ML Model Trainer — Ensemble with Walk-Forward Validation

**Files:**
- Create: `backend/app/services/dunc/predictions/models.py`
- Modify: `backend/tests/services/dunc/test_predictions.py`

**Step 1: Write the failing test**

```python
from sklearn.datasets import make_classification


class TestModelTrainer:
    def test_train_produces_predictions(self):
        from app.services.dunc.predictions.models import ModelTrainer

        X, y = make_classification(
            n_samples=200, n_features=10, n_informative=5,
            n_classes=3, random_state=42,
        )
        X_df = pd.DataFrame(X, columns=[f"f{i}" for i in range(10)])
        y_s = pd.Series(y)

        trainer = ModelTrainer()
        trainer.train(X_df, y_s)

        proba = trainer.predict_proba(X_df.iloc[:5])
        assert proba.shape == (5, 3)
        # Probabilities should sum to ~1.0
        for row in proba:
            assert abs(sum(row) - 1.0) < 0.01

    def test_evaluate_returns_accuracy(self):
        from app.services.dunc.predictions.models import ModelTrainer

        X, y = make_classification(
            n_samples=300, n_features=10, n_informative=5,
            n_classes=3, random_state=42,
        )
        X_df = pd.DataFrame(X, columns=[f"f{i}" for i in range(10)])
        y_s = pd.Series(y)

        trainer = ModelTrainer()
        results = trainer.train_and_evaluate(X_df, y_s)
        assert "accuracy" in results
        assert 0.0 < results["accuracy"] < 1.0
        assert "log_loss" in results
```

**Step 2: Run to verify fails**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestModelTrainer -v`

**Step 3: Write implementation**

Create `backend/app/services/dunc/predictions/models.py`:

```python
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
```

**Step 4: Run to verify passes**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestModelTrainer -v`
Expected: 2 PASSED

**Step 5: Commit**

```bash
git add backend/app/services/dunc/predictions/models.py backend/tests/services/dunc/test_predictions.py
git commit -m "feat(dunc/predictions): ML ensemble trainer with walk-forward evaluation"
```

---

### Task 11: Claude Analyst — LLM Interpretation Layer

**Files:**
- Create: `backend/app/services/dunc/predictions/claude_analyst.py`
- Modify: `backend/tests/services/dunc/test_predictions.py`

**Step 1: Write the failing test**

```python
class TestClaudeAnalyst:
    def test_analyst_initializes_without_key(self):
        """Claude analyst should work without API key (graceful degradation)."""
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
        assert "Premier League" in prompt
```

**Step 2: Run to verify fails**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestClaudeAnalyst -v`

**Step 3: Write implementation**

Create `backend/app/services/dunc/predictions/claude_analyst.py`:

```python
"""Claude API integration for match analysis and divergence interpretation.

Uses claude-sonnet-4-20250514 for structured analysis. Gracefully degrades
when no ANTHROPIC_API_KEY is set — the prediction pipeline works without
Claude, just without natural language reports.
"""

from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger(__name__)


class ClaudeAnalyst:
    def __init__(self) -> None:
        self._client = None
        self.available = False
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if api_key:
            try:
                import anthropic
                self._client = anthropic.Anthropic(api_key=api_key)
                self.available = True
            except Exception as e:
                logger.warning("Claude analyst unavailable: %s", e)

    def _call(self, prompt: str, max_tokens: int = 800) -> str | None:
        if not self._client:
            return None
        try:
            message = self._client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text.strip()
        except Exception as e:
            logger.warning("Claude API call failed: %s", e)
            return None

    def _build_matchup_prompt(
        self,
        home_team: str,
        away_team: str,
        home_form: dict,
        away_form: dict,
        league: str,
    ) -> str:
        return f"""You are an expert football analyst. Analyze this match and return ONLY JSON:

Match: {home_team} (home) vs {away_team} (away)
League: {league}

{home_team} last 5 matches:
- Goals scored avg: {home_form.get('avg_GF', 0):.2f}
- Goals conceded avg: {home_form.get('avg_GA', 0):.2f}
- Form (avg pts): {home_form.get('Form', 0):.2f}

{away_team} last 5 matches:
- Goals scored avg: {away_form.get('avg_GF', 0):.2f}
- Goals conceded avg: {away_form.get('avg_GA', 0):.2f}
- Form (avg pts): {away_form.get('Form', 0):.2f}

Return JSON: {{"home_attack_strength": <0-1>, "home_defense_strength": <0-1>, "away_attack_strength": <0-1>, "away_defense_strength": <0-1>, "home_momentum": <0-1>, "away_momentum": <0-1>, "upset_probability": <0-1>, "home_win_confidence": <0-1>, "reasoning": "<1-2 sentences>"}}"""

    def analyze_matchup(self, home_team: str, away_team: str, home_form: dict, away_form: dict, league: str) -> dict | None:
        prompt = self._build_matchup_prompt(home_team, away_team, home_form, away_form, league)
        text = self._call(prompt, max_tokens=500)
        if not text:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start, end = text.find("{"), text.rfind("}") + 1
            if start != -1 and end > start:
                return json.loads(text[start:end])
            return None

    def analyze_divergence(
        self,
        match: str,
        bookmaker: dict,
        polymarket: dict,
        ml_model: dict,
        poly_liquidity: float = 0,
        poly_volume_24h: float = 0,
    ) -> str | None:
        prompt = f"""You are a senior sports analyst. Analyze divergences between three probability sources for a football match.

Match: {match}

| Source | Home | Draw | Away |
|---|---|---|---|
| Bookmaker | {bookmaker.get('home', 0):.1%} | {bookmaker.get('draw', 0):.1%} | {bookmaker.get('away', 0):.1%} |
| Polymarket | {polymarket.get('home', 0):.1%} | {polymarket.get('draw', 0):.1%} | {polymarket.get('away', 0):.1%} |
| ML Model | {ml_model.get('home', 0):.1%} | {ml_model.get('draw', 0):.1%} | {ml_model.get('away', 0):.1%} |

Polymarket liquidity: ${poly_liquidity:,.0f} | 24h volume: ${poly_volume_24h:,.0f}

1. Where are the main divergences and what might they mean?
2. Which source is likely most reliable here and why?
3. Final analytical assessment with confidence level.

5-8 sentences. No filler. This is analytical research, not betting advice."""
        return self._call(prompt, max_tokens=600)

    def generate_match_report(
        self,
        home_team: str,
        away_team: str,
        model_proba: dict,
        stats: dict,
        league: str,
    ) -> str | None:
        prompt = f"""You are a professional football analyst. Write a concise analytical report.

Match: {home_team} vs {away_team} ({league})

ML probabilities: Home={model_proba.get('home', 0):.1%} | Draw={model_proba.get('draw', 0):.1%} | Away={model_proba.get('away', 0):.1%}

{home_team} (5-match): GF={stats.get('home_avg_GF', 0):.2f}, GA={stats.get('home_avg_GA', 0):.2f}, Form={stats.get('home_Form', 0):.2f}
{away_team} (5-match): GF={stats.get('away_avg_GF', 0):.2f}, GA={stats.get('away_avg_GA', 0):.2f}, Form={stats.get('away_Form', 0):.2f}

Include: key factors, strengths/weaknesses, prediction, confidence (high/medium/low), risks.
Concise, professional, no filler. This is analytical research, not betting advice."""
        return self._call(prompt, max_tokens=1000)
```

**Step 4: Run to verify passes**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py::TestClaudeAnalyst -v`
Expected: 2 PASSED

**Step 5: Commit**

```bash
git add backend/app/services/dunc/predictions/claude_analyst.py backend/tests/services/dunc/test_predictions.py
git commit -m "feat(dunc/predictions): Claude analyst for match interpretation"
```

---

### Task 12: PredictionPipeline — Orchestrator

**Files:**
- Create: `backend/app/services/dunc/predictions/pipeline.py`
- Modify: `backend/app/services/dunc/predictions/__init__.py`

**Step 1: Write implementation**

Create `backend/app/services/dunc/predictions/pipeline.py`:

```python
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
```

**Step 2: Update `__init__.py`**

```python
"""D-U-N-C match prediction engine.

Triple-layer probability fusion: bookmaker odds + Polymarket crowd
intelligence + ML ensemble, with Claude API interpretation.

This is a football analytics research tool. Not for betting.
"""

from app.services.dunc.predictions.pipeline import PredictionPipeline, get_pipeline

__all__ = ["PredictionPipeline", "get_pipeline"]
```

**Step 3: Verify import works**

Run: `cd backend && python -c "from app.services.dunc.predictions import get_pipeline; print('OK')"`
Expected: `OK`

**Step 4: Commit**

```bash
git add backend/app/services/dunc/predictions/
git commit -m "feat(dunc/predictions): prediction pipeline orchestrator"
```

---

### Task 13: Prediction API Routes

**Files:**
- Modify: `backend/app/api/v1/dunc.py` (append prediction routes)

**Step 1: Add prediction routes**

Append to the bottom of `backend/app/api/v1/dunc.py`:

```python
# ── prediction engine ────────────────────────────────────────────────
from app.services.dunc.predictions import get_pipeline
from app.schemas.dunc import MatchPredictionOut, MatchAnalysisRequest, ModelStatusOut, ProbabilitySet

prediction_router = APIRouter(prefix="/predictions", tags=["dunc-predictions"])


@prediction_router.get("/health")
async def predictions_health() -> dict:
    pipeline = get_pipeline()
    return {"status": pipeline.status["status"], "vertical": "dunc-predictions"}


@prediction_router.get("/model/status", response_model=ModelStatusOut)
async def model_status() -> ModelStatusOut:
    pipeline = get_pipeline()
    s = pipeline.status
    return ModelStatusOut(
        status=s["status"],
        accuracy=s.get("accuracy"),
        log_loss=s.get("log_loss"),
        last_trained=s.get("last_trained"),
        matches_in_dataset=s.get("matches_in_dataset", 0),
        leagues=s.get("leagues", []),
    )


@prediction_router.post("/model/refresh")
async def model_refresh() -> dict:
    pipeline = get_pipeline()
    pipeline._status = "cold"
    pipeline.cache.save_json("match_data_meta", {})  # invalidate cache
    pipeline.initialize()
    return pipeline.status


@prediction_router.post("/analyze", response_model=MatchPredictionOut)
async def analyze_match(req: MatchAnalysisRequest) -> MatchPredictionOut:
    pipeline = get_pipeline()
    result = pipeline.predict_match(
        home_team=req.home_team,
        away_team=req.away_team,
        league=req.league,
    )
    if "error" in result:
        raise HTTPException(status_code=503, detail=result["error"])
    return MatchPredictionOut(
        match_key=result["match_key"],
        home_team=result["home_team"],
        away_team=result["away_team"],
        league=result["league"],
        date=result["date"],
        bookmaker=ProbabilitySet(**result["bookmaker"]),
        polymarket=ProbabilitySet(**result["polymarket"]) if result.get("polymarket") else None,
        ml_model=ProbabilitySet(**result["ml_model"]),
        kl_divergence_bk_poly=result.get("kl_divergence_bk_poly"),
        max_divergence=result.get("max_divergence"),
        sources_agree=result["sources_agree"],
        blended=ProbabilitySet(**result["blended"]),
        claude_report=result.get("claude_report"),
        confidence=result["confidence"],
        model_accuracy=result["model_accuracy"],
        model_last_trained=result["model_last_trained"],
    )


router.include_router(prediction_router)
```

**Step 2: Verify server starts**

Run: `cd backend && python -c "from app.api.v1.dunc import router; print('Routes:', len(router.routes))"`
Expected: prints route count without errors

**Step 3: Commit**

```bash
git add backend/app/api/v1/dunc.py backend/app/schemas/dunc.py
git commit -m "feat(dunc/predictions): REST API routes for prediction engine"
```

---

### Task 14: Clone machina-sports/sports-skills

**Files:**
- Create: `backend/vendor/` directory
- Create: `backend/app/services/dunc/predictions/skills_bridge.py`

**Step 1: Clone the repo**

Run: `cd backend && mkdir -p vendor && git clone https://github.com/machina-sports/sports-skills.git vendor/sports-skills --depth 1`

**Step 2: Add to .gitignore**

Append to `.gitignore`:

```
backend/vendor/
```

**Step 3: Create the bridge module**

Create `backend/app/services/dunc/predictions/skills_bridge.py`:

```python
"""Bridge to machina-sports/sports-skills soccer data.

Wraps the sports-skills soccer module for fixture schedules,
standings, and team metadata. Falls back gracefully if the
vendor directory is missing.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

SKILLS_DIR = Path(__file__).resolve().parents[4] / "vendor" / "sports-skills"


def is_available() -> bool:
    return (SKILLS_DIR / "skills").exists()


def get_soccer_skill_path() -> Path | None:
    candidates = [
        SKILLS_DIR / "skills" / "soccer",
        SKILLS_DIR / "skills" / "football",
    ]
    for p in candidates:
        if p.exists():
            return p
    # Search for any skill with "soccer" in name
    skills_dir = SKILLS_DIR / "skills"
    if skills_dir.exists():
        for child in skills_dir.iterdir():
            if "soccer" in child.name.lower() or "football" in child.name.lower():
                return child
    return None


def get_available_skills() -> list[str]:
    skills_dir = SKILLS_DIR / "skills"
    if not skills_dir.exists():
        return []
    return [p.name for p in skills_dir.iterdir() if p.is_dir()]


def get_skill_info(skill_name: str) -> dict | None:
    skill_dir = SKILLS_DIR / "skills" / skill_name
    skill_file = skill_dir / "SKILL.md"
    if not skill_file.exists():
        return None
    return {
        "name": skill_name,
        "path": str(skill_dir),
        "has_skill_md": True,
    }
```

**Step 4: Commit**

```bash
git add .gitignore backend/app/services/dunc/predictions/skills_bridge.py
git commit -m "feat(dunc/predictions): machina-sports/sports-skills bridge"
```

---

### Task 15: Frontend Types and API Client

**Files:**
- Create: `frontend/lib/dunc/predictions-api.ts`
- Modify: `frontend/lib/dunc/types.ts` (append prediction types)

**Step 1: Add prediction types**

Append to `frontend/lib/dunc/types.ts`:

```typescript

// ── Prediction Engine types ─────────────────────────────────────────

export interface ProbabilitySet {
  home: number;
  draw: number;
  away: number;
}

export interface MatchPrediction {
  match_key: string;
  home_team: string;
  away_team: string;
  league: string;
  date: string;

  bookmaker: ProbabilitySet;
  polymarket: ProbabilitySet | null;
  ml_model: ProbabilitySet;

  kl_divergence_bk_poly: number | null;
  max_divergence: number | null;
  sources_agree: boolean;
  blended: ProbabilitySet;

  claude_report: string | null;
  confidence: "high" | "medium" | "low";

  model_accuracy: number;
  model_last_trained: string;
}

export interface ModelStatus {
  status: "ready" | "training" | "cold";
  accuracy: number | null;
  log_loss: number | null;
  last_trained: string | null;
  matches_in_dataset: number;
  leagues: string[];
}
```

**Step 2: Create predictions API client**

Create `frontend/lib/dunc/predictions-api.ts`:

```typescript
// D-U-N-C Predictions REST helpers.

import type { MatchPrediction, ModelStatus } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://latentocean.com";

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${body}`);
  }
  return (await res.json()) as T;
}

export const predictionsApi = {
  health() {
    return j<{ status: string }>("/api/v1/dunc/predictions/health");
  },

  modelStatus() {
    return j<ModelStatus>("/api/v1/dunc/predictions/model/status");
  },

  analyze(home_team: string, away_team: string, league = "Premier League") {
    return j<MatchPrediction>("/api/v1/dunc/predictions/analyze", {
      method: "POST",
      body: JSON.stringify({ home_team, away_team, league }),
    });
  },

  refreshModel() {
    return j<ModelStatus>("/api/v1/dunc/predictions/model/refresh", {
      method: "POST",
    });
  },
};
```

**Step 3: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 4: Commit**

```bash
git add frontend/lib/dunc/types.ts frontend/lib/dunc/predictions-api.ts
git commit -m "feat(dunc/predictions): frontend types and API client"
```

---

### Task 16: Predictions Page — `/dunc/predictions`

**Files:**
- Create: `frontend/app/dunc/predictions/page.tsx`
- Create: `frontend/components/dunc/predictions/MatchPredictionCard.tsx`
- Create: `frontend/components/dunc/predictions/TripleLayerBars.tsx`
- Create: `frontend/components/dunc/predictions/DivergenceIndicator.tsx`
- Create: `frontend/components/dunc/predictions/ModelStatusPanel.tsx`

**Step 1: Create the TripleLayerBars component**

Create `frontend/components/dunc/predictions/TripleLayerBars.tsx`:

```tsx
"use client";

import type { ProbabilitySet } from "@/lib/dunc/types";

interface Props {
  bookmaker: ProbabilitySet;
  polymarket: ProbabilitySet | null;
  mlModel: ProbabilitySet;
  blended: ProbabilitySet;
}

function ProbBar({ label, probs, color }: { label: string; probs: ProbabilitySet; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest">
        <span className="text-li-text-muted">{label}</span>
        <div className="flex gap-3 text-li-text-secondary">
          <span>H {(probs.home * 100).toFixed(0)}%</span>
          <span>D {(probs.draw * 100).toFixed(0)}%</span>
          <span>A {(probs.away * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-li-black-surface">
        <div className="bg-emerald-500" style={{ width: `${probs.home * 100}%` }} />
        <div className="bg-amber-400" style={{ width: `${probs.draw * 100}%` }} />
        <div className="bg-rose-500" style={{ width: `${probs.away * 100}%` }} />
      </div>
    </div>
  );
}

export function TripleLayerBars({ bookmaker, polymarket, mlModel, blended }: Props) {
  return (
    <div className="space-y-3">
      <ProbBar label="Bookmaker" probs={bookmaker} color="#3498db" />
      {polymarket && <ProbBar label="Polymarket" probs={polymarket} color="#e74c3c" />}
      <ProbBar label="ML Model" probs={mlModel} color="#2ecc71" />
      <div className="border-t border-li-border pt-2">
        <ProbBar label="Blended" probs={blended} color="#9b59b6" />
      </div>
    </div>
  );
}
```

**Step 2: Create DivergenceIndicator**

Create `frontend/components/dunc/predictions/DivergenceIndicator.tsx`:

```tsx
"use client";

interface Props {
  maxDivergence: number | null;
  sourcesAgree: boolean;
  confidence: "high" | "medium" | "low";
}

export function DivergenceIndicator({ maxDivergence, sourcesAgree, confidence }: Props) {
  const confColors = { high: "text-emerald-400", medium: "text-amber-400", low: "text-rose-400" };
  const confBg = { high: "bg-emerald-400/10", medium: "bg-amber-400/10", low: "bg-rose-400/10" };

  return (
    <div className="flex items-center gap-3">
      <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded ${confBg[confidence]} ${confColors[confidence]}`}>
        {confidence}
      </span>
      {sourcesAgree ? (
        <span className="text-[10px] font-mono text-emerald-400">Sources agree</span>
      ) : (
        <span className="text-[10px] font-mono text-amber-400">
          Divergence: {maxDivergence ? (maxDivergence * 100).toFixed(1) : "?"}%
        </span>
      )}
    </div>
  );
}
```

**Step 3: Create ModelStatusPanel**

Create `frontend/components/dunc/predictions/ModelStatusPanel.tsx`:

```tsx
"use client";

import type { ModelStatus } from "@/lib/dunc/types";

interface Props {
  status: ModelStatus | null;
  onRefresh: () => void;
  refreshing: boolean;
}

export function ModelStatusPanel({ status, onRefresh, refreshing }: Props) {
  if (!status) return null;

  return (
    <div className="border border-li-border rounded-md p-4 bg-li-black-surface">
      <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono mb-3">
        Model Status
      </div>
      <div className="space-y-2 text-sm font-mono">
        <div className="flex justify-between">
          <span className="text-li-text-secondary">Status</span>
          <span className={status.status === "ready" ? "text-emerald-400" : "text-amber-400"}>
            {status.status}
          </span>
        </div>
        {status.accuracy != null && (
          <div className="flex justify-between">
            <span className="text-li-text-secondary">Accuracy</span>
            <span className="text-li-white">{(status.accuracy * 100).toFixed(1)}%</span>
          </div>
        )}
        {status.matches_in_dataset > 0 && (
          <div className="flex justify-between">
            <span className="text-li-text-secondary">Matches</span>
            <span className="text-li-white">{status.matches_in_dataset.toLocaleString()}</span>
          </div>
        )}
        {status.leagues.length > 0 && (
          <div className="flex justify-between">
            <span className="text-li-text-secondary">Leagues</span>
            <span className="text-li-white">{status.leagues.length}</span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="mt-3 w-full py-1.5 text-[10px] uppercase tracking-widest font-mono border border-li-border rounded-sm hover:border-li-cyan disabled:opacity-50 transition-colors"
      >
        {refreshing ? "Refreshing..." : "Refresh Model"}
      </button>
    </div>
  );
}
```

**Step 4: Create MatchPredictionCard**

Create `frontend/components/dunc/predictions/MatchPredictionCard.tsx`:

```tsx
"use client";

import type { MatchPrediction } from "@/lib/dunc/types";
import { TripleLayerBars } from "./TripleLayerBars";
import { DivergenceIndicator } from "./DivergenceIndicator";

interface Props {
  prediction: MatchPrediction;
}

export function MatchPredictionCard({ prediction }: Props) {
  const p = prediction;
  const bestOutcome = p.blended.home >= p.blended.away && p.blended.home >= p.blended.draw
    ? p.home_team
    : p.blended.away >= p.blended.draw
      ? p.away_team
      : "Draw";

  return (
    <div className="border border-li-border rounded-md bg-li-black-surface overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-li-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-display text-li-white">{p.home_team}</span>
            <span className="text-sm text-li-text-muted">vs</span>
            <span className="text-lg font-display text-li-white">{p.away_team}</span>
          </div>
          <DivergenceIndicator
            maxDivergence={p.max_divergence}
            sourcesAgree={p.sources_agree}
            confidence={p.confidence}
          />
        </div>
        <div className="text-[10px] font-mono text-li-text-muted mt-1">
          {p.league} &middot; {p.date}
        </div>
      </div>

      {/* Probability Bars */}
      <div className="px-4 py-3">
        <TripleLayerBars
          bookmaker={p.bookmaker}
          polymarket={p.polymarket}
          mlModel={p.ml_model}
          blended={p.blended}
        />
      </div>

      {/* Prediction Summary */}
      <div className="px-4 py-3 border-t border-li-border bg-li-black/30">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
              Prediction
            </span>
            <div className="text-sm font-display text-li-cyan mt-0.5">{bestOutcome}</div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
              Blended
            </span>
            <div className="text-sm font-mono text-li-white mt-0.5">
              {(Math.max(p.blended.home, p.blended.draw, p.blended.away) * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Claude Report */}
      {p.claude_report && (
        <details className="border-t border-li-border">
          <summary className="px-4 py-2 text-[10px] uppercase tracking-widest text-li-cyan font-mono cursor-pointer hover:bg-li-black/20">
            Claude Analysis
          </summary>
          <div className="px-4 py-3 text-sm text-li-text-secondary leading-relaxed whitespace-pre-wrap">
            {p.claude_report}
          </div>
        </details>
      )}
    </div>
  );
}
```

**Step 5: Create the predictions page**

Create `frontend/app/dunc/predictions/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { predictionsApi } from "@/lib/dunc/predictions-api";
import type { MatchPrediction, ModelStatus } from "@/lib/dunc/types";
import { MatchPredictionCard } from "@/components/dunc/predictions/MatchPredictionCard";
import { ModelStatusPanel } from "@/components/dunc/predictions/ModelStatusPanel";

const SAMPLE_MATCHES = [
  { home: "Arsenal", away: "Brighton", league: "Premier League" },
  { home: "Liverpool", away: "Chelsea", league: "Premier League" },
  { home: "Barcelona", away: "Real Madrid", league: "La Liga" },
  { home: "Bayern Munich", away: "Dortmund", league: "Bundesliga" },
  { home: "Man City", away: "Tottenham", league: "Premier League" },
];

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<MatchPrediction[]>([]);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom match
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [league, setLeague] = useState("Premier League");

  async function loadSamplePredictions() {
    setLoading(true);
    setError(null);
    try {
      const results: MatchPrediction[] = [];
      for (const match of SAMPLE_MATCHES) {
        const pred = await predictionsApi.analyze(match.home, match.away, match.league);
        results.push(pred);
      }
      setPredictions(results);
      const status = await predictionsApi.modelStatus();
      setModelStatus(status);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeCustom() {
    if (!homeTeam.trim() || !awayTeam.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const pred = await predictionsApi.analyze(homeTeam.trim(), awayTeam.trim(), league);
      setPredictions((prev) => [pred, ...prev]);
      if (!modelStatus) {
        const status = await predictionsApi.modelStatus();
        setModelStatus(status);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const status = await predictionsApi.refreshModel();
      setModelStatus(status as unknown as ModelStatus);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-6 h-14 border-b border-li-border">
        <div className="flex items-baseline gap-3">
          <Link href="/dunc" className="font-display text-xl tracking-tight hover:text-li-cyan transition-colors">
            D-U-N-C
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
            Match Predictions
          </span>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-7xl w-full mx-auto">
        {/* Hero */}
        <div className="mb-8">
          <div className="text-[10px] uppercase tracking-widest text-li-cyan font-mono mb-2">
            Triple-Layer Prediction Engine
          </div>
          <h1 className="font-display text-3xl md:text-4xl leading-tight tracking-tight">
            Bookmaker + Crowd Intelligence + ML
          </h1>
          <p className="text-sm text-li-text-secondary mt-2 max-w-2xl">
            Fusing bookmaker odds, Polymarket prediction market data, and a custom ML ensemble
            to analyze match probabilities. Claude interprets divergences between sources.
            This is an analytical research tool — not betting advice.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Controls + Predictions */}
          <div className="lg:col-span-3 space-y-6">
            {/* Custom Analysis */}
            <div className="border border-li-border rounded-md p-4 bg-li-black-surface">
              <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono mb-3">
                Analyze a Match
              </div>
              <div className="flex flex-wrap gap-3">
                <input
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  placeholder="Home team"
                  className="bg-li-black border border-li-border rounded-sm px-3 py-2 text-sm font-mono text-li-white focus:outline-none focus:border-li-cyan flex-1 min-w-[140px]"
                />
                <span className="text-li-text-muted self-center text-sm">vs</span>
                <input
                  value={awayTeam}
                  onChange={(e) => setAwayTeam(e.target.value)}
                  placeholder="Away team"
                  className="bg-li-black border border-li-border rounded-sm px-3 py-2 text-sm font-mono text-li-white focus:outline-none focus:border-li-cyan flex-1 min-w-[140px]"
                />
                <select
                  value={league}
                  onChange={(e) => setLeague(e.target.value)}
                  className="bg-li-black border border-li-border rounded-sm px-3 py-2 text-sm font-mono text-li-white focus:outline-none focus:border-li-cyan"
                >
                  <option>Premier League</option>
                  <option>La Liga</option>
                  <option>Bundesliga</option>
                  <option>Serie A</option>
                  <option>Ligue 1</option>
                </select>
                <button
                  type="button"
                  onClick={analyzeCustom}
                  disabled={loading || !homeTeam.trim() || !awayTeam.trim()}
                  className="px-5 py-2 bg-li-cyan text-li-black text-sm font-bold tracking-wide rounded-sm hover:bg-li-cyan/80 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Analyzing..." : "Analyze"}
                </button>
              </div>
            </div>

            {/* Quick Load */}
            {predictions.length === 0 && !loading && (
              <button
                type="button"
                onClick={loadSamplePredictions}
                className="w-full py-4 border border-dashed border-li-border rounded-md text-sm text-li-text-muted hover:border-li-cyan hover:text-li-cyan transition-colors font-mono"
              >
                Load sample predictions (EPL, La Liga, Bundesliga)
              </button>
            )}

            {error && (
              <div className="text-sm text-li-red font-mono border border-li-red/30 bg-li-red/5 rounded-md p-3">
                {error}
              </div>
            )}

            {loading && predictions.length === 0 && (
              <div className="text-center py-12 text-li-text-muted font-mono text-sm">
                Initializing prediction engine... (first run fetches historical data and trains the model)
              </div>
            )}

            {/* Prediction Cards */}
            <div className="space-y-4">
              {predictions.map((p) => (
                <MatchPredictionCard key={p.match_key} prediction={p} />
              ))}
            </div>
          </div>

          {/* Right: Model Status */}
          <div className="space-y-4">
            <ModelStatusPanel status={modelStatus} onRefresh={handleRefresh} refreshing={refreshing} />

            <div className="border border-li-border rounded-md p-4 bg-li-black-surface">
              <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono mb-3">
                About
              </div>
              <div className="text-xs text-li-text-secondary leading-relaxed space-y-2">
                <p>
                  Three probability layers fused into one analytical view.
                  Divergences between bookmaker, crowd, and ML predictions
                  reveal where sources disagree — the most interesting signal.
                </p>
                <p>
                  Model: XGBoost + Random Forest + Logistic Regression ensemble.
                  Data: 3-5 seasons across top European leagues.
                </p>
                <p className="text-li-text-muted italic">
                  Analytical research tool. Not betting advice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

**Step 6: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 7: Commit**

```bash
git add frontend/app/dunc/predictions/ frontend/components/dunc/predictions/
git commit -m "feat(dunc/predictions): predictions page with triple-layer cards"
```

---

### Task 17: Link Predictions from Dunc Home Page

**Files:**
- Modify: `frontend/app/dunc/page.tsx`

**Step 1: Add predictions link**

In `frontend/app/dunc/page.tsx`, after the "Try it now" section, add a predictions section. After the `<section className="mt-16">` block containing the PL match card, add:

```tsx
        {/* ═══ PREDICTIONS ═══ */}
        <section className="mt-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="text-[10px] uppercase tracking-widest text-li-cyan font-mono">
              Match Intelligence
            </div>
            <div className="flex-1 h-px bg-li-cyan/20" />
          </div>
          <Link
            href="/dunc/predictions"
            className="block border border-li-cyan/30 bg-li-cyan/5 rounded-md p-6 hover:border-li-cyan transition-colors group"
          >
            <div className="text-xl font-display text-white mb-2 group-hover:text-li-cyan transition-colors">
              Triple-Layer Match Predictions
            </div>
            <div className="text-sm text-li-text-secondary leading-relaxed">
              Fuse bookmaker odds, Polymarket crowd intelligence, and ML ensemble predictions.
              Analyze probability divergences with Claude interpretation.
            </div>
            <div className="mt-3 text-[10px] uppercase tracking-widest text-li-cyan font-mono">
              Open Predictions Engine →
            </div>
          </Link>
        </section>
```

Also add the `Link` import if not already present (it is already imported in the file).

**Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add frontend/app/dunc/page.tsx
git commit -m "feat(dunc): link to predictions engine from home page"
```

---

### Task 18: Start Dev Server and Verify

**Step 1: Start backend**

Run: `cd backend && uvicorn app.main:app --reload --port 8000`

**Step 2: Test prediction health endpoint**

Run: `curl http://localhost:8000/api/v1/dunc/predictions/health`
Expected: `{"status":"cold","vertical":"dunc-predictions"}`

**Step 3: Start frontend**

Run: `cd frontend && npm run dev`

**Step 4: Open in browser**

Navigate to `http://localhost:3000/dunc/predictions`
Verify: page loads with the predictions UI, custom analysis form, and model status panel.

**Step 5: Test an analysis**

Enter "Arsenal" vs "Brighton" in the custom analysis form and click Analyze.
Expected: model initializes (first run takes 30-60s), then returns a prediction card with triple-layer probability bars.

---

### Task 19: Final Integration Test

**Step 1: Run all prediction tests**

Run: `cd backend && python -m pytest tests/services/dunc/test_predictions.py -v`
Expected: All tests pass

**Step 2: Run full backend test suite**

Run: `cd backend && python -m pytest tests/ -v --ignore=tests/services/dunc/test_predictions.py -x`
Expected: No regressions

**Step 3: Frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit final state**

```bash
git add -A
git commit -m "feat(dunc/predictions): complete match prediction engine with triple-layer fusion"
```
