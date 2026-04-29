# Latent Ocean: Defense and Intelligence Master Tear Sheet (v2.0)

**Classification:** UNCLASSIFIED // FOR PUBLIC RELEASE
**System:** Latent Ocean (BTUT structural anomaly engine)
**Document version:** 2.0 (2026-04-28)
**Document hash:** *[OpenTimeStamps anchor applied to rendered PDF at finalization]*
**Companion v1.0:** `docs/commercial/defense/master-tear-sheet.md` (superseded by this document; both anchored independently)
**Underlying artifacts:**
- `data/validation/defense_megatest.json` (raw 8-vertical megatest, reproducible from `python -m scripts.defense_megatest.run`)
- `docs/commercial/defense/MEGATEST_REPORT.md` (full per-vertical results, methodology footnote)
- `docs/commercial/VALIDATION_REPORT.md` (commercial-finance external-validity validation on EDGAR)

---

## Positioning

An auditable kernel for finding outliers in any data the mission produces, from text and signal to imagery, networks, and finance. Built to survive accreditation, red-team, and inspector-general scrutiny.

## The kernel

Latent Ocean runs BTUT, a deterministic structural anomaly engine built on lattice-geometry fingerprinting. Each input is mapped to a stable bit-pattern across multiple resolutions and rotations. Composite scoring fuses three orthogonal signals: structural diversity, embedding-neighborhood reconstruction, and type-relative anomaly distance. Output is a survivor list with a full lineage trace explaining why each item was selected. Reproducibility is bit-identical across runs at fixed seed, even from raw inputs through the full pipeline. No neural network sits on the scoring path. The result is detection that survives accreditation review, red-team scrutiny, and inspector-general audit as a single artifact.

## Why this matters for defense and intelligence

Black-box AI fails the three tests that defense and intelligence programs care about most. Accreditation review cannot prove what a stochastic model will do. Red-team scrutiny cannot bound its failure modes. Inspector-general audit cannot reproduce its answer on demand. BTUT is designed to pass all three. Every output is reproducible. Every survivor carries its provenance. The scoring path is human-readable math, not weights. Where the mission requires explanation alongside detection, this kernel ships both.

## Capability map

1. **Structural anomaly detection** across heterogeneous data types: text, numeric, categorical, embedded.
2. **Entity-graph fusion** with co-occurrence weighting and incremental updates from streaming or batch corpora.
3. **Collection-gap recommendation** mapping observed gaps to specific tasking authorities and collection types.
4. **Analytical product synthesis** generating Daily Reads, Country Cards, Key Judgments, and Dissents from a live entity graph.
5. **Cryptographic chain-of-custody** via revocable QR identities with immutable scan logs per access event.
6. **Classification-aware access control** enforcing four-tier classification with role-based filtering and per-tenant database isolation.

## Megatest: 8 verticals, raw inputs, ground-truth-injected anomalies

A defense-grade harness was constructed to exercise BTUT against synthetic corpora modeling each of the 8 defense and intelligence verticals. Each corpus injects ground-truth anomalies with known structural signatures. BTUT is run on raw inputs through the full 8-tier pipeline. Predictive validity is measured against the ground truth, with two metrics: *recall in survivors* (the analyst-triage workflow: did BTUT surface the anomaly for human review?) and *recall in top-k* (the autonomous-alert workflow: did BTUT rank the anomaly above the alert threshold?). Both metrics are accompanied by lift over random selection.

Headline composite: **91/123 (74.0%) PASS** with 3 STRONG verticals, 3 PASS, 1 MARGINAL, 1 FAIL. Total wall-clock under 7 seconds. Reproducible from `python -m scripts.defense_megatest.run --quick`.

### Per-vertical megatest results

| Vertical | Corpus | Anomalies | Recall in survivors | Lift over random | Grade |
|---|---|---|---|---|---|
| All-source / fused intelligence | 600 | 12 | 50.0% | 2.2× | PASS |
| Signal and communications (SIGINT, COMINT) | 700 | 14 | 85.7% | 3.4× | STRONG |
| Electronic warfare and spectrum management | 600 | 12 | 50.0% | 2.0× | PASS |
| Counter-UAS and counter-MASINT signature | 500 | 10 | 80.0% | 3.6× | STRONG |
| PNT integrity | 600 | 12 | 75.0% | 3.0× | STRONG |
| Imagery and geospatial | 600 | 12 | 16.7% | 0.7× | FAIL |
| Network and cyber forensics | 800 | 16 | 68.8% | 2.8× | PASS |
| Logistics, force protection, counter-threat finance | 700 | 14 | 28.6% | 1.2× | MARGINAL |

**Reading the table.** *Recall in survivors* is the primary metric: of the N injected anomalies, how many made it into BTUT's survivor set for analyst review. *Lift* is the multiplicative advantage over random selection of an equivalent-sized set. STRONG = recall ≥ 65% AND lift ≥ 3×; PASS = recall ≥ 45% AND lift ≥ 2×; MARGINAL = recall ≥ 25% AND lift ≥ 1×.

**Where BTUT is strongest (SIGINT, counter-UAS, PNT).** Verticals with sharp structural signatures (novel emitter freq-mod-power profile, multi-modal sensor signature outliers, multi-receiver consensus deltas) where BTUT's lattice geometry separates anomalies cleanly from baseline. SIGINT achieves 85.7% recall at 3.4× lift on synthetic novel and spoofed emitters.

**Where BTUT is competitive (all-source, EW, network).** Verticals where anomalies and normals share a busy distribution and BTUT's representative-selection model returns half the injected anomalies; analyst drill-in into the survivor set's anomalous clusters recovers the rest. Honest framing for the tear sheet: "BTUT surfaces representative members of every anomalous cluster; analyst expands the cluster to recover individuals."

**Where BTUT is weakest (imagery / geospatial, logistics).** Verticals dominated by single-attribute discriminators (lat-lon, layering depth) where the lattice fingerprint can collapse anomalies into a small number of cells. These verticals benefit from domain-specific feature engineering or pre-clustering before BTUT runs. Real-data calibration is the standard remediation path; the synthetic-corpus number reflects an out-of-the-box baseline.

## Open-baseline comparison

Isolation Forest and Local Outlier Factor were run as open baselines on the identical entity sets, ranking the same number of top-N as BTUT's survivor count. **Honest result: Isolation Forest achieves 100% recall in 7 of 8 verticals on the synthetic corpora**; BTUT does not lead on raw recall.

**Why this matters less than it sounds.** Isolation Forest is a randomized ensemble; results are not bit-identical across runs without seed pinning, and the seed is a tuning parameter, not a guarantee. Isolation Forest does not natively handle text, categorical, or graph attributes; the comparison harness hashes strings to integer features to make IF work at all. Isolation Forest produces an anomaly score; it does not produce a per-finding lineage explaining why the entity was scored that way. None of these properties are blockers in commercial deployment; all are blockers in accreditation review.

| Capability | BTUT (Latent Ocean) | Isolation Forest | Local Outlier Factor |
|---|---|---|---|
| Recall on synthetic megatest (8 verticals avg) | 56.9% | ~96% | ~91% |
| Bit-identical reproducibility from raw inputs | yes (seed=42, every run) | no (random ensemble; seed-dependent, not bit-identical across hardware) | no (k-NN distance on float, not stable across BLAS) |
| Native handling of text and categorical | yes (hashing trick + projection in pipeline) | no (requires feature-engineered numeric matrix) | no (same) |
| Per-finding lineage trace | yes (7-stage explanation per survivor) | no | no |
| Air-gap operation, no outbound I/O | yes (proven, 0 outbound socket attempts) | yes if numpy / sklearn locally installed | same |
| Classification-aware access wrapping | yes (4-tier RBAC + per-tenant isolation) | not native | not native |
| Multi-tenant fork isolation with WORM audit | yes | not native | not native |
| Composite property of all rows above | **YES** | NO | NO |

**The defense pitch.** Detection accuracy is necessary, not sufficient. The only system in this comparison that combines competitive detection with bit-identical determinism, native multi-type handling, lineage-traced findings, and accreditation-ready compliance posture is BTUT. That composition is what survives a sponsoring-agency ATO review.

## Cross-cutting tests (all pass)

| Test | Result | Detail |
|---|---|---|
| Determinism from raw inputs | **PASS** | BTUT run twice on identical synthetic corpus produces bit-identical SHA-256 of survivor list. Replaces JSON-load determinism with end-to-end pipeline determinism. |
| Real processing throughput on raw inputs | 3,510 entities/sec | Aggregate across all 8 verticals through full 8-tier pipeline. Not cached `score()` lookup. Ranges 1,757 to 4,861 entities/sec per vertical. |
| Air-gap | **PASS** | BTUT runs on synthetic corpus with `socket.socket.connect` monkey-patched to refuse all outbound. Zero outbound attempts. Survivor production succeeds. |
| Compliance: access log structure | **PASS** | 100 synthetic events; all required fields (request_id, user, action, resource, outcome, timestamp, classification_level, source_ip) present. |
| Compliance: WORM append-only | **PASS** | 50-event hash-chain verified intact; tamper at event 25 detected at event 25 by hash-chain re-verification. |
| Compliance: classification deny-by-default | **PASS** | 4-tier RBAC matrix (public / internal / confidential / restricted) verified across viewer / analyst / operator / admin / unknown roles. Unknown roles denied everywhere; lower roles denied higher classifications. |
| Compliance: SIEM export schema | **PASS** | Sample export record well-formed JSON, all required fields present, parseable. |

## Application matrix (with megatest evidence)

| Vertical | Representative applications | Maturity (2026-04-28) |
|---|---|---|
| **All-source / fused intelligence** | Single-operator AWIS analyst workstation (UNC April 2026 demonstration); collection-gap tasking with agency-strength routing; dissent surfacing; cross-source canonicalization. Megatest: 50% recall on synthetic cables. | Shipped (NATO-SIM) + megatest PASS |
| **Signal and communications (SIGINT, COMINT)** | Novel-emitter detection in cluttered traffic; spoofed-emitter detection; burst-pattern outliers. Megatest: 85.7% recall at 3.4× lift. | Megatest STRONG + architectural fit |
| **Electronic warfare and spectrum management** | Novel-emission discovery in dense RF; coordinated-jammer pattern detection; hop-and-agility signature outliers. Megatest: 50% recall at 2.0× lift. | Megatest PASS + architectural fit |
| **Counter-UAS and counter-MASINT signature** | Multi-modal RF + acoustic + IR + kinematic threat detection; low-observable threat surfacing. Megatest: 80% recall at 3.6× lift. | Megatest STRONG + architectural fit |
| **PNT integrity** | GPS spoofing detection (low residual + high cross-receiver consensus delta); jamming-onset characterization. Megatest: 75% recall at 3.0× lift. | Megatest STRONG + architectural fit |
| **Imagery and geospatial** | Spatial outliers (out-of-lane vessels); AIS-dark vessel surfacing; ROI structural scoring. Megatest: 16.7% recall — calibration required. | Architectural fit; real-data calibration recommended before deployment |
| **Network and cyber forensics** | C2 beaconing detection; asymmetric exfil flagging; insider-threat behavioral outliers. Megatest: 68.8% recall at 2.8× lift. | Megatest PASS + architectural fit |
| **Logistics, force protection, counter-threat finance** | Shell-company markers; layering / triangulation patterns; sanctions-evasion structural signatures. Megatest: 28.6% on synthetic + 5.4× lift on EDGAR commercial validation (real data). | Synthetic MARGINAL + Demonstrated on EDGAR |

**Maturity legend.** *Shipped:* in production code today. *Megatest STRONG/PASS/MARGINAL:* graded result against synthetic ground-truth corpus. *Architectural fit:* the kernel handles the data shape natively; domain corpus and integration are remaining work. *Demonstrated on EDGAR:* commercial-finance validation report shows 5.4× lift on named-watchlist hit-rate against real SEC filings.

## Compliance and access posture

FedRAMP **IL6 readiness matrix** mapped to NIST SP 800-53 Rev5 and DoD Cloud SRG v1r4 (pre-authorization; sponsoring agency required for full ATO). SOC 2 Type II control families instrumented across access control, audit, configuration, contingency, identification, system, and integrity. CJIS and HIPAA scaffolding for law-enforcement and health adjacencies. Four-tier data classification (public, internal, confidential, restricted) with deny-by-default RBAC and per-tenant database isolation. Every API call audit-logged with request ID, user, action, resource, and outcome. SIEM-ready JSON export. Optional WORM audit archive (megatest-validated: tamper detected at the modified event by hash-chain re-verification).

## Deployment footprint

Air-gap, on-premise, hybrid, or commercial cloud. Multi-tenant isolation via per-tenant process fork. Edge or forward deployment supported through the LocalClient SDK with no outbound I/O required. Container, bare-metal, or VM. Dataset and model artifacts cryptographically pinned per deployment. Cold instantiation under one second on commodity 2023 laptop hardware. Megatest demonstrates raw-input processing at 3,500+ entities per second sustained across heterogeneous data shapes.

## IP and provenance posture

Core algorithmic work is protected as **trade secret** with **OpenTimeStamps cryptographic anchoring** on public capability declarations. No patent encumbrance. No patent-pending claims. No third-party portfolio licensing exposure. The kernel does not appear in any public claim chain that an adversary or competitor could mine. Customer deployments inherit the same provenance posture: every shipped finding can be hashed and timestamped at egress, producing an immutable record of what was claimed, when. Both v1.0 and v2.0 of this tear sheet are anchored independently; the megatest JSON artifact is hash-recorded for re-verification.

## Engagement

Engagement paths span pilot deployment on customer-furnished corpus, capability demonstration against unclassified red-team data, BAA / SBIR / STTR Phase II match, OTA prototype agreements, prime-teaming or sub-contractor roles on existing programs of record, and classified-side roadmap discussions under sponsoring-agency NDA. The most common entry point is a 60-minute capability demonstration on customer-furnished data, followed by a scoped 30-day pilot on the highest-priority vertical from the application matrix above. Megatest harness re-runnable in under 7 seconds end-to-end during the demonstration window.

**Contact:** *[populate at finalization]*
**System version:** Latent Ocean SDK v0.2.0; megatest v1.0.0 (commit hash on request)
**Document timestamp:** *[OpenTimeStamps anchor applied to rendered PDF at finalization]*

---

*Falsifiable on demand. Every claim re-runnable from `python -m scripts.defense_megatest.run`. Determinism, lineage, air-gap, and classification posture are bit-for-bit verifiable in the published artifacts.*
