# D-U-N-C Match Prediction Engine — Design Document

**Date:** 2026-04-17
**Status:** Approved
**Owner:** direncode
**Related:** `docs/plans/2026-04-11-dunc-vertical-design.md`, `backend/app/services/dunc/`

---

## 1. Context

Big Dunc currently provides live tactical intelligence — digital twins, scenario detection, and real-time insight feeds from match simulations. What it lacks is a **pre-match analytical layer**: predictions on match outcomes backed by data, ML models, and multi-source probability fusion.

This feature adds a triple-layer prediction engine that combines:
1. **Bookmaker odds** (Bet365, from football-data.co.uk) — aggregated market expertise
2. **Polymarket** (Gamma API, blockchain) — crowd intelligence from crypto traders
3. **Custom ML ensemble** (XGBoost, Random Forest, Logistic Regression) — our own model

Claude API interprets divergences between sources and generates natural language analytical reports.

**This is a football analytics research tool.** It is not for betting, wagering, or financial decisions. The system demonstrates multi-source intelligence fusion — the same structural intelligence philosophy behind Latent Ocean's other verticals.

## 2. Scope

**In scope:**

1. **Data pipeline.** Auto-fetch 3-5 seasons of match data from football-data.co.uk on cold start. Cache to disk. Daily background refresh.
2. **Feature engineering.** Rolling stats (5-match window), ELO ratings (FIFA formula with margin-of-victory), xG proxy from shot data, fatigue/rest-day features, head-to-head history.
3. **Polymarket integration.** Fetch live crowd probabilities from the Gamma API (public, no auth). Order book depth as confidence signal.
4. **ML ensemble.** Soft-voting ensemble (Logistic Regression, Random Forest, XGBoost weighted 2x). TimeSeriesSplit cross-validation. Walk-forward backtesting.
5. **Triple-layer divergence analysis.** KL-divergence, absolute gaps, agreement signals between bookmaker/Polymarket/ML. Divergences are features and analytical insights.
6. **Claude API integration.** Contextual matchup analysis, divergence interpretation, natural language match reports. Uses `claude-sonnet-4-20250514`.
7. **REST API.** Additive routes under `/api/v1/dunc/predictions/`.
8. **Frontend.** New `/dunc/predictions` page (upcoming matches grid, triple-layer bars, radar charts, Claude reports). Pre-match tab on existing match dashboard.
9. **machina-sports/sports-skills.** Clone repo, extract soccer skill for fixture/standings/live score data as supplementary data source.
10. **Tests.** pytest for pipeline, feature engineering, model training. Frontend typecheck.

**Out of scope (YAGNI):**

- Betting advice, bankroll management, or wagering features
- Real-money or financial integrations
- User accounts or saved prediction history
- Deep learning models (LSTM, transformers) — XGBoost ensemble is sufficient
- Real-time in-play prediction updates during live simulations
- Custom model training UI
- Production Docker compose changes

## 3. Hard Rule — Additive Only

Following the convention from the Dunc vertical design (§3):

- No edits to existing Dunc services (`simulator.py`, `tactical_engine.py`, `twins.py`, etc.)
- No edits to existing API routes (only additive sub-routes)
- No edits to existing frontend pages (only new page + new tab component)
- Exactly one additive edit: extending the Dunc API router registration for prediction sub-routes

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                 D-U-N-C PREDICTION ENGINE                          │
│                                                                    │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  DATA LAYER                                               │     │
│   │  football-data.co.uk (CSV) ─┐                            │     │
│   │  machina-sports/soccer skill ┼──▶ DataLoader             │     │
│   │  Polymarket Gamma API ───────┘    (merged DataFrame)     │     │
│   └──────────────────────────────────────────────────────────┘     │
│                           │                                        │
│                           ▼                                        │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  FEATURE ENGINEERING                                      │     │
│   │  DataCleaner ─▶ FeatureEngineer ─▶ FootballELO            │     │
│   │  Rolling stats │ xG proxy │ Fatigue │ H2H │ Odds features │     │
│   └──────────────────────────────────────────────────────────┘     │
│                           │                                        │
│                           ▼                                        │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  MODEL LAYER                                              │     │
│   │  LogisticRegression │ RandomForest │ XGBoost               │     │
│   │  Ensemble (SoftVoting, weights=[1,1,2])                    │     │
│   │  TimeSeriesSplit CV │ Walk-forward backtest                │     │
│   └──────────────────────────────────────────────────────────┘     │
│                           │                                        │
│                           ▼                                        │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  TRIPLE LAYER FUSION                                      │     │
│   │  Bookmaker probs + Polymarket probs + ML probs            │     │
│   │  KL-divergence │ Agreement signals │ Blended probabilities │     │
│   └──────────────────────────────────────────────────────────┘     │
│                           │                                        │
│                           ▼                                        │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  CLAUDE INTERPRETATION                                    │     │
│   │  claude-sonnet-4-20250514                                 │     │
│   │  Matchup analysis │ Divergence explanation │ Match report  │     │
│   └──────────────────────────────────────────────────────────┘     │
│                           │                                        │
│                           ▼                                        │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  API + UI                                                 │     │
│   │  /api/v1/dunc/predictions/*  ─▶  /dunc/predictions (Next) │     │
│   │  Pre-match tab on /dunc/match/[id]                        │     │
│   └──────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

## 5. Backend Layout

```
backend/app/services/dunc/predictions/
  __init__.py           # Public API: PredictionPipeline, get_pipeline()
  data_loader.py        # FootballDataLoader (football-data.co.uk CSV fetcher)
  skills_bridge.py      # machina-sports soccer skill bridge (fixtures, standings)
  cleaner.py            # DataCleaner (date normalization, encoding, numeric casting)
  features.py           # FeatureEngineer (rolling averages, odds features, xG proxy, fatigue, H2H)
  elo.py                # FootballELO (FIFA formula, margin-of-victory, home advantage)
  polymarket.py         # PolymarketClient (Gamma API search, price extraction, order book)
  triple_layer.py       # TripleLayerFeatures (divergence computation, KL, blending)
  models.py             # ModelTrainer (ensemble, TimeSeriesSplit, walk-forward)
  claude_analyst.py     # ClaudeAnalyst (matchup, divergence, reports via Anthropic SDK)
  pipeline.py           # PredictionPipeline (orchestrator: cold start → cached inference)
  cache.py              # ArtifactCache (model weights, scaler, ELO state, data cache)

backend/app/schemas/dunc.py           # +PredictionOut, TripleLayerOut, MatchAnalysisOut
backend/app/api/v1/dunc.py            # +prediction_router sub-routes

backend/tests/services/dunc/
  test_predictions.py                  # Pipeline, features, model training tests
```

## 6. Data Contracts

### 6.1 MatchPrediction (API response)

```python
class MatchPrediction(BaseModel):
    match_key: str                    # e.g. "arsenal_vs_brighton_2026-04-20"
    home_team: str
    away_team: str
    league: str
    date: str

    # Triple-layer probabilities
    bookmaker: ProbabilitySet         # {home, draw, away}
    polymarket: ProbabilitySet | None # null if no active market
    ml_model: ProbabilitySet

    # Divergence analysis
    kl_divergence_bk_poly: float | None
    max_divergence: float | None
    sources_agree: bool
    blended: ProbabilitySet           # weighted fusion

    # Claude analysis
    claude_report: str | None         # natural language report
    confidence: str                   # "high" | "medium" | "low"

    # Model metadata
    model_accuracy: float
    model_last_trained: str
```

### 6.2 ProbabilitySet

```python
class ProbabilitySet(BaseModel):
    home: float   # 0.0-1.0
    draw: float
    away: float
```

## 7. API Surface (additive)

```
GET  /api/v1/dunc/predictions/health
GET  /api/v1/dunc/predictions/upcoming         → MatchPrediction[]
GET  /api/v1/dunc/predictions/{match_key}      → MatchPrediction (detailed)
POST /api/v1/dunc/predictions/analyze          → custom matchup analysis
GET  /api/v1/dunc/predictions/model/status     → training status, accuracy, last updated
POST /api/v1/dunc/predictions/model/refresh    → force data + model refresh
GET  /api/v1/dunc/predictions/leagues          → available leagues
```

## 8. Frontend Layout

```
frontend/app/dunc/predictions/
  page.tsx              # Main predictions page (match grid, filters, league selector)

frontend/components/dunc/predictions/
  MatchPredictionCard.tsx    # Card with triple-layer probability bars
  TripleLayerRadar.tsx       # Radar chart comparing 3 sources
  DivergenceIndicator.tsx    # Color-coded divergence badge
  ClaudeReport.tsx           # Expandable Claude analysis panel
  ModelStatus.tsx            # Model accuracy/calibration sidebar
  PredictionPreMatch.tsx     # Pre-match tab component for match dashboard

frontend/lib/dunc/predictions-api.ts  # Fetch helpers for prediction endpoints
```

## 9. machina-sports/sports-skills Integration

Clone `machina-sports/sports-skills` and extract:
- **Soccer skill:** ESPN-backed fixture schedules, standings, team rosters
- **Polymarket skill:** Alternative data path for prediction market data (supplement our direct Gamma API client)

Integration approach: `skills_bridge.py` wraps the machina-sports data access patterns and normalizes team names to match our football-data.co.uk dataset. The skills repo is cloned into `backend/vendor/sports-skills/` (gitignored, fetched on build).

## 10. Claude Integration Details

Three call patterns, all using `claude-sonnet-4-20250514`:

1. **`claude_analyze_matchup()`** — Per-match contextual evaluation from stats. Returns JSON with strength/momentum/confidence scores. ~500 tokens.
2. **`claude_analyze_divergence()`** — When triple-layer sources disagree. Interprets what the divergence might mean. ~600 tokens.
3. **`generate_prediction_report()`** — Full natural language match report. Key factors, strengths/weaknesses, prediction, confidence, risks. ~1000 tokens.

All calls are gated behind an `ANTHROPIC_API_KEY` env var check. If no key, the system works without Claude analysis (ML + Polymarket + bookmaker still functional).

## 11. Testing

- `test_predictions.py`:
  - DataLoader fetches and cleans correctly
  - FeatureEngineer produces expected column shapes
  - ELO system converges (top teams > 1500 after training)
  - Model trains and predicts 3-class probabilities summing to ~1.0
  - TripleLayerFeatures computes divergences correctly
  - Pipeline cold-start → cached path works
- Frontend: `tsc --noEmit` via `next build` smoke

## 12. Risks & Trade-offs

1. **Cold start latency.** First prediction request triggers ~30-60s data fetch + model training. Mitigated by background initialization on server startup and aggressive caching.
2. **Polymarket coverage.** Not every match has a Polymarket market. The system gracefully degrades to 2-layer (bookmaker + ML) when Polymarket data is absent.
3. **Football-data.co.uk reliability.** Free CSV source may lag or be unavailable. machina-sports skill provides fallback fixture data.
4. **Claude API cost.** Each match report costs ~$0.01-0.03 (Sonnet). For a full matchday (10 matches), ~$0.10-0.30. Reports are cached per match per day.
5. **Model accuracy ceiling.** Academic literature shows ~52-56% accuracy for 3-class football prediction with basic features. This is expected — football is inherently unpredictable. The value is in the analytical framework, not raw accuracy.
