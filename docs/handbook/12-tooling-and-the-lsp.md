---
slug: tooling-and-the-lsp
number: 12
title: Tooling and the LSP
promise: "After this chapter you can compile, run, format, lint, and edit OCEAN with full IDE support, and you know how to expose OCEAN as a tool to an AI coding agent."
status: draft
---

# Tooling and the LSP

> After this chapter you can compile, run, format, lint, and edit OCEAN with full IDE support, and you know how to expose OCEAN as a tool to an AI coding agent.

## Concepts in this chapter

- The compile-and-run CLI
- The REPL for incremental exploration
- The formatter (canonical pretty-printing)
- The linter (style and dead-code analysis)
- The Language Server Protocol implementation
- The Model Context Protocol server (`ocean-mcp`)
- The `narrate` verb for human-readable annotations

## Compile and run

The single entry point for compiling and running an OCEAN program:

```
python -m scripts.run_universal_pipeline --config first_pipeline.ocean
```

The runner parses, type-checks, and executes the program. Step
timings appear on stdout in the form `[step 1/N] verb ... Xms · summary`,
which is the format the sandboxed handbook runner parses for its
output panel. Failures produce typed diagnostics with line and column
information.

The runner accepts a `--seed N` flag that overrides any `seed`
declaration in the program, useful for `sweep` interactions and
batch reruns. The flag is also useful for stress-testing whether a
result is stable across seeds without editing the source file.

## REPL: interactive exploration

```
python -m scripts.operators.ocean.repl
```

The REPL is a stateful line-by-line interpreter. Each line is
parsed and type-checked; if successful, it is executed and any
resulting bindings persist to the next line.

```
ocean> let raw = load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive
:: Records (50 records, source_sha256=a1b2c3...)

ocean> let z = embed text from raw into 64 dimensions
:: Z (shape: 50 x 64)

ocean> let m = cluster z for 8 rounds max 6 modules using kmeans
:: Modules (4 modules; sizes: [15, 13, 12, 10])
```

The REPL is the right tool for exploring a new corpus or for
prototyping a pipeline shape before committing to a `.ocean` file.
Each successful evaluation displays the resulting value's type and
a one-line summary. The actual contents of values are still opaque;
the REPL does not let the user read inside a `Z` value.

State persists across lines for the duration of the session. A
`:reset` command clears the binding namespace. A `:save FILE`
command writes the current sequence of bindings as a `.ocean`
program.

## The formatter

```
python -m scripts.operators.ocean.format file.ocean
python -m scripts.operators.ocean.format file.ocean --write
```

Without `--write`, the formatter prints the canonical form to
stdout. This is useful for diff-style checks: `diff <(format
file.ocean) file.ocean` shows any non-canonical formatting.

With `--write`, the formatter overwrites the file in place. This
is the right setup for editor-on-save hooks and for pre-commit
hooks in the repository.

The canonical form fixes whitespace (one space around `=`, no
trailing whitespace, single blank line between top-level
statements), normalizes literal forms (`tfidf` becomes `tf-idf`,
numeric underscores are added for groupings above 1000), and
sorts named arguments alphabetically inside a call.

## The linter

```
python -m scripts.operators.ocean.lint file.ocean
python -m scripts.operators.ocean.lint file.ocean --strict
```

The linter catches style and dead-code issues that the typechecker
does not. The default lint level is informational warnings:

- Unused `let` bindings.
- Unused imports.
- Missing `seed` declaration (the default is 42, which is fine,
  but the linter prefers an explicit seed for reproducibility
  contracts).
- Missing `label field is` declaration when the default
  `archive` is not a field in the corpus.
- Sweeps with single-step iterations (`sweep s from 42 to 42`).
- Cluster statements with no upstream embed.
- Paths that do not exist on disk at lint time.
- Magic-number dimensions outside the common set
  `{32, 64, 128, 192, 256}`.

With `--strict`, warnings become errors. The pre-commit hook in
the repository runs the linter with `--strict` on staged `.ocean`
files; new programs cannot be committed with sweeps over a
single value or with paths that do not exist.

## The Language Server Protocol

```
python -m scripts.operators.ocean.lsp
```

The LSP implementation runs the parser, type-checker, and linter
incrementally on each keystroke and reports diagnostics back to
the editor via the standard LSP wire protocol. Hover-tooltips
show the type of any binding. Go-to-definition works for `define`d
functions and imports.

Editor configurations live in the repository under
`editor/vscode/` and `editor/cursor/`. The Goose configuration
ships with the `ocean-mcp` package and registers OCEAN under
`~/.config/goose/config.yaml`.

## Model Context Protocol: OCEAN as an agent tool

```
pip install ocean-mcp
ocean-mcp                                  # runs as a server on stdio
```

The OCEAN MCP server exposes the language as a set of tools for an
AI coding agent: `ocean_compile`, `ocean_validate`, `ocean_run`,
`ocean_format`, `ocean_lint`, `ocean_list_ops`, `ocean_list_stdlib`.
The tool surface is documented in
`packages/ocean-mcp/README.md`.

Configuration for the major MCP-compatible clients:

```json
{
  "mcpServers": {
    "ocean": {
      "command": "ocean-mcp"
    }
  }
}
```

For Claude Desktop on macOS, place this in
`~/Library/Application Support/Claude/claude_desktop_config.json`.
For Cursor, add via Settings to MCP. For Goose, edit
`~/.config/goose/config.yaml`.

With the MCP server running, an agent can ask "validate this
OCEAN snippet" and get back the same diagnostics a human would see
in their editor. This closes the loop between agent-authored
programs and the language's safety guarantees: an agent that
writes a type-incorrect OCEAN program gets a typed error and can
fix it.

## The narrate verb

```ocean static
narrate modules in technical style
```

`narrate` is the last unmentioned verb. It takes a `Modules` or
`Aligned` value and attaches human-readable narrative strings to
each module by inspecting the module's centroid and its closest
records. The output type is the same as the input (`Modules` becomes
`Modules`, `Aligned` becomes `Aligned`), with the `narrative` slot
on each module now populated.

Three styles are accepted: `technical` (operator-and-parameter
focused), `plain` (label-and-record focused), `terse` (one-line
per module). The default is `plain`.

`narrate` is usually the last verb before `save`. Run it after
`align` so the narrative can reference specific records. Do not
run it between `cluster` and `align`; the type system allows it
(narrate accepts `Modules`), but the narratives produced from
bare modules without record alignments are less informative.

## Wider system

A tiny DSL with its own LSP and its own MCP server is
disproportionate effort unless the goal is substrate status. The
first time an agent autocompletes `cluster for 16 rounds max 24
modules`, OCEAN has won a token-level adoption point. The first
time an editor's hover-tooltip shows `Z (shape: 500 x 128)`
without the program author having to think about types, OCEAN has
won a comprehension point.

Substrate status is the accumulation of these small wins across
millions of interactions. The tooling exists to make those wins
free.

## Exercises

1. Run the linter on the Chapter 2 pipeline. What does it warn
   about, if anything?

2. Start the REPL and create two let-bindings, the second referencing
   the first. Confirm the second binding's displayed type matches
   what Chapter 4's type table predicts.

3. Install the MCP server (or read its README), and write a one-line
   description of what `ocean_list_ops` would return for the version
   of OCEAN this handbook documents.

## What's next

Chapter 13 covers patterns that experienced OCEAN authors use and
patterns that beginners often write that turn out badly.
