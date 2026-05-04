-- OCEAN Postgres extension — Supabase variant.
--
-- Supabase enables `pg_net` for outbound HTTP. Use that instead of
-- `http` (the Aurora-FDW path uses `http`). Same function signatures,
-- same return shapes; only the underlying HTTP mechanism differs.
--
-- Install (in the Supabase SQL editor):
--   create extension if not exists pg_net with schema extensions;
--   \i install_supabase.sql
--   alter database postgres set ocean.api_base to 'https://api.latentocean.com';
--   alter database postgres set ocean.api_key  to 'lo_pk_...';

CREATE SCHEMA IF NOT EXISTS ocean;

-- Configuration helpers
CREATE OR REPLACE FUNCTION ocean._api_base() RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(current_setting('ocean.api_base', true),
                    'https://api.latentocean.com');
$$;

CREATE OR REPLACE FUNCTION ocean._api_key() RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT current_setting('ocean.api_key', true);
$$;


-- Core POST helper using pg_net's async API. Polls until response lands.
CREATE OR REPLACE FUNCTION ocean._post(endpoint TEXT, payload JSONB, timeout_s INT DEFAULT 60)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
    request_id  BIGINT;
    api_key     TEXT := ocean._api_key();
    response    extensions.http_response;
    deadline    TIMESTAMPTZ := clock_timestamp() + (timeout_s || ' seconds')::INTERVAL;
BEGIN
    SELECT extensions.http_post(
        url     := ocean._api_base() || endpoint,
        body    := payload,
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', COALESCE('Bearer ' || api_key, '')
        )
    ) INTO request_id;

    -- Poll for the response (pg_net is async)
    LOOP
        SELECT * INTO response
        FROM extensions._http_response
        WHERE id = request_id;

        IF response.id IS NOT NULL THEN
            EXIT;
        END IF;

        IF clock_timestamp() > deadline THEN
            RAISE EXCEPTION 'ocean.% timed out after %s', endpoint, timeout_s;
        END IF;

        PERFORM pg_sleep(0.25);
    END LOOP;

    IF response.status_code = 200 THEN
        RETURN response.content::jsonb;
    END IF;

    RETURN jsonb_build_object(
        'ok',     false,
        'status', response.status_code,
        'error',  response.content
    );
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- ocean.compile, ocean.validate, ocean.run — same signatures
-- as the stock and FDW variants.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ocean.compile(source TEXT)
RETURNS JSONB
LANGUAGE sql STABLE AS $$
    SELECT ocean._post('/v1/compile', jsonb_build_object('source', source));
$$;

CREATE OR REPLACE FUNCTION ocean.validate(source TEXT)
RETURNS JSONB
LANGUAGE sql STABLE AS $$
    SELECT ocean._post('/v1/validate', jsonb_build_object('source', source));
$$;

CREATE OR REPLACE FUNCTION ocean.run(source TEXT)
RETURNS JSONB
LANGUAGE sql AS $$
    SELECT ocean._post('/v1/run', jsonb_build_object('source', source), 300);
$$;


-- Usage:
--   alter database postgres set ocean.api_base to 'https://api.latentocean.com';
--   alter database postgres set ocean.api_key  to 'lo_pk_test_...';
--
--   select ocean.run($$
--     load tmp/corpus.ndjson take 500 records balanced by archive
--     embed text into 128 dimensions
--     cluster for 16 rounds energy = corpus mean
--     align modules using 50 nearest records
--     find dispersion of each label
--     save to data/result.json
--   $$);
