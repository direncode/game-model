---
slug: control-flow
number: 10
title: Control Flow
promise: "After this chapter you can write conditional pipelines, parameter sweeps, methodology comparisons, and parallel branches."
status: draft
---

# Control Flow

> After this chapter you can write conditional pipelines, parameter sweeps, methodology comparisons, and parallel branches.

## Concepts in this chapter

- Named bindings with `let`
- Conditional branching with `if / elif / else`
- Parametric expansion with `sweep`
- Independent execution with `parallel`
- Methodology comparison with `compare ... against ... on ...`

## Named bindings: let

`let` introduces a named binding. The right-hand side is any
expression that produces a pipeline value or a primitive value.

```ocean static
let raw = load tmp/corpus.ndjson take 500 records balanced by archive
let z = embed text from raw into 128 dimensions
let modules = cluster z for 16 rounds max 24 modules using kmeans
```

Each `let` binding has a type, inferred from the right-hand side.
The binding is in scope from its declaration to the end of the
enclosing block (which may be the whole program, or the body of a
`define`, `sweep`, `if`, or `parallel` block).

A binding can be referenced by name in any later statement. The
`from NAME` clause attached to `embed`, `cluster`, `align`, or `find`
selects which upstream binding to use:

```ocean static
let raw = load tmp/corpus.ndjson take 500 records balanced by archive
let z_tfidf = embed text from raw into 128 dimensions using tf-idf
let z_minilm = embed text from raw into 384 dimensions using transformer minilm_l6
```

Two embeddings on the same input. Both are in scope; downstream
`cluster` statements can pick either one with `from z_tfidf` or
`from z_minilm`.

Without `from NAME`, the compiler defaults to "most recent step of
the expected type." This is convenient for short pipelines and
brittle for long ones; the linter warns on `embed` statements that
have multiple upstream `Records` candidates and no explicit `from`.

## Conditional branching: if / elif / else

```ocean static
if target > 5000 then
    reduce records using btut target 300 survivors budget $25
else
    embed text into 128 dimensions
end
```

The condition is a Boolean expression. Both branches must produce
values of the same type, or one branch must be terminal (e.g., a
`return` inside a `define`).

`elif` chains additional conditions:

```ocean static
if target > 100000 then
    reduce records using btut target 1000 survivors budget $200
elif target > 5000 then
    reduce records using btut target 300 survivors budget $25
else
    embed text into 128 dimensions
end
```

The condition expression set is small: comparisons (`==`, `!=`,
`<`, `>`, `<=`, `>=`), arithmetic (`+`, `-`, `*`, `/`), and the
keyword booleans `and`, `or`, `not`. No function calls in condition
positions (though `define`d functions can be invoked as separate
statements).

## Parametric sweeps

```ocean static
sweep s from 42 to 45 do
    load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive
    embed text into 64 dimensions using tf-idf
    cluster for 8 rounds max 6 modules using kmeans energy = corpus mean
    align modules using 5 nearest records
    find dispersion of each label
    save to data/seed_${s}.json
end
```

A `sweep` expands at compile time into N independent branches, one
per value of the sweep variable. The body of the sweep is type-checked
once but executed once per value. The sweep variable is in scope
inside the body and is typically used to disambiguate output paths
via interpolation (`save to data/seed_${s}.json`).

The optional `step` clause sets a stride other than 1:

```ocean static
sweep d from 32 to 256 step 32 do
    embed text into d dimensions using tf-idf
    save to data/dim_${d}.json
end
```

Sweep expansion is deterministic. The branches always materialize in
ascending order of the sweep variable. Two runs of the same sweep
produce the same sequence of artifacts.

## Independent execution: parallel

```ocean static
parallel do
    save to data/tfidf_result.json
    save to data/minilm_result.json
end
```

A `parallel` block declares that its statements have no inter-branch
dependencies and may be executed in any order, including concurrently.
The compiler verifies the independence by checking that no branch
references a binding produced by another branch.

`parallel` is rarely used in short pipelines; the compiler
automatically parallelizes independent branches of the DAG. The
explicit `parallel do ... end` is for cases where the reader wants
to communicate that two branches are intentionally independent and
should not share state.

## Methodology comparison: compare ... against ...

```ocean static
let raw = load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive
compare
    embed text from raw into 64 dimensions using tf-idf
against
    embed text from raw into 64 dimensions using transformer minilm_l6
on dispersion of each label
```

`compare` runs two pipeline tails and reports the difference between
their dispersion findings. The two arms must produce the same
intermediate type (here, both produce `Z`), and the `on ...` clause
names the finding the comparison is measured against.

The artifact for a compare has a slightly different shape than a
single-pipeline artifact: it includes both arms' results plus a
per-label delta:

```json
{
  "compare": {
    "left": {"variant": "tf-idf", "dispersion": {...}},
    "right": {"variant": "transformer_minilm_l6", "dispersion": {...}},
    "delta": {"archive": {"bombe": -0.05, "tunny": +0.02}}
  }
}
```

A negative delta on `bombe` means the left arm's dispersion was
lower than the right arm's; positive means the left was higher. The
delta is the headline number; the two arm artifacts are kept for
auditability.

`compare` is the right tool when a program author wants to know
"does this methodological choice matter?" rather than "what is the
result of one specific methodological choice?"

## Wider system

OCEAN's control flow is deliberately restricted. There are no
unbounded loops; no recursion (except in the operator-level TCD
recursive loop, which is implementation detail); no goto; no exception
handling. Every program compiles to a finite directed acyclic graph
with a known branch count at compile time.

This is the same restriction SQL imposes and for the same reason: a
finite DAG with known branches is something a planner can reason
about. The cost shape is predictable. The artifact set is enumerable.
The audit trail is bounded. Substrate-status infrastructure depends
on these properties; a Turing-complete OCEAN would be a research
language, not a substrate.

## Exercises

1. Write a sweep that runs the toy_tna_50 pipeline at dimensions
   32, 64, 128, and 256. Save each to a separate artifact path.

2. Write a `compare` that puts `tf-idf` against `one-hot numeric`
   on the toy_nslkdd_200 corpus. Read the delta. Which embedder
   gives higher dispersion on the `type` label? Why?

3. Sketch the type error that the compiler would produce for the
   following snippet:

```ocean static
if target > 1000 then
    embed text into 128 dimensions
else
    cluster for 16 rounds max 24 modules using kmeans
end
```

   (Hint: the two arms of an `if` must produce the same type.)

## What's next

Chapter 11 covers user-defined functions: `define`, default
parameters, and the standard library at
`scripts/operators/ocean/stdlib/substrate.ocean`.
