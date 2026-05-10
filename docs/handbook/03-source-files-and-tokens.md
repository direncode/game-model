---
slug: source-files-and-tokens
number: 3
title: Source Files and Tokens
promise: "After this chapter you can read any OCEAN source file at the lexical level: every comment, identifier, literal, keyword, verb, and operator."
status: draft
---

# Source Files and Tokens

> After this chapter you can read any OCEAN source file at the lexical level: every comment, identifier, literal, keyword, verb, and operator.

## Concepts in this chapter

- UTF-8 source files with statement-significant newlines
- Comments, identifiers, and literal classes
- The split between reserved words and the verb namespace
- The full operator set

## Source encoding and line endings

OCEAN source files are UTF-8 encoded. The conventional file extension
is `.ocean`. Line endings may be either LF or CRLF; the lexer
normalizes CRLF to LF on parse. Trailing whitespace on a line is
ignored. Trailing newline at end of file is permitted but not required.

Newlines are _statement-significant_. A statement is terminated by a
newline when the lexer is not inside a parenthesized expression or a
brace block. The following two programs are equivalent:

```ocean static
load tmp/corpus.ndjson take 500 records
embed text into 128 dimensions
```

```ocean static
load tmp/corpus.ndjson take 500 records ; embed text into 128 dimensions
```

OCEAN does not actually accept the `;` separator. The second program
above is illegal. The point is that statement boundaries come from
newlines, not from punctuation. There is no `;` and no `\` line
continuation. A statement that wants to span multiple lines must do
so inside parentheses or a brace block.

## Comments

A `#` character starts a single-line comment. The rest of the line is
ignored.

```ocean static
# This program is documented in handbook chapter 11.
seed 42
load tmp/corpus.ndjson  # in-line comment after a statement
```

Block comments (`/* ... */`) are not supported. The reasoning is the
same as in Python: a language with only one way to write a comment
makes diffs cleaner and machine-readable.

## Identifiers

```
ident   ::= [a-z_] [a-z0-9_]*
```

Identifiers are all lowercase, with underscores. They start with a
letter or underscore and continue with letters, digits, or
underscores. Identifiers are case-sensitive in principle (the lexer
only recognizes lowercase, so `Records` is not a valid identifier in
the user namespace; it is a type name in the language namespace,
covered in Chapter 4).

Identifiers that start with a single underscore (`_corpus`,
`_intermediate`) are conventionally treated as private or
internal-only. The compiler does not enforce this; it is a style
convention.

Reserved words and verbs are not legal identifiers in declaration
positions (`let`, `define`, `import-as`). They may appear elsewhere
as field names in literal data, but not as the name of a `let`
binding or a `define`d function.

## Literals

OCEAN has six literal classes: integer, float, string, path, boolean,
and interpolation.

**Integers** are sequences of digits, optionally negative, with
optional underscore digit-grouping for readability:

```ocean static
let n = 500
let big = 1_000_000
let negative = -1
```

**Floats** use the usual decimal-point notation, with optional
scientific notation:

```ocean static
let pi = 3.14159
let small = 1.5e-9
let neg = -0.5
```

**Strings** are enclosed in double or single quotes. Both forms accept
the same content. The escape sequences supported are: `\"`, `\'`,
`\\`, `\n`, `\t`, `\r`.

```ocean static
let title = "TNA Hardware Catalogue"
let alt = 'single-quoted strings are also fine'
let with_escape = "this is line one\nthis is line two"
```

**Paths** are a special literal class for filesystem paths. A path
literal is a sequence of word characters, slashes, dots, and dashes,
ending in a known extension (`.ndjson`, `.csv`, `.tsv`, `.json`,
`.yaml`, `.yml`, `.txt`, `.ocean`). Path literals do not need quotes.

```ocean static
load tmp/corpus.ndjson
save to data/result.json
import "presets/atlas.ocean" as atlas
```

The third form quotes the path because the `import` syntax requires a
string literal. The first two are bare path literals.

**Booleans** are the lowercase words `true` and `false`:

```ocean static
let verbose = true
let stop_early = false
```

**Interpolations** are the string templating form, written
`${name}`, used inside paths and strings to embed a binding value:

```ocean static
sweep s from 42 to 45 do
    save to data/validation/seed_${s}.json
end
```

The braces are required. `${s}` is the only legal form; `$s` is not.
The expression inside the braces is restricted to a single
identifier; full expressions are not supported.

## Reserved words and verbs

OCEAN has a small reserved-word set. These names cannot be used as
identifiers in declaration positions:

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

The boolean operators are spelled out as words (`and`, `or`, `not`)
rather than as symbols (`&&`, `||`, `!`). This is a deliberate choice;
SQL and Python use the same convention, and the resulting code is
more readable to non-programmers.

Eight names live in the _verb_ namespace, separate from the reserved
words:

```
load    embed   reduce    cluster    align     find    narrate    save
```

A verb introduces a statement. Verbs and reserved words do not overlap;
no name is both. The list is closed by design, on the principle that
adding a new top-level verb would change the shape of every OCEAN
program.

## Operators

The full set of operators recognized by the lexer:

```
=       assignment / named-arg separator
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
+       addition
-       subtraction / unary minus
*       multiplication
/       division
```

OCEAN deliberately omits a number of operators that other languages
have: bitwise operators (`&`, `|`, `^`, `~`, `<<`, `>>`), modulo
(`%`), increment and decrement (`++`, `--`), the conditional ternary
(`?:`), and most of the C-derived family. Substrate-clustering
pipelines do not need them.

## Wider system

The lexical design follows from one premise: OCEAN programs are read
more often than they are written, and they are read by people whose
day job is not programming. A scientific data steward, a compliance
officer, a domain expert reviewing a vendor's pipeline. For those
readers, every reserved word with an English spelling (`and` instead
of `&&`, `using` instead of a flag) is one less symbol to look up.
The smaller operator set means the eye does not have to parse `<<=`
or `~`. The path literal that does not need quotes (`load
tmp/corpus.ndjson`) reads like a shell command, which is the
familiar shape for many of those readers.

This is the same design instinct that made SQL legible to non-programmers
in 1974 and that made dbt's templated SQL legible to analytics
engineers in 2018. Lexical accessibility is part of the substrate-status
play; vocabulary capture only happens if reading the language is easy.

## Exercises

1. Write the shortest legal OCEAN program. (Hint: zero statements is
   allowed.)

2. Find the lexical error in this snippet, in your head, without
   running the compiler:

```ocean static
load tmp/corpus.ndjson && embed text into 128 dimensions
```

3. Which of the following are legal identifiers? `Records`,
   `corpus_size`, `_intermediate`, `123records`, `take`, `my-var`.

## What's next

Chapter 4 leaves the lexical level and steps up to the type system:
the seven pipeline types, what produces each, and what consumes each.
