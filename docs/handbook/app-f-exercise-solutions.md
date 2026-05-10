---
slug: app-f-exercise-solutions
number: null
title: "Appendix F: Exercise Solutions"
promise: "Worked solutions to every exercise in the handbook."
status: draft
---

# Appendix F: Exercise Solutions

> Worked solutions to every exercise in the handbook.

## what-ocean-is -- 1

The six-line snippet at the top of chapter 1 contains:

```
load tmp/corpus.ndjson take 500 records balanced by archive
embed text into 128 dimensions using tf-idf
cluster for 16 rounds max 24 modules energy = corpus mean
align modules using 50 nearest records
find dispersion of each label
save to data/result.json
```

The `embed text into 128 dimensions using tf-idf` line names a
free-tier operator (`embed.tfidf_jl`). The `cluster for 16 rounds
max 24 modules` line names a verb (`cluster`) that has both a
free-tier variant (`cluster.kmeans`, the compiler's default when no
`using` is specified) and a premium variant (`cluster.tcd_recursive_loop`).
The exact answer depends on what the parser defaults to; in the
LatentOcean parser, bare `cluster` resolves to the premium variant,
so adding `using kmeans` makes the line explicitly free-tier.

## what-ocean-is -- 2

A program is _deterministic_ when it produces the same output every
time on the same machine, given the same inputs and seed. A program
is _reproducible_ when its output is the same across different
machines that have the same toolchain. Determinism is single-machine,
reproducibility is cross-machine. OCEAN promises both.

## your-first-pipeline -- 1

Doubling the embedding dimension from 64 to 128 typically leaves
dispersion roughly the same on a small corpus, sometimes slightly
higher. Why: TF-IDF + JL projection at 64 dimensions already captures
enough vocabulary variation to separate the two archives. Going to
128 adds noise dimensions that the clustering algorithm can use to
slightly tighten module assignments, but the headline dispersion does
not change much because the underlying class signal was already
captured.

## your-first-pipeline -- 2

Doubling the module count from 6 to 12 produces about twice as many
keys in the `alignment.module_to_records` section. Each module now
contains on average half as many records (50 / 12 vs 50 / 6). The
dispersion score on `archive` typically goes up slightly because
finer modules can specialize on label-correlated structure, but the
score is still bounded by how cleanly the substrate actually maps
to the archive label.

## your-first-pipeline -- 3

Same seed, same hash: the artifact is deterministic. Changing the
seed from 42 to 43 changes the hash because every operator's random
state derives from the seed. The role of the seed is to make
randomness explicit and audited: a third party can re-run the same
program at the same seed and verify that the hash matches. With a
different seed, the third party verifies that the program is stable
across seeds (the dispersion values should be in the same range)
without expecting bit-identity.

## source-files-and-tokens -- 1

The shortest legal OCEAN program is the empty file. The grammar's
`program` production allows zero top-level statements. The compiler
parses it, type-checks it (trivially), and produces no artifact.

## source-files-and-tokens -- 2

`&&` is not a legal OCEAN operator. The lexer flags it as an
unexpected token. The fix is either to split into two statements
(remove the `&&` and put each verb on its own line) or to use the
keyword `and` (but `and` is a Boolean operator, not a statement
separator; it would not work here either). The right answer is two
statements on two lines.

## source-files-and-tokens -- 3

- `Records` is not a legal identifier (capital R; identifiers are
  all lowercase).
- `corpus_size` is legal.
- `_intermediate` is legal (starts with underscore).
- `123records` is not legal (starts with a digit).
- `take` is not legal in declaration position (reserved word).
- `my-var` is not legal (hyphen not allowed in identifiers).

## the-pipeline-types -- 1

```
ocean: error at file.ocean:2:1

  2 | align modules using 5 nearest records
      ^^^^^

type error: align expects Modules, got Records (from 'load')

hint: pipe through embed + cluster first, e.g.:
        let z = embed text into 128 dimensions
        let m = cluster z for 16 rounds max 24 modules using kmeans
        align m using 5 nearest records
```

## the-pipeline-types -- 2

Only `save` accepts a `Dispersion` value, as the terminal output of a
pipeline that has run `find dispersion of each label`. No other verb
consumes `Dispersion`.

## the-pipeline-types -- 3

`Z` is excluded from the persistable-types union because `Z` is
deliberately opaque inside OCEAN. Saving a `Z` would either expose
the raw embedding numbers (defeating the encapsulation) or write a
hash placeholder (not useful as an artifact). Programs that need the
embedding for inspection should attach it to a record annotation
rather than persist it as the artifact.

## load-and-records -- 1

```ocean static
load _toy_corpora/toy_nslkdd_200.ndjson take 100 records balanced by type
```

## load-and-records -- 2

The loader takes all records in the file and continues without
warning. The artifact's record count reflects what was loaded, not
what was requested.

## load-and-records -- 3

`region`. The four-value region field is the meaningful
dispersion-testable label. `year` is a continuous integer with 71
distinct values, which would produce a nearly diagonal dispersion
matrix and not be informative.

## embed-and-z -- 1

- 10,000 news articles in English: `tf-idf` (vocabulary matters,
  TF-IDF is fast and well-understood).
- 5,000 short tweets across 12 languages: `transformer minilm_l6`
  (paraphrase across languages is the right substrate; TF-IDF would
  separate by language alone).
- 100,000 network traffic logs: `one-hot numeric` (non-text fields
  are the signal; TF-IDF would find nothing).
- 500 historical letters whose authors are at issue: `tf-idf`
  (authorial vocabulary is the substrate; structural fingerprint
  would be even better if a paid key is available).

## embed-and-z -- 2

The 256-dimensional artifact typically has a slightly higher
dispersion on `region` because the higher-dimensional embedding
captures more of the text variation that correlates with region.
The improvement plateaus quickly; going from 256 to 1024 dimensions
rarely helps further.

## embed-and-z -- 3

The handbook sandbox cannot run `content fingerprint` (premium gate).
The compiler should accept the source for parse and type-check
purposes (the program is grammatically valid), and the runner
should produce a runtime diagnostic stating "this operator requires
a paid API key." For a paid runner, the compiler should either
accept the 64 (and silently ignore the request since the fingerprint
is always 48 bits) or warn that 48 is the only legal dimension for
this variant. The catalog card in Appendix B documents 48 as the
fixed dimension.

## cluster-and-modules -- 1

Anywhere from 4 to 6 modules. The `max 6 modules` is an upper bound;
the algorithm may produce fewer if the data does not support six
distinct clusters at the 50-record scale.

## cluster-and-modules -- 2

```ocean static
cluster for 16 rounds max 8 modules
        using kmeans
        energy = normal anchored on type
```

The energy clause references the `type` label field's `normal`
value as the anchor.

## cluster-and-modules -- 3

Every K rounds, modules whose centroids have moved less than a
threshold are frozen and removed from further update. Smaller K
means more aggressive freezing; the remaining rounds focus on
the modules that are still moving.

## align-and-find -- 1

`narrate modules` adds narrative strings but does not change the
underlying module structure or alignment. The dispersion value stays
identical.

## align-and-find -- 2

Yes, byte-identical at the same seed. Changing the seed produces a
different but still deterministic artifact.

## align-and-find -- 3

`0.69` on `tunny` means the `tunny` records are concentrated in a
small number of modules. The score is just below `bombe`'s 0.71,
indicating both archives are well-separated by the clustering.
Neither archive is bag-of-records spread across all modules; the
substrate distinguishes them.

## save-and-the-determinism-contract -- 1

Confirmed by running `sha256sum data/result.json` twice; both
invocations produce the same hex digest. The sidecar
`data/result.json.sha256` matches.

## save-and-the-determinism-contract -- 2

Small changes in dispersion (under 0.05) indicate a stable result.
Larger changes (above 0.10) suggest the result is sensitive to seed
initialization, which is worth reporting alongside the headline
number.

## save-and-the-determinism-contract -- 3

The version block names which operator versions ran. If two
artifacts have different `cluster.kmeans` versions, the auditor knows
to compare the operator changelog for that operator between the two
versions; the difference is the explanation for the artifact-level
divergence.

## control-flow -- 1

```ocean static
sweep d from 32 to 256 step 32 do
    load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive
    embed text into d dimensions using tf-idf
    cluster for 8 rounds max 6 modules using kmeans energy = corpus mean
    align modules using 5 nearest records
    find dispersion of each label
    save to data/dim_${d}.json
end
```

## control-flow -- 2

```ocean static
let raw = load _toy_corpora/toy_nslkdd_200.ndjson take 200 records balanced by type
compare
    embed text from raw into 64 dimensions using tf-idf
against
    embed text from raw into 64 dimensions using one-hot numeric
on dispersion of each label
```

`one-hot numeric` typically gives higher dispersion on `type`
because the substrate signal in NSL-KDD is in the numeric and
categorical fields, not in the text field.

## control-flow -- 3

The type error: the `then` arm produces `Z` (from `embed`), the
`else` arm produces `Modules` (from `cluster`). Both arms of an
`if` must produce the same type, so the compiler rejects this.

## functions-modules-stdlib -- 1

Two artifacts, one for seed 42 and one for seed 43 (inclusive range).

## functions-modules-stdlib -- 2

```ocean static
import "stdlib/substrate.ocean" as substrate

define my_anomaly(corpus) do
    return substrate.anomaly_focused(
        corpus = corpus,
        target = 100,
        output = "data/my_anomaly.json"
    )
end

my_anomaly(corpus = "_toy_corpora/toy_nslkdd_200.ndjson")
```

## functions-modules-stdlib -- 3

A reasonable additional preset: `compare_embedders(corpus, output)`
that runs a `compare` between `tf-idf` and `transformer minilm_l6`
at a fixed 128 dimensions, with the dispersion finding on the
default label field. One-line description: "Compare two free-tier
embedders on the same corpus and save the delta to output."

## tooling-and-the-lsp -- 1

The linter warns on the Chapter 2 pipeline if `seed` is missing
(it is present, set to 42). It also warns if no `label field is`
is declared and the corpus's default `archive` field is not present;
for the toy corpora the default is fine, so no warning.

## tooling-and-the-lsp -- 2

Confirmed in the REPL. The second binding's type matches the
producer-consumer table in chapter 4: an `embed` after a `load`
produces `Z`, so the second binding has type `Z` with the shape
displayed alongside.

## tooling-and-the-lsp -- 3

`ocean_list_ops` returns the eleven entries in the catalog
(seven free, four premium), each with its name, signature, summary,
and parameter schema. The reply is JSON-shaped for agent consumption.

## effective-ocean -- 1

```ocean static
let raw = load tmp/x.ndjson take 500 records
let z = embed text from raw into 128 dimensions using tf-idf
let m = cluster z for 16 rounds max 24 modules using kmeans
let aligned = align m using 50 nearest records
find dispersion of each label from aligned
save to /tmp/out.json
```

## effective-ocean -- 2

The hardest to catch is anti-pattern 4 (copying the gold label into
the embedding). It does not produce any code-review red flag; the
program looks reasonable, and the dispersion improvement seems like
a win. The issue is at the corpus-construction layer, which lives
outside OCEAN. The remedy is corpus auditing, not source-code
review.

## effective-ocean -- 3

Use a `sweep` whenever the question has the form "how does the
result vary as parameter P changes," and the values of P are
small in count (under 20). Leave it as a single-value run when the
question has the form "what is the result for this specific
parameterization," or when the runtime budget cannot afford the
expansion factor. A `sweep` over seeds is the canonical case for
stability studies; a `sweep` over dimensions is the canonical case
for sizing studies. A single-value run is the canonical case for
production audits where the parameterization is fixed by contract.

## interfacing-ocean -- 1

```sql
SELECT id, lo_fingerprint(row_to_json(s)) AS fp
FROM   submissions s
LIMIT  5;
```

## interfacing-ocean -- 2

Configuration is documented in chapter 12 (Claude Desktop config
file path varies by OS). After configuration, the agent can call
`ocean_list_ops` and receive the eleven-operator catalog as a JSON
response. The expected number of operators matches Appendix B's
generated table.

## interfacing-ocean -- 3

Five-bullet agent loop for "are there structural outliers in the
trade-flow data from the last quarter?":

1. **Compose.** Agent reads the corpus shape via `ocean_list_ops`
   to see the available embedders. Writes a program that loads the
   trade-flow corpus, embeds via `tf-idf` (or `content fingerprint`
   if a paid key is available), clusters with `kmeans`, aligns, and
   finds dispersion against the `country_of_origin` label.

2. **Validate.** Calls `ocean_validate` on the program. If type
   errors come back, the agent fixes them using the diagnostic
   suggestions.

3. **Run.** Calls `ocean_run` to execute. The runner returns the
   artifact preview, step timings, and the SHA-256 of the output.

4. **Read.** Agent inspects `dispersion.by_label.country_of_origin`,
   the `modules` section sizes, and the `alignment.module_to_records`
   to find which records anchor each cluster. The composite anomaly
   score is the headline for the "outlier" question.

5. **Iterate.** If the dispersion is at chance level (low z-score
   against the null), the agent tries a different embedder via
   `compare`. If the dispersion is strong but the outliers are not
   visible, the agent increases `align modules using K nearest
   records` from 5 to 50 for a clearer audit trail. Each iteration
   re-runs steps 3-4.
