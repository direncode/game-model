---
slug: save-and-the-determinism-contract
number: 9
title: Save and the Determinism Contract
promise: "After this chapter you understand exactly what 'deterministic' means for an OCEAN program, and why a re-run produces a byte-identical artifact."
status: draft
---

# Save and the Determinism Contract

> After this chapter you understand exactly what 'deterministic' means for an OCEAN program, and why a re-run produces a byte-identical artifact.

## Concepts in this chapter

- What `save` writes (JSON + SHA-256 sidecar)
- The four pillars of OCEAN's determinism contract
- The seed and how to choose one
- How to verify that a re-run is identical

## save and what it writes

`save` is the terminal verb of an OCEAN pipeline. It accepts any
value of the four persistable types (`Records`, `Modules`, `Aligned`,
`Dispersion`) and writes a JSON artifact to disk.

```ocean static
save to data/result.json
```

A single `save` writes two files. The first is the artifact itself,
a pretty-printed JSON document at the named path. The second is the
SHA-256 sidecar: a file with the same name plus a `.sha256`
extension, containing the hex digest of the artifact's bytes.

```
data/result.json
data/result.json.sha256
```

The sidecar is the verification contract. A reader who wants to
confirm an artifact matches the expected version computes
`sha256sum data/result.json` and compares to the sidecar's content. If they match, the artifact is
the right one. If they do not, something has changed.

`save` can be called multiple times in a single program. Each call
writes to its own path. There is no implicit final save; if a program
has no `save` statement, it runs to completion but produces no
on-disk output.

## The four pillars of determinism

OCEAN promises this: for any program _P_, any seed _S_, and any
input file with a fixed content, executing _P_ at seed _S_ produces
the same artifact and the same SHA-256 digest on every machine.

That promise rests on four pillars, each enforced by the compiler.

**Pillar 1: Inputs are content-addressed.** Every `load` line records
the SHA-256 of the file content into the operator's signature. If
the file content changes by a single byte, every downstream operator's
signature changes too, and the runner does not reuse cached
intermediates. The artifact records the source SHA-256 in
`pipeline.source_sha256`, so a reader can audit which input the
artifact corresponds to.

**Pillar 2: Operators are pure functions of inputs and seed.** No
operator reads wall-clock time, system entropy, or environment
variables for randomness. Where an operator would otherwise need
randomness (k-means initialization, BTUT sampling, random projection
seeding), it derives the randomness from `(input_signature, seed)`
and from nothing else.

**Pillar 3: Sweep expansion is order-stable.** A `sweep s from 42 to
45 do ... end` block always produces its four branches in ascending
order of `s`. Two readers running the same sweep collect their
results in the same sequence. This matters because two sweep
artifacts that are byte-identical when ordered ascendingly would
not be byte-identical if one runner happened to enumerate in
descending order.

**Pillar 4: Parallel does not cross state.** A `parallel do ... end`
block isolates its branches; they cannot share variables, write to
the same output path, or otherwise interact. This means the runner
can execute branches in any order without changing the artifact, and
each branch's output is reproducible on its own.

## The seed and how to choose one

```ocean static
seed 42
```

The `seed` declaration sets the integer seed used by every operator
that needs randomness. The declaration is optional; if omitted, the
runner uses 42 by default. The default is published as the
industry-default reproducibility anchor in `docs/PRIMITIVE_SPEC.md`.

Three considerations for choosing a non-default seed:

1. **Use a different seed when running a stability study.** A
   `sweep seed from 42 to 45` produces four independent runs whose
   variation tells the reader how much the result depends on
   initialization. If all four runs land within rounding of each
   other, the result is stable. If they vary by more than a
   reasonable tolerance, the result is sensitive to initialization,
   and the report should say so.

2. **Use a per-customer seed when a customer needs a unique
   artifact.** This is rare but real for some compliance contexts;
   different customers get different artifacts so their files cannot
   be confused, but each customer's artifact is reproducible against
   their own seed.

3. **Otherwise, leave it at 42.** The default seed is the published
   anchor; a third party trying to reproduce a published claim
   should not have to guess which seed the publisher used.

## How to verify a re-run is identical

The verification flow is two commands:

```
sha256sum data/result.json
cat data/result.json.sha256
```

Compare the two hex digests. If they match, the run is verified
against itself. To verify across machines or across time, share the
digest, the OCEAN program source, the seed declaration (if
non-default), and the input file. A second party runs the same
program at the same seed against the same input file and computes
the SHA-256. The digests must match. If they do not, something has
changed: the program text, the input file content, the operator
versions in the runner, or the OCEAN compiler itself. The artifact's
`pipeline.operator_versions` block helps narrow down which one.

There is no built-in `verify` verb in OCEAN. The verification is
deliberately external: it uses standard POSIX tools, lives outside
the program, and can be performed by a party who does not have
OCEAN installed. This is the same shape that makes Git commit SHAs
verifiable; the contract sits in the digest, not in the tool that
produced it.

## Wider system

Determinism is the commercial spine of OCEAN-shaped infrastructure.
Without bit-identical artifacts, the falsifiability commitment in
`docs/PRIMITIVE_SPEC.md` section 11 ("if a published claim ever
fails the null test as specified, the vendor retracts the claim")
cannot be tested. With bit-identical artifacts, the commitment is
testable by anyone with the digest.

Comparison: Stripe's idempotency keys turn retried payments into
deterministic operations; OCEAN's seed turns reruns of analytical
pipelines into deterministic operations. In both cases, the
underlying compute is fundamentally non-idempotent (a card
authorization can fail or succeed; a clustering can hit different
local minima), and the language-level guarantee is what makes the
contract usable. Substrate status depends on this; an
unreproducible substrate is not a substrate.

## Exercises

1. Re-run the Chapter 2 pipeline twice with `seed 42`. Compute
   `sha256sum` of the artifact each time. The two digests should
   match. They do.

2. Re-run the same pipeline with `seed 43`. Does the dispersion
   value change a lot or a little? What does the size of the
   change tell you about stability?

3. The artifact has a `pipeline.operator_versions` block. If a
   future version of `cluster.kmeans` is shipped with a bug fix
   that changes the initialization in a small way, two runs against
   the old and new operator versions will produce different
   artifacts. How should the version field in the artifact help an
   auditor diagnose this?

## What's next

Chapter 10 leaves the verb tour and covers control flow: `let`, `if`,
`sweep`, `parallel`, and `compare`.
