---
slug: effective-ocean
number: 13
title: Effective OCEAN
promise: "After this chapter you write OCEAN the way an experienced OCEAN author writes it."
status: draft
---

# Effective OCEAN

> After this chapter you write OCEAN the way an experienced OCEAN author writes it.

## Concepts in this chapter

- Five idioms worth internalizing
- Four anti-patterns to avoid
- When to reach for which embedder, clusterer, and energy function

## Idiom 1: name your bindings

Inline pipelines that flow one verb into the next are convenient
for prototyping. For anything beyond two or three verbs, name the
intermediate values with `let`:

```ocean static
let raw = load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive
let z = embed text from raw into 64 dimensions using tf-idf
let m = cluster z for 8 rounds max 6 modules using kmeans
let aligned = align m using 5 nearest records
find dispersion of each label from aligned
```

The named version is one or two lines longer than the implicit
version, but it has three properties the implicit version lacks.
The reader can see at a glance what each step produces. A linter
warning that fires on "ambiguous upstream binding" has somewhere
to point. The same `raw` or `z` can be reused in a later `compare`
without re-running the upstream operators.

## Idiom 2: small seeds before sweeps

Before running a `sweep` over many values, confirm the single-value
path works:

```ocean static
seed 42
load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive
embed text into 64 dimensions using tf-idf
cluster for 8 rounds max 6 modules using kmeans
align modules using 5 nearest records
find dispersion of each label
save to data/seed42.json
```

Run this first. If the artifact has the right shape, then wrap the
same body in `sweep s from 42 to 45 do ... end` and re-run. This
catches a class of bugs where the single-value path was wrong but
the sweep masked it across four runs of identical broken output.

## Idiom 3: prefer compare over duplicate pipelines

When the question is "does methodology A produce a different
dispersion than methodology B," use `compare`, not two separate
pipelines with manual diffing:

```ocean static
let raw = load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive
compare
    embed text from raw into 64 dimensions using tf-idf
against
    embed text from raw into 64 dimensions using transformer minilm_l6
on dispersion of each label
```

The `compare` form ensures both arms run against the same `raw`
binding, on the same seed, with the same surrounding parameters.
A hand-written diff between two `save to ...` artifacts misses any
of those equalities that the author forgot to keep in sync.

## Idiom 4: narrate last, never between cluster and align

```ocean static
let m = cluster z for 16 rounds max 24 modules using kmeans
let aligned = align m using 50 nearest records
let narrated = narrate aligned in plain style
find dispersion of each label from narrated
save to data/result.json
```

`narrate` accepts both `Modules` and `Aligned` (since `Aligned <:
Modules`), so the compiler will not complain if a program runs it
on bare `Modules` before alignment. Resist that. Narratives produced
from bare modules name only the centroid, not the records, and read
as generic. Run `narrate` on `Aligned`, after `align`, so the
narrative can reference specific records.

## Idiom 5: explicit seed every time

```ocean static
seed 42
```

Even when 42 is the default, write the declaration. A future
maintainer who reads the source should not have to remember the
default. An auditor who reads the artifact's `pipeline.seed` field
should be able to point at the source line that set it.

The linter warns on programs without an explicit `seed`. Treat that
warning as binding.

## Anti-pattern 1: re-embed per sweep branch

```ocean static
# Wrong: re-embeds 4 times.
sweep s from 42 to 45 do
    load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive
    embed text into 64 dimensions using tf-idf
    cluster for 8 rounds max 6 modules using kmeans
    save to data/seed_${s}.json
end
```

The `embed` step is deterministic; with the same input file and the
same seed strategy (TF-IDF embedding does not depend on the
clustering seed), it produces the same `Z` on every iteration.
Re-running it inside the sweep wastes compute.

The right shape is to embed once, then sweep the seeds that matter:

```ocean static
let raw = load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive
let z = embed text from raw into 64 dimensions using tf-idf
sweep s from 42 to 45 do
    cluster z for 8 rounds max 6 modules using kmeans
    save to data/seed_${s}.json
end
```

The clustering operator picks up the loop variable as its seed via
the standard seed-derivation contract (the linter warns if the
sweep variable is never referenced by the body).

## Anti-pattern 2: hidden upstream dependencies

```ocean static
# Wrong: which Records is align using?
load tmp/train.ndjson take 500 records balanced by label as train_records
load tmp/eval.ndjson take 100 records balanced by label as eval_records
embed text into 128 dimensions from train_records
cluster for 16 rounds max 24 modules using kmeans
align modules using 50 nearest records
```

The `align` step has two candidate `Records` bindings (`train_records`
and `eval_records`). The compiler defaults to "most recent of the
required type," which is `eval_records`. This is almost certainly
not what the program author intended; modules built from training
embeddings should not be aligned against the eval set without the
author saying so explicitly.

The fix is an explicit `from` clause:

```ocean static
align modules using 50 nearest records from train_records
```

The linter warns whenever an implicit upstream binding has more than
one candidate. Treat that warning as binding.

## Anti-pattern 3: tuning dimensions before checking dispersion

A common beginner instinct: see a dispersion of 0.4, decide it is
too low, double the embedding dimension, re-run. The dispersion goes
up to 0.5, but the modules are now full of records that are
spuriously similar in the new high-dimensional space. The
dispersion improved, but the substrate did not.

The right move is to check the null test first. A dispersion of 0.4
with a null mean of 0.39 means the modules are at chance level; no
amount of dimension tuning will help. A dispersion of 0.4 with a
null mean of 0.10 means the modules already capture real substrate;
the question is whether 0.4 is enough for the use case, not whether
0.5 is achievable.

The null test lives at the primitive level (Appendix C); the
handbook does not have a verb for it because it is corpus-level
audit, not pipeline-level work.

## Anti-pattern 4: copying the gold label into the embedding

The most insidious anti-pattern: a program author looking at a low
dispersion score adds a feature to the embedding that derives from
the gold label.

```ocean static
# Wrong: text field now contains the gold label.
# The embedder sees archive='bombe' as a token, indistinguishable
# from a content word. Dispersion will be artificially high.
```

This breaks the falsifiability of the substrate claim. The
dispersion finding is now a tautology; the modules separate the
gold labels because the embedder knew the gold labels. The
remedy is to confirm at the corpus-construction level that the
text and label fields are independent: a feature derived from the
label cannot appear in the text.

This is the substrate-clustering analog of label leakage in
supervised learning. OCEAN's design helps avoid it by separating
the `text field is` and `label field is` declarations, but the
field contents are out of OCEAN's control. A diligent program
author checks the corpus.

## When to reach for what

A quick decision tree, for a reader who has read the previous twelve
chapters and now needs to write one.

**Choosing the embedder.**
- Text corpus, English, vocabulary matters: `tf-idf`.
- Text corpus, multilingual or paraphrase-dominant: `transformer minilm_l6`.
- Non-text corpus (network logs, telemetry): `one-hot numeric`.
- Structural similarity across surface differences: `content fingerprint` (premium).

**Choosing the clusterer.**
- Prototyping a new pipeline: `kmeans`.
- Production run with substrate guarantees: `tcd recursive loop` (premium).

**Choosing the energy function.**
- No privileged class: `energy = corpus mean`.
- A well-defined normal class: `energy = normal anchored on LABEL`.

**Choosing the alignment width.**
- Hand-inspecting modules: `using 5 nearest records`.
- Dispersion math: `using 50 nearest records`.
- Production audit: `using 100 nearest records` or more.

## Wider system

This chapter is where readers learn the culture of OCEAN, not the
syntax. A language acquires substrate status partly through a shared
sense of which patterns are "the right way." The idioms above are
the patterns that experienced OCEAN authors converge on independently;
the anti-patterns are the patterns that show up in code review.

The substrate-status angle: when a customer's data team adopts these
idioms unprompted, OCEAN has won. The vocabulary is not just the
verb list; it is the shared mental model of which way of writing
the verb list is the right way.

## Exercises

1. Take this anti-pattern snippet and rewrite it into the idiomatic
   form, naming bindings appropriately:

```ocean static
load tmp/x.ndjson take 500 records
embed text into 128 dimensions using tf-idf
cluster for 16 rounds max 24 modules using kmeans
align modules using 50 nearest records
find dispersion of each label
save to /tmp/out.json
```

2. Of the four anti-patterns in this chapter, which one is the
   hardest to catch in code review and why?

3. Write a one-paragraph mental rule for when to wrap a pipeline in
   a `sweep` versus when to leave it as a single-value run.

## What's next

Chapter 14 covers interfacing OCEAN to the rest of a system:
Postgres extension, HTTP API, MCP server, CLI, agent loops.
