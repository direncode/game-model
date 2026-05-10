---
slug: interfacing-ocean
number: 14
title: Interfacing OCEAN
promise: "After this chapter you can invoke OCEAN from Postgres, the HTTP API, the MCP server, the CLI, and an agent loop."
status: draft
---

# Interfacing OCEAN

> After this chapter you can invoke OCEAN from Postgres, the HTTP API, the MCP server, the CLI, and an agent loop.

## Concepts in this chapter

- The `pg_latentocean` Postgres extension
- The HTTP API for remote pipeline execution
- The OCEAN MCP server as an agent tool surface
- The CLI for batch usage
- The agent-loop pattern: compose, validate, run, iterate

## pg_latentocean: OCEAN inside Postgres

The Postgres extension `pg_latentocean` adds three functions to a
Postgres database:

```sql
SELECT lo_fingerprint(row_to_json(t)) AS fp
FROM   submissions t
WHERE  t.created_at > now() - interval '7 days';
```

`lo_fingerprint(JSONB)` returns the 48-bit structural fingerprint of
the row, as a `bit(48)` value. The fingerprint is the same one the
OCEAN `embed.content_fp48` operator produces; the contract is in
`docs/PRIMITIVE_SPEC.md`.

```sql
SELECT * FROM lo_score_window('submissions', 'composite', 100);
```

`lo_score_window(table, dim, window)` returns the top-N rows of a
table ranked by the named score dimension, where `dim` is one of
`composite`, `anomaly`, `reconstruction`, or `diversity`. The
window argument bounds the rolling history that scores are computed
against.

```sql
SELECT lo_null_test('submissions', '{composite}', 500, 42);
```

`lo_null_test(table, dims, iterations, seed)` runs the null-test
operation defined in `docs/PRIMITIVE_SPEC.md` section 4. The return
value is a `lo_null_result` composite type with the headline z-score
and the per-quantile null distribution.

The Postgres extension is the right surface when the data is
already in Postgres and the analyst's first language is SQL. It
runs the fingerprint primitive directly in the database; no data
leaves the server. For full pipeline operations (`embed`, `cluster`,
`align`, `find`), the SQL surface returns an OCEAN program text that
the analyst then runs through the compiler or the HTTP API.

## The HTTP API

```
POST /api/v1/run
Content-Type: application/json
Authorization: Bearer lo_pk_...

{
  "source": "<ocean program text>",
  "seed": 42
}
```

The HTTP API accepts an OCEAN program, runs it server-side, and
returns the artifact in the response body. The server handles
file-corpus uploads via a separate `/api/v1/corpora` endpoint that
returns a corpus id usable in `load` statements.

```
GET /api/v1/runs/{run_id}/artifact
GET /api/v1/runs/{run_id}/artifact.sha256
```

Each successful run produces a stable `run_id`. The artifact and
its SHA-256 sidecar are addressable forever (subject to retention
policy) via these endpoints. The artifact's `pipeline.source_sha256`
field is the canonical reference for "what corpus did this run see;"
the run_id is the canonical reference for "which specific execution
of which specific program."

The HTTP API is the right surface when OCEAN runs on a remote
server (a customer's own infrastructure, a managed Latent Ocean
deployment) and the caller is anything other than a Postgres
database: a notebook, a webhook, a CI job.

## MCP: OCEAN as an LLM tool

The MCP server (`ocean-mcp`, covered in chapter 12) exposes the
language as a set of tools for an AI coding agent. The full tool
list:

| Tool | What it does |
| --- | --- |
| `ocean_compile` | Compile source to operator-DAG, no execution. |
| `ocean_validate` | Type-check only, return diagnostics. |
| `ocean_run` | Compile and execute end-to-end. |
| `ocean_format` | Pretty-print to canonical form. |
| `ocean_lint` | Style and dead-code warnings. |
| `ocean_list_ops` | Enumerate operators with English schemas. |
| `ocean_list_stdlib` | List stdlib presets. |

An agent equipped with these tools can:

1. Receive a natural-language request ("cluster these 5,000 SEC
   filings and tell me which ones are anomalies").
2. Look up the available operators via `ocean_list_ops`.
3. Compose an OCEAN program using those operators.
4. Run `ocean_validate` to confirm the program type-checks.
5. Run `ocean_run` to execute it and read the artifact back.

The agent loop is the substrate-status play in real time. Every
agent that adopts these tools is one more place where the OCEAN
vocabulary lives in the agent ecosystem.

## The CLI

```
ocean compile file.ocean             # parse + typecheck + emit DAG
ocean run file.ocean                 # compile + execute
ocean fmt file.ocean --write         # pretty-print in place
ocean lint file.ocean --strict       # style + dead-code
ocean repl                           # interactive
ocean version                        # toolchain version
```

The CLI is a thin wrapper over the same Python modules covered in
chapter 12. It is the right surface for shell-script usage and for
CI pipelines.

The `ocean run` command exits with status 0 on success, 1 on
compile/type error, 2 on runtime error. Diagnostic output goes to
stderr; step timings and the artifact path go to stdout. This makes
the CLI composable with the standard Unix tool stack:

```sh
ocean run pipeline.ocean | jq '.dispersion.by_label' | grep -v '^null'
```

## The agent-loop pattern

The "agent loop" is the pattern that all five interfaces above
participate in:

1. **Compose.** The agent (human, LLM, or hybrid) writes an OCEAN
   program based on the question being asked.
2. **Validate.** The program is type-checked via `ocean_validate` or
   `ocean compile`. Type errors come back as typed diagnostics with
   suggestions. The agent fixes them.
3. **Run.** The program executes, either locally (CLI), via the
   HTTP API, or through MCP.
4. **Read.** The artifact comes back. The agent inspects the
   `dispersion` section, the `modules` section, and the
   `pipeline.operator_versions` block.
5. **Iterate.** Based on the artifact, the agent adjusts the
   program (different dimensions, different energy function,
   different alignment width) and re-runs.

The loop is short because OCEAN's compile-and-typecheck step is
fast (under a second on programs up to a few hundred lines). The
loop is robust because every iteration produces a saved artifact
with a deterministic digest; if the agent's third iteration was
the right one, the artifact is the contract.

## Wider system

The five interfaces above are the deployment-surface list. Each
surface lowers the activation energy for a new user to find OCEAN
already inside the tool they were going to use anyway. A Postgres
user does not need to install anything new; an analyst with an
HTTP client can run a pipeline; a Claude Desktop user gets OCEAN
tools surfaced automatically once the MCP server is configured.

This is comparable to how `psql` ships in every Linux distribution
and how `grep` shipped in every Unix variant; ubiquity is the moat.
Substrate status is built one deployment surface at a time, with
the same verb namespace on every one.

## Exercises

1. Write a `psql` query that calls `lo_fingerprint` on the first
   five rows of a hypothetical `submissions` table and returns the
   id and the fingerprint side by side.

2. Configure the OCEAN MCP server in a Claude Desktop or Cursor
   installation. Verify by asking the agent to `ocean_list_ops`.

3. Sketch an agent loop, in five bullet points, for the question
   "are there structural outliers in the trade-flow data from the
   last quarter?" Reference at least three of the interfaces from
   this chapter.

## What's next

The appendices: the grammar (A), the operator catalog (B), the
primitive spec companion (C), the glossary (D), the reference card
(E), and the exercise solutions (F).
