# Provisional Patent Application

**Title:** Five Operational Primitives and a Convergence Hand-Back Loop for a Self-Improving Structural Substrate, with Cryptographic Cross-Deployment Equivalence Verification across SaaS, On-Premises, Air-Gapped, and Edge Environments

**Filing type:** Provisional Application for Patent (35 U.S.C. § 111(b))

**Inventor(s):** [to be supplied by applicant]

**Assignee:** [to be supplied by applicant]

**Priority date:** [date of this provisional filing]

---

## I. Cross-References to Related Applications

This application is related in subject matter to two commonly-owned,
separately-filed provisional applications:

(a) "Universal Structural Adapter for Heterogeneous Data Sources"
(provisional_01_latent_ocean_universal_adapter), describing the
upstream structural-fingerprint and score-vector primitive on
which the operational primitives of the present invention
operate; and

(b) "Crystara: Runtime Topological Module Crystallization via
Persistent-Homology of Fisher-Information-Preconditioned Langevin
Trajectories" (provisional_03_crystara), describing a downstream
training paradigm that may consume the structurally-enriched
corpora emitted by the hand-back operation of the present
invention.

The present invention may be practiced independently of either
application, but is described in preferred embodiment as
operating on the upstream primitive of (a) and as optionally
emitting to the downstream paradigm of (b).

## II. Field of the Invention

The present invention relates to data-substrate platforms, and
more particularly to apparatus, methods, and computer-program
products implementing a coherent set of five callable operational
primitives — *mount*, *score*, *falsify*, *digest*, and
*hand-back* — together with an architectural convergence loop in
which the structurally-enriched outputs of said primitives are
returned to the substrate as new mountable inputs, and a
cryptographic mechanism whereby the substrate's operation is
verifiably equivalent across cloud-managed, on-premises,
air-gapped, and edge deployment environments.

## III. Background

### A. The fragmentation of substrate operations in current data platforms

Current data platforms expose distinct, separately-implemented
operations for data ingestion (ETL/ELT pipelines), enrichment
(feature stores, data-quality tools), validation (statistical
testing libraries, data-observability platforms), audit
(provenance and lineage systems), and feedback (active-learning
or fine-tuning pipelines). Each operation is typically delivered
by a different software product with a different interface,
configuration model, and operational discipline. The cumulative
operational complexity is substantial, and the lack of a common
interface across operations forecloses reasoning about the
substrate as a whole.

There is a need for a small, fixed set of orthogonal operational
primitives that together constitute a complete substrate
interface, such that any application of the substrate can be
expressed as a sequence of calls to said primitives.

### B. The absence of an architectural feedback loop in classical data substrates

Classical data warehouses, lakehouses, and feature stores
operate as one-way pipelines: raw data flows in, enriched data
flows out, and the pipeline state is independent of downstream
consumption. There is no architectural mechanism by which the
*outputs* of substrate operations are systematically fed back
into the substrate as new inputs that, in turn, enrich
subsequent operations. Such feedback exists informally in
machine-learning training loops (active learning, continual
learning), but is not exposed as a substrate-level architectural
primitive nor accompanied by guarantees of structural
enrichment, deterministic operation, or convergence.

There is a need for an architectural feedback primitive, exposed
at the substrate level, by which the structurally-enriched
output of substrate operations becomes a new mountable input
to the substrate, with operationally-measurable convergence.

### C. The cross-deployment equivalence problem in sovereign and regulated procurement

Substrate platforms commonly deploy in multiple environments:
multi-tenant cloud SaaS, single-tenant on-premises installations,
fully network-isolated air-gapped sovereign deployments, and
edge-resident installations on isolated devices. In conventional
architectures, equivalent inputs presented to different
deployment environments produce *non-equivalent* outputs, owing
to differences in floating-point reduction order, hardware
acceleration kernels, automatically-applied vendor model
updates, observability instrumentation that injects per-tenant
identifiers, and similar implementation details.

The non-equivalence is consequential in sovereign and regulated
procurement: a customer cannot certify that an air-gapped
deployment's outputs match a reference SaaS deployment, even
when that certification is required as a procurement
precondition. The customer is reduced to vendor attestation
rather than cryptographic verification.

There is a need for a cryptographic mechanism by which a
substrate's operation can be verified, in a single comparison,
to be equivalent across deployment environments given identical
inputs.

### D. The problem addressed

There exists a need for a substrate platform comprising
(i) a fixed, small set of orthogonal operational primitives that
together constitute the substrate's complete interface;
(ii) an architectural feedback primitive whereby the substrate's
own outputs become new substrate inputs in a measurable
convergence loop; and (iii) a cryptographic equivalence
verification operating across SaaS, on-premises, air-gapped, and
edge embodiments such that two deployments producing identical
outputs on identical inputs may be cryptographically certified
as equivalent in a single comparison.

## IV. Summary of the Invention

The present invention provides a substrate platform exposing
five callable operational primitives and one architectural loop:

### Primitive 1 — MOUNT

`lo_mount(target, options)` instruments a host data source
(table, collection, stream, or edge buffer) by binding the
universal structural adapter described in
provisional_01_latent_ocean_universal_adapter to the source.
After mount, every record of the source acquires (i) a
deterministic structural fingerprint as a generated column or
equivalent surface, and (ii) a four-dimensional score vector
as a second generated column or equivalent surface. The mount
operation is idempotent; mounting an already-mounted source is
a no-op.

### Primitive 2 — SCORE

`lo_score(fingerprint)` returns the four-dimensional geometric
score vector for a given fingerprint relative to the substrate's
current peer universe. The score is a deterministic pure
function of `(fingerprint, universe, seed)`. The primitive is
callable both row-by-row at insertion time (via the mount-bound
generated column) and ad-hoc against arbitrary fingerprints at
query time.

### Primitive 3 — FALSIFY

`lo_null_test(scope, dimensions, iterations)` performs a
permutation null-test over a specified scope of the substrate
along specified score dimensions, returning a structured
falsifiability report comprising a z-score, a p-value, the
number of iterations performed, and the seed under which the
permutations were drawn. The primitive provides single-call
falsifiability of any ranking, scoring, or anomaly assertion
the substrate has produced. The null-test result is a
deterministic pure function of `(scope, dimensions, iterations,
seed)`.

### Primitive 4 — DIGEST

`lo_repro_digest(scope)` returns a SHA-256 hash computed over a
canonical serialization of the substrate's outputs within the
specified scope, including (i) the fingerprints of every record
in scope, (ii) the score vectors thereof, (iii) any null-test
reports computed for the scope, and (iv) the substrate's
deterministic-execution manifest for the scope. The digest is
the cryptographic anchor for cross-deployment equivalence
verification: two substrate deployments operating on identical
inputs and seeds produce identical digests if and only if their
substrate states are equivalent. A single digest comparison
suffices to verify equivalence.

### Primitive 5 — HAND-BACK

`lo_handback(scope, target_substrate, options)` emits a
structurally-enriched corpus from the specified scope of the
substrate as a new mountable input to either (i) the same
substrate (closing the convergence loop) or (ii) a downstream
substrate (including, in a preferred embodiment, the training
paradigm of provisional_03_crystara). The emitted corpus
includes, for each record in scope, the original record content
augmented with the structural fingerprint, the score vector,
any null-test reports relevant to the record, and the
reproducibility digest of the scope at emission time. The
hand-back operation is the substrate-level architectural
primitive whereby substrate outputs become substrate inputs.

### Architectural feature — Convergence Hand-Back Loop

The substrate exposes a cyclic architectural pattern in which
hand-back outputs are mounted as new substrate inputs, generating
new fingerprints and score vectors over the enriched corpus,
which in turn may be falsified, digested, and handed back again.
The loop is monitored by a convergence indicator `C(t)` defined
in the detailed description, signaling stable equilibrium when
the structural enrichment per loop iteration falls below an
operator-configured threshold. The convergence loop is the
mechanism by which a substrate continuously improves its own
structural model of its data universe without external
intervention.

### Cryptographic Cross-Deployment Equivalence

For any scope of the substrate, the digest primitive operating
in two different deployment environments — for example, a
multi-tenant cloud SaaS deployment and a fully-air-gapped
sovereign deployment — produces identical digest values if and
only if the two deployments produced byte-identical outputs on
byte-identical inputs under identical seeds. A single digest
comparison certifies cross-deployment equivalence; non-identity
of the digest values is equally informative as proof of
divergence at one or more substrate operations.

The novelty of the invention resides in (a) the specific choice of
five orthogonal primitives that together constitute a complete
substrate interface; (b) the convergence hand-back loop as a
substrate-level architectural primitive distinct from
informally-coupled active-learning loops in machine-learning
contexts; (c) the cryptographic cross-deployment equivalence
verification as a single-comparison operation; and (d) the
combination thereof yielding a substrate that is simultaneously
verifiable, falsifiable, and self-improving across heterogeneous
deployment environments.

## V. Brief Description of the Drawings

**Figure 1.** System diagram of the five primitives MOUNT, SCORE,
FALSIFY, DIGEST, HAND-BACK exposed as the substrate's complete
interface, with each primitive's input/output flow annotated.

**Figure 2.** The convergence hand-back loop: scope flows from
substrate through HAND-BACK, becomes a new mountable input
through MOUNT, undergoes enrichment, and may flow through
HAND-BACK again, with the convergence indicator `C(t)`
monitoring loop equilibrium.

**Figure 3.** Cross-deployment equivalence verification: identical
inputs presented to a SaaS deployment, an on-premises deployment,
an air-gapped deployment, and an edge deployment yield identical
DIGEST values if and only if the deployments produced equivalent
outputs.

**Figure 4.** Detail of the FALSIFY primitive: permutation
null-test over a scope, returning z-score, p-value, iterations,
and seed; the report is itself an input to subsequent DIGEST
calls.

**Figure 5.** Detail of the DIGEST primitive: canonical
serialization of fingerprints, scores, null-test reports, and
deterministic-execution manifest into a single SHA-256 hash.

**Figure 6.** Detail of the HAND-BACK primitive: scope is
serialized into a hand-back artifact comprising original record
content augmented with fingerprint, score vector, null-test
report, and reproducibility digest; the artifact is mountable
by any substrate via MOUNT.

**Figure 7.** A sequence diagram illustrating one iteration of
the convergence loop: MOUNT → SCORE (generated) → FALSIFY →
DIGEST → HAND-BACK → MOUNT (next iteration).

**Figure 8.** Convergence-indicator timeline showing `C(t)`
decreasing across loop iterations until it falls below the
operator-configured stable-equilibrium threshold.

## VI. Detailed Description

### A. The MOUNT primitive

The mount operation accepts a target identifier (table name in a
relational embodiment; collection name in a document embodiment;
stream identifier in a streaming embodiment; buffer handle in an
edge embodiment) and a configuration options object specifying,
inter alia, the seed, the universe scope, and any per-tenant
isolation parameters.

Mount binds the universal structural adapter described in the
related provisional to the target. In the relational embodiment,
mount installs `GENERATED ALWAYS AS ... STORED` columns onto the
target table; in the document embodiment, mount installs a
per-document materialized field via the underlying engine's
materialized-view mechanism; in the streaming embodiment, mount
inserts a per-record processor into the stream's processing
graph; in the edge embodiment, mount activates the on-device
binary's processing mode.

Mount is idempotent: a second mount call with identical options
on an already-mounted target is a no-op and emits an
informational return value.

### B. The SCORE primitive

The score operation accepts a fingerprint and emits the
four-dimensional score vector relative to the substrate's current
universe. The vector comprises the composite, anomaly,
reconstruction, and diversity components defined in the universal
adapter primitive. The score is a pure deterministic function of
`(fingerprint, universe, seed)`; equal inputs guarantee equal
outputs across all substrate embodiments.

In ordinary use, the score for a record is computed
automatically at insertion time by the mount-bound surface, so
explicit `lo_score()` calls are typically used for ad-hoc
analysis, post-hoc re-scoring after universe expansion, or
inspection by downstream tools.

### C. The FALSIFY primitive

The falsify operation accepts (i) a scope (table, collection,
stream window, or arbitrary subset selector), (ii) a list of
score dimensions to test, and (iii) an iteration count for
permutation. The operation samples `N` permutations of the score
values over the scope, computes the test statistic for each, and
returns the report:

```
{
    z_score:    real,
    p_value:    real,
    iterations: integer,
    seed:       64-bit integer,
    scope_hash: SHA-256
}
```

The seed is recorded so the report is reproducible; the
scope_hash is recorded so the report is independently verifiable
against the scope's content at the time of the call. In a
preferred embodiment, the iteration count is operator-configured
with default 500; reports for `N < 100` are flagged as
underpowered.

The falsify primitive is the substrate-level falsifiability
operation: any score, ranking, or outlier assertion produced by
the substrate may be falsified by a single FALSIFY call against
the relevant scope.

### D. The DIGEST primitive

The digest operation accepts a scope and emits a single
SHA-256 hash computed over a canonical serialization of the
substrate's complete output for the scope:

```
canonical_input :=  for each record r in sorted(scope):
                       fingerprint(r) ‖ score(r)
                    ‖ for each dimension d in sorted(dimensions):
                          falsify_report(scope, d)
                    ‖ deterministic_execution_manifest(scope)

digest := SHA-256( canonical_input )
```

The deterministic-execution manifest is a structured record of
every numerically-influenced decision the substrate made during
the scope's processing — floating-point reduction order over
sums longer than a configurable threshold, dispatch choices for
matrix multiplications, hardware-accelerator kernel versions,
and analogous hardware-dependent algorithmic choices. The
manifest is emitted as a stable canonical JSON serialization so
that two deployments producing identical manifests have used
identical numerical execution paths.

The digest primitive is the cryptographic anchor for
cross-deployment equivalence: two deployments operating on
identical scopes under identical seeds produce identical digests
if and only if their substrate operations were byte-equivalent.
A single 32-byte comparison suffices to certify equivalence; a
disagreement is cryptographic proof of divergence.

In a preferred embodiment, the substrate operates in two modes
selectable at deployment time. In *strict-deterministic mode*,
any operation that would introduce non-recordable
non-determinism (e.g., a non-deterministic GPU kernel for which
no manifest entry is available) aborts substrate processing and
emits an error. In *best-effort mode*, such operations are
recorded with a warning entry in the manifest and substrate
processing continues. Sovereign and regulated deployments are
typically configured in strict-deterministic mode.

### E. The HAND-BACK primitive

The hand-back operation accepts a scope and emits a
structurally-enriched corpus artifact containing, for each
record in scope, the original record content together with the
structural fingerprint, the score vector, any null-test reports
relevant to the record, and the reproducibility digest of the
scope at emission time. The artifact is serialized in a
canonical format (JSONL with sorted keys per row) and may be
emitted to any of: (i) a target table or collection in the same
substrate, (ii) a different substrate instance, (iii) a
downstream training paradigm such as the one disclosed in
provisional_03_crystara, or (iv) an external file system or
object store.

The emitted artifact is itself mountable by any substrate
implementing the universal adapter; mounting the artifact yields
a new substrate state in which the original records are present
together with the structural enrichment of the previous
substrate iteration. The hand-back operation is therefore the
substrate-level architectural primitive whereby substrate
outputs systematically become substrate inputs.

### F. The Convergence Hand-Back Loop

A substrate may be operated in a closed loop in which
hand-back outputs are immediately mounted as new substrate
inputs. One loop iteration comprises:

1. MOUNT a target (initial input or prior hand-back artifact);
2. SCORE the resulting universe (occurs implicitly via the
   mount-bound generated columns);
3. FALSIFY one or more score dimensions over the universe;
4. DIGEST the universe;
5. HAND-BACK the universe as a new mountable artifact.

The loop is parameterized by an operator-configurable scope,
seed, dimensions, and iteration count, plus a convergence
indicator:

```
C(t)  :=  || score_distribution(t) − score_distribution(t−1) ||₂
            /  || score_distribution(t−1) ||₂
```

i.e., the relative L²-norm change in the substrate's score
distribution between successive loop iterations. When `C(t)`
falls below an operator-configured threshold for a sustained
window of iterations, the loop is declared at stable
equilibrium; further iterations cannot meaningfully enrich the
substrate's structural model of the universe under the current
configuration.

The convergence loop is the substrate's mechanism for
self-improvement: each iteration's enrichment becomes part of
the substrate's universe in subsequent iterations, allowing
fingerprints and scores to reflect not only the original record
content but also the structural relationships discovered in
prior iterations. The loop is operable in fully-automated form
(scheduled by the substrate) or in operator-triggered form
(invoked manually after each iteration).

### G. Cross-Deployment Equivalence Verification

The cryptographic equivalence procedure is as follows. For two
deployments `D₁` and `D₂` of the substrate operating on
purportedly-identical inputs and seeds:

1. Compute `digest₁ := lo_repro_digest(scope, in D₁)`.
2. Compute `digest₂ := lo_repro_digest(scope, in D₂)`.
3. Compare bytewise. Equality certifies that `D₁` and `D₂`
   produced byte-identical substrate outputs on the scope under
   the configured seeds. Inequality is cryptographic proof of
   divergence.

The procedure is applicable across any combination of
deployment environments — multi-tenant cloud SaaS, single-tenant
on-premises, fully-air-gapped sovereign, and edge-resident — and
enables a sovereign procurement officer to certify, in a single
operation, that an air-gapped deployment is operationally
equivalent to a reference SaaS deployment.

### H. Embodiments of substrate operation

In a preferred embodiment, the substrate is exposed to host data
systems via the universal adapter described in
provisional_01_latent_ocean_universal_adapter, with the five
primitives surfaced as user-defined functions / external
functions / aggregation stages / tool surfaces in their
respective host runtimes. In an alternative embodiment, the
substrate is exposed via a standalone HTTP API; in a further
alternative embodiment, via an in-process library binding for
host applications.

The hand-back artifact may flow into a downstream training
paradigm such as the one disclosed in
provisional_03_crystara, in which case the convergence loop
extends across substrate-and-training: structurally-enriched
corpora train new predictor modules, whose outputs may
themselves be fed back through the substrate via subsequent
hand-back iterations.

## VII. Claims

The following claims are illustrative and non-limiting.

1. A computer-implemented substrate system exposing exactly five
   callable operational primitives constituting the substrate's
   complete operational interface, said primitives comprising:
   (a) a mount primitive that binds a structural-fingerprint and
       score-vector adapter to a host data source such that each
       record of the source acquires said fingerprint and said
       score vector;
   (b) a score primitive returning a multi-dimensional geometric
       score vector for a given fingerprint relative to the
       substrate's current universe, deterministically;
   (c) a falsify primitive performing a permutation null-test
       over a specified scope and returning a structured report
       comprising at least a z-score, a p-value, an iteration
       count, and a seed;
   (d) a digest primitive returning a cryptographic hash
       computed over a canonical serialization of the substrate's
       fingerprints, score vectors, falsify reports, and a
       deterministic-execution manifest for a specified scope;
       and
   (e) a hand-back primitive emitting a structurally-enriched
       corpus from a specified scope as a new mountable input
       artifact, said artifact comprising original record content
       augmented with said fingerprints, score vectors, falsify
       reports, and reproducibility digest.

2. The system of claim 1 wherein the substrate is operable in a
   closed-loop configuration in which hand-back artifacts are
   mounted as new substrate inputs in successive iterations,
   said configuration further comprising a convergence indicator
   measuring relative change in score distribution between
   successive iterations and signaling stable equilibrium when
   said indicator falls below an operator-configured threshold
   for a sustained number of iterations.

3. The system of claim 1 wherein the digest primitive's output is
   bit-identical across at least two deployment environments
   selected from the group consisting of: multi-tenant cloud
   SaaS, single-tenant on-premises, fully-air-gapped sovereign,
   and edge-resident, given identical inputs and seeds, such
   that bytewise equality of the digest output certifies
   cross-deployment operational equivalence.

4. The system of any preceding claim wherein the substrate is
   operable in a strict-deterministic mode in which any operation
   that would introduce non-recordable non-determinism aborts
   substrate processing and emits an error, and in a best-effort
   mode in which such operations are recorded with warning
   entries in the deterministic-execution manifest and processing
   continues.

5. The system of any preceding claim wherein the falsify
   primitive's report further comprises a scope-content hash by
   which the report may be independently re-verified against the
   scope's content at the time of the report's generation.

6. The system of any preceding claim wherein the hand-back
   artifact is consumable as training input by a downstream
   self-organizing predictor-discovery system of the type
   disclosed in commonly-owned provisional application
   provisional_03_crystara, whereby the convergence loop extends
   across the substrate and the downstream training paradigm.

7. The system of any preceding claim wherein the mount primitive
   is idempotent on a target, such that repeated mount
   invocations with identical options on an already-mounted
   target are no-ops emitting an informational return value
   distinguishable from the first-mount return value.

8. The system of any preceding claim wherein the deterministic-
   execution manifest of claim 1 records, for each substrate
   operation, the floating-point reduction order over numeric
   reductions of length exceeding an operator-configurable
   threshold, the dispatch choices for matrix-multiplication
   operations, and the version identifiers of any hardware-
   accelerator kernels invoked during processing.

9. The system of any preceding claim wherein the convergence
   indicator of claim 2 is computed as the relative L²-norm
   change in score distribution between successive loop
   iterations, normalized by the prior iteration's distribution
   norm.

10. A computer-implemented method comprising the operations
    recited in any of claims 1–9.

11. A non-transitory computer-readable medium storing
    instructions that, when executed by one or more processors,
    cause said processors to perform the operations recited in
    any of claims 1–9.

12. The system of any preceding claim wherein the five
    operational primitives are exposed via a Postgres extension
    as user-defined functions, via a Snowflake declaration as
    external functions, via a MongoDB declaration as aggregation
    stages, and via a Model Context Protocol declaration as agent
    tool surfaces, with bit-identical behavior across all
    surfaces given identical inputs and seeds.

13. A method of certifying cross-deployment operational
    equivalence between two substrate deployments operating on
    identical inputs and seeds, comprising the steps of:
    (a) computing a reproducibility digest of an operationally-
        relevant scope at each of the two deployments;
    (b) bytewise comparing the resulting digests; and
    (c) emitting an equivalence certification if and only if the
        digests are bytewise identical.

14. The system of any preceding claim further comprising a
    cryptographic chain-of-custody record in which each digest
    incorporates the digest of the prior loop iteration,
    whereby the substrate's complete operational history is
    cryptographically auditable from any later digest backward
    through arbitrary prior iterations.

## VIII. Abstract

A substrate platform is disclosed exposing five callable
operational primitives — MOUNT, SCORE, FALSIFY, DIGEST, and
HAND-BACK — that together constitute the substrate's complete
operational interface. The MOUNT primitive binds a structural-
fingerprint and score-vector adapter to a host data source; the
SCORE primitive returns the four-dimensional geometric score for
a given fingerprint deterministically; the FALSIFY primitive
performs a permutation null-test returning a structured report;
the DIGEST primitive returns a SHA-256 hash over the substrate's
fingerprints, scores, falsify reports, and deterministic-execution
manifest, providing a single-comparison cryptographic anchor for
cross-deployment equivalence verification across SaaS, on-premises,
air-gapped, and edge environments; and the HAND-BACK primitive
emits a structurally-enriched corpus from the substrate as a new
mountable input artifact, enabling a convergence loop in which
substrate outputs become substrate inputs and the substrate
continuously improves its structural model of its data universe,
with operator-monitorable stable-equilibrium signalling via a
convergence indicator. The hand-back artifact may further flow
into a downstream training paradigm, extending the convergence
loop across substrate and training.

---

*This document is a provisional application drafted by the
applicant for filing under 35 U.S.C. § 111(b). It has not been
reviewed by registered patent counsel. Applicant is advised to
have counsel review the application before filing, and to convert
to a non-provisional application under 35 U.S.C. § 111(a) within
twelve (12) months of the filing date in order to preserve the
priority claim.*
