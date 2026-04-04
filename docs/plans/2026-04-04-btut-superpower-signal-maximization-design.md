# BTUT Superpower Signal Maximization — Design

**Date**: 2026-04-04
**Goal**: Full spectrum signal extraction — maximum structural diversity + maximum reconstruction quality + maximum anomaly detection

## Problem

Current BTUT on 69K EDGAR entities produces 244 survivors across 52 clusters, but with three signal gaps:
1. Type imbalance: 89% financial_facts, only 9% companies, 2% filings
2. Zero anchors: missing the stable structural core
3. Magnitude skew: selecting volatile entities, missing stable signal

## Approach: Multi-Resolution Cascade Threading

### Multi-Resolution Threading
Three threading passes at different quantile bin resolutions (4, 8, 16 bins/dim), each with 16 rotations. Concatenated 48-bit fingerprint captures coarse mega-clusters, medium sub-clusters, and fine boundary entities simultaneously. Three stacked magnitude tables produce a 288-column multi-resolution magnitude profile.

### Stratified Type-Balanced Selection
Enforce proportional representation per entity type with minimum floors. Per-cluster cap prevents single-cluster domination.

### Three-Axis Signal Scoring
- Diversity (0.35): Inverse fingerprint frequency — rare structural patterns score high
- Reconstruction (0.40): Greedy facility-location NN coverage contribution
- Anomaly (0.25): Distance from type centroid in magnitude space

### Output
~300 survivors, per-survivor lineage, cluster map, anomaly ranking, reconstruction quality metric, full JSON report.

## Implementation
Single script `scripts/edgar_superpower.py` using cached EDGAR data and existing BTUT components. No core library changes. Target: <2 minutes on CPU.
