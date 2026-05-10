---
slug: app-c-primitive-spec-companion
number: null
title: "Appendix C: Primitive Spec Companion"
promise: "A handbook-voice summary of the lo_fingerprint primitive specification."
status: draft
---

# Appendix C: Primitive Spec Companion

> A handbook-voice summary of the lo_fingerprint primitive specification.

The normative spec lives at `docs/PRIMITIVE_SPEC.md`. This appendix
summarizes that spec in the handbook's prose voice. When the two
disagree, the normative spec wins.

## Domain and range

The fingerprint primitive is a pure function from a structured row
to a 48-bit identifier:

```
lo_fingerprint :  Row  ->  bit(48)
lo_score       :  bit(48) × History(bit(48))  ->  ScoreVec
```

`Row` is any structured record (JSONB, Avro, Parquet row, document).
`bit(48)` is the 48-bit stable identifier. `History` is a bounded
rolling window of fingerprints from the same logical universe
(typically the whole table, or the last N events, or per tenant per
tick). `ScoreVec` is four numbers in the unit interval, named
`composite`, `anomaly`, `reconstruction`, and `diversity`.

The determinism property: for any row r, history H, and seed s,
both `lo_fingerprint(r, seed=s)` and `lo_score(lo_fingerprint(r), H,
seed=s)` are deterministic functions of (r, H, s) alone. No
wall-clock, no system entropy.

## Fingerprint construction in one paragraph

The primitive computes 48 independent pseudorandom bits per row. Each
bit position k is derived from `SHA-256(seed || k || canonical_json(row))`.
The canonical JSON encoding sorts keys and round-trips numerics to stable
representations, so two rows with the same logical content produce
the same JSON byte sequence and therefore the same fingerprint. A
rotation ensemble (XOR over three byte ranges of the SHA-256 output)
yields 48 bits that are pairwise independent at the level required
for the downstream Bloom-shape statistics. The seed is process-global
and is published as 42 by default; changing it is equivalent to
re-keying the hash.

## The score vector

The four score dimensions are computed against the rolling history:

| Dimension | What it measures (data-buyer reading) |
| --- | --- |
| `anomaly` | Isolation in fingerprint space; how far from any peer. |
| `reconstruction` | Information density of the fingerprint itself. |
| `diversity` | Entropy of per-bit probabilities across the window. |
| `composite` | Weighted default ranking, 0.40·rec + 0.35·div + 0.25·anom. |

All four are normalized to the unit interval. The composite weights
are fixed at the values above by commercial contract; deployments
that need different weights must declare them in their published SLO
and re-run any prior claims against the new weights.

## The null test

The single most-important commercial property of the primitive is
its falsifiability. Any claim a vendor publishes against the
primitive (an anomaly score, a top-K ranking, a composite cutoff)
can be tested against a null distribution by shuffling the
fingerprint bits within the same window:

```
lo_null_test(table, dims=["composite"], iterations=500, seed=42)
```

The null preserves the bit-count of every fingerprint (it permutes
bit positions, not bit values), which keeps the null distribution
on the same statistical support as the true distribution. The
returned record names the true top-K mean, the null mean and
standard deviation, the 95th / 99th / 99.9th null percentiles, and
the z-score of the true value against the null.

A z-score below 2.0 is at chance; above 3.0 is meaningful; above 5.0
is bulletproof for most commercial purposes. The published
example numbers in `docs/PRIMITIVE_SPEC.md` section 9 include
z = 18.19σ on a streaming feed of cryptocurrency market data,
demonstrating that the null test scales to live data.

## Algebraic operations

The primitive supports a small set of named operations:

| Operation | Signature | What it does |
| --- | --- | --- |
| `rank` | `(table, dim, k) -> top-k` | Structural outlier ranking on the named dim. |
| `filter` | `(table, dim, threshold) -> rows` | Gate by composite / anomaly / etc. |
| `peer_rank` | `(row, peer_group) -> int` | Position within a peer window. |
| `drift` | `(fp_t, fp_{t-1}) -> hamming` | Per-row change over time. |
| `bridge` | `(fp_a, fp_b) -> hamming` | Cross-universe structural similarity. |
| `digest` | `(table, k) -> SHA-256` | Reproducibility hash for audit. |

`digest` is the operation that backs the reproducibility commitment.
Two customers running the primitive on the same source data, at the
same seed, produce the same digest.

## What the primitive does NOT promise

A short list of things the primitive does not do, for the avoidance
of doubt:

1. It does not predict. A high composite score does not imply
   anything causal about the row's future.
2. It is not a classifier. It has no labels, no training step.
3. It is not a downstream representation. Use an embedding for ML
   work; use the fingerprint for outlier detection and audit.
4. It does not replace domain expertise. A high composite is an
   invitation to look, not a conclusion.

## The commercial commitment

Section 11 of the normative spec contains the load-bearing
commercial clause: any claim the vendor publishes against this
primitive that fails the null test as specified in Section 4 is
retracted, and pilot customers are refunded the pilot.

This is the falsifiability clause that the rest of the substrate-clustering
infrastructure rests on. Every dispersion finding the OCEAN
language reports, every audit trail the pg_latentocean extension
exposes, every score the streaming variant publishes traces back to
this primitive's deterministic, reproducible, falsifiable shape.

## Where to find the normative spec

The full text, including the streaming addendum and the
implementation map, is at `docs/PRIMITIVE_SPEC.md`. Read it when
the question is "what does the contract actually say."
