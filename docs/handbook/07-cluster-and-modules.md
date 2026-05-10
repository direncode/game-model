---
slug: cluster-and-modules
number: 7
title: Cluster and Modules
promise: "After this chapter you can run a clustering pass with sensible defaults and explain why the defaults are sensible."
status: draft
---

# Cluster and Modules

> After this chapter you can run a clustering pass with sensible defaults and explain why the defaults are sensible.

## Concepts in this chapter

- What a `module` is and what fields it carries
- The free-tier `kmeans` operator
- The premium `tcd recursive loop` operator
- The energy function: `corpus mean` vs `normal anchored on LABEL`
- The loop parameters: `for N rounds`, `max M modules`, `crystallize every K`

## What a module is

A `module` is a named, stable group of records that the clustering
operator has decided belong together. After `cluster` runs, the
program has a `Modules` value: a list of modules, each with an id,
a centroid (the geometric center of the group's records in Z space),
and a count of how many records the module contains.

```ocean static
load tmp/corpus.ndjson take 500 records balanced by archive
embed text into 128 dimensions
cluster for 16 rounds max 24 modules using kmeans energy = corpus mean
```

This program produces between two and twenty-four modules, depending
on how many distinct clusters the algorithm finds. The `max M
modules` is an upper bound, not a target. The algorithm may produce
fewer than M modules if the data does not support that many.

A module is named by its id (an integer from 0). Modules in a
`Modules` value are sorted by id, and ids are assigned in a
deterministic order tied to the centroid hash. Two runs of the same
program at the same seed produce the same module ids for the same
records.

## cluster.kmeans (the free-tier baseline)

```ocean static
cluster for 16 rounds max 24 modules using kmeans energy = corpus mean
```

The free-tier clustering operator is standard k-means with two
non-standard properties:

1. **Deterministic initialization.** The initial centroids are seeded
   from `(input_signature, seed)` rather than from system entropy.
   Two runs at the same seed start in the same place.

2. **Stopping rule.** The algorithm stops when modules stabilize or
   when `for N rounds` is exhausted, whichever comes first. The
   default round count is 16; this is more than enough for most
   real corpora.

`kmeans` is fast (linear in records, quadratic in dimensions) and
well-understood. It is the right choice for prototyping a pipeline
and for any corpus where the modules are roughly spherical in Z
space.

## cluster.tcd_recursive_loop (the premium variant)

```ocean static
cluster for 16 rounds max 24 modules
        using tcd recursive loop
        crystallize every 4
        energy = corpus mean
```

The premium clustering operator is the TCD recursive loop, the
proprietary algorithm that gives OCEAN its substrate-clustering
guarantees. Three properties distinguish it from k-means:

1. **Monotone module energy.** Each loop round either lowers the
   total module energy (the sum of distances from each record to its
   module's centroid) or leaves it unchanged. The algorithm never
   oscillates.

2. **Bounded module count.** The `max M modules` is a hard cap, not
   a soft preference. The algorithm provably produces at most M
   modules. This matters for downstream operators that have to
   reason about per-module work.

3. **Crystallization.** Every K rounds, modules whose centroids
   have moved less than a threshold are _crystallized_: marked as
   stable and excluded from further centroid updates. This focuses
   the remaining rounds on the still-moving modules and lets the
   algorithm converge faster on long corpora.

The `tcd recursive loop` is a premium operator; executing it requires
a paid API key. The grammar above type-checks in the free-tier sandbox
but does not run. To run it locally, set `OCEAN_API_KEY` and use the
full compiler.

## Energy functions: corpus mean and normal anchored

The `energy = ...` clause picks the optimization target for the
clustering operator. Two options:

```ocean static
cluster for 16 rounds max 24 modules energy = corpus mean
```

`corpus mean` (the default): minimize the sum of squared distances
from each record to its module centroid, measured against the corpus
mean. This is the standard k-means objective and is the right choice
when no label is privileged.

```ocean static
cluster for 16 rounds max 24 modules
        energy = normal anchored on type
```

`normal anchored on LABEL`: pick the records whose value of LABEL is
the literal string `normal` and use _their_ centroid as the energy
anchor. The algorithm then biases module construction so that the
"normal" records form one tight module, and the remaining records
are partitioned according to how they differ from normal.

This is the right energy function for anomaly detection on a corpus
where there is a well-defined normal class. The NSL-KDD intrusion
detection corpus has a `type` field whose `normal` value names the
benign network traffic; anchoring on that produces modules
corresponding to attack patterns rather than to the geometry of the
corpus as a whole.

## Loop parameters

The clustering operator accepts three loop-shaping knobs:

`for N rounds` sets the maximum number of loop iterations. 16 is the
sensible default for most corpora. For very large corpora (above
100k records), 32 or 64 may be needed. For very small corpora (the
50-record toy), 8 is plenty.

`max M modules` caps the number of modules the algorithm may
produce. Choose this number by considering the expected coarseness
of the substrate. If the corpus has roughly K underlying classes,
set `max` to 2K or 3K; the over-provisioning gives the algorithm
room to split classes that have internal structure.

`crystallize every K` (premium only) freezes converged modules every
K rounds. Smaller K is more aggressive crystallization; K=1 freezes
modules as soon as they converge, K=N never crystallizes anything.
Use K=4 for most pipelines.

## Wider system

Why the TCD recursive loop is the part of OCEAN that took the
longest to design: it is the proprietary clustering algorithm whose
guarantees (determinism, monotone energy, bounded module count) are
what made the substrate provable. Without those guarantees, the
language could not promise byte-identical artifacts; clustering
algorithms with stochastic convergence would be a source of drift.

The substrate-status angle: a customer who prototypes on `kmeans`
and swaps to `tcd recursive loop` for production is doing what the
language was designed to enable. The verb is the same. The energy
clause is the same. The loop parameters are the same. Only the
variant phrase changes. This is exactly the ergonomic continuity
that the open-core boundary requires.

## Exercises

1. Run `cluster for 8 rounds max 6 modules using kmeans energy =
   corpus mean` on the toy_tna_50 corpus. How many modules does the
   artifact's `modules` section list?

2. The NSL-KDD corpus has a `type` field where `normal` names the
   benign records and `neptune`, `smurf`, `back` name attack types.
   Write a `cluster` statement that uses `normal anchored on type`
   as the energy function. (Hint: the `type` field is a string, the
   energy clause references it by name.)

3. What does `crystallize every K` mean? Explain in one sentence
   without using the word "crystallize."

## What's next

Chapter 8 connects modules back to records via `align` and turns
the result into a finding via `find dispersion of each label`.
