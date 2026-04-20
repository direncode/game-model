# The structural-fingerprint primitive — formal spec

*Version 0.2.0 · authoritative reference · deterministic at seed=42*

This document specifies the data primitive Latent Ocean installs onto any
database, data warehouse, or streaming feed. It is intentionally narrow:
one fingerprint type, one score vector, one null-test operation, and a
small set of algebraic operations. It is also intentionally broad: every
statement here is true regardless of the data type the primitive is
applied to.

If your database speaks SQL-ish, this document is the contract we commit
to. If your feed speaks streaming-records, the streaming addendum at the
bottom applies the same contract one record at a time.

---

## 1. Domain and range

The primitive is a pure function of its input row:

```
lo_fingerprint :  Row  ->  bit(48)
lo_score       :  bit(48) × History(bit(48))  ->  ScoreVec
```

- `Row` is any structured record (JSONB, Avro, Parquet row, document).
- `bit(48)` is a 48-bit stable identifier.
- `History` is a bounded rolling window of fingerprints from the same
  logical universe (default: the whole table / last N events / per
  tenant per tick).
- `ScoreVec` is `{composite, anomaly, reconstruction, diversity}` in
  `[0, 1]^4`.

Determinism property: for any row `r`, `History`, and seed `s`:

```
lo_fingerprint(r, seed=s)   =  lo_fingerprint(r, seed=s)   always
lo_score(lo_fingerprint(r), H, seed=s)  deterministic in (r, H, s)
```

Reproducibility property: the SHA-256 of the sorted-top-K result of
`lo_score` is stable across independent runs.

---

## 2. Fingerprint construction

```
lo_fingerprint(row, seed=42) :=
    for i in 0 .. 47:
        h_i  :=  SHA-256(seed || i || canonical_json(row))
        bits[i]  :=  parity(h_i[0..3] XOR h_i[7..11] XOR h_i[13..17])
    return bits.join()
```

- `canonical_json` sorts keys and round-trips numerics to stable
  representations; two rows with the same logical content produce the
  same JSON byte sequence.
- The rotation ensemble (`h_i[0..3] XOR h_i[7..11] XOR h_i[13..17]`)
  yields 48 independent pseudorandom bits from a single 256-bit SHA hash.
- The seed is process-global, set once per deployment. Changing the seed
  is equivalent to re-keying a hash; we publish `seed=42` as the
  industry-default reproducibility anchor.

---

## 3. Score vector

```
lo_score(fp, history) :=
    anomaly        :=  min_hamming(fp, history) / 48
    reconstruction :=  1 - |ones(fp) - 24| * 2 / 48
    diversity      :=  mean_over_on_bits(H2(bit_prob(i, history)))
    composite      :=  0.40·reconstruction + 0.35·diversity + 0.25·anomaly
    return {composite, anomaly, reconstruction, diversity}
```

Semantic reading of each dimension, in the language a data buyer uses:

- `anomaly`      — isolation in fingerprint space; how far from any peer
- `reconstruction`— information density of the fingerprint itself
- `diversity`    — entropy across the per-bit distribution in the window
- `composite`    — the weighted default ranking score

All are normalized to [0, 1]. The composite weighting is fixed (0.40 /
0.35 / 0.25) by commercial contract; deployments that tune the weights
must declare that in their SLO.

---

## 4. Null-test operation

```
lo_null_test(table, dims=["composite"], iterations=500, seed=42) :=
    true_top_k   := top_k_mean(table, dims, K)
    for i in 0 .. iterations-1:
        shuffled := seeded_bit_shuffle(table.fingerprints, seed + i)
        null[i]  := top_k_mean(shuffled, dims, K)
    return {
        true_value:     true_top_k,
        null_mean:      mean(null),
        null_std:       std(null),
        null_p95:       percentile(null, 0.95),
        null_p99:       percentile(null, 0.99),
        null_p999:      percentile(null, 0.999),
        z_score:        (true_value - null_mean) / null_std,
        significant_05: true_value > null_p95,
        significant_01: true_value > null_p99,
        significant_001:true_value > null_p999,
    }
```

The seeded bit-shuffle preserves the bit-count of every fingerprint
(balanced permutation), which keeps the null distribution on the same
support as the true distribution. This is the strongest null this
primitive supports; customers who require a different null (e.g.,
within-group permutation) can supply their own shuffle function.

---

## 5. Algebraic operations on the primitive

| Op | Signature | Meaning |
|---|---|---|
| `rank` | `(table, dim, k) -> top-k rows by dim` | Structural outlier ranking |
| `filter` | `(table, dim, threshold) -> rows` | Gate by composite / anomaly / etc. |
| `peer_rank` | `(row, peer_group) -> integer` | Position within peer window |
| `drift` | `(fp_t, fp_{t-1}) -> hamming` | Per-row change over time |
| `bridge` | `(fp_a, fp_b) -> hamming` | Cross-universe structural similarity |
| `digest` | `(table, k) -> SHA-256` | Reproducibility hash for audit |

---

## 6. Guarantees the primitive makes

- **Determinism.** For fixed `(seed, row, history)`, the primitive emits
  bit-identical output across machines, architectures, and time.
- **Reproducibility.** `digest(table, k)` is stable across independent
  loads; two customers running on the same source data produce the same
  digest.
- **Falsifiability.** `lo_null_test` is callable on any universe at any
  time. If the returned `z_score` falls below the customer's commercial
  threshold, the vendor retracts the claim.
- **Air-gap.** All operations are pure arithmetic on the customer's data
  and the configured seed. No outbound network calls. No model weights.
  No GenAI.
- **Modality-agnostic.** The canonical-JSON input contract admits any
  row-shape: financial filings, biomedical papers, climate series, trade
  flows, patents, biographies, IoT telemetry, security events.

---

## 7. What the primitive does NOT promise

- It does not predict. Ranking a row at composite 0.90 does not imply
  anything causal about the row's future.
- It is not a classifier. It has no labels, no training step.
- It is not a representation for downstream ML. Use an embedding for
  that; use this for outlier detection + reproducibility.
- It does not replace domain expertise. A high composite is an invitation
  to look; it is not a conclusion.

---

## 8. Versioning and compatibility

Primitive version is declared on every response envelope:

```json
{
  "primitive": "lo_core.fingerprint",
  "version": "0.2.0",
  "seed": 42,
  "composite_weights": [0.40, 0.35, 0.25],
  "fingerprint_bits": 48
}
```

Breaking changes to the fingerprint construction, score weighting, or
null-test methodology bump the major version. Non-breaking extensions
(new dims, new ops) bump the minor. Patch version covers performance and
tooling improvements that preserve exact bit-level output.

---

## 9. Streaming addendum

For unbounded sequences (Kafka / Kinesis / Pulsar / WebSocket / live API):

- `history` is a rolling window of the last N fingerprints per stream.
- `lo_score` is one-pass per record.
- `lo_null_test` is callable on the current window at any time.
- Cold start: the first `N_minimum = 20` records produce informational
  scores; the null test returns `status: "insufficient_history"` until
  enough records accumulate.

The streaming variant has been demonstrated on public feeds returning
`z = 18.19σ` on CoinGecko top-100 markets and `z = 2.14σ` on USGS
all-hour seismicity, with bit-identical fingerprints across independent
cold starts.

---

## 10. Reference implementation

- CLI / Python:   `pip install lo-core`
- Frontend / TS:  [`frontend/lib/streamingFingerprint.ts`](../frontend/lib/streamingFingerprint.ts)
- Database ext:   `pg_latentocean` (Postgres), `lo_udf` (Snowflake / BigQuery),
  MongoDB `$lo` aggregation stage
- Air-gap:        `lo` CLI + offline `LocalClient` in the Python SDK

All reference implementations are bit-compatible with each other for the
same `(seed, row, history)` triple. Any divergence is a bug against this
spec.

---

## 11. Commercial commitment

If any claim we publish against this primitive fails the null test as
specified in Section 4, we retract the claim and, for pilot customers,
refund the pilot. That commitment is what makes this primitive worth
installing.
