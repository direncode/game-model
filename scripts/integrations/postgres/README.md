# OCEAN — Postgres extension

The substrate-clustering primitive callable as a SQL function. Choose your install path based on your Postgres flavor.

## Install paths

| Database | Install file | Mechanism |
|---|---|---|
| Stock Postgres 14 / 15 / 16 | [`ocean_pg.sql`](./ocean_pg.sql) | `plpython3u` runs the OCEAN runtime in-process |
| Aurora Postgres / RDS / AlloyDB | [`install_aurora_fdw.sql`](./install_aurora_fdw.sql) | `http` extension bridges to OCEAN HTTP API |
| Supabase | [`install_supabase.sql`](./install_supabase.sql) | `pg_net` async HTTP bridges to OCEAN HTTP API |
| CockroachDB | (use Aurora FDW path) | `http` extension over standard Postgres wire protocol |
| Yugabyte | (use Aurora FDW path) | same as Aurora |
| TimescaleDB | (use stock or FDW depending on managed-vs-self-hosted) | — |

## Function surface (identical across all install paths)

```sql
ocean.compile(source TEXT)         RETURNS JSONB    -- typecheck + DAG, no execution
ocean.validate(source TEXT)        RETURNS JSONB    -- diagnostics only
ocean.run(source TEXT)             RETURNS JSONB    -- compile + execute, returns timings + artifact
ocean.format(source TEXT)          RETURNS TEXT     -- canonical pretty-print (stock + Aurora)
ocean.list_operators()             RETURNS TABLE    -- operator catalog with schemas
ocean.health()                     RETURNS JSONB    -- service health (FDW variants)
```

Same signatures, same return shapes. Code that works against the stock install works against Aurora, RDS, AlloyDB, Supabase, Cockroach, Yugabyte without changes.

## Quick start

### Stock Postgres

```sql
CREATE EXTENSION IF NOT EXISTS plpython3u;
\i ocean_pg.sql
```

Note: requires `plpython3u` available in your Postgres install (most managed services don't allow it; use the Aurora FDW path for those).

### Aurora / RDS / AlloyDB

```sql
CREATE EXTENSION IF NOT EXISTS http;
\i install_aurora_fdw.sql

ALTER DATABASE mydb SET ocean.api_base TO 'https://api.latentocean.com';
ALTER DATABASE mydb SET ocean.api_key  TO 'lo_pk_test_...';
```

### Supabase

```sql
create extension if not exists pg_net with schema extensions;
\i install_supabase.sql

alter database postgres set ocean.api_base to 'https://api.latentocean.com';
alter database postgres set ocean.api_key  to 'lo_pk_test_...';
```

## Usage examples

```sql
-- Run a pipeline literally
SELECT ocean.run($$
    load tmp/corpus.ndjson take 500 records balanced by archive
    embed text into 128 dimensions
    cluster for 16 rounds energy = corpus mean
    align modules using 50 nearest records
    find dispersion of each label
    save to data/result.json
$$);

-- Run a pipeline stored in a column
SELECT ocean.run(pipeline_source) AS result
FROM company.scheduled_pipelines
WHERE id = 42;

-- Inspect operator catalog (English-labeled)
SELECT kind, schema -> 0 ->> 'english' AS first_param
FROM ocean.list_operators()
WHERE kind LIKE 'embed.%';

-- Validate without running (for CI / lints)
SELECT ocean.validate(pipeline_source)
FROM company.scheduled_pipelines;
```

## Premium-operator gating

Premium operators (`embed.content_fp48`, `cluster.tcd_recursive_loop`, `reduce.btut`, `align.dispersion`) require a paid API key. The free reference operators (`embed.tfidf_jl`, `cluster.kmeans`, `align.module`, `persist.json`) are sufficient for most pipelines.

Get a key at <https://latentocean.com/protocols>.

## Performance

| Operation | Stock Postgres | FDW (Aurora/Supabase) |
|---|---|---|
| `ocean.compile()` (no I/O) | <50ms | ~80-150ms (HTTP round-trip) |
| `ocean.validate()` | <50ms | ~80-150ms |
| `ocean.run()` (small corpus) | seconds-to-minutes (in-process) | seconds-to-minutes (bounded by remote runtime) |
| `ocean.run()` (large corpus, GPU-accelerated) | not available | available via remote runtime |

The FDW path can use the LatentOcean hosted runtime which has SPU silicon (when shipped). The stock path runs everything locally on your Postgres host.

## License

MIT for the language + reference operators; commercial license for premium operators (BTUT, TCD-JEPA, content_fp48, dispersion).
