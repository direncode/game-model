---
slug: embed-and-z
number: 6
title: Embed and Z
promise: "After this chapter you can choose between three free-tier embedders, name the premium structural variant, and pick a sensible target dimension."
status: draft
---

# Embed and Z

> After this chapter you can choose between three free-tier embedders, name the premium structural variant, and pick a sensible target dimension.

## Concepts in this chapter

- What `embed` produces (the `Z` latent space)
- TF-IDF with Johnson-Lindenstrauss projection (free)
- The MiniLM-L6 sentence-transformer embedder (free)
- The one-hot numeric embedder (free, for non-text corpora)
- The premium `content fingerprint` variant (referenced, not run here)
- How to choose `into N dimensions`

## What `embed` produces: the Z space

`embed` takes a `Records` value and produces a `Z` value. The `Z`
value is a fixed-dimension numeric array, one row per record. The
array dimensions are determined by the `into N dimensions` clause.
The numerical contents of the array are opaque to the rest of the
program. Nothing in OCEAN reads back the individual numbers; the
downstream verbs operate on the array as a whole.

The minimal `embed` statement is:

```ocean static
embed text into 128 dimensions
```

This reads the `text` field of each record (or whatever `text field
is` set during `load`) and produces a 128-dimensional embedding using
the default operator, TF-IDF with Johnson-Lindenstrauss projection.

The embed verb has three free-tier variants and one premium variant.

## tf-idf (the default, free-tier)

```ocean static
embed text into 128 dimensions using tf-idf
```

The free-tier default. The corpus is tokenized, term frequencies are
computed, inverse document frequencies weight the rare terms, and a
Johnson-Lindenstrauss random projection collapses the resulting
high-dimensional sparse vector down to the target dimension.

TF-IDF is fast (under a second on 50,000 records on a laptop) and
well-understood. The substrate it produces is _surface vocabulary_:
two records that use the same words land near each other in the Z
space. This is right for many tasks (topic clustering, exact-quote
detection) and wrong for others (paraphrase matching, cross-language
analysis).

Three optional knobs:

```ocean static
embed text into 128 dimensions using tf-idf
     with min_df = 2
     with max_df = 0.8
     with max_features = 50000
```

`min_df` drops terms that appear in fewer than N documents.
`max_df` drops terms that appear in more than the given fraction of
documents (stopword-like terms). `max_features` caps the vocabulary
size.

## transformer minilm_l6 (free-tier, semantic)

```ocean static
embed text into 384 dimensions using transformer minilm_l6
```

A sentence-transformer embedder using the `all-MiniLM-L6-v2` model
from sentence-transformers. The native output dimension is 384; ask
for a different dimension and a linear projection is applied.

The MiniLM-L6 embedder is the right choice when the corpus is short
text and the substrate of interest is semantic, not lexical. Two
records that paraphrase each other will land near each other in the
Z space, even if they share no words. The trade-off is speed: MiniLM
is roughly an order of magnitude slower than TF-IDF, and it adds a
~90 MB model dependency to the runtime.

This variant is free-tier; the model weights are open-source.

## one-hot numeric (free-tier, for non-text corpora)

```ocean static
embed text into 64 dimensions using one-hot numeric
```

Despite the verb spelling `embed text`, this variant ignores the
text field. It reads the numeric and categorical fields of the
records and constructs a one-hot encoded representation, padded or
projected to the target dimension. This is the right embedder for
network-traffic logs, telemetry, or other tabular non-text corpora.

For the `toy_nslkdd_200.ndjson` corpus, which has fields like
`duration`, `protocol`, `service`, `src_bytes`, this variant
produces a meaningful Z that captures the relationships between
records based on their numeric and categorical attributes.

## The premium content fingerprint variant

The premium embedder is referenced by name but does not run in the
sandboxed handbook runner:

```ocean static
embed text into 48 dimensions using content fingerprint
```

The output dimension is always 48 (the width of the structural
fingerprint primitive defined in `docs/PRIMITIVE_SPEC.md`). The
fingerprint is a Bloom-style hash of the top-K most-distinctive
terms of each record, with a rotation ensemble that yields 48
independent pseudorandom bits from a single SHA-256.

The substrate `content fingerprint` produces is _structural shape_,
not surface vocabulary. Two records with completely different words
but the same underlying template land near each other in the Z
space. This is the right embedder for cross-corpus matching,
template detection, and structural anomaly hunting.

Because the fingerprint is the proprietary primitive that backs the
commercial commitment in `docs/PRIMITIVE_SPEC.md`, executing
`content fingerprint` requires a paid API key. The grammar is
identical either way; the runtime gate is the only difference.

## Choosing into N dimensions

The target dimension is a knob the program author sets. The two
considerations:

- **Statistical power.** Smaller dimensions concentrate signal but
  lose detail. 32 dimensions is the floor for any real corpus; below
  that, clusters get noisy.
- **Compute cost.** Larger dimensions cost more in every downstream
  operator: clustering quadratic in the dimension, alignment
  near-linear, dispersion negligible. 1024 is the practical ceiling
  for a laptop; 256 is comfortable.

Reasonable defaults by embedder:

| Embedder | Sensible dimension range | Default in this book |
| --- | --- | --- |
| `tf-idf` | 64 to 256 | 128 |
| `transformer minilm_l6` | 384 (native) or down to 128 | 384 |
| `one-hot numeric` | 32 to 128 | 64 |
| `content fingerprint` | 48 (fixed) | 48 |

When in doubt, run the same pipeline at two dimensions and use
`compare` (chapter 10) to see whether the dispersion changes
meaningfully.

## Wider system

The split between TF-IDF and the content fingerprint is the
open-core boundary made visible at the verb level. TF-IDF is
well-understood public-domain mathematics. `content fingerprint` is
the proprietary structural primitive. The verb is the same. The
program author can prototype on TF-IDF, validate that the pipeline
shape is right, and swap to `content fingerprint` for the
commercial run by changing one phrase. That cost-of-switching
matters: a customer who has already invested in OCEAN's vocabulary
and pipeline shape can adopt the premium primitive without rewriting
anything else.

This is the same shape Stripe uses for its test-mode and live-mode
APIs. The API surface is identical; only the keys and the cost
profile change. The substrate-status play depends on having that
ergonomic continuity between free and paid.

## Exercises

1. Pick the best free-tier embedder for each of the following
   corpora and justify in one sentence:
   - 10,000 news articles in English
   - 5,000 short tweets across 12 languages
   - 100,000 network traffic logs from a firewall
   - 500 historical letters whose authors are at issue

2. The toy_climate corpus has 100 records. Run an `embed` at 32
   dimensions, then at 256 dimensions. Which artifact has a higher
   `dispersion.by_label.region` score? Why might that be?

3. The premium `content fingerprint` operator always produces 48
   dimensions. If a program asks `into 64 dimensions using content
   fingerprint`, what should the compiler do? (Hint: look at the
   premium operator card in Appendix B.)

## What's next

Chapter 7 takes a `Z` value and clusters it into `Modules`, with
the free-tier `kmeans` operator and the premium `tcd recursive
loop`.
