---
slug: app-e-reference-card
number: null
title: "Appendix E: Reference Card"
promise: "A one-page printable summary of every verb, control-flow form, and type."
status: draft
---

# Appendix E: Reference Card

> A one-page printable summary of every verb, control-flow form, and type.

## Verbs

```
load   PATH [take INT records] [balanced by FIELD]
            [text field is FIELD] [label field is FIELD]
            : Path -> Records

embed  text [from RECORDS] into N dimensions
            [using tf-idf | content fingerprint | transformer minilm_l6 | one-hot numeric]
            : Records -> Z

reduce records using btut [target N survivors] [budget $D]
            : (Z, Records) -> (Z, Records)

cluster [Z] [using kmeans | tcd recursive loop]
            [for N rounds] [max M modules]
            [energy = corpus mean | normal anchored on LABEL]
            [crystallize every K]
            : Z -> Modules

align  [MODULES] using K nearest records
            [fine label field is FIELD]
            : (Modules, Records, Z) -> Aligned

find   dispersion of each label [from ALIGNED]
            : (Aligned, Records, Z) -> Dispersion

narrate modules [in technical | plain | terse style]
            : Aligned -> Aligned

save   VALUE to PATH
            : Any -> Artifact
```

## Pipeline types

```
Records      a finite set of structured records loaded from a file
Z            a latent embedding of a Records set (opaque)
Modules      a partition of a Z into named groups
Aligned      Modules + nearest-record assignments (subtype of Modules)
Dispersion   a normalized score per label per module
Artifact     the persisted JSON output of save (terminal)
Pipeline     the type of a compare, sweep, or define body
```

## Primitive types

```
Number   int or float literal
String   "..." or '...'
Path     bare path or string literal with known extension
Bool     true or false
Any      escape hatch
```

## Control flow

```
let NAME [: TYPE] = EXPR
                                     : name a binding

if COND then STMT
   { elif COND then STMT }
   [ else STMT ]
   end
                                     : conditional branching

sweep VAR from INT to INT [step INT] do
    STMTS
end
                                     : parametric expansion

parallel do
    STMTS
end
                                     : independent branches

compare EXPR against EXPR
        [ on FINDING of LABEL ]
                                     : methodology comparison

define NAME ( PARAMS ) do
    STMTS
end
                                     : reusable named pipeline

return EXPR
                                     : function return value

import "PATH" as NAME
                                     : load and namespace a .ocean file
```

## Top-level declarations

```
require ocean MAJOR.MINOR[.PATCH]
                                     : declare minimum required version

seed INT
                                     : set the global seed
```

## Reserved words

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

## Operators

```
=  ,  {  }  (  )                    structural
==  !=  <  >  <=  >=                comparisons
+  -  *  /                          arithmetic
and  or  not                        boolean (keyword form)
```

## Tooling commands

```
python -m scripts.run_universal_pipeline --config FILE.ocean    compile + run
python -m scripts.operators.ocean.repl                          REPL
python -m scripts.operators.ocean.format FILE.ocean [--write]   formatter
python -m scripts.operators.ocean.lint FILE.ocean [--strict]    linter
python -m scripts.operators.ocean.lsp                           LSP server
ocean-mcp                                                       MCP server
```
