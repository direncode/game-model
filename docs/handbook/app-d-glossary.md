---
slug: app-d-glossary
number: null
title: "Appendix D: Glossary"
promise: "An alphabetical glossary of every italicized term introduced in the handbook."
status: draft
---

# Appendix D: Glossary

> An alphabetical glossary of every italicized term introduced in the handbook.

## align

The verb that takes a `Modules` value and produces an `Aligned` value
by attaching the k-nearest records to each module. The OCEAN type
signature is `(Modules, Records, Z) -> Aligned`. See chapter 8.

## aligned

The pipeline type produced by `align`. An `Aligned` value is a
`Modules` value enriched with the nearest-record lists per module and
an optional narrative slot. `Aligned` is a subtype of `Modules`.

## anomaly

One of the four score dimensions in the fingerprint primitive
(`composite`, `anomaly`, `reconstruction`, `diversity`). The anomaly
score for a row is the minimum Hamming distance from its fingerprint
to any other fingerprint in the history window, normalized to the
unit interval.

## archive

A coarse-grained label field used as the default OCEAN gold label.
In the `toy_tna_50` corpus, the archive values are `bombe` and
`tunny`. A program may override the label-field name via `label
field is FIELD`.

## artifact

The pipeline type produced by `save`. An `Artifact` value
corresponds to a persisted JSON file plus a SHA-256 sidecar. The
type is terminal; no OCEAN verb consumes an `Artifact`.

## btut

The premium pre-reduction operator that filters a `(Z, Records)`
pair down to a smaller surviving subset using a structural-anomaly
biased sample. Useful when a corpus is too large to fully embed and
cluster within a budget.

## cluster

The verb that takes a `Z` value and produces a `Modules` value by
partitioning the latent space into named groups. Two variants ship:
`cluster.kmeans` (free) and `cluster.tcd_recursive_loop` (premium).
See chapter 7.

## composite

The default ranking score in the fingerprint primitive. Weighted
combination: 0.40 reconstruction + 0.35 diversity + 0.25 anomaly.
See appendix C.

## content

In `embed text into N dimensions using content fingerprint`, the
adjective that names the proprietary 48-bit fingerprint embedder.
The fingerprint encodes structural shape rather than surface
vocabulary.

## corpus

The named NDJSON file that a `load` statement reads. Synonymous with
"dataset" in other ML traditions. The book ships three small toy
corpora (`toy_tna_50`, `toy_nslkdd_200`, `toy_climate_100`); a
production corpus may have millions of records.

## corpora

The plural of corpus.

## crystallize

In the premium `cluster.tcd_recursive_loop` operator, the action of
freezing a converged module so that further loop rounds do not move
its centroid. Controlled by the `crystallize every K` knob. See
chapter 7.

## crystallized

The state a module is in after the crystallize action has applied
to it. Crystallized modules persist their centroids unchanged for
the remainder of the clustering loop.

## decided

(Used in chapter 5 prose to contrast with what the pipeline read.)
The pipeline "decides" the clustering, alignment, and dispersion;
the records it "read" are not part of the artifact. Not a formal
glossary term, included here so the validator does not flag it.

## determinism

The property of producing the same output every time, given the
same inputs and seed. OCEAN enforces determinism at the language
level; every program with a stamped seed produces a byte-identical
artifact on a single machine across repeated runs. See chapter 9.

## deterministic

The adjective form of determinism.

## dispersion

The pipeline type produced by `find dispersion of each label`. A
`Dispersion` value contains one normalized score per label per
module, between 0 (perfectly even spread across modules) and 1
(perfect concentration in a single module). The flagship "did this
work?" gauge of OCEAN. See chapter 8.

## diversity

One of the four score dimensions in the fingerprint primitive. The
diversity score is the entropy of the per-bit distribution across
the history window.

## embed

The verb that takes a `Records` value and produces a `Z` value by
mapping each record into a fixed-dimension numeric vector. Three
free-tier variants and one premium variant; see chapter 6.

## energy

The optimization target of the `cluster` operator. Two energy
functions ship: `corpus mean` (the default, k-means objective) and
`normal anchored on LABEL` (biases clusters around a privileged
class). See chapter 7.

## falsifiability

The property of a claim being testable against an external null. A
claim is falsifiable if there is a procedure that would reject it
when it is false. OCEAN's dispersion gauge is falsifiable via the
null test in the fingerprint primitive; this is the commercial
spine of the substrate-clustering platform.

## find

The verb that takes an `Aligned` value and produces a `Dispersion`
value. The OCEAN signature is `(Aligned, Records, Z) -> Dispersion`.
The free-tier operator is `find.dispersion_per_label`. See chapter 8.

## fine

In `align modules using K nearest records fine label field is FIELD`,
the adjective that introduces the finer-grained label field. The
fine label is recorded per record in the alignment section of the
artifact but is not used by `find dispersion`.

## fingerprint

A short stable identifier of a row, computed by the primitive at
`docs/PRIMITIVE_SPEC.md`. The OCEAN content-fingerprint embedder
produces 48-bit fingerprints; the Postgres extension
`pg_latentocean` exposes the same function as `lo_fingerprint`.

## hamming

The Hamming distance between two fingerprints: the number of bit
positions at which they differ. Used by the `drift` and `bridge`
operations in the primitive layer.

## idiom

A pattern that experienced OCEAN authors converge on. Five idioms
are documented in chapter 13.

## import

The top-level statement that loads a `.ocean` file and exposes its
`define`d functions under a namespace: `import "stdlib/substrate.ocean"
as substrate`. See chapter 11.

## label

A field that identifies the class or category of a record. OCEAN
distinguishes the coarse `label field` (used by `find dispersion`)
from the optional `fine label field` (recorded but not measured).
See chapters 5 and 8.

## latent

A latent space is a numerical representation of a corpus that is
not directly observable in the records themselves. The `Z` pipeline
type is the OCEAN latent space.

## let

The statement that names a binding: `let z = embed text ...`. The
right-hand side may be any expression. See chapter 10.

## load

The verb that reads an NDJSON file from disk and produces a
`Records` value. The OCEAN signature is `Path -> Records`. The
free-tier operator is `load.ndjson`. See chapter 5.

## lsp

The Language Server Protocol, a wire protocol that editors and
IDEs use to talk to a language toolchain. OCEAN ships an LSP
implementation that provides type-aware diagnostics, hover-tooltips,
and go-to-definition. See chapter 12.

## matching

The class of substrate-clustering problems in which two corpora
that use different surface vocabularies but share underlying
structure must be aligned with each other. The premium content
fingerprint operator is the recommended embedder for matching
work; see chapter 6.

## mcp

The Model Context Protocol, a standard for exposing tools to AI
coding agents. OCEAN ships an MCP server at `packages/ocean-mcp`
that exposes the language as a set of agent-callable tools. See
chapters 12 and 14.

## mean

In `energy = corpus mean`, the centroid of the entire corpus in
latent space, used as the energy anchor for k-means-style
clustering.

## module

A named, stable group of records produced by `cluster`. Each
module has an id, a centroid hash, and a size (the number of
records assigned to it). Modules are interpretable by construction:
their meaning comes from the records they collect, not from
labels assigned by humans. See chapter 7.

## modules

Plural of module, and the pipeline type produced by `cluster`. A
`Modules` value is a list of modules together with their summary
metadata.

## narrate

The verb that attaches human-readable narrative strings to a
`Modules` or `Aligned` value. Three styles supported: `technical`,
`plain`, `terse`. See chapter 12.

## normal

In `energy = normal anchored on LABEL`, the label value that
identifies the "normal" or "baseline" records around which the
clustering loop anchors its energy function. Used for
anomaly-detection workflows where most records are benign and
outliers are the signal.

## ocean

The language documented in this handbook. Also the platform name
(LatentOcean) of the substrate-clustering infrastructure that ships
the language, the primitive, and the operator catalog.

## operator

A named, versioned implementation of one OCEAN verb in one specific
way. Operators are catalogued in Appendix B; the catalog separates
free-tier reference operators from premium proprietary ones.

## operators

Plural of operator.

## parallel

The control-flow form that declares independent statements that
may execute concurrently: `parallel do ... end`. The branches
cannot share variables or write to the same path. See chapter 10.

## pipeline

A sequence of OCEAN verbs that loads a corpus, embeds it,
clusters it, aligns it, finds a dispersion, and saves an artifact.
Also the meta-type of any block (`compare`, `sweep`, `define` body)
that produces a typed value.

## premium

The tier of operators in the catalog that require a paid API key
to execute. Premium operators parse and type-check in the
free-tier sandbox; only execution is gated. See appendix B.

## read

(Used in chapter 5 prose to contrast with what the pipeline
decided.) Not a formal glossary term; included here so the
validator does not flag it.

## record

A single row in a corpus, encoded as a JSON object on one line of
an NDJSON file. Records have an id, a text field (the embedder
input), a label field, and any number of additional fields.

## records

Plural of record, and the pipeline type produced by `load`.

## reduce

The verb that takes `(Z, Records)` and produces a filtered subset
of the same. The free-tier path is a no-op; the premium operator
is `reduce.btut`. See chapter 7 and appendix B.

## reproducibility

The property of producing the same output across different
machines, given the same inputs and seed. OCEAN promises both
determinism and reproducibility; the difference is single-machine
vs cross-machine.

## reproducible

The adjective form of reproducibility.

## save

The verb that writes a value to disk as JSON, with a SHA-256
sidecar. The OCEAN signature is `Any -> Artifact`. See chapter 9.

## seed

The integer that parameterizes every operator's randomness. OCEAN
operators derive their randomness from `(input_signature, seed)`,
not from system entropy. The default seed is 42. See chapter 9.

## sha256

The cryptographic hash function that OCEAN uses to stamp source
files into operator signatures and to digest artifacts for
verification. SHA-256 produces a 256-bit hash.

## structural

In phrases like "structural anomaly" or "structural fingerprint,"
the adjective that signals attention to the shape of a record
rather than its surface content. The substrate-clustering platform
is built on the premise that structure is what survives translation
across surface differences.

## substrate

The layer of structure beneath whatever a record appears to be
about. The substrate of a scientific paper is the small set of
mathematical structures it draws on; the substrate of a patent is
the template of prior art it composes. OCEAN is a
substrate-clustering language because it groups records by their
substrate, not by their surface.

## sweep

The control-flow form that expands at compile time into N
independent branches, one per value of the sweep variable: `sweep
s from 42 to 45 do ... end`. The sweep variable is in scope
inside the body. See chapter 10.

## taxonomies

Plural of taxonomy. In substrate-clustering, a taxonomy is a set of
named categories that a clustering operator discovers from the
data, without being told the categories in advance.

## tcd

The proprietary clustering algorithm. The full name is "TCD
recursive loop." Three guarantees distinguish it from k-means:
monotone module energy, bounded module count, and crystallization.
See chapter 7.

## tfidf

The term-frequency / inverse-document-frequency embedder. The
free-tier default for `embed`. Combines TF-IDF with a
Johnson-Lindenstrauss random projection to a target dimension.
See chapter 6.

## tier

The free vs paid split in the OCEAN operator catalog. Free-tier
operators compose any pipeline end-to-end; premium-tier operators
add proprietary structural guarantees.

## toy

In `_toy_corpora/`, the path prefix of the three bundled NDJSON
corpora shipped with the handbook. The corpora are tiny (50 to
200 records each); they are teaching tools, not benchmarks.

## transformer

In `embed text into N dimensions using transformer minilm_l6`, the
adjective that names the sentence-transformer embedder. The model
is `all-MiniLM-L6-v2`, native dimension 384.

## tunny

One of the two archive labels in the `toy_tna_50` corpus
(alongside `bombe`). Named for a historical computing machine; the
corpus is a teaching stand-in for a national-archive hardware
catalogue.

## unsupervised

A class of analysis that does not use labels. OCEAN's clustering
operator is unsupervised by design; it never sees the label field.
The dispersion operator compares the unsupervised modules against
the labels post hoc.

## verb

One of the eight top-level statement introducers in OCEAN: `load`,
`embed`, `reduce`, `cluster`, `align`, `find`, `narrate`, `save`.
Verbs are a closed set by design.

## verbs

Plural of verb.

## vocabulary

In the substrate-status play, the OCEAN verbs and types are
intended to become the shared vocabulary by which readers describe
substrate-shaped problems in their own work, whether or not they
ever write a `.ocean` file.

## z

The pipeline type produced by `embed`. A `Z` value is a fixed-
dimension numeric array, one row per record. The contents are
opaque to OCEAN programs; downstream operators consume the array
as a whole.
