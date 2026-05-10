---
slug: functions-modules-stdlib
number: 11
title: Functions, Modules, Stdlib
promise: "After this chapter you can read the standard library, call its functions, and write your own."
status: draft
---

# Functions, Modules, Stdlib

> After this chapter you can read the standard library, call its functions, and write your own.

## Concepts in this chapter

- `define` for naming a reusable pipeline body
- Default parameters and named-argument call syntax
- `import "path" as namespace` for cross-file reuse
- The substrate stdlib at `scripts/operators/ocean/stdlib/substrate.ocean`
- When to author a stdlib function versus an inline pipeline

## Defining a function

```ocean static
define basic_run(corpus, target = 500, embed_dim = 128, iters = 16,
                 k_nearest = 50,
                 output = "data/validation/basic_run.json") do
    load corpus take target records balanced by archive
    embed text into embed_dim dimensions
    cluster for iters rounds max 24 modules using kmeans energy = corpus mean
    align modules using k_nearest nearest records
    find dispersion of each label
    save to output
end
```

`define NAME(params) do ... end` introduces a reusable, named
pipeline. The body is any sequence of statements legal at top level.
Parameters appear as identifiers usable in the body. Parameters with
default values are optional at call sites.

The function above takes one required parameter (`corpus`) and five
optional ones with defaults. Call sites supply the corpus and
override any default they want:

```ocean static
basic_run(corpus = "_toy_corpora/toy_tna_50.ndjson", target = 50)
```

Calls use the named-argument syntax. Positional arguments are also
legal but discouraged for anything beyond the first one or two
parameters; named arguments read better and are less brittle to
function-signature changes.

## Default parameters and types

Parameter types are inferred from their default values, when present,
or annotated explicitly:

```ocean static
define run_at_seed(corpus : Path, target : Number = 500) do
    ...
end
```

When the type is unambiguous from the default (a number literal, a
path literal, a string literal), the annotation can be omitted. When
a parameter has no default and is called with mixed types across
sites, annotate explicitly.

The compiler enforces parameter types at call sites: passing a
string to a parameter annotated as `Path` is a type error.

## return: making functions reusable as expressions

A `define`d function can `return` a value, making it usable on the
right-hand side of `let`:

```ocean static
define embed_and_cluster(corpus, dim = 128) do
    let raw = load corpus take 500 records balanced by archive
    let z = embed text from raw into dim dimensions using tf-idf
    let modules = cluster z for 16 rounds max 24 modules using kmeans
    return modules
end
```

```ocean static
let m = embed_and_cluster(corpus = "tmp/x.ndjson", dim = 64)
align m using 50 nearest records
find dispersion of each label
```

The return type is inferred from the type of the returned value (here,
`Modules`).

## Imports

```ocean static
import "presets/atlas.ocean" as atlas
let result = atlas.basic_run(corpus = "_toy_corpora/toy_tna_50.ndjson")
```

`import "PATH" as NAME` reads the named file, parses and type-checks
it independently, and exposes its top-level `define`s under the
namespace `NAME`. Only `define`d functions are visible across the
import; top-level statements in the imported file are not executed.

Imports are textual and namespaced. Cyclic imports are an error.
Two imports with the same `as NAME` are an error. The path is
relative to the importing file, or relative to a configured
include root.

## The substrate stdlib

The standard library ships at
`scripts/operators/ocean/stdlib/substrate.ocean`. It defines four
common pipelines as `define`d functions:

`basic_run(corpus, target, embed_dim, iters, k_nearest, output)`
runs the simplest end-to-end pipeline. The defaults are tuned for a
500-record sample: 128 dimensions, 16 rounds, 24 modules, 50 nearest
records.

`seed_sweep(corpus, target, first_seed, last_seed)` runs the same
pipeline at every seed in the inclusive range and saves to
`data/validation/seed_${s}.json`. The default range is 42 to 45,
producing four artifacts to compare.

`anomaly_focused(corpus, normal_label, target, output)` runs an
anomaly-detection pipeline with the energy function anchored on the
normal class. Defaults match the NSL-KDD intrusion-detection corpus
shape (`normal` as the normal label, `type` as the label field).

`content_vs_structural(corpus, output)` runs a `compare` between
TF-IDF and the premium content fingerprint, measured on dispersion
of the `directorate_to_pm` label. This preset requires an API key
for the content fingerprint operator; without one, the compare
type-checks but the content arm does not execute.

To call any preset from a program:

```ocean static
import "stdlib/substrate.ocean" as substrate

let result = substrate.basic_run(
    corpus = "_toy_corpora/toy_tna_50.ndjson",
    target = 50
)
```

## When to author a stdlib function

The right time to extract a preset into the stdlib is when the same
pipeline shape has appeared in two or more programs in the project,
and the parameters that vary across sites are bounded.

A pipeline shape that is unique to one program should stay inline.
A pipeline shape that varies on every call should not become a stdlib
function; it should remain a directly-written pipeline so the variation
is visible.

Stdlib functions in OCEAN are presets, not abstractions. They name a
sensible-default pipeline and let the call site override the few
parameters that typically vary. A preset that hides every parameter
behind a wall of defaults is a code smell; readers should be able to
read the preset's signature and know roughly what it does.

## Wider system

The stdlib is the most concrete piece of the substrate-status play.
Every preset (`basic_run`, `seed_sweep`, `anomaly_focused`,
`content_vs_structural`) is a pattern that customers describe in
their own work even if they never import the stdlib. When a customer
team reports "the seed sweep showed stable dispersion," they have
already adopted OCEAN's vocabulary; whether they ran
`substrate.seed_sweep` or hand-wrote the `sweep` statement is a
detail.

This is the same shape that made dbt's macros load-bearing for
analytics engineers: the named patterns became the vocabulary, and
the vocabulary became the way the work was described, and the way
the work was described became how the rest of the toolchain
organized itself.

## Exercises

1. Call `substrate.seed_sweep` against the toy_tna_50 corpus with
   `first_seed = 42` and `last_seed = 43`. How many artifacts does
   the call produce?

2. Define a function `my_anomaly(corpus)` that wraps `anomaly_focused`
   with `target = 100` and a fixed output path. Call it.

3. The stdlib has `basic_run`, `seed_sweep`, `anomaly_focused`, and
   `content_vs_structural`. Suggest one more preset that would be a
   good candidate for the stdlib, and write a one-line description
   of its parameters.

## What's next

Chapter 12 covers the tooling: the REPL, the formatter, the linter,
the LSP, and the OCEAN MCP server that exposes the language as a
set of tools for an AI coding agent.
