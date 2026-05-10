---
slug: your-first-pipeline
number: 2
title: Your First Pipeline
promise: "After this chapter you have run a complete OCEAN pipeline end-to-end and read its output artifact."
status: draft
---

# Your First Pipeline

> After this chapter you have run a complete OCEAN pipeline end-to-end and read its output artifact.

## Concepts in this chapter

- The shape of an NDJSON _corpus_
- The six-verb canonical _pipeline_ in execution form
- The structure of the JSON _artifact_ a pipeline produces
- How the artifact's SHA-256 sidecar makes the run reproducible

## The toy_tna_50 corpus

This book ships three small _corpora_ for hands-on use. The first is
`toy_tna_50.ndjson`, a 50-record sample drawn from a fictional national
archive: every record names a piece of historical computing equipment
and which archive collection it belongs to. The format is _NDJSON_:
one JSON object per line, no enclosing array, no commas between
records.

Here are the first three records of the corpus:

```json
{"archive":"bombe","id":"tna-0000","primary_category":"structural","text":"machine catalogue entry machine catalogue entry machine catalogue entry bombe unit 0"}
{"archive":"tunny","id":"tna-0001","primary_category":"mechanical","text":"machine catalogue entry machine catalogue entry tunny unit 1"}
{"archive":"bombe","id":"tna-0002","primary_category":"electrical","text":"machine catalogue entry machine catalogue entry machine catalogue entry machine catalogue entry bombe unit 2"}
```

Each record has four fields. The `id` is the stable record key. The
`archive` field is a coarse-grained label, splitting records into two
collections (`bombe` and `tunny`). The `primary_category` field is a
finer-grained label, splitting records into three categories
(`mechanical`, `electrical`, `structural`). The `text` field is what
the pipeline will embed.

The toy corpus is small enough to run in under five seconds on a
laptop. The conclusions a pipeline draws from 50 records are not
statistically meaningful; the corpus is a teaching tool, not a
benchmark. Chapter 9 covers the difference between a teaching corpus
and a benchmark corpus.

## Six lines that run

Here is a complete OCEAN program. It loads the toy corpus, embeds
the text into a 64-dimensional space, clusters the embeddings into
modules, aligns each module back to its closest records, finds the
dispersion of the `archive` label across modules, and saves the
result.

```ocean run corpus=toy_tna_50
seed 42
load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive
embed text into 64 dimensions using tf-idf
cluster for 8 rounds max 6 modules energy = corpus mean
align modules using 5 nearest records
find dispersion of each label
save to /tmp/first_pipeline.json
```

Run this snippet by clicking the **Run** button in the web view of this
handbook, or by saving it to `first_pipeline.ocean` and invoking the
compiler from a checkout of the repository:

```
python -m scripts.run_universal_pipeline --config first_pipeline.ocean
```

Either way, the program finishes in a few seconds and writes its
artifact to `/tmp/first_pipeline.json`. A second file is written
alongside it (`/tmp/first_pipeline.json.sha256`) holding the hex
digest of the artifact's bytes.

## Reading the output artifact

The artifact is a single JSON object. Here is the top-level shape,
truncated for the page:

```json
{
  "pipeline": {
    "seed": 42,
    "source_sha256": "8f2c...",
    "operator_versions": {
      "load.ndjson": "1.0.0",
      "embed.tfidf_jl": "1.0.0",
      "cluster.kmeans": "1.0.0",
      "align.module": "1.0.0",
      "find.dispersion_per_label": "1.0.0",
      "persist.json": "1.0.0"
    }
  },
  "modules": [
    {"id": 0, "size": 9, "centroid_hash": "a1b3...", "narrative": null},
    {"id": 1, "size": 8, "centroid_hash": "c742...", "narrative": null}
  ],
  "alignment": {
    "module_to_records": {
      "0": ["tna-0007", "tna-0019", "tna-0023"],
      "1": ["tna-0001", "tna-0012"]
    }
  },
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

The top-level object has four sections. The `pipeline` section is the
provenance block: the seed used, the SHA-256 of the input file, and
the version stamp of every operator that ran. Without these, the
artifact is not reproducible. With them, any reader can re-run the
pipeline at the same seed against the same source file and compare
SHA-256 hashes.

The `modules` section lists the modules the clustering algorithm
produced. Each module has an id, a size (how many records are closer
to this module than any other), a centroid_hash, and a slot for an
optional `narrate` annotation (Chapter 12 covers narration).

The `alignment` section maps each module back to its closest records.
The default is the top five records per module; the `using K nearest
records` knob in the program adjusts this.

The `dispersion` section is the headline finding. The score `0.71`
on `bombe` means: across the six modules, the `bombe` archive is
fairly well concentrated in a small number of modules rather than
spread evenly across all of them. A score of `1.0` would mean a
single module captures the entire archive; a score of `0.0` would
mean every module contains exactly the same proportion of `bombe`
records. The numerical reading of dispersion is covered in detail in
Chapter 8.

## What the six lines mean

Re-read the snippet with the artifact in front of you. Each line in
the program corresponds to a section of the artifact.

| Program line | Artifact section that records its result |
| --- | --- |
| `seed 42` | `pipeline.seed` |
| `load _toy_corpora/...` | `pipeline.source_sha256` |
| `embed text into 64 dimensions ...` | (intermediate, not in artifact) |
| `cluster for 8 rounds ...` | `modules` |
| `align modules using 5 ...` | `alignment` |
| `find dispersion of each label ...` | `dispersion` |
| `save to /tmp/...` | (writes the file itself) |

The embedding step does not show up in the artifact. The 64-dimensional
vectors are intermediate state. The clustering step records its result
because clusters are durable; the embeddings are scaffolding.

This is a recurring shape in OCEAN: intermediate stages produce
opaque in-memory values, and only the terminal stages produce
durable named outputs that show up in the artifact. The hidden
intermediates are what give the language room to swap operator
implementations without changing what is recorded.

## Wider system

Compare this six-line program to a typical Jupyter notebook that
does the same analysis. The notebook would be 80 to 150 lines:
imports, NDJSON reading, vectorizer setup, k-means parameter
sweeps, alignment code, dispersion math, JSON serialization. The
notebook would also be _unreproducible by default_. Two readers
running the same notebook get different random initializations,
different vectorizer vocabularies, different module ids. Comparing
across two notebook runs requires careful bookkeeping.

OCEAN's six lines collapse to one declarative DAG with a stamped
seed and stamped operator versions. Comparing across two runs is
two `sha256sum` invocations. That collapse, repeated across an
organization with hundreds of pipelines, is the operational case for
OCEAN: a notebook-shaped process becomes auditable not by adding
checklists but by being a different shape of artifact.

## Exercises

1. Change `dimensions` from 64 to 128 and re-run. Does the dispersion
   on `bombe` go up, go down, or stay roughly the same? Why might that
   be?

2. Change `max 6 modules` to `max 12 modules` and re-run. Each module
   now contains fewer records on average. How does the `module_to_records`
   alignment section in the artifact change?

3. Run the pipeline twice with the same seed and compute the SHA-256
   of the artifact each time. The hashes should match. Now change
   `seed 42` to `seed 43` and re-run. Do the hashes still match? What
   does this tell you about the role of the seed?

## What's next

Chapter 3 zooms in on the lexical level: which characters in an OCEAN
program count as a token, an identifier, a literal, a keyword, or a
comment.
