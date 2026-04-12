# NIV (National Impact Velocity) Vertical — Design

**Status:** approved, ready to implement
**Date:** 2026-04-11
**Author:** Claude (with diren)
**Related:** `2026-04-10-tcd-jepa-vertical-design.md`, `2026-04-04-btut-command-center-design.md`, `2026-04-10-latk-design.md`

## Summary

Integrate NIV — the composite macro indicator
`NIV_t = (u_t · P_t²) / (X_t + F_t)^η` — as a production vertical inside
Latent Ocean. Source of truth for the formula and ensemble is the
`direncode/regenerationism` repository (Rust formula engine + TypeScript
walk-forward ensemble, both public). This design ports both to Python,
fills the documented gaps (orthogonal variance, conformal prediction as a
first-class API concept, Protocol D forward test), and wires the vertical
to the existing Latent Ocean services (BTUT, TCD-JEPA crystallization,
LATK) through one-way bridges so that each piece is independently
deployable.

Port fidelity policy: **match the live dashboard by default, improvements
are opt-in flags.** The Python port must reproduce regenerationism.ai's
current numbers bit-for-bit on six known dashboard months, or the port is
wrong and we fix the port before shipping.

## Goals

1. NIV becomes a first-class vertical in `backend/app/services/niv/`,
   registered at `/api/v1/niv/*`, and follows the package conventions
   used by BTUT, LATK, and the TCD-JEPA bridge.
2. The formula and ensemble reproduce `regenerationism.ai` numerically on
   six known NBER reference months (parity gate).
3. The vertical exposes: live score, history, components, walk-forward
   OOS, Protocol D frozen forward test, orthogonal variance vs. Fed yield
   curve, conformal bands, tearsheet generation, TCD-JEPA crystallization.
4. BTUT is used as an **optional** feature-selection preprocessor; the
   vertical still works without it.
5. TCD-JEPA ingests walk-forward ensembles as crystallization modules via
   an inverted dependency (NIV → crystallization, never the reverse).
6. A `sovereign.py` extension point exists for non-US NIV (UAE liquidity
   sandbox as the first target, v1 ships with the stub).
7. Five learning-mode hooks are left as `NotImplementedError` stubs with
   explicit TODO docstrings — these are the product-shaping decisions
   that must come from diren, not from Claude.

## Non-goals (v1)

- Frontend dashboard components. The existing regenerationism.ai
  frontend can be retargeted to the Python API by flipping a base URL.
  Latent Ocean dashboard widgets are a follow-up.
- Bit-parity with the Rust engine for *every* month — parity is asserted
  on six reference months and on total variance preservation, not on all
  660 months.
- ALFRED real-time vintage for pre-1983 data — the ALFRED archive starts
  in the mid-1990s for most series. We use latest vintage for older
  months and flag the tearsheet accordingly.

## Context — what the regenerationism repo actually contains

After inspecting all nine branches, the canonical files are:

| Path | Language | Role |
|---|---|---|
| `regenerationism.ai/rust-engine/src/niv.rs` | Rust | Deterministic NIV formula, 12-mo smoothing, alert levels |
| `regenerationism.ai/rust-engine/src/fred.rs` | Rust | FRED fetcher, 90-day NN alignment |
| `regenerationism.ai/frontend/lib/oosTests.ts` | TypeScript | Walk-forward ensemble (LR + AdaBoost + NN), isotonic calibration, conformal prediction, AUC |
| `regenerationism.ai/analysis/niv_analysis.py` | Python | ROC/tearsheet visualization (reuse directly) |
| `docs/NIV_Next_Gen_OOS_Framework.md` | doc | Methodology spec for walk-forward |
| `docs/NIV_Out_of_Sample_Methodology_and_Results.md` | doc | Published OOS protocol |
| `docs/NIV_Final_OOS_Report.md` | doc | Results |

**What the spec claimed but the public code does not contain:**
- "AUC 0.8538 at 18-mo horizon" — no specific number in the public docs.
  Treated as an aspirational target, not a reproducibility contract.
- "Orthogonal variance 41.71% vs Fed yield curve" — the methodology doc
  explicitly admits orthogonal variance is not defined. Python port adds
  it as new work in `orthogonal_variance.py`.
- Walk-forward "504 months (1970–2024)" — the deployed code uses
  `startIdx = floor(0.2 * n)` (a fraction, not a fixed month count). We
  match the code, not the spec number.

## Architecture

### Package layout

```
backend/app/services/niv/
├── __init__.py                 # exports NIVVertical facade
├── config.py                   # NIVConfig: eta, epsilon, smoothing, feature weights, vintage
├── fred_adapter.py             # FRED/ALFRED ingestion → normalized monthly frame
├── formula.py                  # pure NIV: thrust, P², slack, drag, tanh bound, clamp, recession P
├── features.py                 # 12 feature columns (matches TS) + augmentation pool hook
├── ensemble.py                 # LR + AdaBoost + MLP + log-odds combiner + opt-in stacking
├── conformal.py                # split-conformal predictor, α=0.1, rolling window=100
├── walkforward.py              # expanding-window harness, warmup_frac=0.20, retrain_every=5
├── protocol_d.py               # frozen forward test (fit once, predict zero-retrain)
├── orthogonal_variance.py      # OLS decomposition + bootstrap CI (NEW, not a port)
├── tearsheet.py                # reuses niv_analysis.py visuals, investment thesis hook
├── btut_bridge.py              # optional: macro feature thinning via run_btut_pipeline
├── crystallization_bridge.py   # optional: registers modules with TCD-JEPA job_manager
├── sovereign.py                # UAE extension point (stub with data-source hook)
├── vertical.py                 # NIVVertical facade
└── cache.py                    # Redis-backed series cache (FRED rate-limit)

backend/app/api/v1/niv.py        # FastAPI router
backend/app/schemas/niv.py       # pydantic request/response models
backend/app/tasks/niv_refresh.py # monthly FRED refresh cron
tests/unit/niv/                  # per-module unit tests
tests/integration/niv/           # end-to-end
tests/parity/niv/                # six-month TS parity gate
```

### Facade

```python
class NIVVertical:
    def __init__(self, config: NIVConfig, btut=None, tcd_jepa=None, latk=None): ...
    def ingest(self, start, end) -> pd.DataFrame: ...
    def compute_scores(self, frame) -> NIVResult: ...
    def fit_walkforward(self, frame, horizons=(3,6,12,18)) -> WalkForwardResult: ...
    def fit_protocol_d(self, frame, freeze_date, horizons) -> ProtocolDResult: ...
    def predict_probabilities(self, features) -> EnsemblePrediction: ...
    def orthogonal_variance(self, niv_series, benchmark="T10Y3M") -> OrthogonalVarianceResult: ...
    def tearsheet(self, output="pdf") -> Path: ...
    def register_crystallization_modules(self) -> list[ModuleId]: ...
    def thin_signals_via_btut(self, candidate_pool) -> list[FeatureSpec]: ...
```

### Dependency direction (enforced by package layout)

```
NIVVertical
   ├─→ (optional) services/btut/pipeline.run_btut_pipeline()
   ├─→ (optional) services/crystallization/job_manager.enqueue_modules()
   └─→ (optional) services/latk (via HTTP router, not direct import)

None of btut/, crystallization/, or latk/ import anything from niv/.
```

If BTUT, crystallization, or LATK aren't available at runtime, the
vertical degrades gracefully. The Latent Ocean features are pure
augmentations, not gates. This is the horizontal-platform invariant.

## Formula layer (`formula.py`)

Pure numpy, no state, no external dependencies beyond `numpy`.

### Constants (from `niv.rs`)

```python
ETA = 1.5
EPSILON = 0.001
SMOOTH_WINDOW = 12
R_D_MULTIPLIER = 1.15
THRUST_DG_WEIGHT = 1.0
THRUST_DA_WEIGHT = 1.0
THRUST_DR_WEIGHT = 0.7
DRAG_SPREAD_WEIGHT = 0.4
DRAG_REAL_RATE_WEIGHT = 0.4
DRAG_VOLATILITY_WEIGHT = 0.2
NIV_SCALE = 1000.0   # NIV raw ratio × 1000 before clamp
NIV_CLAMP = (-100.0, 100.0)
```

### Key functions

```python
def thrust(dG, dA, dr) -> float:
    return np.tanh((THRUST_DG_WEIGHT*dG + THRUST_DA_WEIGHT*dA - THRUST_DR_WEIGHT*dr) / 10.0)

def efficiency_squared(investment, gdp) -> float:
    if gdp <= 0: return 0.0
    return ((investment * R_D_MULTIPLIER) / gdp) ** 2

def slack(tcu) -> float:
    return 1.0 - (tcu / 100.0)

def drag(yield_spread, fed_funds, cpi_inflation, sigma_r_12mo) -> DragBreakdown:
    drag_spread = abs(yield_spread) / 100.0 if yield_spread < 0 else 0.0
    real_rate = max(0.0, fed_funds - cpi_inflation) / 100.0
    drag_vol = sigma_r_12mo / 100.0
    total = (DRAG_SPREAD_WEIGHT * drag_spread
             + DRAG_REAL_RATE_WEIGHT * real_rate
             + DRAG_VOLATILITY_WEIGHT * drag_vol)
    return DragBreakdown(total=total, spread=drag_spread, real_rate=real_rate, vol=drag_vol)

def niv_score(u, P_sq, X, F, eta=ETA, eps=EPSILON) -> float:
    numerator = u * P_sq
    denom = (X + F + eps) ** eta
    if abs(denom) < 1e-15: return 0.0
    raw = numerator / denom
    return float(np.clip(raw * NIV_SCALE, *NIV_CLAMP))   # ← the scaling+clamp I originally missed

def recession_probability(niv) -> float:
    # Matches niv.rs compute_recession_probability: 1 - σ(niv/10)
    p = 1.0 / (1.0 + np.exp(-niv / 10.0))
    return 1.0 - p

def smooth_12m(series: pd.Series) -> pd.Series:
    # Matches niv.rs apply_smoothing: first 11 rows passthrough, from index 11 onward use 12-mo mean
    result = series.copy()
    for i in range(SMOOTH_WINDOW - 1, len(series)):
        result.iloc[i] = series.iloc[i - SMOOTH_WINDOW + 1 : i + 1].mean()
    return result
```

### Parity gate

`tests/parity/niv/test_against_regenerationism_spot_checks.py` loads six
reference months (2007-07, 2008-09, 2009-06, 2019-12, 2020-04, 2023-06)
from a frozen snapshot of the live dashboard JSON and asserts the Python
output matches within `1e-4` per component. This test gates every PR
touching `formula.py`.

## Ensemble layer (`ensemble.py`)

### Learners (defaults match TS verbatim)

```python
DEFAULT_LEARNERS = [
    ("lr",   LogisticRegression(
        C=1.0/0.01, class_weight="balanced", penalty="l2",
        max_iter=100, solver="lbfgs", random_state=42)),
    ("ada",  AdaBoostClassifier(
        n_estimators=15, estimator=DecisionTreeClassifier(max_depth=1),
        algorithm="SAMME", random_state=42)),
    ("mlp",  MLPClassifier(
        hidden_layer_sizes=(8,), activation="relu", solver="adam",
        max_iter=500, early_stopping=True, random_state=42)),
]
```

### Combiner

**Default = log-odds averaging** (matches TS dashboard numerically):

```python
def log_odds_average(p1, p2, p3) -> float:
    return sigmoid((logit(p1) + logit(p2) + logit(p3)) / 3)
```

**Opt-in** via `NIVConfig(combiner="stacking")`: sklearn
`StackingClassifier` with `LogisticRegression` as the meta-learner.

### Calibration

**Default = isotonic on last 30% of training slice, fit on ensemble
logit** (matches TS). **Opt-in** via `NIVConfig(calibration="cv5")`:
`CalibratedClassifierCV(cv=5, method="isotonic")` wrapping the ensemble.

### Ensemble class

```python
class NIVEnsemble:
    def __init__(self, learners=DEFAULT_LEARNERS, combiner="log_odds", calibrate="last_30pct"):
        self.learners = learners
        self.combiner = combiner
        self.calibrate = calibrate
        self._fitted = {}
        self._iso: IsotonicModel | None = None
        self._scaler_mean: np.ndarray | None = None
        self._scaler_std: np.ndarray | None = None

    def fit(self, X, y, sample_weight=None) -> "NIVEnsemble": ...
    def predict_proba(self, X) -> np.ndarray: ...
    def predict_per_learner(self, X) -> dict[str, np.ndarray]: ...
    def explain(self, X) -> EnsembleExplanation: ...   # per-learner contributions
```

### Conformal layer (`conformal.py`)

Port of the TS `ConformalPredictor(0.1)` with a 100-score rolling
window. Produces `(lower, upper, coverage)` per prediction.

```python
class SplitConformal:
    def __init__(self, alpha: float = 0.1, window: int = 100): ...
    def update(self, pred: float, actual: int) -> None: ...   # rolling nonconformity
    def bands(self, pred: float) -> tuple[float, float]: ...  # (lower, upper)
    def coverage(self) -> float: ...                          # empirical coverage on window
```

## Walk-forward harness (`walkforward.py`)

```python
@dataclass
class WalkForwardConfig:
    warmup_frac: float = 0.20         # matches TS startIdx = floor(0.2 * n)
    warmup_months: int | None = None  # optional override
    retrain_every: int = 5            # matches TS retrainEvery = 5
    horizons: tuple[int, ...] = (3, 6, 12, 18)
    expanding: bool = True            # True=expanding, False=fixed 180-month rolling
    fixed_window_months: int = 180    # only when expanding=False
    min_positive_class: int = 1       # matches TS hasPos/hasNeg check
    calibrate: str = "last_30pct"     # or "cv5"

def walkforward(
    frame: pd.DataFrame,              # time-indexed features + 'recession' label
    ensemble_factory: Callable[[], NIVEnsemble],
    config: WalkForwardConfig,
    conformal: SplitConformal | None = None,
) -> WalkForwardResult:
    ...
```

`WalkForwardResult` carries: per-horizon AUC, Brier, F1@50%, optimal F1 +
threshold, ECE, per-step predictions with conformal bands, per-fold
feature importances (LR + AdaBoost), warnings (skipped folds, NaN rows),
and a `to_tearsheet()` method.

## Protocol D (`protocol_d.py`)

Separate module for the frozen forward test:

```python
def protocol_d(
    frame: pd.DataFrame,
    freeze_date: str,                 # e.g., "2022-12-31"
    ensemble: NIVEnsemble,
    horizons: tuple[int, ...] = (3, 6, 12, 18),
) -> ProtocolDResult:
    """
    Fit ensemble once on data ≤ freeze_date. Predict all months after
    freeze_date with zero retraining. Return ProtocolDResult with
    per-horizon AUC, Brier, and the frozen ensemble for inspection.
    """
```

## Orthogonal variance (`orthogonal_variance.py`) — NEW

Fills the documented gap. Regresses NIV on the benchmark with lags, then
reports residual variance fraction with a bootstrap 95% CI.

```python
@dataclass
class OrthogonalVarianceResult:
    fraction: float              # Var(residuals) / Var(niv)
    ci_95: tuple[float, float]   # bootstrap CI
    betas: dict[int, float]      # lag → coefficient
    benchmark_series: str
    n_obs: int

def orthogonal_variance(
    niv: pd.Series,
    benchmark: pd.Series,        # default T10Y3M
    lags: int = 6,
    bootstrap_iters: int = 500,
) -> OrthogonalVarianceResult:
    ...
```

Target: `fraction ≥ 0.35` (spec says 0.4171 but that number has no
documented provenance). Tearsheet reports the actual number, not the
spec target.

## BTUT integration (`btut_bridge.py`)

BTUT is an **optional** feature-selection preprocessor. The 12 features
in `oosTests.ts` are hand-picked; BTUT's role is to select 12 from a
larger augmented pool in a data-driven, auditable way.

```python
def thin_features(
    candidate_pool: list[FeatureSpec],   # from features.build_augmentation_pool()
    niv_frame: pd.DataFrame,
    target: int = 12,
    budget_dollars: float = 5.0,
) -> BTUTThinningResult:
    """
    Wraps run_btut_pipeline. Each FeatureSpec becomes a BTUT entity with
    type 'macro_feature'. Edges connect features sharing a source series.
    Returns the 12 survivors + a manifest showing diversity/reconstruction/
    anomaly scores per survivor.
    """
```

Kill switch: `NIVConfig(btut_thinning=False)` bypasses BTUT and uses the
hand-picked 12 features from the TS code. Vertical is never gated on BTUT.

## TCD-JEPA integration (`crystallization_bridge.py`)

```python
def register_modules(
    walkforward_result: WalkForwardResult,
    job_manager,
    granularity: Literal["per_fold", "per_year"] = "per_year",
) -> list[ModuleId]:
    """
    Convert each walk-forward fold (or year's aggregate) into a
    crystallization module descriptor. Submit via job_manager.enqueue_modules().
    Return module IDs so the tearsheet can link to them.
    """
```

Granularity default is `per_year` (~42 modules for full 504-month
history), not `per_fold` (~100 modules). Cheaper to crystallize, still
enough for regime clustering.

## LATK integration (`sovereign.py`)

Sovereign extension is a `NIVVertical` subclass that overrides `ingest()`
to pull non-US series. Everything else — formula, ensemble, OOS,
conformal, BTUT, crystallization — is inherited unchanged.

LATK routing: the sovereign NIV time series + feature fingerprint is
sent through LATK's existing `/api/v1/latk/route-to-ancestors` endpoint
to find the US macro regime that best matches the current sovereign
state. Outputs "your UAE liquidity state maps to US 2013-Q4" style
analogues.

## API surface (`api/v1/niv.py`)

Read-path:
```
GET  /niv/latest                        current month score + components + alert + bands
GET  /niv/history?start=&end=&smooth=   monthly time series
GET  /niv/components/{date}             breakdown for one month
GET  /niv/alert                         current alert envelope
GET  /niv/datasets                      US (default), UAE-sovereign (stub), ...
```

Compute-path:
```
POST /niv/ensemble/predict              body: {features|date, combiner?}
POST /niv/walkforward                   body: {start, end, horizons, combiner, vintage}
POST /niv/protocol-d                    body: {freeze_date, horizons}
POST /niv/orthogonal-variance           body: {benchmark_series, lags}
POST /niv/btut-thin                     body: {candidate_pool_size, target}
```

Artifact:
```
POST /niv/tearsheet                     body: {format, dataset, include_protocol_d}
GET  /niv/tearsheet/{id}
POST /niv/crystallize                   submits walk-forward to TCD-JEPA, returns module IDs
```

WebSocket `/ws/niv`: alert level changes, ingestion complete, walk-forward progress.

## Data flow & error handling

```
FRED/ALFRED → fred_adapter (real-time vintage, 90-day NN alignment) → Redis cache (TTL=7d)
→ features.build_frame() → formula.compute_frame() → NIVResult (raw + smoothed)
→ {btut_bridge.thin() if enabled} → ensemble.predict_proba → conformal.wrap
→ [tearsheet | crystallization_bridge | WebSocket push]
```

| Failure | Response |
|---|---|
| FRED 429 | Backoff (1s/2s/4s/8s), fall back to Redis cache, `stale: true` header |
| Missing months in a series | 90-day NN interpolation, wider gaps drop row with warning |
| NaN in derived features | `nan_guard` pattern, drop row, downgrade `prediction_quality` |
| Lookahead bias | `features.py` enforces `as_of` param, unit tests assert no leak |
| Empty positive class in fold | Skip fold, log, proceed (matches TS) |
| ALFRED vintage predates date | Fall back to latest vintage with red-flag header |

## Testing strategy

```
tests/unit/niv/
  test_formula_parity.py           1e-4 per-component vs Rust on 10 NBER months
  test_ensemble_learners.py        LR/AdaBoost/MLP vs sklearn references
  test_conformal.py                empirical coverage ≥ 1 - α
  test_orthogonal_variance.py      known-answer test
  test_walkforward_harness.py      deterministic seed reproducibility

tests/integration/niv/
  test_us_pipeline_end_to_end.py   FRED stub → scores → walkforward → tearsheet
  test_protocol_d_frozen.py        freeze 2022-12, predict 2023+, no retraining
  test_btut_bridge_optional.py     vertical still works with btut_thinning=False
  test_crystallization_bridge.py   descriptor matches job_manager schema

tests/parity/niv/
  test_against_regenerationism_spot_checks.py   6 dashboard dates, bit-parity with TS
```

Three tests are **merge gates**: formula-parity, ensemble-parity on six
known months, walk-forward reproducibility under a deterministic seed.

## Learning-mode contribution hooks

Five `NotImplementedError` stubs in the v1 code that diren fills. These
are the places where domain knowledge shapes the vertical and cannot be
inferred from the source:

1. **`formula.py::alert_level_from_probability()`** (5-8 lines) —
   alert ladder + action envelope (position-size, hysteresis, notify).
2. **`features.py::build_augmentation_pool()`** (8-12 lines) —
   which ~50 candidate features BTUT should select 12 from.
3. **`sovereign.py::UAELiquiditySandbox.ingest()`** (10-15 lines) —
   UAE macro data source list.
4. **`tearsheet.py::investment_thesis_paragraph()`** (6-10 lines) —
   3-5 sentence investor-facing thesis from NIV state.
5. **`crystallization_bridge.py::to_module_descriptor()`** (5-8 lines) —
   TCD-JEPA module descriptor shape.

Everything else ships as working code. These five are the contract.

## Open questions / risks

1. **No AUC ground truth.** The spec's "0.8538 at 18-mo" is not in the
   public docs. Whatever AUC the port produces becomes the Latent Ocean
   baseline. Mitigation: ship the number with provenance (model config,
   vintage, feature pool hash) so it's reproducible and auditable.
2. **ALFRED real-time vintage coverage.** ALFRED starts ~1994 for most
   series; earlier months will use latest vintage with a red flag.
3. **LATK lattice shape for time series.** LATK was built for text.
   Routing macro fingerprints through it is plausible but unproven —
   treat the sovereign LATK path as experimental in v1.
4. **Crystallization module descriptor schema** — I'll read
   `services/crystallization/job_manager.py` and match whatever it
   already accepts. If the shape needs to evolve, that's a TCD-JEPA
   change, not an NIV change.
5. **Rust→Python parity for bit-exactness** — some Rust operations
   (`f64::powf`, `tanh`) may differ from numpy by 1 ULP. Parity tolerance
   is `1e-4`, not bit-exact, and unit tests enforce this.

## Success criteria (v1 ship gate)

1. `/api/v1/niv/latest` returns a response in < 500 ms cold, < 50 ms warm.
2. Formula parity test passes on 10 NBER months with `1e-4` tolerance.
3. Ensemble parity test passes on 6 dashboard months with `1e-3`
   tolerance (per-learner) and `1e-2` on the combined output.
4. Walk-forward produces an AUC ≥ 0.75 at 12-month horizon on the US
   series (baseline sanity check, not a target).
5. Protocol D (freeze 2022-12) produces a forward-test AUC that is
   **reported**, not required to hit a threshold — the honesty matters
   more than the number.
6. `orthogonal_variance` reports a fraction with a bootstrap CI against
   T10Y3M; target ≥ 0.35, actual documented in the tearsheet.
7. BTUT bridge, crystallization bridge, and LATK routing all disable
   cleanly via config without breaking the rest of the vertical.
8. All five learning-mode hooks raise `NotImplementedError` with clear
   TODO docstrings; no ship-blocking defaults disguised as product
   decisions.

## References

- `regenerationism.ai/rust-engine/src/niv.rs` (formula, constants, clamp)
- `regenerationism.ai/rust-engine/src/fred.rs` (series list, NN alignment)
- `regenerationism.ai/frontend/lib/oosTests.ts` (walk-forward, learners, conformal, AUC)
- `regenerationism.ai/analysis/niv_analysis.py` (visualization, ROC)
- `docs/NIV_Out_of_Sample_Methodology_and_Results.md` (OOS protocol)
- `docs/NIV_Next_Gen_OOS_Framework.md` (feature list, retrain rules, Protocol D)
- `backend/app/services/btut/pipeline.py` (the BTUT bridge wraps this)
- `backend/app/services/crystallization/job_manager.py` (TCD-JEPA submission target)
- `backend/app/api/v1/latk.py` (LATK routing consumer)
