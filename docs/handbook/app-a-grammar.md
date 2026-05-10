---
slug: app-a-grammar
number: null
title: "Appendix A: Grammar"
promise: "This appendix is the complete EBNF grammar of OCEAN 1.0."
status: draft
---

# Appendix A: Grammar

> This appendix is the complete EBNF grammar of OCEAN 1.0.

The grammar below is identical to `docs/OCEAN_LANG.md` section 2. It
is normative; any disagreement between this appendix and the formal
reference is a bug against this handbook, not against OCEAN. Terminals
are quoted; non-terminals are bare.

## EBNF

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
              | int ;

verb           = "load" | "embed" | "reduce" | "cluster" | "align"
              | "find" | "narrate" | "save" ;

variant        = ident { ident } ;

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

## Lexical productions (informal)

```
ident   ::= [a-z_] [a-z0-9_]*
int     ::= [-]? [0-9] ([0-9_]* [0-9])?
float   ::= [-]? [0-9]+ ('.' [0-9]+)? ([eE] [+-]? [0-9]+)?
string  ::= '"' (any-char-except-quote | escape)* '"'
         |  "'" (any-char-except-quote | escape)* "'"
escape  ::= '\' ('"' | "'" | '\' | 'n' | 't' | 'r')
path    ::= [\w./\\-]+ '.' ('ndjson' | 'csv' | 'tsv' | 'json'
                          | 'yaml' | 'yml' | 'txt' | 'ocean')
bool    ::= 'true' | 'false'
interp  ::= '${' ident '}'
comment ::= '#' (any-char-except-newline)*
```

Newlines are statement-significant outside parenthesized expressions
and brace blocks. Whitespace separates tokens.

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

## Verbs

```
load    embed    reduce    cluster    align    find    narrate    save
```

## Operators

```
=  ,  {  }  (  )  ==  !=  <  >  <=  >=  +  -  *  /
```

Boolean operators are spelled `and`, `or`, `not`. There are no
bitwise operators, no modulo, no increment or decrement.
