---
slug: load-and-records
number: 5
title: Load and Records
promise: "After this chapter you can load any NDJSON corpus, stratify the sample, and choose which fields hold the text and the label."
status: draft
---

# Load and Records

> After this chapter you can load any NDJSON corpus, stratify the sample, and choose which fields hold the text and the label.

## Concepts in this chapter

- The NDJSON file shape
- `take N records` for size control
- `balanced by FIELD` for class-balanced sampling
- `text field is FIELD` and `label field is FIELD` for field selection
- What a `Records` value contains in memory

## NDJSON: one JSON object per line

`load` accepts a single file format: _NDJSON_, also called "JSON
Lines." One JSON object per line, no enclosing array, no separator
characters between records.

```
{"id":"tna-0000","archive":"bombe","text":"..."}
{"id":"tna-0001","archive":"tunny","text":"..."}
{"id":"tna-0002","archive":"bombe","text":"..."}
```

NDJSON is the format because it streams cleanly (the loader does not
need to read the whole file before processing any record), it is
diff-friendly (a one-record change is a one-line change), and it
preserves field order in every implementation. CSV is too lossy
(every value is a string), Parquet is overkill for a teaching
language, and JSON-array files force the loader to buffer the
entire file.

A minimal load is one line:

```ocean static
load tmp/corpus.ndjson
```

This loads every record in the file. With no sampling and no field
overrides, the loader picks the `text` field as the text body and
the `archive` field as the gold label, both by default.

## Sampling: `take` and `balanced by`

For corpora larger than the laptop budget, `load` accepts a sampling
clause:

```ocean static
load tmp/corpus.ndjson take 500 records
```

The loader reads the entire file but emits only the first 500
records to the downstream verb. If the file has fewer than 500
records, the loader emits all of them and continues without warning.

For class-balanced sampling, add a `balanced by FIELD` clause:

```ocean static
load tmp/corpus.ndjson take 500 records balanced by archive
```

This samples 500 records spread evenly across the distinct values of
the `archive` field, round-robin. If the file has two `archive`
values (`bombe` and `tunny`), the loader emits 250 of each. If there
are five values, the loader emits 100 of each. If a value has fewer
records than the per-class budget, the loader takes all of that
value and continues round-robin on the remaining values.

The `balanced by` knob is the most underrated knob in the language.
Without it, a corpus with a 95-5 imbalance produces clusters that
faithfully reproduce the imbalance, and the dispersion finding looks
roughly the same on every label. With it, the clusters have to find
structure that distinguishes the smaller class from the larger one,
which is often where the substrate signal lives.

## Pointing at the right fields

The default `text` field is the field literally named `text`. The
default label field is the field literally named `archive`. Both
defaults can be overridden:

```ocean static
load tmp/legal_cases.ndjson
     text field is body
     label field is jurisdiction
```

`text field is body` tells the loader that the `body` field of each
record contains the text to embed. `label field is jurisdiction`
tells the loader that the `jurisdiction` field is the gold label that
`find dispersion of each label` will compute against.

If a record is missing the text field, the loader treats it as an
empty string and includes the record. If a record is missing the
label field, the loader assigns it the special label `_unlabeled` so
the dispersion math has somewhere to put it.

There is also a `fine label field is FIELD` clause, used during
alignment to map each module to a more granular label than the
coarse one used by `find dispersion`. See chapter 8 for the
alignment side of this knob.

## What a `Records` value contains

A `Records` value is the in-memory representation of the loaded file.
Conceptually it carries:

- The SHA-256 of the source file, for the determinism contract
- The records themselves (id, text, label, fine_label, fields)
- A canonical iteration order (the order records came out of the
  loader, which is deterministic given the file content and the
  sampling parameters)

Records is opaque from inside the OCEAN program. No verb other than
`load` constructs a `Records` value, and no expression inside the
language can ask "what is the text of record 5?" The records are
black-box inputs to the downstream pipeline. The artifact saved by
`save to PATH` does include selected record ids (in the alignment
section, where the program asks `align modules using K nearest
records`), but it never dumps the full record contents.

This opacity is deliberate. It prevents a class of bugs where two
runs differ because the program author printed records in some
nondeterministic order during development. It also prevents the
artifact from accidentally exfiltrating sensitive text fields. The
artifact records what the pipeline _decided_, not what it _read_.

## Wider system

Compare OCEAN's `load` to a `COPY` in PostgreSQL or a source
declaration in dbt. In all three cases, one short statement maps a
file format into a logical, query-able shape. PostgreSQL's `COPY`
needs a target table definition; dbt's source needs a YAML schema
file; OCEAN's `load` needs neither. The schema is inferred from the
first record at parse time, and the rest of the program references
the field names by string.

The trade-off is that OCEAN is not the tool to use when the schema
is unknown. If the records have wildly varying shape, or if half
the records are missing the `text` field, the loader will not catch
that. It will load the corpus, embed the empty strings, and produce
a meaningless artifact. The fingerprinting primitive in
`docs/PRIMITIVE_SPEC.md` has the same property: garbage in, garbage
out, but the garbage will be deterministically the same garbage
across machines.

## Exercises

1. Write a `load` statement that takes 100 records from the file
   `_toy_corpora/toy_nslkdd_200.ndjson`, balanced across the field
   named `type`.

2. What happens if `take N` asks for more records than the corpus
   actually contains? Read the section "Sampling" again and write
   the answer in one sentence.

3. The toy_climate corpus has a `region` field and a `year` field. If
   a program wants to dispersion-test the four climate regions, what
   should `label field is` point at: `region` or `year`?

## What's next

Chapter 6 covers `embed`: turning a `Records` value into a `Z`
latent-space value, with three free-tier embedders and one premium
variant.
