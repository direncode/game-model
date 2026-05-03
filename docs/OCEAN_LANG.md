# OCEAN — a domain-specific language for substrate-clustering pipelines

*Authoritative spec. Version 0.1.0.*

OCEAN is a small declarative language for composing corpus → modules
pipelines on the LatentOcean substrate. It compiles to a DAG of
[operators](../scripts/operators/) and runs deterministically at a seed.

A pipeline reads like English:

```ocean
seed 42

load tmp/bombe_tna_full.ndjson take 500 records balanced by archive
embed text into 128 dimensions using tf-idf
cluster with tcd recursive loop for 16 rounds energy = corpus mean
align modules using 50 nearest records
find dispersion of each label
save to data/validation/tna_run.json
```

But it can also express things YAML can't:

```ocean
seed 42
let corpus = load tmp/bombe_tna_full.ndjson take 500 records balanced by archive
let z = embed text from corpus into 128 dimensions using tf-idf

sweep seed from 42 to 45 do
    let modules = cluster z using tcd recursive loop for 16 rounds
    let aligned = align modules using 50 nearest records
    save aligned to data/validation/tna_seed_${seed}.json
end

compare
    embed text from corpus into 128 dimensions using tf-idf
against
    embed text from corpus using content fingerprint top 32 terms
on dispersion of directorate_to_pm
```

---

## 1. Lexical structure

### 1.1 Whitespace and comments

Spaces, tabs, and newlines separate tokens. A `#` starts a line comment;
everything until end-of-line is ignored. Block comments are not supported.

### 1.2 Keywords

Reserved words that cannot be used as identifiers:

```
seed   let   in   as   on   from   to   into   using   with   by   of
do     end   sweep   compare   against   parallel   import
```

### 1.3 Verbs (operator-introducing)

Every pipeline statement begins with one of these verbs. Each verb maps to
exactly one operator in the registry:

| Verb       | Operator kind                      |
| ---------- | ---------------------------------- |
| `load`     | `source.ndjson`                    |
| `embed`    | `embed.tfidf_jl` (default)         |
| `reduce`   | `reduce.btut` (when implemented)   |
| `cluster`  | `cluster.tcd_recursive_loop`       |
| `align`    | `align.module`                     |
| `find`     | `align.dispersion`                 |
| `narrate`  | `narrate.plain_english`            |
| `save`     | `persist.json`                     |
| `compare`  | `meta.compare` (compiler-built)    |

The default operator can be overridden with `using` (e.g. `embed text using
content fingerprint`).

### 1.4 Literals

- Integers: `42`, `1500`, `10_000`
- Floats: `0.85`, `1.5e-3`
- Strings: `"hello"` or single-quoted `'hello'`
- Paths: bare tokens matching `[\w./\\-]+\.(ndjson|csv|json|tsv|yaml|yml)`
- Identifiers: `[a-z_][a-z0-9_]*`

### 1.5 Operators

- Equality: `=` (assignment in `let`, named-config in operator args)
- String interpolation: `${name}` inside path-like or string literals
- Range: `42 to 45 step 1`

---

## 2. Grammar

```
program      ::= seed_decl? statement*

seed_decl    ::= 'seed' INTEGER

statement    ::= verb_stmt
              | let_stmt
              | sweep_stmt
              | compare_stmt
              | parallel_stmt
              | import_stmt

let_stmt     ::= 'let' IDENT '=' expression

verb_stmt    ::= VERB args? ('as' IDENT)? ('using' IDENT)?

args         ::= arg (',' arg | NEWLINE arg)*
arg          ::= keyword_phrase value
              | bare_value

keyword_phrase ::= 'into' | 'from' | 'to' | 'with' | 'by' | 'of' | 'on'
                | 'take' | 'balanced' 'by'
                | param_name '='

sweep_stmt   ::= 'sweep' IDENT 'from' INTEGER 'to' INTEGER ('step' INTEGER)?
                 'do' statement+ 'end'

compare_stmt ::= 'compare' statement 'against' statement
                 ('on' IDENT 'of' IDENT)?

parallel_stmt ::= 'parallel' 'do' statement+ 'end'

import_stmt  ::= 'import' STRING ('as' IDENT)?

expression   ::= verb_stmt | IDENT | LITERAL
```

---

## 3. Semantics

### 3.1 Names and bindings

Every verb_stmt produces an output. By default the output is named after
the verb (`load` → `source`, `embed` → `embed`, etc.). An explicit `as
NAME` overrides it. `let NAME = expr` binds the result of `expr` to NAME.

### 3.2 Implicit data flow

Each verb has a default upstream stage it reads from. In the absence of
explicit references, statements wire together by stage order:

```
load    →  embed    →  cluster   →  align   →  find    →  save
[source]   [embed]      [cluster]    [align]    [disperse]  [persist]
```

The compiler builds a DAG matching this. To override, use `from NAME`:

```ocean
let raw = load corpus.ndjson
let z   = embed text from raw using tf-idf
let z2  = embed text from raw using content fingerprint
```

### 3.3 Sweeps

`sweep VAR from A to B do ... end` produces *N* parallel pipeline branches
(one per VAR value). Inside the body, `${VAR}` interpolates the current
value into paths and string literals. The compiler emits one DAG branch
per iteration; the runner executes them in parallel where the operators
permit (independent branches always parallelize).

### 3.4 Compare

`compare A against B [on METRIC of LABEL]` runs two pipelines and emits a
diff artifact. Both pipelines must terminate in the same stage type. The
optional `on METRIC of LABEL` clause selects the dispersion metric for
the specific label to surface in the diff summary.

### 3.5 Determinism

The compiler attaches a content hash to every `load` operator's signature
so two runs of the same OCEAN program with the same seed and the same
file contents produce byte-identical output artifacts. (This fixes the
quirk we found in the universal pipeline: same seed + same DSL but
different source pool gave different output. Pinning the file content
into the signature closes that hole.)

### 3.6 Type system

Every operator has a typed signature. The seven primitive types:

| Type           | What it represents                                      |
| -------------- | ------------------------------------------------------- |
| `Records`      | List of dict — corpus records                           |
| `Z`            | NumPy array, shape `(N, D)`, L2-normalized              |
| `Modules`      | List of dict — formed clusters with topology + centroid |
| `Aligned`      | Modules + alignment metrics                             |
| `Dispersion`   | Per-label routing table                                 |
| `Artifact`     | On-disk JSON output                                     |
| `Pipeline`     | A pipeline value (compose, sweep, compare)              |

The type-checker runs at compile time. If `cluster` receives `Records`
where it expects `Z`, the error points at the offending line.

---

## 4. Standard library — every verb's contract

### 4.1 `load`

```
load PATH [take N records] [balanced by FIELD]
     [text field is FIELD] [label field is FIELD]
     [as NAME]
```

Output type: `Records`

### 4.2 `embed`

```
embed text [from RECORDS] into D dimensions
     [using tf-idf | content fingerprint | one-hot numeric]
     [with min_df = N] [with max_df = F] [with max_features = N]
     [as NAME]
```

Output type: `Z`

### 4.3 `cluster`

```
cluster [Z] using tcd recursive loop
     [for N rounds] [max M modules]
     [energy = corpus mean | normal anchored on LABEL]
     [crystallize every K]
     [as NAME]
```

Output type: `Modules`

### 4.4 `align`

```
align [MODULES] using K nearest records
     [fine label field is FIELD]
     [as NAME]
```

Output type: `Aligned`

### 4.5 `find`

```
find dispersion of each label [from ALIGNED]
     [as NAME]
```

Output type: `Dispersion`

### 4.6 `save`

```
save NAME to PATH
```

Output type: `Artifact` (side-effecting)

### 4.7 `sweep`

```
sweep VAR from A to B [step S] do
   <statements using ${VAR}>
end
```

Output type: `Pipeline[]` (one per VAR value, executed in parallel)

### 4.8 `compare`

```
compare PIPELINE_A against PIPELINE_B [on METRIC of LABEL]
```

Output type: `Artifact` (diff JSON)

---

## 5. Errors — every diagnostic format

```
ocean: error at tna.ocean:7:18

  7 | embed text into 128 dimensiosn using tf-idf
                              ^^^^^^^^^^

unknown keyword 'dimensiosn' — did you mean 'dimensions'?
```

Every error emits:
- File path + line + column
- The offending line with a caret
- The error category (lex / parse / type / runtime)
- A suggestion when one is computable (typo correction via edit-distance to keywords + verbs + param names)

---

## 6. Reference card

```ocean
# minimum
load CORPUS take N records
embed text into D dimensions
cluster using tcd recursive loop
align modules using K nearest records
find dispersion of each label
save to OUT.json

# multi-seed sweep
sweep seed from 42 to 45 do
    cluster ...
    save ... to OUT_${seed}.json
end

# named bindings
let raw = load corpus.ndjson take 500 records
let z = embed text from raw into 128 dimensions
let modules = cluster z using tcd recursive loop for 16 rounds

# compare two embedders
compare
    embed text from raw using tf-idf
against
    embed text from raw using content fingerprint
on dispersion of directorate_to_pm
```

That's the entire language.
