# Defense Megatest — Design Spec

**Date:** 2026-04-28
**Owner:** Latent Ocean (lsx)
**Status:** Approved scope; implementation starting same day
**Companion:** `docs/superpowers/specs/2026-04-28-defense-tear-sheet-design.md` (v1.0 tear sheet, superseded by v2.0 produced from this megatest)

## Purpose

Replace the existing internal-consistency-grade validation (`scripts/commercial_validation.py`) with a defense-grade harness that proves external predictive validity, real processing throughput on raw inputs, adversarial robustness, and compliance posture. The output drives a v2.0 master tear sheet whose proof-points survive a hostile DARPA / IARPA / MITRE / SES technical review.

The megatest exists because the existing harness tests the SDK against cached BTUT survivors (a self-consistency check), not the BTUT pipeline against raw inputs (the load-bearing claim). For commercial-finance pitching, the cached-results approach is fine because findings audit cleanly to public 10-Ks. For defense pitching, no equivalent verification shortcut exists, so the methodology has to stand on its own.

## What the megatest proves that the current harness does not

1. **Processing throughput on raw inputs** (entities/sec through the full 8-tier pipeline), not cached `score()` lookups.
2. **External predictive validity** (precision/recall/F1 against ground-truth injected anomalies), not internal score-metric overlap.
3. **Determinism from raw inputs** (identical synth corpus → identical survivors), not JSON-load determinism.
4. **Adversarial robustness** (does the algorithm survive controlled perturbation, mimicry, layering?).
5. **Multi-vertical coverage** (8 defense data shapes, not just SEC filings).
6. **Head-to-head comparison** against open baselines (Isolation Forest, Local Outlier Factor) where applicable.
7. **Compliance assertions** (access log structure, WORM append-only, classification deny-by-default, SIEM export schema).

## Scope

### Eight verticals (each deep)

| # | Vertical | Synth corpus shape | Anomaly injection | Predictive validity metric |
|---|---|---|---|---|
| 1 | All-source / fused intelligence | Cable messages: text + numeric + type (HUMINT/SIGINT/IMINT) | Novel actor combinations with unusual urgency-for-topic | precision@k, recall@k, F1, lift |
| 2 | SIGINT / COMINT | Emitter events: freq, bandwidth, mod-type, duration | Novel freq-mod combos, burst-pattern outliers | recall@k on novel emitters |
| 3 | EW spectrum management | Spectral observations: freq, hop-rate, agility, dwell | Novel emissions, coordinated-jammer patterns | recall@k on novel emissions |
| 4 | Counter-UAS / counter-MASINT | Multi-modal tracks: RF + acoustic + IR + kinematic | Track behavior outliers, low-observable threats | precision@k on threat tracks |
| 5 | PNT integrity | Multi-receiver GPS readings with consensus delta | Spoofing events (low individual residual, cross-receiver mismatch) | spoofing detection rate |
| 6 | Imagery / geospatial | Event tracks: lat, lon, speed, heading, AIS-consistency | Spatial outliers (out-of-lane vessels, ADS-B holes) | precision@k on spatial outliers |
| 7 | Network / cyber forensics | Flow records: bytes, duration, packet entropy, dst port | C2 patterns, beaconing, asymmetric flows | precision/recall on C2 detection |
| 8 | Logistics / counter-threat finance | Transactions: vendor, country, commodity, amount | Sanctions evasion: shell-company markers, layering, triangulation | precision/recall on injected patterns |

Each vertical produces a `VerticalResult` with: corpus_size, n_anomalies, n_recovered_in_top_k, precision, recall, f1, lift_vs_random, btut_wall_seconds, baseline_results.

### Five cross-cutting tests

1. **Determinism from raw inputs**: Run BTUT twice on identical synth corpus, hash survivor lists, compare. Bit-identical or fail.
2. **Real throughput on raw inputs**: entities/sec through the full pipeline (not cached lookup), aggregated across all 8 verticals.
3. **Air-gap proof**: existing test, kept (clean claim, scoped to SDK surface).
4. **Compliance assertions**: access-log structure validation, WORM append-only proof, classification deny-by-default proof, SIEM export schema.
5. **Resource profile**: peak memory, wall-clock, per-vertical breakdown.

### Baselines (head-to-head where applicable)

- **Isolation Forest** (sklearn) — for tabular numeric verticals
- **Local Outlier Factor** (sklearn) — for tabular numeric verticals
- **Skipped** for verticals where the baseline doesn't natively handle the data shape (e.g., text-heavy all-source); noted in the report

The baseline runs the same anomaly detection task: rank entities, take top-k, count how many were injected anomalies. Same metric, different ranker.

## Output artifacts

- `data/validation/defense_megatest.json` — raw artifact, fully reproducible, every test seeded
- `docs/commercial/defense/MEGATEST_REPORT.md` — human-readable, per-vertical pass/fail, methodology footnote
- `docs/commercial/defense/master-tear-sheet-v2.md` — new tear sheet with grounded numbers (companion to v1.0, both anchored separately)
- Updated `docs/commercial/defense/HASHES.md` — adds v2 hashes alongside v1

## Implementation layout

```
scripts/defense_megatest/
    __init__.py
    run.py              # orchestrator, CLI entry
    synth.py            # 8 corpus generators
    runner.py           # BTUT pipeline wrapper, baseline runners
    metrics.py          # precision/recall/f1/lift helpers
    adversarial.py      # perturbation patterns
    compliance.py       # access log, WORM, classification, SIEM tests
    report.py           # markdown report writer
```

Single command to run: `python -m scripts.defense_megatest.run [--quick|--full]` or `python scripts/defense_megatest/run.py`.

## Discipline

- **Every test seeded.** seed=42 throughout.
- **Every threshold documented** with rationale in code comments.
- **Every failure mode named.** Where a test produces a weak result, the report says so; no overclaiming.
- **Methodology footnote** in MEGATEST_REPORT.md distinguishes external-validity claims from internal-consistency claims; pre-empts the methodology challenge.
- **Pass/fail thresholds** explicit per test: e.g., "BTUT recall@k >= 60% AND lift >= 5× random" → pass.
- **Wall-clock budgets**: `--quick` < 5 minutes; `--full` < 30 minutes on commodity laptop.
- **Voice rules** for tear sheet v2.0: no first-person, no em dashes in displayable text. Trade-secret IP framing only.
- **Public-capability layer only.** Tear sheet does not expose specific signal weights, fingerprint resolution counts, prompt scaffolding, or any other trade-secret internal.

## Out of scope

- Real classified data (none used; synthetic only)
- Named-vendor head-to-head benchmarks (would need their data; open baselines only)
- Hardware-in-the-loop (PNT receivers, RF spectrum analyzers — synthetic only)
- ATO-grade documentation package (separate, larger effort)

## Verification of the megatest itself

Megatest must be self-deterministic: running it twice produces bit-identical artifacts (modulo wall-clock fields, which are excluded from the determinism hash). The artifact's content hash is recorded in `HASHES.md` for v2.0 OTS anchoring.
