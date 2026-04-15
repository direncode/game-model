#!/bin/bash
# Latent Ocean Fork Entrypoint
# ─────────────────────────────────────────────────────────────────────
# This script runs inside the fork container at startup. It validates
# configuration, tests database connectivity, initializes materializer
# tables, optionally runs an initial reduction, and starts the API server.
#
# Environment variables are injected by the control plane provisioner.
# See fork_config.py for the full list.
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

LOG_PREFIX="[fork:${FORK_ID:-unknown}]"

log_info()  { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) INFO  $LOG_PREFIX $*"; }
log_warn()  { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) WARN  $LOG_PREFIX $*" >&2; }
log_error() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ERROR $LOG_PREFIX $*" >&2; }

# ── Step 1: Validate configuration ──────────────────────────────────

log_info "Step 1: Validating configuration"

required_vars=(FORK_ID CUSTOMER_ID SUBDOMAIN SOURCE_DSN)
for var in "${required_vars[@]}"; do
    if [ -z "${!var:-}" ]; then
        log_error "Required environment variable $var is not set"
        exit 1
    fi
done

# Default OUTPUT_DSN to SOURCE_DSN if not set
export OUTPUT_DSN="${OUTPUT_DSN:-$SOURCE_DSN}"
export OUTPUT_SCHEMA="${OUTPUT_SCHEMA:-latent_ocean}"
export ENGINE_BUDGET="${ENGINE_BUDGET:-50.0}"
export API_PORT="${API_PORT:-8000}"
export API_HOST="${API_HOST:-0.0.0.0}"
export LOG_LEVEL="${LOG_LEVEL:-INFO}"

log_info "Fork ID:    $FORK_ID"
log_info "Customer:   $CUSTOMER_ID"
log_info "Subdomain:  $SUBDOMAIN"
log_info "Schema:     $OUTPUT_SCHEMA"
log_info "Budget:     $ENGINE_BUDGET"

# ── Step 2: Test database connectivity ───────────────────────────────

log_info "Step 2: Testing database connectivity"

MAX_RETRIES=5
RETRY_DELAY=5

test_connection() {
    python3 -c "
from sqlalchemy import create_engine, text
import sys
try:
    engine = create_engine('$1', connect_args={'connect_timeout': 10})
    with engine.connect() as conn:
        conn.execute(text('SELECT 1'))
    engine.dispose()
    print('Connection OK')
except Exception as e:
    print(f'Connection failed: {e}', file=sys.stderr)
    sys.exit(1)
"
}

retry=0
while [ $retry -lt $MAX_RETRIES ]; do
    if test_connection "$SOURCE_DSN"; then
        log_info "Source database: connected"
        break
    fi
    retry=$((retry + 1))
    if [ $retry -lt $MAX_RETRIES ]; then
        log_warn "Source database: connection attempt $retry/$MAX_RETRIES failed, retrying in ${RETRY_DELAY}s"
        sleep $RETRY_DELAY
    else
        log_error "Source database: all $MAX_RETRIES connection attempts failed"
        exit 1
    fi
done

# Test output connection if different from source
if [ "$OUTPUT_DSN" != "$SOURCE_DSN" ]; then
    retry=0
    while [ $retry -lt $MAX_RETRIES ]; do
        if test_connection "$OUTPUT_DSN"; then
            log_info "Output database: connected"
            break
        fi
        retry=$((retry + 1))
        if [ $retry -lt $MAX_RETRIES ]; then
            log_warn "Output database: connection attempt $retry/$MAX_RETRIES failed, retrying in ${RETRY_DELAY}s"
            sleep $RETRY_DELAY
        else
            log_error "Output database: all $MAX_RETRIES connection attempts failed"
            exit 1
        fi
    done
fi

# ── Step 3: Schema introspection ─────────────────────────────────────

log_info "Step 3: Introspecting source schema"

python3 -c "
from sqlalchemy import create_engine, inspect
engine = create_engine('$SOURCE_DSN')
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f'Found {len(tables)} tables: {tables[:10]}...' if len(tables) > 10 else f'Found {len(tables)} tables: {tables}')
engine.dispose()
" || log_warn "Schema introspection failed (non-fatal)"

# ── Step 4: Initialize materializer tables ───────────────────────────

log_info "Step 4: Initializing materializer tables in schema '$OUTPUT_SCHEMA'"

python3 -c "
from engine.materializer import MaterializerConfig
from engine.materializer.drivers.postgresql import PostgreSQLMaterializer

config = MaterializerConfig(
    connection_string='$OUTPUT_DSN',
    schema_name='$OUTPUT_SCHEMA',
    create_schema=True,
    incremental=True,
)
materializer = PostgreSQLMaterializer(config)
materializer.initialize()
print('Materializer tables initialized')
materializer.close()
" || {
    log_error "Materializer initialization failed"
    exit 1
}

# ── Step 5: Run initial reduction (if enabled) ───────────────────────

if [ "${REDUCTION_ON_STARTUP:-true}" = "true" ]; then
    log_info "Step 5: Running initial reduction"

    python3 -c "
import logging
logging.basicConfig(level=logging.INFO)
from engine import LatentOceanEngine, EngineConfig
from engine.materializer import MaterializerConfig
from engine.materializer.drivers.postgresql import PostgreSQLMaterializer

# This is a placeholder — in production, the fork would use its
# configured connector to fetch entities from the customer's DB.
print('Initial reduction: skipped (no connector configured yet)')
print('Fork will run scheduled reductions via cron: ${REDUCTION_SCHEDULE:-0 2 * * *}')
" || log_warn "Initial reduction failed (non-fatal — will retry on schedule)"
else
    log_info "Step 5: Skipping initial reduction (REDUCTION_ON_STARTUP=false)"
fi

# ── Step 6: Start the API server ─────────────────────────────────────

log_info "Step 6: Starting API server on ${API_HOST}:${API_PORT}"

exec uvicorn \
    "fork_runner:app" \
    --host "$API_HOST" \
    --port "$API_PORT" \
    --log-level "${LOG_LEVEL,,}" \
    --workers 1 \
    --timeout-keep-alive 30
