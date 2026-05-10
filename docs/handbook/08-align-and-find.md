---
slug: align-and-find
number: 8
title: Align and Find
promise: "After this chapter you can read a dispersion artifact and explain what it claims about a corpus."
status: draft
---

# Align and Find

> After this chapter you can read a dispersion artifact and explain what it claims about a corpus.

## Concepts in this chapter

- Module-to-record alignment via k-nearest
- The `fine label field is` knob for finer-grained alignment
- The `find dispersion of each label` operation
- What dispersion measures (a single normalized score per label per module)
- Why dispersion is the ungameable falsifiability gauge

## align: putting records back next to their modules

`cluster` produces a `Modules` value whose entries name the centroids
of each cluster but do not list which records are nearest. `align`
fills that gap by attaching, to each module, the k records whose Z
positions are closest to that module's centroid.

```ocean static
align modules using 5 nearest records
```

This produces an `Aligned` value: the same modules, each now carrying
a list of five record ids. The artifact's `alignment.module_to_records`
section is what `save` writes from this value.

The `K nearest records` knob ranges from 1 (only the nearest record
per module) to roughly module-size (every record in the module gets
listed). Sensible defaults: 5 for hand inspection, 50 for the
dispersion math, 100+ for production audits where the alignment
itself is a deliverable.

There is one extra knob, `fine label field is`:

```ocean static
align modules using 50 nearest records fine label field is primary_category
```

This tells `align` to also record, alongside each per-module record
list, the fine-grained label for each of those records. The fine
label field is typically a more granular version of the gold label.
For the TNA corpus, the gold label is `archive` (two values: `bombe`,
`tunny`) and the fine label might be `primary_category` (three
values: `mechanical`, `electrical`, `structural`).

The fine label is not used by `find dispersion`. It is recorded for
the human reader who later inspects the alignment section of the
artifact and wants to see, at a glance, what kind of records each
module collected.

## find dispersion of each label

```ocean static
find dispersion of each label
```

`find dispersion of each label` is the verb that turns an `Aligned`
value into a `Dispersion` value. The output is a single normalized
score per label per module, indicating how cleanly each label is
concentrated in or distributed across the modules.

The artifact's `dispersion.by_label` section is the result.

For the TNA pipeline with two archives (`bombe`, `tunny`) and six
modules, the dispersion section might look like:

```json
{
  "dispersion": {
    "by_label": {
      "archive": {
        "bombe": 0.71,
        "tunny": 0.69
      }
    }
  }
}
```

A score of `1.0` means the entire `bombe` archive is concentrated in
a single module, with no `bombe` records spread to other modules. A
score of `0.0` means `bombe` records are spread perfectly evenly
across every module, indistinguishable from random assignment. The
0.71 score above says the `bombe` archive concentrates in a small
number of modules, but not in just one.

The exact formula is the normalized entropy of the per-module label
proportions, inverted so that high values mean concentrated and low
values mean spread. The normalization is against the number of
modules in the artifact, so dispersion scores can be compared across
runs with different `max M modules` settings.

## What dispersion measures

Dispersion is the "did this actually find anything?" gauge. It
answers a single question: do the modules that the unsupervised
clustering produced happen to line up with the labels the data
already had? The answer is one number per label, between 0 and 1.

Dispersion has three commercially load-bearing properties:

1. **Single number.** A buyer asks "did this work?" and gets a
   number back. Not a confusion matrix, not a ROC curve, not a
   per-class table. One number per label. The substrate-status
   commitment depends on every customer being able to read the
   same gauge.

2. **Deterministic.** Same seed, same corpus, same dispersion score
   to the bit. Two auditors running the same pipeline get the same
   number. This is what makes dispersion a contract rather than a
   suggestion.

3. **Ungameable in one direction.** A pipeline cannot "cheat" toward
   a high dispersion by, for instance, copying the gold labels into
   the embedding. The clustering operator never sees the labels;
   only `find dispersion` does, and it sees them only after the
   modules are fixed. A high dispersion score is therefore evidence
   of substrate structure, not of label leakage.

The fourth property, which the next section covers, is that
dispersion can be _null-tested_.

## Null testing

The substrate-clustering claim "the dispersion of `archive` is
0.71" is meaningful only if 0.71 is much higher than what random
chance would produce on the same corpus. The null test answers
that question by running the same clustering 500 times on a
randomly shuffled version of the data and comparing the true score
against the distribution of null scores.

The null test is not a verb in OCEAN. It is a separate operation
in the primitive layer, documented in `docs/PRIMITIVE_SPEC.md` and
Appendix C of this handbook. The reason it lives in the primitive
layer is that the null test operates on fingerprints directly,
without the embedding and clustering steps; it is much cheaper to
run.

When a vendor publishes a dispersion claim ("0.71 on this corpus,
z = 18.19σ against the null"), the second number is the null-test
z-score. A claim with z below 2.0 is at chance level; above 3.0 is
meaningful; above 5.0 is bulletproof for most commercial purposes.

## Wider system

Dispersion is the falsifiability gauge that makes OCEAN-shaped
infrastructure commercially viable. Without it, the substrate
claim would be circular: "trust the modules because they came out
of the algorithm." With it, the substrate claim is testable: "the
modules concentrate label X with dispersion 0.71, which exceeds the
99th percentile of the null distribution, so the structure is
real."

This is the same shape that makes p-values load-bearing in
empirical science: a single number that can be checked against a
known null. OCEAN's commercial commitment in `docs/PRIMITIVE_SPEC.md`
section 11 is built on this: if a published claim ever fails the
null test as specified, the vendor retracts the claim. That is the
kind of commitment that only a falsifiable gauge makes possible.

## Exercises

1. Add `narrate modules` between `align` and `find` in the
   Chapter 2 pipeline (chapter 12 covers narrate in detail). Does
   the dispersion value in the artifact change? Should it?

2. Run the Chapter 2 pipeline twice with the same seed and compare
   the dispersion values. Are they byte-identical? What if you
   change the seed to 43?

3. Read the dispersion score `0.69` for `tunny` in the example
   above. In your own words, what does it claim?

## What's next

Chapter 9 covers `save` and the full determinism contract, including
how the artifact's SHA-256 sidecar is computed and how to verify a
re-run against a previous one.
