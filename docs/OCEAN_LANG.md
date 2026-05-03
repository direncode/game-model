# OCEAN — formal language reference

*Authoritative spec. Version 1.0.0.*

OCEAN is a formal, deterministic, statically-typed programming language for
substrate-clustering pipelines on the LatentOcean platform. It is a
domain-specific language: not Turing-complete, not general-purpose, and
this is intentional. Programs always terminate, always type-check, and
produce byte-identical artifacts when given the same inputs.

This document is the language definition. Every feature, every syntax
form, every type rule, and every error class is here.

---

## 0. Versioning

OCEAN follows semantic versioning at the language level. The version
string of a program is implied by the toolchain that compiles it. A
program may declare a minimum required version:

```ocean
require ocean 1.0
```

Programs without a `require` declaration target the latest stable.
Backwards-incompatible language changes bump major; new features bump
minor; bug fixes bump patch.

| Version | Status | Released |
|---------|--------|----------|
| 1.0.0   | stable | 2026-05-03 |
| 0.1.0   | obsolete | 2026-05-03 |

---

## 1. Lexical structure

### 1.1 Source encoding

OCEAN source files are UTF-8 encoded. Line endings may be LF or CRLF;
they are normalized to LF on parse. The conventional file extension is
`.ocean`.

### 1.2 Whitespace and comments

Spaces, tabs, and newlines separate tokens. Newlines are
**statement-significant** (they terminate statements when not inside a
block). Inside parentheses or brace blocks, newlines are not significant.

A `#` starts a single-line comment; everything until end-of-line is
ignored. Block comments are not supported.

### 1.3 Reserved words

```
require    seed       let        in         as         on         from
to         into       using      with       by         of         do
end        sweep      compare    against    parallel   import     step
take       balanced   field      is         for        rounds     round
max        modules    module     energy     crystallize every     nearest
records    record     dispersion each       label      fine       anchored
dimensions dimension  loop       recursive  tcd        tf-idf     tfidf
content    fingerprint one-hot   numeric    mean       corpus     normal
text       define     return     if         then       else       elif
true       false      not        and        or
```

### 1.4 Verbs

Verbs introduce statements. They are not reserved words in the strict
sense (they live in their own namespace), but the parser recognizes
them in statement position:

```
load    embed   reduce    cluster    align     find    narrate    save
```

### 1.5 Identifiers

```
ident   ::= [a-z_] [a-z0-9_]*
```

Identifiers are lowercase with underscores. Starting with `_` is
allowed (used for internal/anonymous bindings). Reserved words and
verbs cannot be used as identifiers in declaration contexts (let,
define, import-as).

### 1.6 Literals

```
int     ::= [-]? [0-9] ([0-9_]* [0-9])?
float   ::= [-]? [0-9]+ ('.' [0-9]+)? ([eE] [+-]? [0-9]+)?
string  ::= '"' (any-char-except-quote | escape)* '"'
         |  "'" (any-char-except-quote | escape)* "'"
escape  ::= '\' ('"' | "'" | '\' | 'n' | 't' | 'r')
path    ::= [\w./\\-]+ '.' ('ndjson' | 'csv' | 'tsv' | 'json' | 'yaml' | 'yml' | 'txt' | 'ocean')
bool    ::= 'true' | 'false'
interp  ::= '${' ident '}'
```

### 1.7 Operators

```
=       assignment / named-arg
,       arg separator (optional, newline serves the same purpose)
{       block start
}       block end
(       expression group
)       expression group
==      equality
!=      inequality
<       less-than
>       greater-than
<=      less-or-equal
>=      greater-or-equal
+       addition (numbers)
-       subtraction / unary minus
*       multiplication
/       division
```

Boolean operators are spelled `and`, `or`, `not` (not `&&`, `||`, `!`).

---

## 2. Grammar (EBNF)

The complete grammar. Terminals are quoted; non-terminals are bare.

```ebnf
program        = [ require_decl ] [ seed_decl ] { import_stmt } { top_stmt } EOF ;

require_decl   = "require" "ocean" version ;
version        = int "." int [ "." int ] ;

seed_decl      = "seed" int ;

import_stmt    = "import" string [ "as" ident ] ;

top_stmt       = define_decl | statement ;

define_decl    = "define" ident [ "(" param_list ")" ]
                 "do" { statement } "end" ;
param_list     = param { "," param } ;
param          = ident [ ":" type_expr ] [ "=" literal ] ;

statement      = let_stmt
              | sweep_stmt
              | compare_stmt
              | parallel_stmt
              | if_stmt
              | return_stmt
              | verb_stmt ;

let_stmt       = "let" ident [ ":" type_expr ] "=" expression ;

sweep_stmt     = "sweep" ident "from" int "to" int [ "step" int ]
                 "do" { statement } "end" ;

compare_stmt   = "compare" expression "against" expression
                 [ "on" ident "of" ident ] ;

parallel_stmt  = "parallel" "do" { statement } "end" ;

if_stmt        = "if" expression "then" statement
                 { "elif" expression "then" statement }
                 [ "else" statement ]
                 "end" ;

return_stmt    = "return" expression ;

verb_stmt      = verb { phrase } [ "as" ident ] [ "using" variant ] ;

phrase         = phrase_kw value_expr
              | "from" ident
              | int  /* bare positional, only for align k_nearest */ ;

verb           = "load" | "embed" | "reduce" | "cluster" | "align"
              | "find" | "narrate" | "save" ;

variant        = ident { ident }    /* e.g. 'tf-idf', 'content fingerprint' */ ;

expression     = literal
              | ident
              | verb_stmt
              | call_expr
              | binary_expr
              | "(" expression ")" ;

call_expr      = ident "(" [ expression { "," expression } ] ")" ;

binary_expr    = expression bin_op expression ;
bin_op         = "==" | "!=" | "<" | ">" | "<=" | ">="
              | "+"  | "-"  | "*" | "/"
              | "and" | "or" ;

literal        = int | float | string | path | bool | interp ;

type_expr      = type_name [ "[" type_expr "]" ] ;
type_name      = "Records" | "Z" | "Modules" | "Aligned" | "Dispersion"
              | "Artifact" | "Pipeline" | "Number" | "String"
              | "Path" | "Bool" | "Any" ;
```

---

## 3. Type system

OCEAN is statically typed with type inference. Every binding has a type,
inferred from the operator's signature or the literal's form. The
type-checker runs after parsing and before compilation.

### 3.1 Primitive types

| Type          | Inhabitants                                                  |
| ------------- | ------------------------------------------------------------ |
| `Number`      | int, float                                                   |
| `String`      | "..."                                                        |
| `Path`        | bare-token paths or string literals validated against fs     |
| `Bool`        | `true`, `false`                                              |
| `Any`         | escape hatch; subtypes everything                            |

### 3.2 Pipeline types

| Type          | Produced by                                | Consumed by                |
| ------------- | ------------------------------------------ | -------------------------- |
| `Records`     | `load`                                      | `embed`, `align`, `find`, `save` |
| `Z`           | `embed`                                     | `cluster`, `align`, `find` |
| `Modules`     | `cluster`                                   | `align`, `save`            |
| `Aligned`     | `align`                                     | `find`, `save`             |
| `Dispersion`  | `find`                                      | `save`                     |
| `Artifact`    | `save`                                      | terminal                   |
| `Pipeline`    | `compare`, `sweep`, `define` body           | top-level                  |

### 3.3 Operator signatures

```
load    : Path -> Records
embed   : Records -> Z
reduce  : (Z, Records) -> (Z, Records)             -- BTUT survivor filter
cluster : Z -> Modules
align   : (Modules, Records, Z) -> Aligned
find    : (Aligned, Records, Z) -> Dispersion
save    : (Aligned | Dispersion | Modules | Records) -> Artifact
```

### 3.4 Subtyping

`Aligned` is a subtype of `Modules`. `Dispersion` is its own type, no
implicit conversions. `Any` is a top type but only used for `define`
function parameters when inference can't determine a type.

### 3.5 Type checking rules

1. **Literal types**: int and float literals get type `Number`. String
   literals get `String`. Paths get `Path`. `true`/`false` get `Bool`.
2. **Verb statement type**: equal to the operator signature's output
   type, with input arity validated against upstream bindings.
3. **`let` binding**: the inferred type of the right-hand side. If a
   type annotation is present, it must match (or be supertyped by) the
   inferred type.
4. **`if` statement**: condition must be `Bool`. Both branches must
   produce values of the same type (or one must be terminal).
5. **`compare`**: both sides must produce the same type.
6. **`sweep`**: variable is `Number`. Body produces a sequence of values
   of a uniform type.
7. **`define`**: parameter types are either annotated, defaulted by
   their literal, or inferred from first call site.

### 3.6 Type errors

```
ocean: error at file.ocean:5:1

  5 | cluster raw using tcd recursive loop
      ^^^^^^^

type error: cluster expects Z, got Records (from 'raw')

hint: pipe through embed first, e.g.:
        let z = embed text from raw into 128 dimensions
        cluster z using tcd recursive loop
```

---

## 4. Semantics

### 4.1 Evaluation order

OCEAN is **declarative dataflow**. The compiler builds a DAG from the
program; the runner executes operators in topological order. Independent
branches are eligible for parallel execution.

### 4.2 Determinism contract

For any program P, seed S, and identical input file contents, executing
P with seed S produces a byte-identical artifact. This is enforced by:

- File content sha256 baked into every `load` operator's signature
- Every operator has `(input_signature, seed) -> output_signature` purity
- `sweep` expansion is deterministic: branches always materialize in
  ascending variable-value order
- `parallel` execution does not cross branches' state

### 4.3 Implicit data flow

Each verb has a default upstream binding (see §6). In the absence of
explicit `from NAME`, statements wire to the most-recent step of the
expected type. Reordering source-text statements changes program
semantics.

### 4.4 Module imports

```ocean
import "presets/atlas.ocean" as atlas
let result = atlas.run_basic(target=500)
```

Imports are textual and namespaced. Imported file is parsed and
type-checked separately; only `define`d functions are reachable through
the namespace. Cyclic imports are an error.

### 4.5 User-defined functions

```ocean
define run_basic(target=500, embed_dim=128) do
    load tmp/corpus.ndjson take target records balanced by archive
    embed text into embed_dim dimensions
    cluster for 16 rounds max 24 modules energy = corpus mean
    align modules using 50 nearest records
    find dispersion of each label
    return save to data/validation/run.json
end
```

Functions are reusable named pipelines. Parameters with defaults are
optional at call sites. Return type is inferred from the last statement
or explicit `return` expression.

---

## 5. Standard verbs

### 5.1 `load`

```
load PATH [take INT records] [balanced by FIELD]
     [text field is FIELD] [label field is FIELD] [as NAME]
```

Type: `Path -> Records`

| Knob | Type | Default | Description |
|------|------|---------|-------------|
| `take` | int | all | sample N records (after stratification if `balanced by`) |
| `balanced by` | ident | none | round-robin sample across distinct values of this field |
| `text field` | ident | `text` | which field holds the text body |
| `label field` | ident | `archive` | which field holds the coarse gold label |

### 5.2 `embed`

```
embed text [from RECORDS] into D dimensions
     [using tf-idf | content fingerprint | one-hot numeric]
     [with min_df = N] [with max_df = F] [with max_features = N]
     [as NAME]
```

Type: `Records -> Z`

Variants:
- `tf-idf` — TF-IDF + JL random projection (default)
- `content fingerprint` — Bloom-style 48-bit fingerprint of top-K terms
- `one-hot numeric` — for numeric-attribute corpora

### 5.3 `reduce`

```
reduce records using btut [target N survivors] [budget $D]
```

Type: `(Z, Records) -> (Z, Records)`

BTUT structural-anomaly pre-reduction. Optional; many text corpora
skip it.

### 5.4 `cluster`

```
cluster [Z] using tcd recursive loop
     [for N rounds] [max M modules]
     [energy = corpus mean | normal anchored on LABEL]
     [crystallize every K]
     [as NAME]
```

Type: `Z -> Modules`

### 5.5 `align`

```
align [MODULES] using K nearest records
     [fine label field is FIELD] [as NAME]
```

Type: `(Modules, Records, Z) -> Aligned`

### 5.6 `find`

```
find dispersion of each label [from ALIGNED] [as NAME]
```

Type: `(Aligned, Records, Z) -> Dispersion`

### 5.7 `narrate`

```
narrate modules [in technical | plain | terse style] [as NAME]
```

Type: `Aligned -> Aligned` (annotated with narrative strings)

### 5.8 `save`

```
save VALUE to PATH
```

Type: `Any -> Artifact` (side-effecting; writes JSON + sha256)

---

## 6. Implicit data flow defaults

When a verb's input is not given by an explicit `from NAME`, the
compiler resolves it to the most recent step of the expected type. The
default upstream-binding map:

| Verb     | Default input   | Source step (verb)        |
| -------- | --------------- | ------------------------- |
| `embed`  | `records`       | most recent `load`        |
| `cluster`| `Z`             | most recent `embed`       |
| `align`  | `modules`, `records`, `Z` | most recent `cluster`, `load`, `embed` |
| `find`   | `aligned_modules`, `records`, `Z` | most recent `align`, `load`, `embed` |
| `save`   | varies by source type | most recent terminal step |

---

## 7. Errors

Every error carries:

- File name, line, column
- The offending source line with a caret marking the token
- The error category (`syntax` | `type` | `name` | `runtime` | `import`)
- A typed suggestion when one is computable

Error categories:

### 7.1 Syntax errors
Parser-level. Token sequence violates grammar.

### 7.2 Name errors
References to undefined bindings, undefined imports, undefined functions.

### 7.3 Type errors
Operator inputs don't match the declared signature. Both branches of an
`if` produce different types. `compare` arms produce different types.

### 7.4 Runtime errors
File not found, NDJSON malformed, operator throws. Carry the offending
source location (the `load` line for a missing file, the `cluster` line
for a TCD failure, etc.).

### 7.5 Import errors
Imported file missing, cyclic import detected, imported file has type
errors.

---

## 8. Tooling

### 8.1 Compiler / runner

```
python -m scripts.run_universal_pipeline --config x.ocean [--seed N]
```

### 8.2 REPL

```
python -m scripts.operators.ocean.repl
```

Interactive mode. Each line is parsed + type-checked + (optionally)
executed. State persists across lines (let-bindings remain in scope).

### 8.3 Formatter

```
python -m scripts.operators.ocean.format file.ocean [--write]
```

Pretty-prints to canonical form. Without `--write`, prints to stdout
(diff-style usage). With `--write`, formats in place.

### 8.4 Conformance tests

```
python -m pytest tests/ocean/
```

Each test case is `<name>.ocean` plus expected `<name>.expected.json`
(compiled config) or `<name>.error.txt` (expected diagnostic).

---

## 9. Reference card

```ocean
require ocean 1.0
seed 42

import "presets/atlas.ocean" as atlas

# function definition with default args
define run_corpus(path, target=500, embed_dim=128) do
    load path take target records balanced by archive
    embed text into embed_dim dimensions
    cluster for 16 rounds max 24 modules energy = corpus mean
    align modules using 50 nearest records
    find dispersion of each label
    return save to data/validation/run.json
end

# conditional branch
if target > 5000 then
    reduce records using btut target 300 survivors budget $25
else
    # for small corpora, skip BTUT
    let z = embed text into 128 dimensions
end

# parametric sweep
sweep seed from 42 to 45 do
    cluster for 16 rounds energy = corpus mean
    save to data/validation/seed_${seed}.json
end

# methodology comparison
compare
    embed text using tf-idf
against
    embed text using content fingerprint
on dispersion of directorate_to_pm
```
