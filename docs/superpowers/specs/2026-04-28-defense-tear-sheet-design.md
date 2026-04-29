# Defense and Intelligence Master Tear Sheet — Design Spec

**Date:** 2026-04-28
**Owner:** Latent Ocean (lsx)
**Author:** brainstorm session, captured for OTS anchoring

## Purpose

Two-page master tear sheet positioning Latent Ocean for defense and intelligence buyers. Travels into SBIR / DIU / AFWERX / SOFWERX intake, prime-teaming conversations, and cross-agency capability briefings as a single artifact. Replaces ad-hoc capability claims with a single hash-anchored document.

## Constraints

- ~1,100 to 1,300 words body, fits two letter pages dense.
- No first-person voice (no "we", "our", "us") in deliverable text.
- No em dashes in displayable text. Use colons, semicolons, parens, sentence breaks.
- Trade-secret IP framing only. Never claim "patents filed" or "patent pending".
- Capability claims must trace to one of: existing code, validation report, or honestly tagged `Architectural fit`.
- Public-capability layer only. Trade-secret internals stay redacted.

## Redaction line (what stays out)

The following live in the codebase but do NOT appear in the deliverable, even though Latent Ocean now publicly declares the existence of the system itself:

- Specific signal weights, thresholds, magnitude axes, fingerprint resolution counts, rotation counts.
- Stratification weights, cluster cap heuristics, k-NN parameters.
- Prompt scaffolding in `resolver.py`, `synthesizer.py`, `agency_capabilities.py` (the craft layer).
- TCD-JEPA crystallization internals (Langevin parameters, persistent-homology thresholds, module-promotion criteria).
- Any specific tier counts in the BTUT pipeline that go beyond what already appears in the public sales one-pager.

The deliverable references "lattice-geometry fingerprinting", "multi-resolution rotations", "structural diversity / reconstruction / anomaly composite". It does not enumerate the arity of any of those.

## Deliverable structure (10 sections)

1. **Header strip:** classification, system, version, hash placeholder.
2. **Positioning sentence:** two options offered for user pick.
3. **The kernel:** capability-level paragraph on BTUT.
4. **Why this matters for defense and intelligence:** the accreditation / red-team / IG-audit framing.
5. **Capability map:** six named capabilities, one sentence each.
6. **Application matrix:** eight verticals, two to four representative applications each, maturity tag per row.
7. **Proof points:** seven dimensions from validation report, all reproducible.
8. **Compliance and access posture:** FedRAMP IL6 readiness, SOC 2, CJIS / HIPAA, classification tiers, audit, SIEM.
9. **Deployment footprint:** air-gap, on-prem, hybrid, edge, multi-tenant fork isolation.
10. **IP and provenance posture:** trade secret + OpenTimeStamps. Engagement footer with TODO ask.

## Application matrix — eight verticals

| # | Vertical | Maturity tag |
|---|---|---|
| 1 | All-source / fused intelligence | Shipped / Demonstrated |
| 2 | Signal and communications (SIGINT, COMINT) | Architectural fit |
| 3 | Electronic warfare and spectrum management | Architectural fit |
| 4 | Counter-UAS and counter-MASINT signature | Architectural fit |
| 5 | PNT integrity | Architectural fit |
| 6 | Imagery and geospatial | Architectural fit |
| 7 | Network and cyber forensics | Architectural fit |
| 8 | Logistics, force protection, counter-threat finance | Demonstrated (financial domain) |

## Maturity-tag definitions

- **Shipped:** in production code today, exercised by working frontends or ingestion pipelines.
- **Demonstrated:** shown in a live exercise (NATO-SIM AWIS, 2026-04-25) or recorded in `docs/commercial/VALIDATION_REPORT.md`.
- **Architectural fit:** the BTUT kernel handles the data shape (the multi-type embedder accepts text, numeric, categorical, embedded inputs in `backend/engine/reduce/pipeline.py`). Domain corpus, sensor adapters, and integration are the remaining work; algorithmic novelty is not required.

## User contribution points (marked TODO in the deliverable)

- **Positioning sentence** at the top of page one. Two options proposed; user picks or rewrites.
- **Engagement / ask footer.** Customer-specific (pilot, BAA, OTA, SBIR Phase II match, prime teaming, classified roadmap).
- **Anchor application framing** in the All-Source vertical. NATO-SIM AWIS workstation can be re-positioned by user judgment.

## Verification of proof points

Numbers in the deliverable are verified against `docs/commercial/VALIDATION_REPORT.md` (generated 2026-04-19, readiness score 100/100):

| Claim | Source line in VALIDATION_REPORT.md |
|---|---|
| Watchlist hit-rate 25/46, 5.4× random, p90 = 0.759 | Line 22 |
| Null-test z = 29.2σ live (12/16 metrics), 54.68σ archived | Line 23 |
| Throughput 38,135 qps single-process | Line 24 |
| Reproducibility bit-identical SHA-256 across 5 runs | Line 25 |
| Cost ~$0.0164 cold-run on commercial workload | Line 26, 131 |
| Multi-tenant 21,313 qps across 10 tenants, p99 = 264µs | Line 27 |
| Air-gap proof, 0 outbound socket attempts | Line 28 |

## Output

- Spec: `docs/superpowers/specs/2026-04-28-defense-tear-sheet-design.md` (this file).
- Deliverable: `docs/commercial/defense/master-tear-sheet.md`.
- Recommended next: render to PDF, hash with OpenTimeStamps, archive.

## Voice and IP

- **Voice:** declarative, capability-led, third-person, falsifiable.
- **IP:** trade secret + OpenTimeStamps cryptographic anchoring on public capability declarations. Explicit "no patent reliance" statement included.
- **Document hash:** OpenTimeStamps anchor applied to rendered PDF at finalization. Hash placeholder reserved in header.

## Out of scope

- One-page reduction (cut from master later).
- Slide-deck rendering (separate artifact).
- Customer-specific tear sheets (cut from master with engagement-footer swap).
- Classified-side capability claims (require sponsoring-agency engagement).
