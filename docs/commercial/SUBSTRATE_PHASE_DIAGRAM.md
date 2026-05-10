# Substrate Phase Diagram — Overnight Campaign

Generated: 2026-05-05T10:23:16.761979Z

Total tests recorded: **158**  (completed: 157, errors: 1)
Perfect EFFECTIVE-purity (coverage-aware): **124 / 157** (79.0%)
Perfect raw module purity (uncorrected for coverage): **157 / 157**
Cumulative GPU cost: **$0.1029**

> Effective purity = `mean_module_purity × min(1, n_modules_discovered / n_classes_input)`. When the substrate produces fewer modules than ground-truth classes, the missing classes' entities are not represented in any module — raw purity overstates fidelity. Effective purity is the coverage-corrected number.

## Phase 1 — scale × class_count
Mean module purity at each (scale, class_count). Target: 1.000 perfect.

| entities \ classes | 2 | 4 | 8 | 16 | 32 | 64 |
| --- | --- | --- | --- | --- | --- | --- |
| 1000 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | ~0.500 | `0.250` |
| 2000 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | ~0.500 | `0.250` |
| 5000 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | ~0.500 | `0.250` |
| 10000 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | ~0.500 | `0.250` |
| 20000 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | ~0.500 | `0.250` |
| 50000 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | ~0.500 | `0.250` |
| 100000 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | ~0.500 | `0.250` |

**Boundaries:**
- n_entities: last perfect = 100000, first break = 1000
- n_classes: last perfect = 16, first break = 32

## Phase 2 — class × noise level
Noise = fraction of class signature tokens replaced with random-pool tokens.

| classes \ noise | 0.0 | 0.1 | 0.3 | 0.5 | 0.7 |
| --- | --- | --- | --- | --- | --- |
| 4 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **1.0000** |
| 8 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **1.0000** |
| 16 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **1.0000** |
| 24 | ~0.667 | ~0.667 | ~0.667 | ~0.667 | ~0.667 |
| 32 | ~0.500 | ~0.500 | ~0.500 | ~0.500 | ~0.500 |

**Boundaries:**
- noise_level: last perfect = 0.7, first break = 0.0

## Phase 3 — class × imbalance ratio
Imbalance ratio = largest class size / smallest class size (geometric distribution).

| classes \ imbalance | 1.0 | 10.0 | 100.0 | 1000.0 | 10000.0 |
| --- | --- | --- | --- | --- | --- |
| 4 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **1.0000** |
| 6 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **1.0000** |
| 8 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **1.0000** |
| 12 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **1.0000** |
| 16 | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **1.0000** |
| 24 | ~0.667 | ~0.667 | ~0.667 | ~0.667 | ~0.667 |

**Boundaries:**
- imbalance_ratio: last perfect = 10000.0, first break = 1.0

## Phase 4 — class × signature overlap
Overlap = fraction of signature tokens shared between classes.

| classes \ overlap | 0.0 | 0.25 | 0.5 | 0.75 |
| --- | --- | --- | --- | --- |
| 4 | **1.0000** | **1.0000** | **1.0000** | **1.0000** |
| 6 | **1.0000** | **1.0000** | **1.0000** | **1.0000** |
| 8 | **1.0000** | **1.0000** | **1.0000** | **1.0000** |
| 12 | **1.0000** | **1.0000** | **1.0000** | **1.0000** |
| 16 | **1.0000** | **1.0000** | **1.0000** | **1.0000** |
| 24 | ~0.667 | ~0.667 | ~0.667 | ~0.667 |

**Boundaries:**
- overlap_frac: last perfect = 0.75, first break = 0.0

## Phase 5 — Real-data suite

### TNA SIGINT (real)
| test | n_entities | classes | modules | mean_purity | mean_basin | AUC | exec_ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tna_npa100 | 600 | 6 | 6 | **1.0000** | **1.0000** | 0.8982 | 527 |
| tna_npa150 | 900 | 6 | 6 | **1.0000** | **1.0000** | 0.9041 | 619 |
| tna_npa200 | 1149 | 6 | 6 | **1.0000** | **1.0000** | 0.9179 | 574 |
| tna_npa300 | 1549 | 6 | 6 | **1.0000** | **1.0000** | 0.9238 | 2080 |
| tna_npa50 | 300 | 6 | 6 | **1.0000** | **1.0000** | 0.9073 | 441 |

### NSL-KDD intrusion (real)
| test | n_entities | classes | modules | mean_purity | mean_basin | AUC | exec_ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| nsl_npc1000_tc4 | 4000 | 4 | 4 | **1.0000** | **1.0000** | 0.9141 | 2067 |
| nsl_npc1000_tc6 | 6000 | 6 | 6 | **1.0000** | **1.0000** | 0.9053 | 663 |
| nsl_npc100_tc4 | 400 | 4 | 4 | **1.0000** | **1.0000** | 0.9245 | 334 |
| nsl_npc100_tc6 | 600 | 6 | 6 | **1.0000** | **1.0000** | 0.9023 | 375 |
| nsl_npc100_tc8 | 800 | 8 | 8 | **1.0000** | **1.0000** | 0.8954 | 1869 |
| nsl_npc250_tc4 | 1000 | 4 | 4 | **1.0000** | **1.0000** | 0.9018 | 384 |
| nsl_npc250_tc6 | 1500 | 6 | 6 | **1.0000** | **1.0000** | 0.9091 | 1935 |
| nsl_npc250_tc8 | 2000 | 8 | 8 | **1.0000** | **1.0000** | 0.921 | 467 |
| nsl_npc500_tc4 | 2000 | 4 | 4 | **1.0000** | **1.0000** | 0.9219 | 435 |
| nsl_npc500_tc6 | 3000 | 6 | 6 | **1.0000** | **1.0000** | 0.9009 | 505 |
| nsl_npc500_tc8 | 4000 | 8 | 8 | **1.0000** | **1.0000** | 0.919 | 530 |

## Phase 6 — Throughput burst

- 20 sequential 5K-entity / 8-class jobs against the warm worker.
- Mean GPU exec: 736 ms (σ 462)
- Mean wall: 12.4 s
- Sustained throughput: **6,789 entities / sec / H100**
- Perfect-purity runs: 20 / 20


## Headline
- 124 of 157 tests at perfect (≥0.999) EFFECTIVE purity.
- 157 of 157 tests at perfect raw purity (uncorrected for coverage).
- Total GPU spend: **$0.1029**.
- Boundary discovery: see Phase 2 (noise tolerance), Phase 3 (rare-class detection),
  Phase 4 (signature overlap) for the first-break / last-perfect axis values.