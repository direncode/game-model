-- OCEAN Postgres extension
-- Exposes the OCEAN compiler + runtime as SQL functions, callable from
-- any Postgres-compatible database (Postgres, Aurora, AlloyDB, CockroachDB,
-- Yugabyte, Supabase, Neon, TimescaleDB).
--
-- Install:
--    CREATE EXTENSION plpython3u;          -- requires plpython3u available
--    \i scripts/integrations/postgres/ocean_pg.sql
--
-- Then any analyst can run:
--
--    SELECT * FROM ocean_run($$
--        load tmp/corpus.ndjson take 500 records balanced by archive
--        embed text into 128 dimensions
--        cluster for 16 rounds energy = corpus mean
--        align modules using 50 nearest records
--        find dispersion of each label
--        save to data/validation/result.json
--    $$);
--
-- The result is returned as a SETOF JSON rows. Substrate clustering
-- becomes a SQL primitive callable from any analytics workflow.
--
-- This is the second protocol-level distribution channel for OCEAN
-- (the first being MCP). Together they cover every AI agent stack
-- and every data warehouse stack.

CREATE SCHEMA IF NOT EXISTS ocean;

-- Note: PL/Python uses 'GD' (global dict) to cache imports across calls.

-- ── ocean.compile(source) → JSONB ─────────────────────────────────
-- Compile-only. Returns the operator-DAG configuration as JSONB.

CREATE OR REPLACE FUNCTION ocean.compile(source TEXT)
RETURNS JSONB
LANGUAGE plpython3u
AS $$
    import sys
    if 'ocean_loaded' not in GD:
        sys.path.insert(0, '/opt/latentocean')   # adjust to the repo install path
        GD['ocean_loaded'] = True
    import json
    from scripts.operators.ocean.compiler import compile_ocean
    from scripts.operators.ocean.lexer import LexerError
    from scripts.operators.ocean.parser import ParseError
    from scripts.operators.ocean.typecheck import TypeError_
    from scripts.operators.ocean.compiler import CompileError
    try:
        cfg = compile_ocean(source, source_name='<sql-call>')
        return json.dumps({"ok": True, "config": cfg}, default=str)
    except (LexerError, ParseError, TypeError_, CompileError) as e:
        return json.dumps({"ok": False, "error": e.pretty('<sql-call>')})
$$;


-- ── ocean.validate(source) → JSONB ───────────────────────────────
-- Type-check only. Returns structured diagnostics.

CREATE OR REPLACE FUNCTION ocean.validate(source TEXT)
RETURNS JSONB
LANGUAGE plpython3u
AS $$
    import sys
    if 'ocean_loaded' not in GD:
        sys.path.insert(0, '/opt/latentocean')
        GD['ocean_loaded'] = True
    import json
    from scripts.operators.ocean.compiler import compile_ocean
    from scripts.operators.ocean.lexer import LexerError
    from scripts.operators.ocean.parser import ParseError
    from scripts.operators.ocean.typecheck import TypeError_
    from scripts.operators.ocean.compiler import CompileError
    diags = []
    try:
        compile_ocean(source, source_name='<sql-call>')
    except (LexerError, ParseError, TypeError_, CompileError) as e:
        diags.append({
            "severity": "error",
            "category": type(e).__name__,
            "line":     getattr(e, 'line', 0),
            "col":      getattr(e, 'col', 0),
            "message":  getattr(e, 'message', str(e)),
        })
    return json.dumps({"ok": True, "diagnostics": diags})
$$;


-- ── ocean.run(source) → JSONB ────────────────────────────────────
-- Compile + execute. Returns step timings and the persisted artifact.
-- This is the workhorse function — analysts call this from any SQL surface.

CREATE OR REPLACE FUNCTION ocean.run(source TEXT)
RETURNS JSONB
LANGUAGE plpython3u
AS $$
    import sys
    if 'ocean_loaded' not in GD:
        sys.path.insert(0, '/opt/latentocean')
        # Pre-load torch to dodge sklearn/torch DLL clash on Windows hosts
        import os
        os.environ.setdefault('KMP_DUPLICATE_LIB_OK', 'TRUE')
        try:
            import torch  # noqa
        except Exception:
            pass
        GD['ocean_loaded'] = True

    import json
    from scripts.operators import run_pipeline, PipelineConfig, StepConfig
    from scripts.operators.ocean.compiler import compile_ocean
    import scripts.operators.source   # noqa: F401
    import scripts.operators.embed    # noqa: F401
    import scripts.operators.cluster  # noqa: F401
    import scripts.operators.align    # noqa: F401
    import scripts.operators.persist  # noqa: F401

    cfg = compile_ocean(source, source_name='<sql-call>')
    pipeline = PipelineConfig(
        seed=cfg['seed'],
        steps=[StepConfig(**{k: v for k, v in s.items()
                             if k in {'name', 'kind', 'inputs', 'config'}})
               for s in cfg['steps']],
    )
    state = run_pipeline(pipeline, verbose=False)
    return json.dumps({
        "ok":      True,
        "timings": state.get('_pipeline.timings', []),
        "seed":    state.get('_pipeline.seed'),
    }, default=str)
$$;


-- ── ocean.list_operators() → SETOF (kind TEXT, schema JSONB) ─────
-- Catalog enumeration. Returns one row per registered operator with
-- its English-labeled parameter schema.

CREATE OR REPLACE FUNCTION ocean.list_operators()
RETURNS TABLE(kind TEXT, schema JSONB)
LANGUAGE plpython3u
AS $$
    import sys
    if 'ocean_loaded' not in GD:
        sys.path.insert(0, '/opt/latentocean')
        GD['ocean_loaded'] = True
    import json
    from scripts.operators.ocean.schema import all_schemas
    rows = []
    for kind, sch in all_schemas().items():
        rows.append((kind, json.dumps(sch)))
    return rows
$$;


-- ── ocean.format(source) → TEXT ──────────────────────────────────
-- Pretty-print to canonical OCEAN form. Useful when storing OCEAN
-- programs in a TEXT column and wanting normalized whitespace.

CREATE OR REPLACE FUNCTION ocean.format(source TEXT)
RETURNS TEXT
LANGUAGE plpython3u
AS $$
    import sys
    if 'ocean_loaded' not in GD:
        sys.path.insert(0, '/opt/latentocean')
        GD['ocean_loaded'] = True
    from scripts.operators.ocean.parser import parse_ocean
    from scripts.operators.ocean.format import format_program
    prog = parse_ocean(source, source_name='<sql-call>')
    return format_program(prog)
$$;


-- ── Demonstrative usage ────────────────────────────────────────────
-- Comments below show how a data-warehouse analyst would use OCEAN
-- without leaving SQL.

-- Example 1: validate a stored pipeline before scheduling it
--
--   WITH p AS (
--     SELECT pipeline_source FROM company.scheduled_pipelines
--     WHERE id = 42
--   )
--   SELECT ocean.validate(pipeline_source) AS diagnostics FROM p;
--
-- Example 2: run a pipeline whose source is a database column
--
--   SELECT ocean.run(pipeline_source) AS run_result
--   FROM company.scheduled_pipelines
--   WHERE id = 42;
--
-- Example 3: enumerate operator catalog (for dropdown UIs)
--
--   SELECT kind, schema -> 0 ->> 'english' AS first_param
--   FROM ocean.list_operators()
--   WHERE kind LIKE 'embed.%';
