# ocean-mcp

**MCP server for the OCEAN substrate-clustering language.**
Drop into Claude Desktop, Cursor, Goose, Continue.dev, or any MCP-compatible AI client.

The OCEAN language is a typed, declarative, deterministic DSL for substrate-clustering pipelines. The MCP server makes the language callable as a set of agent tools: compile, validate, run, format, lint, list operators, browse the stdlib.

```
pip install ocean-mcp
```

## Quick start

### Claude Desktop / Cursor / Goose

Add to your MCP client's configuration:

```json
{
  "mcpServers": {
    "ocean": {
      "command": "ocean-mcp"
    }
  }
}
```

For Claude Desktop on macOS, this lives at:
`~/Library/Application Support/Claude/claude_desktop_config.json`

For Cursor: Settings → MCP → Add Server.
For Goose: `~/.config/goose/config.yaml`.

### npx wrapper (Node ecosystem)

```bash
npx -y @latentocean/ocean-mcp
```

The wrapper auto-installs the Python package on first run.

## Tools provided

| Tool name        | What it does |
|------------------|--------------|
| `ocean_compile`  | Compile `.ocean` source → operator-DAG configuration. Validates syntax + types without running. |
| `ocean_validate` | Type-check only. Returns structured diagnostics (line, col, message, suggestion). |
| `ocean_run`      | Compile + execute end-to-end. Returns step timings + the persisted artifact. |
| `ocean_format`   | Pretty-print to canonical OCEAN form. |
| `ocean_lint`     | Style + dead-code analysis. |
| `ocean_list_ops` | Enumerate operators with English-labeled parameter schemas. |
| `ocean_list_stdlib` | List stdlib functions (basic_run, seed_sweep, anomaly_focused, content_vs_structural). |

## Resources provided

| URI                          | Content |
|------------------------------|---------|
| `ocean://docs/spec`          | Full OCEAN language reference |
| `ocean://docs/spu`           | SPU hardware architecture |
| `ocean://stdlib/{file}`      | Stdlib `.ocean` source |

## Premium operators

The proprietary operators (`embed.content_fp48`, `cluster.tcd_recursive_loop`, `reduce.btut`, `align.dispersion`) require a paid API key. Set:

```bash
export OCEAN_API_KEY=lo_pk_...
```

Free tier covers the reference operators (`embed.tfidf_jl`, `cluster.kmeans`, `align.module`, `persist.json`) — sufficient to compose end-to-end pipelines for proof of concept.

Get a key at <https://latentocean.com/protocols>.

## What is OCEAN?

A typed declarative language for substrate-clustering pipelines. Same family as SQL but for unsupervised structural pattern extraction across heterogeneous corpora.

```ocean
load tmp/corpus.ndjson take 500 records balanced by archive
embed text into 128 dimensions using tf-idf
cluster for 16 rounds max 24 modules energy = corpus mean
align modules using 50 nearest records
find dispersion of each label
save to data/result.json
```

Six lines describe a complete pipeline. The same six lines run identically through MCP, the Postgres extension, the HTTP API, or the OCEAN CLI.

Read the spec: <https://latentocean.com/language>

## License

MIT.
