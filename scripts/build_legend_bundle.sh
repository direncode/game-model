#!/usr/bin/env bash
# Build lo-legends-v1.tar.gz — the separately-distributable legend bundle.
# Usage: scripts/build_legend_bundle.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-v1}"
OUT="${REPO_ROOT}/dist/lo-legends-${VERSION}.tar.gz"

mkdir -p "${REPO_ROOT}/dist"

# Staging directory
STAGE="$(mktemp -d)"
trap 'rm -rf "${STAGE}"' EXIT
mkdir -p "${STAGE}/lo-legends"

# Copy ConnectResult-shaped legend JSONs (frontend/data/legends/)
cp "${REPO_ROOT}/frontend/data/legends/manifest.json" "${STAGE}/lo-legends/" 2>/dev/null || true
cp "${REPO_ROOT}/frontend/data/legends/bridges.json" "${STAGE}/lo-legends/" 2>/dev/null || true
for f in "${REPO_ROOT}/frontend/data/legends/"*.json; do
  name="$(basename "$f")"
  # Skip manifest/bridges (already copied)
  [[ "$name" == "manifest.json" || "$name" == "bridges.json" ]] && continue
  cp "$f" "${STAGE}/lo-legends/"
done

# Copy raw BTUT outputs (for customers running their own lo_core analysis)
mkdir -p "${STAGE}/lo-legends/raw"
for f in "${REPO_ROOT}/scripts/cross_era_analysis/output/"*_btut_result_v2.json; do
  [[ -f "$f" ]] && cp "$f" "${STAGE}/lo-legends/raw/"
done
for f in "${REPO_ROOT}/scripts/results/"*_superpower_result.json; do
  [[ -f "$f" ]] && cp "$f" "${STAGE}/lo-legends/raw/"
done

# Include the LEGEND_BUNDLE.md spec and a README
cp "${REPO_ROOT}/lo_core/LEGEND_BUNDLE.md" "${STAGE}/lo-legends/" 2>/dev/null || true

cat > "${STAGE}/lo-legends/README.md" <<'EOF'
# lo-legends bundle

Pre-cached BTUT corpora + ConnectResult-shaped legend JSONs. Consumable by
the `lo_core` engine (`lo analyze` / `lo validate`) or directly by the
Latent Ocean frontend.

## Layout

- `manifest.json` — legend index
- `bridges.json` — cross-corpus bridge computation (pairwise + triple)
- `<legend>.json` — ConnectResult-shaped output per legend (UI-ready)
- `raw/<legend>_btut_result_v2.json` — raw BTUT outputs (for analysis pipelines)

## Usage

```bash
# Install lo_core (not included in this bundle)
pip install lo-core

# Analyze a raw corpus
lo analyze raw/polymath_btut_result_v2.json --corpus-id polymath -o findings.json

# Validate the whole set against null
lo validate raw/ --focus polymath --iterations 30
```
EOF

# Build the tarball
tar -czf "${OUT}" -C "${STAGE}" lo-legends
SIZE=$(du -h "${OUT}" | cut -f1)

echo "Built ${OUT}  (${SIZE})"
echo ""
echo "Contents:"
tar -tzf "${OUT}" | head -20
echo "..."
echo "Total: $(tar -tzf "${OUT}" | wc -l) entries"
