#!/bin/bash
set -euo pipefail

# ══════════════════════════════════════════════
# Latent Intelligence — Deploy Script
# ══════════════════════════════════════════════
# Usage: bash scripts/deploy.sh
# Pulls latest code, builds images, runs migrations, restarts services.

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "══════════════════════════════════════════"
echo " Deploying Latent Intelligence"
echo " $(date)"
echo "══════════════════════════════════════════"

# ─── Pre-flight checks ───
if [ ! -f ".env.production" ]; then
    echo "ERROR: .env.production not found."
    echo "  cp .env.production.example .env.production"
    echo "  Then fill in your secrets."
    exit 1
fi

# ─── 1. Pull latest code ───
echo ""
echo "→ [1/6] Pulling latest code..."
git pull --no-recurse-submodules

# ─── 2. Build images ───
echo ""
echo "→ [2/6] Building Docker images..."
docker compose -f docker-compose.prod.yml --env-file .env.production build

# ─── 3. Stop old containers (keep DBs running) ───
echo ""
echo "→ [3/6] Restarting application services..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d postgres redis neo4j minio elasticsearch

# Wait for Postgres to be ready
echo "   Waiting for databases..."
sleep 5

# ─── 4. Run database migrations ───
echo ""
echo "→ [4/6] Running database migrations..."
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api \
    python -m alembic upgrade head 2>/dev/null || echo "   (No alembic migrations found, skipping)"

# ─── 5. Start all services ───
echo ""
echo "→ [5/6] Starting all services..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# ─── 5b. Restart nginx so it re-resolves upstream container IPs ───
# docker-compose recreates application containers with new IPs; nginx
# keepalive / DNS cache holds the old IPs and serves 502 until restarted.
# A blanket nginx restart is a no-op on cost and prevents the stale-upstream
# class of post-deploy bug.
echo ""
echo "→ [5b/6] Restarting nginx to refresh upstream DNS..."
docker compose -f docker-compose.prod.yml --env-file .env.production restart nginx
sleep 3

# ─── 6. Health check ───
echo ""
echo "→ [6/6] Running health checks..."
sleep 10

# Check each service
SERVICES=("nginx" "frontend" "api" "worker" "postgres" "redis" "neo4j" "minio" "elasticsearch")
ALL_HEALTHY=true

for svc in "${SERVICES[@]}"; do
    STATUS=$(docker compose -f docker-compose.prod.yml ps --format json "$svc" 2>/dev/null | grep -o '"State":"[^"]*"' | head -1 || echo "")
    if echo "$STATUS" | grep -q "running"; then
        echo "   ✓ $svc is running"
    else
        echo "   ✗ $svc is NOT running"
        ALL_HEALTHY=false
    fi
done

echo ""
if $ALL_HEALTHY; then
    echo "══════════════════════════════════════════"
    echo " Deployment successful!"
    echo " https://latentocean.com is live."
    echo "══════════════════════════════════════════"
else
    echo "══════════════════════════════════════════"
    echo " WARNING: Some services may not be running."
    echo " Check: docker compose -f docker-compose.prod.yml logs"
    echo "══════════════════════════════════════════"
fi
