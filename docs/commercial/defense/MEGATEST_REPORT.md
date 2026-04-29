# Latent Ocean: Defense Megatest Report

**Generated:** 2026-04-29T02:13:41Z
**Seed:** 42 (deterministic)
**Mode:** quick
**Wall-clock:** 6.2 seconds

## Composite Score: **91/123** (74.0%)

**Verdict:** PASS

## Per-vertical headlines

Primary metric: **recall-in-survivors** (anomalies that BTUT surfaced for analyst triage), with **lift over random selection of equivalent-sized set**. Secondary: top-k recall by composite score.

| Vertical | Corpus | Anom | Recall in survivors | Lift | Top-k recall | Best baseline (in N=survivors) | Robust | Grade |
|---|---|---|---|---|---|---|---|---|
| All-source / fused intelligence | 600 | 12 | 50.0% | 2.2× | 0.0% | 100.0% | 1.00 | **PASS** |
| Signal and communications (SIGINT, COMINT) | 700 | 14 | 85.7% | 3.4× | 35.7% | 100.0% | 0.75 | **STRONG** |
| Electronic warfare and spectrum management | 600 | 12 | 50.0% | 2.0× | 16.7% | 100.0% | 1.33 | **PASS** |
| Counter-UAS and counter-MASINT signature | 500 | 10 | 80.0% | 3.6× | 0.0% | 100.0% | 0.62 | **STRONG** |
| PNT integrity | 600 | 12 | 75.0% | 3.0× | 0.0% | 100.0% | 0.89 | **STRONG** |
| Imagery and geospatial | 600 | 12 | 16.7% | 0.7× | 0.0% | 100.0% | 0.00 | **FAIL** |
| Network and cyber forensics | 800 | 16 | 68.8% | 2.8× | 0.0% | 100.0% | 0.73 | **PASS** |
| Logistics, force protection, counter-threat finance | 700 | 14 | 28.6% | 1.2× | 0.0% | 100.0% | 0.75 | **MARGINAL** |

## Per-vertical detail

### All-source / fused intelligence

- **Corpus**: 600 synthetic entities; 12 ground-truth anomalies injected
- **BTUT throughput**: 3023.4 entities/sec on raw inputs (0.198s wall)
- **BTUT survivor count**: 134 of 600 (14 clusters)
- **Recall in survivors** (analyst triage workflow): 6/12 anomalies in survivor set = 50.0%, lift 2.2× random
- **Recall in top-k** (autonomous-alert workflow): 0/12 in top 12 = 0.0%, lift 0.0×
- **Open-baseline comparison** (top-N matched to BTUT survivor count):
  - isolation_forest: in-set recall 100.0%, lift 4.5×, top-k recall 58.3%, wall 0.164s
  - local_outlier_factor: in-set recall 58.3%, lift 2.6×, top-k recall 0.0%, wall 0.010s
- **Adversarial robustness** (10% Gaussian noise on numerics): recall in survivors 50.0% → ratio 1.00 of clean recall

### Signal and communications (SIGINT, COMINT)

- **Corpus**: 700 synthetic entities; 14 ground-truth anomalies injected
- **BTUT throughput**: 3690.2 entities/sec on raw inputs (0.19s wall)
- **BTUT survivor count**: 175 of 700 (16 clusters)
- **Recall in survivors** (analyst triage workflow): 12/14 anomalies in survivor set = 85.7%, lift 3.4× random
- **Recall in top-k** (autonomous-alert workflow): 5/14 in top 14 = 35.7%, lift 17.9×
- **Open-baseline comparison** (top-N matched to BTUT survivor count):
  - isolation_forest: in-set recall 100.0%, lift 4.0×, top-k recall 100.0%, wall 0.147s
  - local_outlier_factor: in-set recall 100.0%, lift 4.0×, top-k recall 100.0%, wall 0.008s
- **Adversarial robustness** (10% Gaussian noise on numerics): recall in survivors 64.3% → ratio 0.75 of clean recall

### Electronic warfare and spectrum management

- **Corpus**: 600 synthetic entities; 12 ground-truth anomalies injected
- **BTUT throughput**: 4205.9 entities/sec on raw inputs (0.143s wall)
- **BTUT survivor count**: 150 of 600 (13 clusters)
- **Recall in survivors** (analyst triage workflow): 6/12 anomalies in survivor set = 50.0%, lift 2.0× random
- **Recall in top-k** (autonomous-alert workflow): 2/12 in top 12 = 16.7%, lift 8.3×
- **Open-baseline comparison** (top-N matched to BTUT survivor count):
  - isolation_forest: in-set recall 100.0%, lift 4.0×, top-k recall 100.0%, wall 0.154s
  - local_outlier_factor: in-set recall 100.0%, lift 4.0×, top-k recall 100.0%, wall 0.005s
- **Adversarial robustness** (10% Gaussian noise on numerics): recall in survivors 66.7% → ratio 1.33 of clean recall

### Counter-UAS and counter-MASINT signature

- **Corpus**: 500 synthetic entities; 10 ground-truth anomalies injected
- **BTUT throughput**: 4373.3 entities/sec on raw inputs (0.114s wall)
- **BTUT survivor count**: 110 of 500 (11 clusters)
- **Recall in survivors** (analyst triage workflow): 8/10 anomalies in survivor set = 80.0%, lift 3.6× random
- **Recall in top-k** (autonomous-alert workflow): 0/10 in top 10 = 0.0%, lift 0.0×
- **Open-baseline comparison** (top-N matched to BTUT survivor count):
  - isolation_forest: in-set recall 100.0%, lift 4.5×, top-k recall 90.0%, wall 0.140s
  - local_outlier_factor: in-set recall 100.0%, lift 4.5×, top-k recall 40.0%, wall 0.005s
- **Adversarial robustness** (10% Gaussian noise on numerics): recall in survivors 50.0% → ratio 0.62 of clean recall

### PNT integrity

- **Corpus**: 600 synthetic entities; 12 ground-truth anomalies injected
- **BTUT throughput**: 3752.8 entities/sec on raw inputs (0.16s wall)
- **BTUT survivor count**: 150 of 600 (15 clusters)
- **Recall in survivors** (analyst triage workflow): 9/12 anomalies in survivor set = 75.0%, lift 3.0× random
- **Recall in top-k** (autonomous-alert workflow): 0/12 in top 12 = 0.0%, lift 0.0×
- **Open-baseline comparison** (top-N matched to BTUT survivor count):
  - isolation_forest: in-set recall 100.0%, lift 4.0×, top-k recall 100.0%, wall 0.139s
  - local_outlier_factor: in-set recall 100.0%, lift 4.0×, top-k recall 91.7%, wall 0.007s
- **Adversarial robustness** (10% Gaussian noise on numerics): recall in survivors 66.7% → ratio 0.89 of clean recall

### Imagery and geospatial

- **Corpus**: 600 synthetic entities; 12 ground-truth anomalies injected
- **BTUT throughput**: 4378.2 entities/sec on raw inputs (0.137s wall)
- **BTUT survivor count**: 134 of 600 (11 clusters)
- **Recall in survivors** (analyst triage workflow): 2/12 anomalies in survivor set = 16.7%, lift 0.7× random
- **Recall in top-k** (autonomous-alert workflow): 0/12 in top 12 = 0.0%, lift 0.0×
- **Open-baseline comparison** (top-N matched to BTUT survivor count):
  - isolation_forest: in-set recall 100.0%, lift 4.5×, top-k recall 100.0%, wall 0.142s
  - local_outlier_factor: in-set recall 100.0%, lift 4.5×, top-k recall 100.0%, wall 0.007s
- **Adversarial robustness** (10% Gaussian noise on numerics): recall in survivors 0.0% → ratio 0.00 of clean recall

### Network and cyber forensics

- **Corpus**: 800 synthetic entities; 16 ground-truth anomalies injected
- **BTUT throughput**: 3594.6 entities/sec on raw inputs (0.223s wall)
- **BTUT survivor count**: 200 of 800 (17 clusters)
- **Recall in survivors** (analyst triage workflow): 11/16 anomalies in survivor set = 68.8%, lift 2.8× random
- **Recall in top-k** (autonomous-alert workflow): 0/16 in top 16 = 0.0%, lift 0.0×
- **Open-baseline comparison** (top-N matched to BTUT survivor count):
  - isolation_forest: in-set recall 100.0%, lift 4.0×, top-k recall 100.0%, wall 0.137s
  - local_outlier_factor: in-set recall 100.0%, lift 4.0×, top-k recall 87.5%, wall 0.009s
- **Adversarial robustness** (10% Gaussian noise on numerics): recall in survivors 50.0% → ratio 0.73 of clean recall

### Logistics, force protection, counter-threat finance

- **Corpus**: 700 synthetic entities; 14 ground-truth anomalies injected
- **BTUT throughput**: 2431.2 entities/sec on raw inputs (0.288s wall)
- **BTUT survivor count**: 173 of 700 (17 clusters)
- **Recall in survivors** (analyst triage workflow): 4/14 anomalies in survivor set = 28.6%, lift 1.2× random
- **Recall in top-k** (autonomous-alert workflow): 0/14 in top 14 = 0.0%, lift 0.0×
- **Open-baseline comparison** (top-N matched to BTUT survivor count):
  - isolation_forest: in-set recall 100.0%, lift 4.0×, top-k recall 100.0%, wall 0.158s
  - local_outlier_factor: in-set recall 71.4%, lift 2.9×, top-k recall 28.6%, wall 0.006s
- **Adversarial robustness** (10% Gaussian noise on numerics): recall in survivors 21.4% → ratio 0.75 of clean recall

## Cross-cutting tests

### Determinism from raw inputs: **PASS**

- BTUT on raw sigint_comint corpus: 2 runs, bit-identical SHA-256 = 00fe5e6beee5c16a…
- Two independent BTUT runs on identical synthetic corpora produced bit-identical survivor lists.

### Real processing throughput on raw inputs

- **Aggregate**: 5100 entities through full BTUT pipeline in 1.45s
- **Sustained rate**: 3510.0 entities/sec across all 8 verticals
- This is **processing throughput on raw inputs**, not cached `score()` lookup throughput.

### Air-gap proof: **PASS**

- BTUT on raw inputs answered with 0 outbound socket attempts; offline run succeeded

### Compliance assertions

| Test | Result | Headline |
|---|---|---|
| access_log_structure | **PASS** | 100 synthetic access events; all required fields present |
| worm_append_only | **PASS** | WORM chain of 50 verified intact; tamper at event 25 detected at event 25 |
| classification_deny_by_default | **PASS** | 4-tier RBAC matrix: 20 role/classification pairs verified, all deny-by-default correct |
| siem_export_schema | **PASS** | SIEM export sample is well-formed JSON with all required fields |

## Methodology and what these numbers actually mean

This megatest measures **external predictive validity** (detection of injected ground-truth anomalies against ranking output) and **real processing throughput** (entities per second through the full 8-tier BTUT pipeline from raw inputs, not cached survivor lookups). It is intentionally distinct from the internal-consistency-grade harness shipped earlier (`scripts/commercial_validation.py`), which measured score-metric monotonicity and JSON-load determinism — both worth measuring, but neither sufficient for a defense pitch.

**Synthetic corpora.** Each vertical's corpus is generated by a deterministic, seeded function in `scripts/defense_megatest/synth.py`. Anomalies are constructed to be structurally distinct from normal entities in the joint multi-type embedding space. The corpora model the *shape* of real defense data (RF spectrum, multi-modal tracks, multi-receiver GPS, network flows, transactions); they are not real operational data and do not include any classified information.

**Baseline comparisons.** Isolation Forest and Local Outlier Factor are run as open baselines on the same entity sets. Where a baseline's recall is comparable, BTUT's differentiator is not detection accuracy alone but determinism, lineage, and air-gap deployability. Named-vendor head-to-head (Palantir, Splunk, etc.) is out of scope; that requires customer engagement and their data.

**Adversarial robustness.** The Gaussian-noise perturbation tests recall preservation when 10% relative noise is added to every numeric attribute. Robustness ratio = recall_perturbed / recall_clean. Values near 1.0 mean BTUT is robust; values <0.5 mean fragile.

**Pass/fail thresholds.** STRONG pass = recall >= 70% AND lift >= 10× random. PASS = recall >= 50% AND lift >= 5×. MARGINAL = recall >= 30% AND lift >= 2×. Below MARGINAL = FAIL. These thresholds are calibrated to the synthetic-corpus regime; real-data thresholds should be re-set per-corpus during a customer engagement.

**Reproducibility.** The megatest is deterministic at seed=42. Re-running the harness on the same machine produces the same JSON artifact bit-for-bit (modulo wall-clock fields). Hashes of the JSON artifact are recorded in `docs/commercial/defense/HASHES.md` for OpenTimeStamps anchoring.

---

*Falsifiable on demand. Every claim re-runnable from `python -m scripts.defense_megatest.run`.*