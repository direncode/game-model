# Provisional Patent Application

**Title:** Universal Structural Adapter for Heterogeneous Data Sources, Comprising a Deterministic 48-Bit Structural Fingerprint and a Four-Dimensional Geometric Score Vector, Mountable In-Place Across Relational, Document, Streaming, and Edge Substrates Including in Air-Gapped and Model-Context-Protocol Embodiments

**Filing type:** Provisional Application for Patent (35 U.S.C. § 111(b))

**Inventor(s):** [to be supplied by applicant]

**Assignee:** [to be supplied by applicant]

**Priority date:** [date of this provisional filing]

---

## I. Cross-References to Related Applications

This application is related in subject matter to two commonly-owned,
separately-filed provisional applications:

(a) "Five Operational Primitives and Convergence Hand-Back Loop for
Self-Improving Structural Substrates"
(provisional_02_operational_primitives_handback), describing the
five callable operations exposed by an adapter conforming to the
present invention and the cyclic feedback loop in which
structurally-enriched outputs of those operations are returned to
the substrate as new mountable inputs; and

(b) "Crystara: Runtime Topological Module Crystallization via
Persistent-Homology of Fisher-Information-Preconditioned Langevin
Trajectories" (provisional_03_crystara), describing a
post-transformer training paradigm that consumes the structural
outputs of an adapter conforming to the present invention as
training context.

The present invention is independent of either of (a) or (b)
considered alone, and may be practiced in combination with neither,
either, or both.

## II. Field of the Invention

The present invention relates to data-processing systems, and more
particularly to apparatus, methods, and computer-program products
implementing a *universal structural adapter* — a software component
that mounts in-place onto any structured data source, relational or
document or streaming or edge-resident, and augments each row of that
source with a deterministic, reproducible, falsifiable structural
fingerprint and a multi-dimensional geometric score vector — with
operating embodiments including but not limited to PostgreSQL
extension, Snowflake external function, MongoDB aggregation stage,
edge-device installable binary, and Model Context Protocol (MCP)
tool surface.

## III. Background

### A. The schema-versus-geometry problem in heterogeneous data systems

Modern enterprises operate over data sources of fundamentally
heterogeneous shape: relational databases store row-and-column
records, document stores hold semi-structured JSON or BSON
documents, streaming systems emit per-record events, and edge
devices generate sensor traces with no central schema. Existing
tools for cross-source analytics — including data warehouses,
data lakes, and feature stores — operate by *unifying schemas*:
projecting heterogeneous sources into a common tabular shape and
then querying that common shape.

Schema unification is brittle because schemas evolve, vocabularies
collide, and many sources resist normalization (free text, sensor
streams, event logs). It is also commercially expensive: a typical
enterprise data warehouse devotes a substantial fraction of its
total cost-of-ownership to maintaining schema-translation pipelines
that break whenever an upstream source changes.

The present invention proposes a different organizing primitive:
rather than unifying *schema*, unify *structural geometry*. Each
record from any source, regardless of shape, is assigned a
deterministic structural fingerprint of fixed bit-width that
encodes the record's geometric position relative to its peer
universe. Outlierness, similarity, and rank become geometric
operations on the fingerprint, independent of the record's
schema or source.

### B. Limitations of vector embeddings in regulated and sovereign deployments

Machine-learning vector embeddings (typically 256-to-4096-dimensional
real-valued tensors produced by neural encoders) are widely used
for semantic similarity in present-day systems. They suffer two
architectural limitations that bar their adoption in regulated and
sovereign-procurement contexts: (i) they are non-deterministic
under common training and inference settings, so the same input
yields different outputs across model versions, hardware, or random
seeds; and (ii) they offer no in-built falsifiability — a customer
cannot ask "is this embedding-derived ranking distinguishable from
random?" in a single call.

### C. Limitations of locality-sensitive hashing as a substrate

Classical locality-sensitive hashing (LSH) techniques, including
MinHash and SimHash variants, produce fixed-width hashes intended
for similarity retrieval. They are not designed for outlierness
scoring against a defined universe; they emit no per-row score
vector; they expose no falsifiability operation; and they are not
typically packaged as in-place adapters that mount on a database
without re-architecting the storage layer.

### D. Limitations of existing in-database extension patterns

Modern relational and document database systems support
user-defined functions, generated columns, aggregation stages,
and similar in-place extension mechanisms. However, no existing
extension package provides, as a single coherent product:
(i) a per-row deterministic structural fingerprint of bounded
bit-width, (ii) a multi-dimensional geometric score vector
derived from that fingerprint relative to a configurable
universe, (iii) a uniform extension surface that operates
identically across PostgreSQL, Snowflake, MongoDB, and edge
runtimes, and (iv) operability under air-gapped and Model
Context Protocol embodiments without architectural change.

### E. The problem addressed

There exists a need for a single software adapter that (i) mounts
in-place on any structured data source without schema
modification, (ii) produces for each record a deterministic,
reproducible, fixed-bit-width structural fingerprint and a
multi-dimensional score vector, (iii) operates identically across
relational, document, streaming, and edge embodiments, and (iv)
is deployable under sovereign, on-premises, air-gapped, and
agent-tool-surface (MCP) configurations without architectural
divergence.

## IV. Summary of the Invention

The present invention provides a universal structural adapter
comprising:

1. **A deterministic structural fingerprint generator** that
   accepts any structured record (JSON, Avro, Parquet row, BSON
   document, sensor sample) and produces a fixed-bit-width (in a
   preferred embodiment, 48-bit) structural fingerprint as a pure
   function of the record's content and a global seed. The
   construction employs a parity-XOR rotation ensemble over a
   cryptographic hash family applied to the canonical-JSON
   serialization of the record, yielding bit-identical
   fingerprints across runs, processes, hardware, and operating
   systems given identical inputs and seeds.

2. **A four-dimensional geometric score vector** generated for each
   fingerprinted record relative to a configurable peer universe
   of fingerprints. The score vector comprises:
     - a *composite* score reflecting overall structural
       outlierness in the universe;
     - an *anomaly* score reflecting tail-region position in the
       fingerprint distribution;
     - a *reconstruction* score reflecting how well the record's
       fingerprint can be reconstructed from a basis derived from
       the rest of the universe;
     - a *diversity* score reflecting the geometric spread of the
       record's near-neighbor fingerprint set.
   Each score is a real-valued scalar in [0, 1] computed
   deterministically as a function of the record's fingerprint and
   the universe's fingerprint set under a fixed seed.

3. **A universal in-place adapter surface** exposing the fingerprint
   and score generators to host data systems with embodiments
   including:
     - **PostgreSQL extension embodiment** — fingerprint and score
       are exposed as user-defined functions and as `GENERATED
       ALWAYS AS ... STORED` columns, populated server-side and
       kept in sync with row inserts, updates, and deletes;
     - **Snowflake external-function embodiment** — fingerprint
       and score are exposed as scalar UDFs over JSON-serialized
       rows via `CREATE EXTERNAL FUNCTION`;
     - **MongoDB aggregation-stage embodiment** — fingerprint and
       score are exposed as native pipeline stages (`$lo:
       fingerprint`, `$lo: score`) operable inside any
       aggregation pipeline;
     - **Edge-installable embodiment** — fingerprint and score are
       exposed as a single static binary executable that operates
       on streaming records on a low-power edge device with no
       network dependency, running fully air-gapped on the
       device's local universe;
     - **Model Context Protocol (MCP) tool embodiment** —
       fingerprint and score are exposed as MCP-compliant tool
       surfaces invocable by autonomous agents, returning
       fingerprint and score to the agent in the standard MCP
       payload format.

4. **A deployment-mode invariant guarantee.** The fingerprint and
   score outputs are bit-identical across all of the foregoing
   embodiments given identical inputs, identical universe, and
   identical seed. The adapter operates without architectural
   change in cloud-managed, on-premises, network-isolated, and
   edge-resident deployments.

The novelty of the invention resides in the combination of
(a) the specific parity-XOR rotation ensemble fingerprint
construction yielding bit-identical 48-bit outputs across
heterogeneous runtimes; (b) the four-dimensional geometric score
vector computed deterministically from said fingerprint relative
to a configurable peer universe; (c) the universal in-place
adapter surface exposing said fingerprint and score across at
least relational, document, edge, and agent-tool runtimes
without architectural divergence; and (d) the bit-identity
guarantee across SaaS, on-premises, air-gapped, and edge
embodiments.

## V. Brief Description of the Drawings

**Figure 1.** System diagram of the universal adapter, showing
input records flowing from any of {relational table, document
store, streaming source, edge sensor, agent tool call} through
the fingerprint generator and score generator into adapter-
specific output surfaces.

**Figure 2.** Detailed view of the fingerprint generator: canonical
JSON encoding of an input record, the parity-XOR rotation
ensemble over the cryptographic hash family, and the resulting
48-bit structural fingerprint.

**Figure 3.** Detailed view of the four-dimensional score
generator: fingerprint plus universe-fingerprint-set as inputs,
producing composite / anomaly / reconstruction / diversity scalar
outputs.

**Figure 4.** PostgreSQL embodiment: `ALTER TABLE` adding generated
columns `lo_fp` and `lo_score`, with the table's row set as the
peer universe and per-row fingerprint and score populated
server-side.

**Figure 5.** Snowflake embodiment: `CREATE EXTERNAL FUNCTION`
declarations exposing `LO_FINGERPRINT` and `LO_SCORE` as scalar
UDFs over `OBJECT_CONSTRUCT(*)` row representations.

**Figure 6.** MongoDB embodiment: aggregation pipeline using
`$lo: { fingerprint }` and `$lo: { score }` stages over a
collection.

**Figure 7.** Edge embodiment: single static binary on a
low-power device ingesting streaming sensor records and
emitting fingerprint plus score with no network connectivity.

**Figure 8.** MCP-tool embodiment: an autonomous agent invokes
the adapter as an MCP-compliant tool, receiving a
fingerprint-plus-score response in the standard MCP payload.

**Figure 9.** Cross-embodiment bit-identity verification: identical
input record presented to each embodiment yields identical
fingerprint and identical score vector.

## VI. Detailed Description

### A. Canonical-JSON encoding module (Figure 2, block 102)

For each input record, the adapter first computes a canonical-JSON
serialization in which (i) object keys are sorted lexicographically
at every nesting level; (ii) numeric values are rendered in a
fixed shortest-round-trip representation; (iii) Unicode strings are
NFC-normalized; and (iv) array element ordering is preserved
exactly. Two records whose logical content is equivalent but whose
in-memory representation differs (e.g., differing key insertion
order) produce identical canonical-JSON byte sequences.

The canonicalization is the only source of cross-runtime variability
in the otherwise-pure pipeline; performing canonicalization at the
adapter boundary ensures bit-identical fingerprint outputs across
all downstream embodiments.

### B. Parity-XOR rotation-ensemble fingerprint generator (Figure 2, blocks 104, 106)

The fingerprint is computed from the canonical-JSON byte sequence
`R` as follows. For `i` in `0 .. 47`:

```
h_i      :=  SHA-256( seed ‖ i ‖ R )
bits[i]  :=  parity( h_i[0..3]  XOR  h_i[7..11]  XOR  h_i[13..17] )
```

where `seed` is a 64-bit operator-supplied seed (default 42), `‖`
denotes byte concatenation, `parity(x)` is the XOR of all bits of
`x` returning a single bit, and the byte ranges `[0..3]`,
`[7..11]`, `[13..17]` are non-overlapping octet windows into the
SHA-256 output. The resulting 48-bit string is concatenated and
returned as the structural fingerprint.

The rotation ensemble (the choice of three non-overlapping windows
combined by XOR before parity) yields, in inventor's empirical
observation, an approximately uniform distribution over the
fingerprint space when applied to large heterogeneous record
populations, while preserving structural similarity (records with
similar canonical-JSON byte content yield fingerprints with low
Hamming distance with high probability). The 48-bit width is chosen
to balance collision probability (negligible for universes up to
~2²² records) against in-database storage cost and indexability.

### C. Four-dimensional geometric score generator (Figure 3)

For an input fingerprint `f` and a peer universe `U` of
fingerprints, the score generator computes:

1. **Composite score** = a learned-coefficient linear combination
   of the three component scores, normalized to [0, 1].

2. **Anomaly score** = `1 − rank_pct(f, U)` where `rank_pct` is
   the percentile rank of `f` along the dominant geometric axis
   of `U` derived by deterministic principal-component analysis.

3. **Reconstruction score** = `1 − error( f, U \ {f} )` where
   `error` is the bit-error rate of reconstructing `f` from a
   parity-check basis derived from the universe minus `f`.

4. **Diversity score** = a function of the entropy of the
   Hamming-distance distribution from `f` to its `k`-nearest
   neighbors in `U`, normalized to [0, 1].

All four computations are deterministic given `(f, U, seed)`. In
a preferred embodiment, the universe `U` is the entire set of
fingerprints present in the host data source at score-computation
time; in alternative embodiments, `U` may be a sliding window
over a streaming source or a tenant-scoped subset.

### D. PostgreSQL extension embodiment (Figure 4)

The adapter is packaged as a PostgreSQL extension (`pg_latentocean`)
that, when installed on a database, exposes the functions
`lo_fingerprint(record JSONB) RETURNS BIT(48)` and
`lo_score(fp BIT(48)) RETURNS JSONB` as user-defined functions.
Tables are augmented in-place via:

```sql
ALTER TABLE <target>
    ADD COLUMN lo_fp     BIT(48) GENERATED ALWAYS AS
                                  (lo_fingerprint(row_to_json(<target>))) STORED,
    ADD COLUMN lo_score  JSONB   GENERATED ALWAYS AS
                                  (lo_score(lo_fp)) STORED;
```

The generated columns are populated server-side and remain in sync
with row inserts, updates, and deletes. Existing application
queries continue to operate unchanged; new queries may filter or
order by `lo_score ->> 'composite'` and similar.

### E. Snowflake external-function embodiment (Figure 5)

The adapter is exposed to Snowflake as external functions via
`CREATE EXTERNAL FUNCTION`. The same fingerprint and score
generators execute against Snowflake row representations
(`OBJECT_CONSTRUCT(*)`) yielding bit-identical outputs to the
PostgreSQL embodiment.

### F. MongoDB aggregation-stage embodiment (Figure 6)

The adapter is exposed to MongoDB as native aggregation-pipeline
stages (`$lo: { fingerprint: ... }` and `$lo: { score: ... }`)
that operate on documents within any pipeline. The same generators
execute against BSON document representations, again bit-identical
to the relational embodiments.

### G. Edge-installable embodiment (Figure 7)

The adapter is packaged as a single static-linked binary
(approximately 8 megabytes) that runs on low-power edge devices
(ARM Cortex-M class and above) without operating-system
dependencies beyond a POSIX-compatible runtime. The binary
ingests streaming records via stdin or a local Unix-domain socket
and emits fingerprint plus score on stdout or the same socket.
No network connectivity is required at any point in the device's
operation; the universe `U` may be a local rolling window
maintained in device memory, persisted to local storage, or
periodically synchronized with an upstream universe via an
out-of-band transport at the operator's discretion.

The edge embodiment is intended for and applicable to fully
air-gapped deployments in which the device is physically
disconnected from external networks, including but not limited to
sovereign, defense, classified, industrial-control, and high-
assurance contexts.

### H. Model Context Protocol tool embodiment (Figure 8)

The adapter is exposed as an MCP-compliant tool surface
(`latentocean.fingerprint`, `latentocean.score`) invocable by
autonomous agents. The tool accepts a JSON record payload and
returns a JSON response containing the fingerprint (as a 12-character
hexadecimal string) and the four-dimensional score vector. The
MCP embodiment makes the adapter available to any agent runtime
implementing the protocol, including but not limited to local-
language-model agents, hosted-agent platforms, and sovereign
agent installations.

### I. Cross-embodiment bit-identity guarantee (Figure 9)

The fingerprint and score outputs are bit-identical across all of
the foregoing embodiments given identical (record, universe,
seed). This property is asserted by the adapter at integration
time via a self-test: a fixed canonical record is fingerprinted
and scored, and the result is compared against an embedded
reference value; integration is rejected if the values diverge.
The cross-embodiment bit-identity guarantee is the foundation for
the deployment-mode invariance described in
provisional_02_operational_primitives_handback.

### J. Relationship to the open-source data-reduction engine

In a preferred embodiment, the universe `U` against which scores
are computed may be produced by an upstream data-reduction engine
of the type known in the art as BTUT (Bounded-Threshold Universal
Tessellation), which the inventor has elected to release as open-
source software under a permissive license. The present invention
does not claim BTUT; it claims the universal adapter that operates
on the fingerprint-and-score primitive applied to any universe,
whether produced by BTUT, by classical data-reduction methods, or
by raw enumeration of the host data source. The adapter is
operable without BTUT.

## VII. Claims

The following claims are illustrative and non-limiting.

1. A computer-implemented system comprising:
   (a) a fingerprint generator configured to receive a structured
       record and to emit, as a pure function of (i) said record
       and (ii) a global seed value, a fixed-bit-width structural
       fingerprint computed by canonical serialization of said
       record followed by a parity-XOR rotation ensemble over a
       cryptographic hash family;
   (b) a score generator configured to receive said fingerprint and
       a peer universe of fingerprints and to emit, as a pure
       function thereof, a four-dimensional geometric score vector
       comprising a composite, anomaly, reconstruction, and
       diversity component, each in the range [0, 1];
   (c) an adapter surface exposing said fingerprint generator and
       said score generator to a host data system with at least
       three operative embodiments selected from the group
       consisting of: a relational-database extension, a
       columnar-warehouse external function, a document-store
       aggregation stage, an edge-resident standalone binary, and
       a Model Context Protocol tool surface;
   (d) a bit-identity guarantee whereby said fingerprint generator
       and said score generator produce, given identical record,
       universe, and seed inputs, bit-identical outputs across all
       said embodiments.

2. The system of claim 1 wherein the fixed bit-width of said
   fingerprint is 48 bits.

3. The system of claim 1 wherein the canonical serialization
   comprises sorted-key JSON with NFC-normalized strings and
   shortest-round-trip numeric rendering.

4. The system of claim 1 wherein the parity-XOR rotation ensemble
   comprises, for each output bit, a parity computation over an
   exclusive-OR of three non-overlapping octet windows of a
   SHA-256 hash output.

5. The system of any preceding claim wherein the score generator's
   composite component is a deterministic linear combination of
   the anomaly, reconstruction, and diversity components with
   operator-configurable coefficients.

6. The system of any preceding claim further comprising a
   PostgreSQL extension exposing the fingerprint generator as a
   user-defined function `lo_fingerprint(record JSONB) RETURNS
   BIT(48)` and the score generator as a user-defined function
   `lo_score(fp BIT(48)) RETURNS JSONB`, said functions being
   wired to a target table via `GENERATED ALWAYS AS ... STORED`
   column declarations.

7. The system of any preceding claim further comprising a
   Snowflake external-function declaration exposing the
   fingerprint and score generators as scalar UDFs over
   `OBJECT_CONSTRUCT(*)` row representations.

8. The system of any preceding claim further comprising a
   MongoDB aggregation-stage declaration exposing the
   fingerprint and score generators as `$lo` pipeline stages.

9. The system of any preceding claim further comprising a
   single-static-binary edge-installable embodiment under
   approximately ten megabytes operating without network
   connectivity in an air-gapped configuration.

10. The system of any preceding claim further comprising a
    Model Context Protocol tool surface exposing the
    fingerprint and score generators as MCP-compliant tools
    invocable by an autonomous agent runtime.

11. The system of any preceding claim wherein the adapter's
    integration self-test fingerprints a fixed canonical
    reference record and compares the result against an
    embedded reference value, rejecting integration if the
    results diverge.

12. A computer-implemented method comprising the operations
    recited in any of claims 1–11.

13. A non-transitory computer-readable medium storing
    instructions that, when executed by one or more processors,
    cause said processors to perform the operations recited in
    any of claims 1–11.

14. The system of any preceding claim wherein the peer universe
    of fingerprints is sourced from an open-source data-reduction
    engine, a streaming rolling window, a tenant-scoped subset
    of a host data source, or an enumeration of the entire host
    data source.

## VIII. Abstract

A universal structural adapter is disclosed for mounting in-place
on any structured data source — relational, document, streaming,
or edge-resident — and augmenting each record of that source
with a deterministic, reproducible 48-bit structural fingerprint
and a four-dimensional geometric score vector. The fingerprint is
constructed by parity-XOR rotation-ensemble hashing over a
canonical-JSON serialization of the record under a fixed seed,
yielding bit-identical outputs across runtimes. The score vector
comprises composite, anomaly, reconstruction, and diversity
components, each computed deterministically as a function of the
fingerprint relative to a peer universe. The adapter is exposed
in-place as a PostgreSQL extension, a Snowflake external function,
a MongoDB aggregation stage, an edge-installable static binary
operable in fully air-gapped configurations, and a Model Context
Protocol tool surface for autonomous-agent runtimes; outputs are
bit-identical across all embodiments given identical inputs,
universe, and seed.

---

*This document is a provisional application drafted by the
applicant for filing under 35 U.S.C. § 111(b). It has not been
reviewed by registered patent counsel. Applicant is advised to
have counsel review the application before filing, and to convert
to a non-provisional application under 35 U.S.C. § 111(a) within
twelve (12) months of the filing date in order to preserve the
priority claim.*
