# Provisional Patent Application

**Title:** Two-Engine Deterministic Discovery Pipeline Composing a Structural-Fingerprint Substrate with a Self-Organizing Topological-Crystallization Module Layer, with Reproducibility Across Heterogeneous Deployment Environments

**Filing type:** Provisional Application for Patent (35 U.S.C. § 111(b))

**Inventor(s):** [to be supplied by applicant]

**Assignee:** [to be supplied by applicant]

**Priority date:** [date of this provisional filing]

---

## I. Cross-References to Related Applications

This application claims subject matter related to two
commonly-owned, separately-filed provisional applications:

(a) "Systems and Methods for Deterministic Structural
Fingerprinting of Arbitrary Data Records with Integrated
Falsifiability Testing and Modality-Agnostic Outlier Detection"
(provisional_01_btut_primitive), describing the upstream
fingerprint substrate; and

(b) "Systems and Methods for Self-Organizing Predictor Module
Discovery in Joint Embedding Predictive Architectures via
Persistent-Homology Crystallization of Latent-Space Exploration
Trajectories" (provisional_02_tcd_jepa), describing the
downstream predictor-discovery layer.

The present invention is independent of either of (a) or (b)
considered alone, and is directed instead to the *composition* of
the two — including specific data-flow contracts, deterministic
boundary properties, deployment-mode invariants, and database
embodiments — that the inventor has discovered to yield
capabilities and guarantees not present in either component
operated standalone.

## II. Field of the Invention

The present invention relates to data-processing pipelines for
structural discovery on heterogeneous data, and more particularly
to systems and methods composing a deterministic per-record
fingerprint primitive with a self-organizing topological
predictor-module layer in a single end-to-end pipeline whose
output is reproducible across cloud-managed, on-premises, and
fully air-gapped deployment environments.

## III. Background

### A. Composability problems in deterministic-plus-probabilistic stacks

Modern machine-learning systems frequently combine deterministic
components (database engines, hash functions, classical algorithms)
with probabilistic components (neural networks, sampling-based
inference, generative models). Such composed systems typically
*lose* determinism at the boundary: even where the upstream
component produces bit-identical output across runs, the
downstream probabilistic component introduces non-replayable
behavior — non-deterministic kernels in floating-point
accumulation, non-replayable random initialization, hardware-
dependent implementations of stochastic operators, and so on.

The loss of end-to-end determinism is consequential in regulated
deployments: an audit committee, regulator, or due-diligence
examiner cannot reproduce the system's findings to verify them,
even given identical inputs and source code.

### B. Deployment-mode drift in commercial machine-learning systems

Commercially-deployed machine-learning systems are commonly
offered in multiple deployment modes — for example, multi-tenant
cloud SaaS; single-tenant on-premises; and air-gapped, network-
isolated installations for defense or regulated-industry
customers. In conventional architectures, the system's outputs
diverge across these modes due to differences in: GPU model and
CUDA version; cloud-managed model versions automatically updated
by the vendor; per-tenant random seeds; observability tooling
that injects per-tenant identifiers into logs and outputs; and
similar.

A customer evaluating findings produced in the SaaS mode and
the air-gap mode of the same product receives *materially
different* outputs and cannot transitively trust either against
the other.

### C. The problem addressed

There exists a need for a composed discovery pipeline that
(i) joins a deterministic fingerprint substrate with a
self-organizing predictor layer in a manner that preserves
end-to-end determinism subject to a fixed random seed; (ii)
guarantees byte-identical outputs across cloud, on-premises, and
air-gapped deployment modes given identical inputs; and (iii)
provides cryptographically-verifiable evidence of equivalence
across modes.

## IV. Summary of the Invention

The present invention provides a composed two-engine discovery
pipeline in which:

1. An upstream **fingerprint engine** (the "Substrate Engine"),
   embodying a deterministic structural-fingerprint primitive,
   produces for each input record a fixed-width structural
   fingerprint, a multi-dimensional score vector, and a
   reproducibility digest.

2. A downstream **predictor-discovery engine** (the "Discovery
   Engine"), embodying a self-organizing predictor-module
   crystallization process, consumes the fingerprinted records
   and the structural-similarity geometry implied by the
   fingerprints, and emits crystallized predictor modules, each
   tagged with a provenance trace back to the fingerprinted
   records that contributed to its formation.

3. A **deterministic boundary layer** between the two engines
   that (i) freezes the fingerprint outputs in a content-addressed
   cache before they enter the Discovery Engine; (ii) seeds the
   Discovery Engine's stochastic operators from a pseudo-random
   stream itself derived from the SHA-256 of the cached
   fingerprint set; and (iii) records all hardware-influenced
   numerical decisions (e.g. floating-point reduction order) in
   a deterministic-execution manifest.

4. A **deployment-invariant emission interface** that, for each
   produced finding, accompanies the finding with a
   reproducibility digest computed jointly over (a) the input
   universe, (b) the fingerprint outputs, (c) the deterministic-
   execution manifest, and (d) the crystallized module set. Two
   deployments — one cloud, one air-gapped — operating on
   identical input universes will produce findings with
   bit-identical reproducibility digests if and only if their
   outputs are byte-equivalent.

5. **Database-embodiment connectors** by which the composed
   pipeline is exposed in-place inside relational, columnar, and
   document database systems, including: a Postgres extension
   exposing the composed pipeline as user-defined functions and
   generated columns; a Snowflake external function exposing the
   same composed pipeline as scalar UDFs over JSON-serialized
   rows; and a MongoDB aggregation stage exposing the same
   composed pipeline over BSON documents.

The invention's novelty resides in (a) the deterministic-boundary
architecture between the fingerprint substrate and the
self-organizing predictor layer; (b) the cryptographic
deployment-invariant interface; and (c) the multi-platform
in-database embodiment of the composed pipeline as a single
queryable primitive.

## V. Brief Description of the Drawings

**Figure 1.** End-to-end pipeline diagram: input records → Substrate
Engine → content-addressed cache → Discovery Engine → output
findings, with the deterministic boundary layer highlighted.

**Figure 2.** Detail of the deterministic boundary layer, showing
the fingerprint cache, the SHA-256-derived seed stream, and the
deterministic-execution manifest.

**Figure 3.** Three side-by-side deployment topologies (SaaS;
on-premises; air-gapped) with annotation showing where the
pipeline's components reside in each, and arrows showing equivalence
of the output reproducibility digest.

**Figure 4.** Postgres-extension embodiment: pseudo-DDL
illustrating `lo_fingerprint`, `lo_score`, and `lo_module_predict`
as generated columns and user-defined functions over a `filings`
table.

**Figure 5.** Snowflake-embodiment: external-function declaration
illustrating the same composed pipeline exposed as scalar UDFs.

**Figure 6.** MongoDB-aggregation embodiment: pipeline-stage
example illustrating the composed pipeline applied as a
`$lo` aggregation stage.

**Figure 7.** Reproducibility-digest verification flow: two
independent deployments produce findings; the digests are
compared and equality is asserted.

## VI. Detailed Description

### A. Substrate Engine interface

The Substrate Engine exposes the following interface to the
Discovery Engine:

```
struct SubstrateOutput {
    record_id        : RecordId;
    fingerprint      : bit(48);
    scores           : ScoreVec;     // {composite, anomaly, recon, diversity}
    null_test        : NullTestResult;
    seed             : uint64;
    universe_digest  : SHA256;       // hash of sorted-top-K of universe
}
```

The Substrate Engine's outputs are deterministic functions of
its inputs and seed; it imposes no stochastic operations
between input ingestion and output emission. Its determinism
properties are described in detail in the Substrate Engine's
own application (referenced above).

### B. Deterministic boundary layer

The deterministic boundary layer comprises three components:

1. **Content-addressed fingerprint cache.** Each
   `SubstrateOutput` is written to an immutable cache entry
   keyed by `SHA-256(record_id ‖ fingerprint ‖ seed)`. The
   cache is the only path by which the Discovery Engine
   accesses Substrate outputs. The cache may be backed by a
   key-value store (Redis, RocksDB, etc.), a content-addressable
   filesystem, or an object store with content-hash addressing.

2. **Seed-stream derivation.** The Discovery Engine's
   pseudo-random number generator is initialized from a stream
   defined by

   ```
   PRG_seed_t = SHA-256(global_seed || universe_digest || iteration_t)
   ```

   where `global_seed` is the operator-supplied 64-bit seed,
   `universe_digest` is taken from the SubstrateOutput, and
   `iteration_t` is an incrementing counter. No other source of
   randomness is consulted by the Discovery Engine.

3. **Deterministic-execution manifest.** During execution, the
   Discovery Engine records to a manifest file every
   numerically-influenced decision that depends on hardware:
   the reduction order of floating-point summations longer than
   a configurable threshold; the dispatch path chosen for matrix
   multiplications; the GPU-kernel version when applicable;
   and any other hardware-dependent algorithmic choice. The
   manifest is emitted as a structured JSON artifact alongside
   the Discovery Engine's output.

In strict-deterministic mode, the Discovery Engine refuses to
proceed if any operation would introduce non-recordable
non-determinism; in best-effort mode, it records a warning in
the manifest and continues.

### C. Deployment-invariant emission interface

Each finding produced by the composed pipeline is emitted as a
tuple

```
{
    finding_id           : UUID,
    payload              : <finding payload>,
    substrate_provenance : list[SHA-256],  // fingerprint cache keys
    discovery_provenance : SHA-256,        // module set hash
    manifest             : SHA-256,        // deterministic-execution manifest hash
    repro_digest         : SHA-256         // outer hash of the above
}
```

The `repro_digest` is computed as `SHA-256` over the canonical
serialization of all preceding fields. Two deployments that
produced identical findings will produce identical
`repro_digest` values. Conversely, any divergence in input,
intermediate state, or numerical execution path will produce
divergent `repro_digest` values, providing a single-comparison
test of cross-deployment equivalence.

### D. SaaS, on-premises, and air-gapped embodiments

In the **SaaS embodiment**, the Substrate Engine, Discovery
Engine, and emission interface execute on infrastructure
managed by the operator on behalf of multiple tenants. Per-tenant
isolation is achieved at the database and namespace layer; the
deterministic boundary layer ensures that tenant-A and tenant-B
provided with identical inputs receive identical outputs.

In the **on-premises embodiment**, the same software artifacts
are deployed inside a customer's data center, with no managed
component remaining under the operator's control. The
deterministic boundary layer permits the customer to verify,
via the `repro_digest`, that on-premises outputs match a
reference SaaS output for the same input universe.

In the **air-gapped embodiment**, the system operates with no
network connectivity; all dependencies (model weights, ontology
files, configuration) are bundled into the deployable artifact.
The deterministic boundary layer ensures that an air-gapped
deployment produces `repro_digest` values identical to a
network-connected deployment provided with the same input
universe and seed.

The byte-identity guarantee across the three modes — SaaS,
on-premises, air-gapped — is the central novel property of the
present invention.

### E. Postgres-extension embodiment

In a particular preferred embodiment, the composed pipeline is
exposed to a PostgreSQL database as the `pg_latentocean`
extension. Pseudo-DDL of an example application:

```sql
CREATE EXTENSION pg_latentocean;

ALTER TABLE filings
    ADD COLUMN lo_fp        bit(48) GENERATED ALWAYS AS (lo_fingerprint(row_to_json(filings))) STORED,
    ADD COLUMN lo_score     jsonb   GENERATED ALWAYS AS (lo_score(lo_fp)) STORED,
    ADD COLUMN lo_module_id text    GENERATED ALWAYS AS (lo_module_predict(lo_fp)) STORED;

-- Find structural outliers
SELECT cik, concept, (lo_score ->> 'composite')::float AS composite
FROM   filings
ORDER  BY composite DESC
LIMIT  10;

-- Verify falsifiability
SELECT lo_null_test('filings', dims => ARRAY['composite'], iterations => 500);

-- Inspect crystallized modules
SELECT * FROM lo_modules() ORDER BY contribution DESC;
```

The extension wraps both engines and their boundary layer; the
generated columns are populated server-side and remain in sync
with row inserts and updates.

### F. Snowflake-embodiment

In an alternative embodiment, the composed pipeline is exposed
to Snowflake via external functions. Pseudo-DDL:

```sql
CREATE OR REPLACE EXTERNAL FUNCTION LO_FINGERPRINT(payload VARIANT)
    RETURNS BINARY
    API_INTEGRATION = lo_api_integration
    AS 'https://api.latentocean.com/v1/fingerprint';

CREATE OR REPLACE EXTERNAL FUNCTION LO_SCORE(fp BINARY)
    RETURNS VARIANT
    API_INTEGRATION = lo_api_integration
    AS 'https://api.latentocean.com/v1/score';

CREATE OR REPLACE TABLE customers_structured AS
    SELECT *,
           LO_FINGERPRINT(OBJECT_CONSTRUCT(*))           AS lo_fp,
           LO_SCORE(LO_FINGERPRINT(OBJECT_CONSTRUCT(*))) AS lo_score
    FROM   customers;
```

Identical semantics to the Postgres-extension embodiment are
guaranteed by the deterministic boundary layer.

### G. MongoDB-embodiment

In a further alternative embodiment, the composed pipeline is
exposed as a MongoDB aggregation stage. Pseudo-aggregation:

```javascript
db.papers.aggregate([
    { $lo: { fingerprint: "$$ROOT", bits: 48 } },
    { $lo: { score: "$lo_fp" } },
    { $match: { "lo_score.composite": { $gte: 0.85 } } },
    { $sort:  { "lo_score.composite": -1 } },
    { $limit: 20 }
]);
```

### H. Cross-embodiment verification

The deployment-invariant `repro_digest` permits a single
verification operation across embodiments: a customer running
the composed pipeline as a Postgres extension on-premises may
compare the digest of a finding to a digest of the same finding
produced by the same operator's SaaS instance over the same
input universe. Equality of digests certifies that the two
deployments produced byte-identical output.

## VII. Claims

The following claims are illustrative and non-limiting.

1. A computer-implemented system comprising:
   (a) a substrate engine configured to receive an input record
       and emit a deterministic structural fingerprint, a score
       vector, and a content-addressed cache key for the record;
   (b) a discovery engine configured to receive said fingerprints
       from said cache and to emit, in response thereto, one or
       more crystallized predictor modules whose architectural
       parameters are determined by topological features of the
       fingerprint set; and
   (c) a deterministic boundary layer disposed between (a) and
       (b), said boundary layer configured to (i) freeze
       substrate outputs in a content-addressed cache before
       discovery-engine consumption, (ii) seed the discovery
       engine's pseudo-random operators from a hash chain
       derived from said cache contents, and (iii) record all
       hardware-influenced numerical decisions in a
       deterministic-execution manifest.

2. The system of claim 1 further comprising an emission interface
   that, for each finding, computes a reproducibility digest
   over the substrate provenance, the discovery provenance, and
   the deterministic-execution manifest, said digest being
   byte-identical across deployments operating on identical
   inputs and seeds.

3. The system of any preceding claim wherein the system is
   deployable in a multi-tenant cloud-managed mode, a
   single-tenant on-premises mode, and a network-isolated
   air-gapped mode, each mode producing reproducibility digests
   byte-identical to the others for identical input universes
   and seeds.

4. The system of any preceding claim wherein the substrate
   engine and discovery engine are exposed in-place inside a
   relational database management system as one or more user-
   defined functions, generated columns, or aggregation stages.

5. The system of claim 4 wherein the relational database
   management system is selected from the group consisting of
   PostgreSQL, Snowflake, and MongoDB.

6. The system of any preceding claim wherein the deterministic
   boundary layer is operable in a strict-deterministic mode
   in which any unrecordable non-deterministic operation aborts
   processing, and a best-effort mode in which such operations
   are recorded with warnings in the deterministic-execution
   manifest.

7. The system of any preceding claim wherein the substrate
   engine is the structural-fingerprint primitive disclosed in
   commonly-owned provisional application
   provisional_01_btut_primitive, and the discovery engine is
   the self-organizing predictor-module crystallization system
   disclosed in commonly-owned provisional application
   provisional_02_tcd_jepa.

8. A computer-implemented method comprising the operations
   recited in any of claims 1–7.

9. A non-transitory computer-readable medium storing
   instructions that, when executed by one or more processors,
   cause said processors to perform the operations recited in
   any of claims 1–7.

10. The system of any preceding claim wherein the
    reproducibility digest of claim 2 is computed as a SHA-256
    hash over a canonical serialization of (a) substrate
    fingerprint cache keys, (b) the deterministic-execution
    manifest hash, and (c) the discovery provenance hash, in
    that order, with sorted-key-first JSON canonicalization
    used at each stage.

## VIII. Abstract

A composed two-engine discovery pipeline is disclosed in which a
deterministic structural-fingerprint substrate engine is joined
to a self-organizing topological-crystallization discovery
engine through a deterministic boundary layer comprising a
content-addressed fingerprint cache, a hash-chain pseudo-random
seed stream, and a deterministic-execution manifest. Each
finding produced by the pipeline is accompanied by a
cryptographic reproducibility digest computed jointly over its
inputs, intermediate state, and emitted output, with the
property that two deployments — one cloud-managed, one
on-premises, one air-gapped — produce byte-identical digests
when given byte-identical inputs and seeds. The composed
pipeline is exposed in-place inside relational and document
database systems via user-defined functions, generated columns,
and aggregation stages, providing a single queryable primitive
across PostgreSQL, Snowflake, and MongoDB embodiments.

---

*This document is a provisional application drafted by the
applicant for filing under 35 U.S.C. § 111(b). It has not been
reviewed by registered patent counsel. Applicant is advised to
have counsel review the application before filing, and to convert
to a non-provisional application under 35 U.S.C. § 111(a) within
twelve (12) months of the filing date in order to preserve the
priority claim.*
