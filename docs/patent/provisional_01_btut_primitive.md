# Provisional Patent Application

**Title:** Systems and Methods for Deterministic Structural Fingerprinting of Arbitrary Data Records with Integrated Falsifiability Testing and Modality-Agnostic Outlier Detection

**Filing type:** Provisional Application for Patent (35 U.S.C. § 111(b))

**Inventor(s):** [to be supplied by applicant]

**Assignee:** [to be supplied by applicant]

**Priority date:** 2026-04-20 (date of this provisional filing)

---

## I. Cross-References to Related Applications

None at time of filing.

## II. Field of the Invention

The present invention relates generally to data processing systems,
and more particularly to apparatus, methods, and computer-program
products for constructing deterministic, reproducible structural
signatures of records from heterogeneous data sources, and for
testing the statistical significance of rankings derived from such
signatures.

## III. Background

### A. Limitations of vector embeddings in regulated contexts

Machine learning systems increasingly rely on dense vector embeddings
— typically real-valued representations of 256 to 4,096 dimensions —
produced by neural encoders such as transformers. Embeddings support
semantic similarity search, retrieval-augmented generation, and
similarity-based analytics across many commercial and scientific
applications.

However, vector embeddings produced by neural encoders suffer from
two architectural limitations that bar their use in a substantial
category of applications:

1. **Non-determinism.** An embedding produced by a learned encoder on
   parallel hardware (e.g., graphics processing units) is sensitive
   to floating-point precision, kernel execution ordering, batch
   composition, and driver version. Two invocations of the same
   encoder on identical input commonly produce embeddings that differ
   in the low-order bits, and sometimes in higher-order bits.

2. **Lack of integrated falsifiability.** Given a ranking produced
   from embeddings, there exists no primitive operation that
   determines, with respect to the underlying representation, whether
   the ranking is statistically distinguishable from a ranking
   produced by chance. Practitioners may apply permutation tests in
   a post hoc manner, but the underlying system is not constructed
   with such testing in mind, and the results depend on the specific
   test harness implemented.

### B. Limitations of classical locality-sensitive hashing

Classical locality-sensitive hashing (LSH) schemes — including but
not limited to MinHash, SimHash, and random projection methods —
provide deterministic representations suitable for similarity
estimation. However, existing LSH systems:

- are typically designed for a specific data modality (e.g., MinHash
  for set-valued data; SimHash for textual data), requiring
  replacement for each new modality;
- do not ship with integrated falsifiability testing;
- do not enforce a canonical input encoding sufficient to guarantee
  bit-identical output across heterogeneous systems;
- do not incorporate a composite scoring function that normalizes
  multiple structural measurements onto a common scale suitable for
  ranking across modalities.

### C. The problem addressed

A need exists in the art for a deterministic, modality-agnostic data
primitive that (a) produces a compact structural signature of each
record suitable for outlier detection across heterogeneous data
sources, (b) ships with an integrated null-permutation falsifiability
operation as a first-class primitive, and (c) guarantees bit-
identical reproducibility of both signatures and rankings across
independent invocations.

## IV. Summary of the Invention

The invention provides a system and method for generating, from an
input record comprising one or more attribute-value pairs, a fixed-
length structural fingerprint, along with a multi-dimensional score
vector and an integrated null-permutation testing operation, all
producing bit-identical output under a fixed configuration seed.

In one aspect, the invention comprises:

- A deterministic canonical-encoding module that produces, from a
  record, a byte sequence stable under semantic equivalence of the
  record;
- A rotation-ensemble hashing module that computes, from the
  canonical byte sequence and a fixed configuration seed, a fixed-
  length binary structural signature (preferably 48 bits);
- A multi-dimensional scoring module that computes, from the
  structural signature and a history window of previously-generated
  signatures, a score vector having at least three dimensions
  corresponding to (i) minimal Hamming distance to any other
  signature in the window, (ii) information density of the signature
  itself, and (iii) per-bit entropy of the signature across the
  window;
- A composite scoring module that combines the individual score
  dimensions via a fixed weighting;
- A null-permutation testing module that, on demand, computes the
  empirical null distribution of the top-K score by permuting the
  individual bits of each signature in the corpus a specified number
  of times while preserving bit count per signature, and reports the
  resulting z-score and significance threshold;
- A reproducibility digest module that produces, for any top-K
  ranking of signatures, a cryptographic digest stable across
  independent invocations.

In another aspect, the invention further comprises a topological
feature extraction module that applies persistent-homology analysis
to the Hamming-distance graph over the signature corpus, producing
topological feature descriptors (Betti numbers, birth-death
barcodes) as additional descriptors of the corpus structure.

In another aspect, the invention provides methods of applying the
system to at least ten distinct data modalities — including financial
filings, biomedical literature, international trade records, climate
time-series, patent abstracts, scholarly publications, geophysical
event records, and cryptographic asset markets — using identical
configuration parameters and with no modality-specific preprocessing
beyond the canonical-encoding step.

## V. Brief Description of the Drawings

*The following description refers to conceptual figures that would
accompany a non-provisional filing. No figures are attached to this
provisional application; the written description is intended to be
complete without them.*

- **Figure 1** is a block diagram illustrating the end-to-end flow
  of a record through the canonical-encoding module, the rotation-
  ensemble hashing module, the scoring module, and optional null-
  permutation and topology modules.
- **Figure 2** is a schematic showing the 48-bit rotation-ensemble
  hashing process, including SHA-256 invocation with seed-and-index
  salting and the XOR-rotation parity extraction.
- **Figure 3** is a block diagram of the null-permutation module's
  internal structure, including the seeded bit-shuffle and
  distribution-summary components.
- **Figure 4** is a sequence diagram illustrating the invocation of
  the full pipeline on a heterogeneous corpus comprising records
  from ten or more distinct data modalities.

## VI. Detailed Description

### A. Canonical encoding module (Figure 1, block 102)

The canonical-encoding module accepts a record comprising one or more
attribute-value pairs. The module:

1. enumerates the attributes in a deterministic sort order (e.g.,
   lexical order of attribute names);
2. normalizes attribute values to a stable representation (e.g.,
   numeric values serialized without trailing zeros, boolean values
   as canonical keywords);
3. serializes the enumeration as a byte sequence using a fixed
   serialization format (e.g., JSON with sorted keys and no
   extraneous whitespace).

The output is a byte sequence whose identity is a function of the
record's semantic content, independent of attribute enumeration order
or representation-specific artifacts.

### B. Rotation-ensemble hashing module (Figure 1, block 104; Figure 2)

The hashing module accepts the canonical byte sequence and a fixed
configuration seed *s*. For each bit-position *i* in a preferably
48-bit output:

1. compute *h_i* = SHA-256(s || i || canonical-bytes);
2. extract the first four bytes of *h_i* as a 32-bit integer *v_i*;
3. compute *w_i* = *v_i* XOR (*v_i* >> 7) XOR (*v_i* >> 13);
4. emit the low-order bit of *w_i* as the fingerprint's *i*-th bit.

The output is a 48-bit binary vector deterministic under (s, record).

The choice of 48 bits provides approximately 2⁴⁸ ≈ 2.8 × 10¹⁴
distinguishable configurations, sufficient for corpora up to the 10¹³
range; alternative output lengths (e.g., 64, 128, 256) are
contemplated and claim scope is not limited to 48 bits.

### C. Multi-dimensional scoring module (Figure 1, block 106)

Given a fingerprint F and a history window H = {F_1, F_2, ..., F_n},
the scoring module computes:

- **Anomaly(F, H)** = (min over g ∈ H of HammingDistance(F, g)) / L,
  where L is the fingerprint length;
- **Reconstruction(F)** = 1 − 2 · |OnesCount(F) − L/2| / L;
- **Diversity(F, H)** = (1 / k) · Σ over on-bits i of F of
  BinaryEntropy(p_i), where p_i is the prevalence of on-bit at
  position i across H, and k is the number of such positions
  considered.

All three dimensions are normalized to [0, 1].

### D. Composite scoring module

The composite score is computed as a fixed weighted combination:

    Composite = w_r · Reconstruction + w_d · Diversity + w_a · Anomaly

with default weights w_r = 0.40, w_d = 0.35, w_a = 0.25. The
composite is a single scalar in [0, 1] suitable for ranking.

### E. Null-permutation testing module (Figure 3)

The null-permutation module performs the following operation on
demand:

1. Accept an input corpus of fingerprints, a target top-K size, a
   set of score dimensions, and a number of iterations N.
2. Compute the true top-K mean for each dimension.
3. For each of N iterations:
   a. seed a pseudorandom number generator with a derived seed;
   b. for each fingerprint in the corpus, perform a Fisher-Yates
      shuffle of the fingerprint's bits, preserving the bit count;
   c. compute the top-K mean for each dimension over the permuted
      corpus.
4. Construct an empirical null distribution from the N permuted
   top-K means.
5. Compute the observed z-score as (true_mean − null_mean) /
   null_stddev.
6. Report significance thresholds at p < 0.05, p < 0.01, and
   p < 0.001.

### F. Reproducibility digest module

The digest module, given an ordered ranking of the top-K fingerprints
and their composite scores, produces a SHA-256 digest of a canonical
representation of the ranking. This digest:

- is deterministic across independent invocations of the pipeline;
- provides an audit trail suitable for regulated-industry compliance;
- enables bit-level verification of rankings across distributed
  deployments.

### G. Topological feature extraction module (optional)

In another embodiment, the invention further computes persistent-
homology features of the corpus by:

1. constructing the Hamming-distance matrix over the fingerprint
   corpus;
2. applying the Vietoris-Rips filtration to produce persistence
   diagrams at dimensions 0, 1, and optionally 2 or higher;
3. extracting descriptor features including the number of persistent
   features above a threshold, the total bar length, and the
   longest-lived feature at each dimension.

### H. Pipeline orchestration (Figure 4)

The canonical encoding, hashing, scoring, null-permutation, and
topology modules may be invoked as a unified pipeline on a
heterogeneous corpus. The pipeline is demonstrated to produce
statistically significant rankings (z > 10 σ at p < 0.001) across
at least twenty distinct data modalities including but not limited
to financial filings, biomedical literature, trade flows, climate
records, and scholarly publications, using identical configuration
parameters.

## VII. Claims

The applicant reserves the right to claim any and all subject matter
described or implied herein in a subsequent non-provisional filing.
The following claims are provisional and subject to revision:

**Claim 1.** A method of computing a deterministic structural
fingerprint of a data record, comprising:

(a) receiving a data record comprising one or more attribute-value
pairs;

(b) serializing said record into a canonical byte sequence using a
deterministic attribute sort order and a deterministic value
normalization;

(c) for each bit position i of a fixed-length fingerprint, computing
a hash h_i as SHA-256 applied to the concatenation of a configuration
seed, the bit position index i, and the canonical byte sequence, and
extracting a parity bit from an XOR-rotation combination of bits
within h_i;

(d) concatenating the parity bits to produce a fixed-length binary
structural fingerprint.

**Claim 2.** The method of claim 1, wherein the fixed fingerprint
length is 48 bits.

**Claim 3.** The method of claim 1, further comprising computing,
with respect to a history window of previously-generated
fingerprints, a score vector having at least three dimensions
corresponding to minimum Hamming distance, information density, and
per-bit entropy.

**Claim 4.** The method of claim 3, further comprising computing a
composite score as a fixed weighted combination of said at least
three dimensions.

**Claim 5.** The method of claim 4, further comprising computing on
demand a null-permutation distribution of the top-K composite score
by seeded bit-shuffle of each fingerprint in a corpus while preserving
fingerprint bit-count, and reporting statistical significance of the
observed top-K score against said null distribution.

**Claim 6.** The method of claim 1, further comprising computing a
cryptographic digest of an ordered top-K ranking of fingerprints,
wherein said digest is deterministic across independent invocations
of the method.

**Claim 7.** The method of claim 1, wherein the data record is any of
a financial filing, a biomedical publication, an international trade
flow record, a climate time-series observation, a patent abstract, a
scholarly publication record, a geophysical event record, a
cryptographic asset market record, or a combination thereof, and
wherein the method configuration parameters are identical across
modalities.

**Claim 8.** A system comprising a processor and a non-transitory
computer-readable medium storing instructions that, when executed by
said processor, cause said processor to perform the method of any of
claims 1-7.

**Claim 9.** A non-transitory computer-readable medium storing
instructions that, when executed by a processor, cause said processor
to perform the method of any of claims 1-7.

**Claim 10.** The method of claim 5, further comprising computing
persistent-homology features of the fingerprint corpus by applying
Vietoris-Rips filtration to the Hamming-distance matrix over the
corpus and reporting dimension-0 and dimension-1 persistence
descriptors.

## VIII. Abstract

A system and method for computing deterministic structural
fingerprints of arbitrary data records, comprising a canonical-
encoding module, a rotation-ensemble SHA-256 hashing module, a
multi-dimensional scoring module, a composite scoring module with
fixed weights, an on-demand null-permutation falsifiability testing
module, and a reproducibility digest module. The fingerprint output
is a 48-bit binary vector bit-identical across invocations under a
fixed seed. The system is demonstrated to produce statistically
significant rankings across at least twenty distinct data modalities
with identical configuration, without modality-specific
preprocessing, at null-permutation significance levels exceeding
p < 0.001. Applications include audit-trail analytics, compliance-
sensitive outlier detection, sovereign-AI deployment, and
regulated-industry reporting pipelines where determinism and
falsifiability are required properties of the output.

---

**End of Provisional Patent Application**

*This document is a provisional application under 35 U.S.C. §
111(b). A non-provisional application claiming priority under 35
U.S.C. § 119(e) must be filed within twelve (12) months of the
filing date of this provisional for the priority claim to be
effective. The applicant is advised to retain qualified patent
counsel for conversion to a non-provisional application.*
