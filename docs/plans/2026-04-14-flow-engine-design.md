# Flow Engine Design — Universal Data Flow Primitives

**Date:** 2026-04-14
**Status:** Approved
**Origin:** Abstraction of NIV (National Impact Velocity) vertical into domain-agnostic flow engine

## Motivation

Latent Ocean is a universal engine. NIV's Bloomberg-grade macro command center, while technically strong, is an economics-specific model. The valuable patterns inside NIV — liquidity measurement, friction modeling, alert hysteresis, ensemble disagreement, conformal uncertainty, walk-forward validation — are universal. This design extracts those patterns into a graph-based flow engine that any vertical can use.

The economics-specific wrapper (FRED adapter, recession probability, UAE sovereign sandbox, tearsheet generation) is retired.

## Core Abstractions

### 1. Well (Self-Diagnosing Data Reservoir)

A well accumulates data from one or more sources and maintains sensor readings about its own state.

**Sensor readings (all normalized to [0, 1]):**

| Sensor | Definition |
|--------|-----------|
| Saturation | How full the well is relative to its capacity |
| Conversion Rate | Ratio of useful output produced to raw input received |
| Impulse | Rate of new data arriving (first derivative of volume) |
| Staleness | Time since last meaningful update, normalized against expected cadence |

A well exposes a **health vector** — the tuple of all sensor readings. This is the unit of observation for all downstream analytics.

**Well states:** `active`, `saturated`, `starved`, `dormant`

### 2. Wire (Directed Connection with Liquidity)

A wire connects two wells (source → sink) and measures flow characteristics.

**Liquidity score** (composite):
- **Throughput** — volume of data transferred per unit time
- **Readiness** — latency to first byte; how quickly the wire can respond to demand

Both are measured from actual traffic, not configured.

**Friction coefficient** (composite, derived from):
- Error rate on the wire
- Retry count / backpressure signals
- Queue depth at the sink well

**Wire states:** `flowing`, `throttled`, `blocked`, `dormant`

### 3. FlowGraph (Directed Graph of Wells + Wires)

The FlowGraph is the system-level structure. It computes aggregate metrics from well health vectors and wire liquidity scores.

**System-level metrics:**

| Metric | Computation | Reveals |
|--------|-------------|---------|
| Resilience | Min-cut of the flow graph (wire failures before a well is isolated) | Structural robustness |
| Circulation Rate | Sum of (liquidity x throughput) across all active wires | System vitality |
| Saturation Pressure | Max well saturation minus mean capacity headroom | Proximity to overload |
| Friction Index | Demand-weighted mean of wire friction | Overall systemic drag |
| Recovery Time | Simulated wire failure → time for flow to redistribute via alternate paths | Adaptive capacity |
| Cascade Depth | BFS depth from most-saturated well to terminal wells | Blast radius of failure |

## Meta-Patterns Extracted from NIV

These operate on the FlowGraph's time-series of metrics. They are domain-agnostic.

### Alert Hysteresis

The state machine pattern from NIV's AlertEnvelope, generalized:
- Four levels: `normal` → `elevated` → `warning` → `critical`
- Each metric defines an **escalation threshold** and a **de-escalation band** (prevents flip-flopping)
- Wells and wires each have their own alert state
- FlowGraph aggregates into a system-level alert (worst-of or weighted)

### Conformal Uncertainty Bands

From NIV's SplitConformal, applied to any metric that changes over time:
- Rolling nonconformity window (default 100 observations)
- Adapts to regime changes automatically
- Applied to: resilience, circulation rate, individual wire liquidity

### Ensemble Disagreement as Signal

When multiple estimation methods disagree on a metric, the disagreement itself is information:
- For any derived metric, run 2-3 estimators
- Expose a **disagreement score** — high disagreement = ambiguous state worth investigating
- Estimators are metric-specific, not tied to NIV's LR/AdaBoost/MLP

### Walk-Forward Validation

Any predictive model in the system gets validated via expanding-window walk-forward:
- Warmup period, configurable retrain cadence, horizon-based metrics (AUC, Brier, F1)
- This is the quality gate — no predictive metric ships without walk-forward evidence

## Integration with Latent Ocean

### Well Mapping

Each existing vertical becomes a well:
- **BTUT Well** — the 13-file MFG data reduction system
- **TCD-JEPA Well** — crystallization pipeline
- **Data Estate Well** — enterprise data layer
- **DUNC Well** — simulation engine

External data sources (FRED, HuggingFace Hub, user uploads) are **source wells** with no inbound wires.

### Wire Discovery

Wires are **discovered by observing actual data flow**, not manually configured:
- BTUT → TCD-JEPA (feature thinning pipeline)
- TCD-JEPA → Data Estate (crystallized modules)
- External sources → respective verticals

### Service Placement

- New backend service: `backend/app/services/flow_engine/`
- Sits alongside existing verticals — observes and measures, does not orchestrate
- API endpoints for: graph state, per-well health, per-wire liquidity, system-level resilience
- Frontend visualization: live flow graph with liquidity/health overlays

## NIV Retirement Plan

### Extracted into flow_engine (lives on):
- Alert hysteresis state machine → `flow_engine/alerts.py`
- Conformal band computation → `flow_engine/conformal.py`
- Ensemble disagreement pattern → `flow_engine/ensemble.py`
- Walk-forward validation harness → `flow_engine/walkforward.py`
- Drag concept → generalized as wire friction

### Retired (economics-specific):
- NIV formula (thrust/efficiency²/slack/drag with calibrated weights)
- FRED data adapter and 7-series pipeline
- Recession probability sigmoid transform
- UAE sovereign sandbox
- Tearsheet generation with investment thesis
- NBER recession date hardcoding
- All NIV-specific schemas, API endpoints, and frontend components

## Domain Application: Regenerationism

The flow engine metrics map directly to regenerative system concepts:

| Flow Engine Metric | Regenerationism Interpretation |
|-------------------|-------------------------------|
| Resilience | Ecosystem health / structural integrity |
| Circulation Rate | Nutrient cycling / resource flow |
| Saturation Pressure | Carrying capacity proximity |
| Friction Index | Systemic resistance to regeneration |
| Recovery Time | Regenerative capacity |
| Cascade Depth | Vulnerability propagation depth |

This mapping is not built into the engine — it's a consumer-side interpretation. The engine stays domain-agnostic.
