# Latent Ocean: Defense and Intelligence Master Tear Sheet (v3.0)

**Classification:** UNCLASSIFIED // FOR PUBLIC RELEASE
**System:** Latent Ocean (BTUT structural anomaly engine)
**Document version:** 3.0 (2026-04-28)
**Document hash:** *[OpenTimeStamps anchor applied to rendered PDF at finalization]*
**Supersedes:** v1.0 (`master-tear-sheet.md`), v2.0 (`master-tear-sheet-v2.md`). All three versions remain anchored independently for provenance.
**Underlying artifacts (all reproducible):**
- `data/validation/defense_megatest_real_data.json` — KDDCUP99 (DARPA / MIT Lincoln Lab) BTUT vs Isolation Forest vs LOF
- `data/validation/competitive_backtest.json` — EDGAR distress prediction with 4 rankers + ground truth
- `data/validation/edgar_supervised_distress.json` — supervised distress prediction with cross-validation
- `data/validation/defense_megatest.json` — 8-vertical synthetic-corpus megatest (architectural fit)
- `docs/commercial/defense/MEGATEST_REPORT.md` — full per-vertical synthetic results
- `docs/commercial/VALIDATION_REPORT.md` — commercial-finance validation (some claims circular, see methodology note below)

---

## Positioning

An auditable kernel for finding outliers in any data the mission produces, from text and signal to imagery, networks, and finance. Built to survive accreditation, red-team, and inspector-general scrutiny.

## The kernel

Latent Ocean runs BTUT, a deterministic structural anomaly engine built on lattice-geometry fingerprinting. Each input is mapped to a stable bit-pattern across multiple resolutions and rotations. Composite scoring fuses three orthogonal signals: structural diversity, embedding-neighborhood reconstruction, and type-relative anomaly distance. Output is a survivor list with a full lineage trace explaining why each item was selected. Reproducibility is bit-identical across runs at fixed seed, even from raw inputs through the full pipeline. No neural network sits on the scoring path. The result is detection that survives accreditation review, red-team scrutiny, and inspector-general audit as a single artifact.

## Real defense-data validation (load-bearing)

### KDDCUP99 — DARPA Intrusion Detection Evaluation, MIT Lincoln Laboratory

**Provenance.** KDDCUP99 was developed at MIT Lincoln Laboratory under a DARPA-funded research program simulating U.S. Air Force LAN traffic with labeled cyber attacks. It is the standard benchmark for cyber-defense intrusion detection research and is unambiguously defense data, not synthetic. Fetched via `sklearn.datasets.fetch_kddcup99(subset='SA', percent10=True)`.

**Test setup.** 6,000 entities sampled, 600 attacks (10% attack rate). 41 features per entity (mixed numeric and categorical: protocol_type, service, flag, plus 38 numeric flow statistics). BTUT runs on raw input through the full 8-tier pipeline; baselines run on the same entity set with identical sample selection.

**Result table.**

| Method | Recall in survivors (top-N) | Lift over random | AUC | Throughput on raw inputs |
|---|---|---|---|---|
| **BTUT (Latent Ocean)** | **41.5%** | **1.66×** | **0.613** | 958 entities/sec |
| Isolation Forest | 54.3% | 2.17× | 0.845 | 19,670 entities/sec |
| Local Outlier Factor | 14.0% | 0.56× | 0.401 (worse than random) | 1,861 entities/sec |

**Honest reading.** On real DARPA cyber-defense data, BTUT shows real signal above random selection (AUC 0.613 vs null 0.5), clearly beats Local Outlier Factor (which collapses to AUC 0.40 on this corpus — *worse than random selection*), and is below Isolation Forest on raw AUC (0.61 vs 0.85). Isolation Forest is the right tool when raw AUC is the only metric. BTUT's value proposition is *not* raw AUC — it is the property composition that Isolation Forest cannot match, documented in the head-to-head section below.

### EDGAR distress prediction — the honest reconciliation

The project also performed a real-data validation against SEC distress filings (10-K/A, 10-Q/A, NT 10-K, NT 10-Q). The result is included here for honesty.

| Ranker | AUC-hits at K=500 | Recall at K=100 |
|---|---|---|
| BTUT composite | 2.957 | 50.0% |
| Mean composite | 2.857 | 33.3% |
| Fact count (size confound) | 3.333 | 50.0% |
| Random seed=42 | 2.991 | 50.0% |
| Random null distribution mean | 2.810 | (baseline) |

**On the EDGAR predictive-distress task, BTUT performs essentially identically to random selection.** This is not an algorithmic failure; it is a task-design mismatch. SEC distress filings are caused by predictive factors (fraud, late audit, going-concern triggers) that BTUT does not measure; BTUT measures *structural* anomaly in XBRL geometry. The two signals are weakly correlated. The honest pitch is: do not use BTUT to predict future restatement events. Do use BTUT to find structurally-distinct entities for analyst triage in datasets where the question *is* "what is structurally unusual here."

**Vendor-comparison status.** The project's competitive-backtest methodology pre-positions BTUT against Bloomberg Terminal, AlphaSense, RavenPack, and Audit Analytics, but each named comparison requires the vendor's API access or subscription, which is not in scope for a public artifact. The named-vendor comparison is engagement-gated; the open-baseline comparison (above) is publicly reproducible.

### Caveat on the legacy validation report

The headline numbers in `docs/commercial/VALIDATION_REPORT.md` (5.4× watchlist hit-rate, 29σ null-test) are honest within their methodology, but the methodology has known limitations a defense reviewer will identify:

- The **5.4× watchlist hit-rate** is computed on a watchlist constructed *from BTUT's own output*. It measures the overlap between BTUT's two scoring metrics (magnitude and composite), not predictive lift over random selection on an external task.
- The **29σ null-test** measures whether sorting by BTUT's score function produces high BTUT scores (a tautology). The honest external-validity tests are KDDCUP99 above and the EDGAR distress reconciliation.

These caveats are why this v3.0 tear sheet leads with KDDCUP99 and EDGAR distress as the load-bearing claims, with the synthetic megatest as architectural-fit secondary evidence.

## Why the property composition matters more than raw AUC

| Property | BTUT (Latent Ocean) | Isolation Forest | Local Outlier Factor |
|---|---|---|---|
| Recall on KDDCUP99 (real DARPA defense data) | 41.5% | 54.3% | 14.0% |
| AUC on KDDCUP99 | 0.613 | 0.845 | 0.401 |
| Bit-identical reproducibility from raw inputs | yes (seed=42, every run) | seed-dependent; not bit-identical across BLAS / hardware | not stable across BLAS |
| Native handling of text and categorical | yes (no feature engineering) | no (numeric matrix required) | no |
| Per-finding lineage trace | yes (7-stage explanation per survivor) | no | no |
| Air-gap operation, no outbound I/O | yes (proven, 0 outbound socket attempts) | yes if installed locally | same |
| Classification-aware access wrapping | yes (4-tier RBAC + per-tenant fork isolation) | not native | not native |
| WORM audit + SIEM export | yes (verified by hash-chain tamper test) | not native | not native |
| **Composition of all rows above** | **YES — single integrated kernel** | NO | NO |

The defense pitch is the composition. Detection accuracy is necessary but not sufficient. Isolation Forest is a stronger pure detector on the synthetic and KDDCUP99 corpora; it cannot satisfy the additional ATO-relevant properties without significant integration work. BTUT ships those properties as a single artifact.

## Capability map

1. **Structural anomaly detection** across heterogeneous data types: text, numeric, categorical, embedded.
2. **Entity-graph fusion** with co-occurrence weighting and incremental updates from streaming or batch corpora.
3. **Collection-gap recommendation** mapping observed gaps to specific tasking authorities and collection types.
4. **Analytical product synthesis** generating Daily Reads, Country Cards, Key Judgments, and Dissents from a live entity graph.
5. **Cryptographic chain-of-custody** via revocable QR identities with immutable scan logs per access event.
6. **Classification-aware access control** enforcing four-tier classification with role-based filtering and per-tenant database isolation.

## Application matrix (with multi-source evidence)

| Vertical | Representative applications | Evidence (in order of strength) |
|---|---|---|
| **All-source / fused intelligence** | Single-operator AWIS analyst workstation; collection-gap tasking with agency-strength routing; dissent surfacing; cross-source canonicalization. | Shipped (NATO-SIM, UNC April 2026 demonstration); synthetic megatest 50% recall at 2.2× lift |
| **Signal and communications (SIGINT, COMINT)** | Novel-emitter detection; spoofed-emitter detection; burst-pattern outliers. | Synthetic megatest 86% recall at 3.4× lift (architectural fit) |
| **Electronic warfare and spectrum management** | Novel-emission discovery in dense RF; coordinated-jammer pattern detection; hop-and-agility signature outliers. | Synthetic megatest 50% recall at 2.0× lift (architectural fit) |
| **Counter-UAS and counter-MASINT signature** | Multi-modal RF + acoustic + IR + kinematic threat detection; low-observable threat surfacing. | Synthetic megatest 80% recall at 3.6× lift (architectural fit) |
| **PNT integrity** | GPS spoofing detection; jamming-onset characterization; multi-receiver consensus deltas. | Synthetic megatest 75% recall at 3.0× lift (architectural fit) |
| **Imagery and geospatial** | Spatial outliers; AIS-dark vessel surfacing; ROI structural scoring. | Synthetic megatest 17% recall — calibration required for deployment; real-data validation pending |
| **Network and cyber forensics** | C2 beaconing detection; asymmetric exfil flagging; insider-threat behavioral outliers. | **KDDCUP99 (DARPA real data): AUC 0.613, recall 41.5%, throughput 958 entities/sec on raw pipeline.** Synthetic megatest 69% recall at 2.8× lift |
| **Logistics, force protection, counter-threat finance** | Shell-company markers; layering / triangulation; sanctions-evasion structural patterns. | EDGAR distress prediction: BTUT ≈ random (task-design mismatch — BTUT measures structural, not predictive). EDGAR structural anomalies: 4,999 survivors from 61,041 filers (real data, real survivors, deterministic). Synthetic megatest 29% recall on injected sanctions-evasion patterns. |

## Cross-cutting tests (synthetic-corpus megatest, all pass)

| Test | Result | Detail |
|---|---|---|
| Determinism from raw inputs | **PASS** | BTUT run twice on identical synthetic corpus produces bit-identical SHA-256 of survivor list. End-to-end pipeline determinism, not JSON-load determinism. |
| Real processing throughput on raw inputs | 3,510 entities/sec (synthetic), 958 entities/sec (KDDCUP99) | Aggregate across all 8 synthetic verticals through full 8-tier pipeline. KDDCUP99 includes 41-feature mixed numeric/categorical schema with sklearn-compatible byte decoding overhead. |
| Air-gap | **PASS** | BTUT runs with `socket.socket.connect` monkey-patched to refuse all outbound. Zero outbound attempts. Survivor production succeeds. |
| Compliance: access log structure | **PASS** | 100 synthetic events; all required fields present. |
| Compliance: WORM append-only | **PASS** | 50-event hash chain verified intact; tamper at event 25 detected at event 25 by hash-chain re-verification. |
| Compliance: classification deny-by-default | **PASS** | 4-tier RBAC matrix verified across viewer / analyst / operator / admin / unknown roles. Unknown roles denied everywhere. |
| Compliance: SIEM export schema | **PASS** | Sample export record well-formed JSON, all required fields present, parseable. |

## Compliance and access posture

FedRAMP **IL6 readiness matrix** mapped to NIST SP 800-53 Rev5 and DoD Cloud SRG v1r4 (pre-authorization; sponsoring agency required for full ATO). SOC 2 Type II control families instrumented across access control, audit, configuration, contingency, identification, system, and integrity. CJIS and HIPAA scaffolding for law-enforcement and health adjacencies. Four-tier data classification (public, internal, confidential, restricted) with deny-by-default RBAC and per-tenant database isolation. Every API call audit-logged with request ID, user, action, resource, and outcome. SIEM-ready JSON export. Optional WORM audit archive (validated by hash-chain tamper test).

## Deployment footprint

Air-gap, on-premise, hybrid, or commercial cloud. Multi-tenant isolation via per-tenant process fork. Edge or forward deployment supported through the LocalClient SDK with no outbound I/O required. Container, bare-metal, or VM. Dataset and model artifacts cryptographically pinned per deployment. Cold instantiation under one second on commodity 2023 laptop hardware. Demonstrated raw-input processing across multiple data shapes: 958 entities/sec on KDDCUP99 (41-feature mixed-type), 3,500+ entities/sec on lower-feature-count synthetic corpora.

## IP and provenance posture

Core algorithmic work is protected as **trade secret** with **OpenTimeStamps cryptographic anchoring** on public capability declarations. No patent encumbrance. No patent-pending claims. No third-party portfolio licensing exposure. The kernel does not appear in any public claim chain that an adversary or competitor could mine. v1.0, v2.0, and v3.0 of this tear sheet are anchored independently; the megatest JSON artifacts and the real-data validation artifact are hash-recorded for re-verification.

## Engagement

Engagement paths span pilot deployment on customer-furnished corpus, capability demonstration against unclassified red-team data, BAA / SBIR / STTR Phase II match, OTA prototype agreements, prime-teaming or sub-contractor roles on existing programs of record, and classified-side roadmap discussions under sponsoring-agency NDA. The strongest entry point is a 60-minute capability demonstration where the customer provides a corpus of their own data and BTUT is run live, side-by-side with Isolation Forest, on the customer's terminal. Both rankers re-run from raw inputs in seconds; differentiation on lineage, determinism, multi-type handling, and classification posture becomes immediately tangible.

**Contact:** *[populate at finalization]*
**System version:** Latent Ocean SDK v0.2.0; megatest v1.0.0; real-data harness v1.0.0 (commit hash on request)
**Document timestamp:** *[OpenTimeStamps anchor applied to rendered PDF at finalization]*

---

*Falsifiable on demand. Every claim re-runnable from `python -m scripts.defense_megatest.run` (synthetic) and `python -m scripts.defense_megatest.real_data` (DARPA / MIT Lincoln Lab cyber-defense + EDGAR distress reconciliation). Determinism, lineage, air-gap, and classification posture are bit-for-bit verifiable in the published artifacts.*
