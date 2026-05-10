---
slug: the-pipeline-types
number: 4
title: The Pipeline Types
promise: "After this chapter you can name the seven pipeline types, the verb that produces each, and the verb that consumes each."
status: draft
---

# The Pipeline Types

> After this chapter you can name the seven pipeline types, the verb that produces each, and the verb that consumes each.

## Concepts in this chapter

- The seven pipeline types and what each holds
- Why static typing exists in a declarative DSL
- The producer-consumer table
- One subtype relation (`Aligned <: Modules`)
- How to read an OCEAN type error

## Why static types in a pipeline language

A type system for a small DSL like OCEAN seems heavy at first.
SQL, the canonical small DSL, exposes types only at column boundaries
(`int`, `varchar(N)`, `timestamp`). The query as a whole is not
typed; rows flow through it and the result is just a set of rows.

OCEAN does something stronger: every statement has a type, every
binding has a type, every verb is a typed function from input types
to an output type. The type-checker runs after the parser and
before the compiler hands off to the runner. A program that does not
type-check does not run.

The reasoning is the reasoning for static typing in any production
codebase: the cost of a runtime type error in a multi-hour pipeline
run is much higher than the cost of catching that error at compile
time. A pipeline that loads a 50-million-row corpus, embeds it for
forty minutes, and then crashes because `cluster` was applied to
`Records` instead of `Z` has wasted forty minutes and a few dollars.
The type-checker catches that crash in milliseconds, before any
operator runs.

## The seven pipeline types

OCEAN has exactly seven types in the pipeline namespace:

| Type | Description |
| --- | --- |
| `Records` | A finite set of structured records loaded from a file. |
| `Z` | A latent embedding of a `Records` set; opaque internally. |
| `Modules` | A partition of a `Z` into a small number of named groups. |
| `Aligned` | Modules with their nearest-record assignments and optional narratives. |
| `Dispersion` | A finding: a normalized score per label per module. |
| `Artifact` | The persisted JSON output of `save`. Terminal type. |
| `Pipeline` | The type of a `compare`, `sweep`, or `define` body. |

There are also four primitive types used inside expressions: `Number`,
`String`, `Path`, `Bool`. The escape hatch `Any` exists for the rare
`define` function whose parameter type cannot be inferred at the call
site. The seven pipeline types above are the ones the verbs care
about.

The naming follows the data: `Records` are records; `Z` is the
standard math notation for a latent space; `Modules` are clusters
under their substrate-clustering name; `Aligned` is the post-alignment
shape; `Dispersion` is the finding; `Artifact` is the persisted file;
`Pipeline` is the meta-type of any block that produces other typed
values.

## Operator signatures

Every verb has a fixed input-output signature:

```
load    : Path -> Records
embed   : Records -> Z
reduce  : (Z, Records) -> (Z, Records)
cluster : Z -> Modules
align   : (Modules, Records, Z) -> Aligned
find    : (Aligned, Records, Z) -> Dispersion
narrate : Aligned -> Aligned
save    : (Aligned | Dispersion | Modules | Records) -> Artifact
```

`reduce` takes the pair `(Z, Records)` and returns a new pair of the
same shape, filtering both down to a smaller surviving subset (the
BTUT pre-reduction operator).

`align` and `find` each take three inputs: the directly relevant
type, plus the original `Records` and `Z` carried forward in the
DAG. The two carried inputs are wired implicitly by the compiler;
the program never names them.

`save` is the only verb whose input type is a union. It accepts the
most natural terminal value from any branch of the DAG.

## Subtyping: Aligned is a Modules

OCEAN has one subtype relation: `Aligned <: Modules`. An `Aligned`
value is a `Modules` value with extra information attached (the
per-module nearest-record list and any narrative annotation). This
means `narrate` and `find` can be skipped and the program still
type-checks; `save` accepts an `Aligned` wherever a `Modules` is
allowed.

```ocean static
load tmp/corpus.ndjson take 500 records
embed text into 128 dimensions
cluster for 16 rounds max 24 modules using kmeans energy = corpus mean
save to data/just_modules.json
```

This program saves a `Modules` value directly, without aligning or
finding dispersion. It type-checks because `save` accepts `Modules`.
The resulting artifact has the `modules` section but no `alignment`
or `dispersion` sections.

## Reading a type error

When a verb is applied to the wrong input, the compiler emits a
diagnostic with a caret, a category, and a suggestion. Here is an
intentional type error and the diagnostic it produces:

```ocean static
load tmp/corpus.ndjson take 500 records as raw
cluster raw using tcd recursive loop
```

The compiler refuses to compile this program and prints:

```
ocean: error at file.ocean:2:1

  2 | cluster raw using tcd recursive loop
      ^^^^^^^

type error: cluster expects Z, got Records (from 'raw')

hint: pipe through embed first, e.g.:
        let z = embed text from raw into 128 dimensions
        cluster z using tcd recursive loop
```

The diagnostic carries four pieces of information: the file and
position, the offending token, the actual-versus-expected types,
and a typed suggestion. The suggestion is generated from the verb
signature table and the upstream binding shape; it is not a generic
"check your types" message.

Chapter 7 of this handbook covers `cluster` in detail and explains
the `using tcd recursive loop` variant, which is a premium operator.
For now, the only point is that the typechecker caught the error
before the pipeline tried to load a 50,000-record file and cluster
its `Records` directly.

## Wider system

The seven-type pipeline namespace is deliberately fewer than would
arise from a general data-flow language. Spark, in contrast, has at
least three pipeline-shaped types (RDD, DataFrame, Dataset), each
with its own operator set, and the conversions between them are a
source of confusion for new Spark users. OCEAN avoids the choice by
having a single linear progression: `Records` to `Z` to `Modules`
to `Aligned` to `Dispersion` to `Artifact`. Every program is the
same shape.

The substrate-status angle: the type names are part of OCEAN's
vocabulary. When developers say "the dispersion of this label looks
low" or "the modules came out badly," they are speaking OCEAN even
if they are not running the language. That vocabulary
capture is harder to achieve with a sprawling type system.

## Exercises

1. Without running the compiler, predict the type error in the
   following program and write it out in the diagnostic format above:

```ocean static
load tmp/corpus.ndjson take 500 records
align modules using 5 nearest records
```

2. Name the verbs that accept `Dispersion` as an input. (Hint: only
   one.)

3. The four types that `save` accepts as input are `Records`,
   `Modules`, `Aligned`, and `Dispersion`. Why not `Z`? What would
   it mean to save a `Z` value?

## What's next

Chapter 5 starts the verb-by-verb tour with `load`, the only verb that
takes a `Path` and produces a `Records`.
