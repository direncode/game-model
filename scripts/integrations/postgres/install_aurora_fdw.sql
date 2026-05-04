-- OCEAN Postgres extension — Aurora / RDS / AlloyDB variant.
--
-- These platforms don't allow arbitrary `plpython3u` (the PL/Python
-- procedural language). Instead, we install OCEAN as a *foreign data
-- wrapper* that bridges to the LatentOcean HTTP API.
--
-- Functionally equivalent to the stock plpython3u install: same
-- function signatures, same return shapes.
--
-- Install:
--   CREATE EXTENSION http;             -- plpgsql_check or pg_net also work
--   \i install_aurora_fdw.sql
--   ALTER DATABASE your_db SET ocean.api_base TO 'https://api.latentocean.com';
--   ALTER DATABASE your_db SET ocean.api_key  TO 'lo_pk_...';

CREATE SCHEMA IF NOT EXISTS ocean;

-- ─────────────────────────────────────────────────────────────
-- Helper: pull configuration from session GUCs.
-- (current_setting + missing_ok=true returns NULL when unset)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ocean._api_base() RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(current_setting('ocean.api_base', true),
                    'https://api.latentocean.com');
$$;

CREATE OR REPLACE FUNCTION ocean._api_key() RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT current_setting('ocean.api_key', true);
$$;


-- ─────────────────────────────────────────────────────────────
-- ocean.compile(source) — typed-DAG compile via HTTP POST /v1/compile
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ocean.compile(source TEXT)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
    response_body TEXT;
    api_url       TEXT := ocean._api_base() || '/v1/compile';
    api_key       TEXT := ocean._api_key();
BEGIN
    SELECT content::text INTO response_body
    FROM http((
        'POST',
        api_url,
        ARRAY[
            http_header('Content-Type',  'application/json'),
            http_header('Authorization', COALESCE('Bearer ' || api_key, ''))
        ],
        'application/json',
        jsonb_build_object('source', source)::text
    )::http_request);

    RETURN response_body::jsonb;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- ocean.validate(source) — typecheck only via HTTP POST /v1/validate
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ocean.validate(source TEXT)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
    response_body TEXT;
    api_url       TEXT := ocean._api_base() || '/v1/validate';
    api_key       TEXT := ocean._api_key();
BEGIN
    SELECT content::text INTO response_body
    FROM http((
        'POST',
        api_url,
        ARRAY[
            http_header('Content-Type',  'application/json'),
            http_header('Authorization', COALESCE('Bearer ' || api_key, ''))
        ],
        'application/json',
        jsonb_build_object('source', source)::text
    )::http_request);

    RETURN response_body::jsonb;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- ocean.run(source) — compile + execute via HTTP POST /v1/run
-- Heads-up: long-running. The HTTP gateway has a 5-minute timeout;
-- multi-thousand-record corpora running TCD recursive loop can
-- approach that. Use `LATERAL` carefully if running across a column.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ocean.run(source TEXT)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
    response_body TEXT;
    api_url       TEXT := ocean._api_base() || '/v1/run';
    api_key       TEXT := ocean._api_key();
BEGIN
    IF api_key IS NULL THEN
        RAISE EXCEPTION 'ocean.api_key not set; ALTER DATABASE % SET ocean.api_key TO ''lo_pk_...'';',
                        current_database();
    END IF;

    SELECT content::text INTO response_body
    FROM http((
        'POST',
        api_url,
        ARRAY[
            http_header('Content-Type',  'application/json'),
            http_header('Authorization', 'Bearer ' || api_key)
        ],
        'application/json',
        jsonb_build_object('source', source)::text
    )::http_request);

    RETURN response_body::jsonb;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- ocean.list_operators() — HTTP GET /v1/operators
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ocean.list_operators()
RETURNS TABLE(kind TEXT, schema JSONB, premium BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
    response_body TEXT;
    api_url       TEXT := ocean._api_base() || '/v1/operators';
    api_key       TEXT := ocean._api_key();
    rec           JSONB;
    op_kind       TEXT;
    op_schema     JSONB;
    premium_set   JSONB;
BEGIN
    SELECT content::text INTO response_body
    FROM http((
        'GET',
        api_url,
        ARRAY[http_header('Authorization', COALESCE('Bearer ' || api_key, ''))],
        NULL,
        NULL
    )::http_request);

    rec         := response_body::jsonb;
    premium_set := rec -> 'premium';

    FOR op_kind IN SELECT jsonb_object_keys(rec -> 'operators') LOOP
        op_schema := (rec -> 'operators') -> op_kind;
        kind    := op_kind;
        schema  := op_schema;
        premium := premium_set @> jsonb_build_array(op_kind);
        RETURN NEXT;
    END LOOP;
    RETURN;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- Self-test: confirm the FDW path works.
-- After install:    SELECT ocean.health();
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ocean.health()
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
    response_body TEXT;
    api_url       TEXT := ocean._api_base() || '/v1/health';
BEGIN
    SELECT content::text INTO response_body
    FROM http(('GET', api_url, ARRAY[]::http_header[], NULL, NULL)::http_request);
    RETURN response_body::jsonb;
END;
$$;


-- Usage examples:
--
-- ALTER DATABASE mydb SET ocean.api_base TO 'https://api.latentocean.com';
-- ALTER DATABASE mydb SET ocean.api_key  TO 'lo_pk_test_...';
--
-- -- Run a pipeline stored in a TEXT column
-- SELECT ocean.run(pipeline_source) FROM company.scheduled_pipelines WHERE id = 42;
--
-- -- Inspect operator catalog with English-labeled parameters
-- SELECT kind, schema -> 0 ->> 'english' AS first_param, premium
-- FROM ocean.list_operators()
-- WHERE kind LIKE 'embed.%';
