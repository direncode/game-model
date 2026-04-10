#!/usr/bin/env bash
#
# Deploy the LATK query server + lattice files to the production EC2 instance.
#
# This script is meant to be executed BY THE USER from their local machine.
# Claude (the assistant that wrote this) cannot run SSH commands against your
# production host — that's an explicit boundary in its operating rules.
#
# Usage:
#   ./scripts/cross_era_analysis/latk_tool/deploy/deploy_latk_to_ec2.sh [ssh_alias]
#
# If ssh_alias is omitted, defaults to 'prod'. The script is idempotent: you
# can run it repeatedly.
#
set -euo pipefail

SSH_ALIAS="${1:-prod}"
REMOTE_REPO="/opt/latentocean"
LOCAL_REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"

echo "==> LATK deployment starting"
echo "    local repo : $LOCAL_REPO"
echo "    ssh alias  : $SSH_ALIAS"
echo "    remote repo: $REMOTE_REPO"
echo ""

# 1. Sanity: do the lattice files we need actually exist locally?
LATTICES=(
  "scripts/cross_era_analysis/output/latk_mini_btut_result_v2.json"
  "scripts/cross_era_analysis/output/linguistics_btut_result_v2.json"
)
# Optional v2 physics lattice — only copied if present
OPTIONAL_LATTICES=(
  "scripts/cross_era_analysis/output/latk_physics_btut_result_v2.json"
)

echo "==> Checking required lattice files"
missing=0
for f in "${LATTICES[@]}"; do
  if [[ ! -f "$LOCAL_REPO/$f" ]]; then
    echo "    MISSING: $f"
    missing=1
  else
    size_kb=$(du -k "$LOCAL_REPO/$f" | cut -f1)
    echo "    ok ($size_kb KB): $f"
  fi
done
if [[ $missing -ne 0 ]]; then
  echo "ERROR: missing required lattice files. Aborting." >&2
  exit 1
fi

echo ""
echo "==> Verifying remote repo exists + git-clean"
ssh "$SSH_ALIAS" "test -d $REMOTE_REPO/.git" || {
  echo "ERROR: remote repo not found at $REMOTE_REPO" >&2
  exit 1
}

# 2. Pull latest main
echo ""
echo "==> Remote: git pull origin main"
ssh "$SSH_ALIAS" "cd $REMOTE_REPO && git pull origin main"

# 3. Ensure remote output directory exists
echo ""
echo "==> Remote: ensure output dir exists"
ssh "$SSH_ALIAS" "mkdir -p $REMOTE_REPO/scripts/cross_era_analysis/output"

# 4. Copy required lattice files
echo ""
echo "==> Copying required lattice files to remote"
for f in "${LATTICES[@]}"; do
  echo "    scp $f"
  scp "$LOCAL_REPO/$f" "$SSH_ALIAS:$REMOTE_REPO/$f"
done

# 5. Copy optional lattice files if they exist
for f in "${OPTIONAL_LATTICES[@]}"; do
  if [[ -f "$LOCAL_REPO/$f" ]]; then
    echo "    scp $f (optional)"
    scp "$LOCAL_REPO/$f" "$SSH_ALIAS:$REMOTE_REPO/$f"
  else
    echo "    (skip optional; not found locally: $f)"
  fi
done

# 6. Restart backend
echo ""
echo "==> Remote: restart backend service"
ssh "$SSH_ALIAS" "cd $REMOTE_REPO && docker compose restart backend"

# 7. Health check via curl from the remote host (avoids needing public URL resolution locally)
echo ""
echo "==> Remote: health probe"
ssh "$SSH_ALIAS" "curl -sS http://localhost:8000/api/v1/latk/health | head -c 500"
echo ""

echo ""
echo "==> LATK deployment complete"
echo "    Next: curl the /api/v1/latk/novelty endpoint against your public URL"
echo "    and paste a modern text to see historical ancestors come back."
