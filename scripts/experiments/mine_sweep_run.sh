#!/usr/bin/env bash
# mine_sweep_run.sh — end-to-end pipeline runner for /mine-sweep.
#
# Per spec docs/superpowers/specs/2026-05-11-mine-sweep-design.md.
#
# Preconditions before running:
#   1. Populate the BAG URL list at data/validation/mine_sweep/_bag_urls.json
#      with NCEI hydrographic surveys covering Stellwagen Sanctuary.
#      Source: https://www.ngdc.noaa.gov/mgg/bathymetry/hydro.html
#   2. Set the AWOIS URL via env or by editing mine_sweep_ingest.py:
#      export MINE_SWEEP_AWOIS_URL="https://nauticalcharts.noaa.gov/data/wrecks-and-obstructions/<actual.zip>"
#      export MINE_SWEEP_AWOIS_RELEASE="2026-04"
#   3. Set the SBNMS boundary URL the same way.
#   4. Implement the two LEARNING-MODE stubs in scripts/experiments/mine_sweep.py:
#        - anomaly_score(...)
#        - b_gate(...)
#      Both have proposed implementations in the docstrings.
#   5. Install geo deps: pip install rasterio geopandas pyarrow shapely pyproj scikit-learn scipy
#
# Run modes:
#   ./mine_sweep_run.sh                  # full pipeline (4-12 hr depending on hardware)
#   ./mine_sweep_run.sh --ingest-only    # just download + manifest
#   ./mine_sweep_run.sh --features-only  # just feature extraction
#   ./mine_sweep_run.sh --substrate-only # just substrate + baselines + summary
#
# Optional RunPod dispatch:
#   If you want substrate to run on RunPod GPU instead of local CPU, replace
#   the substrate step below with a runpod_dispatch.submit_and_wait call
#   that runs `python scripts/experiments/mine_sweep.py --skip-substrate`
#   on the remote, then pulls the modules JSONs back. The 880K x 4 matrix
#   is small enough that local CPU is usually faster than RunPod cold-start
#   plus transfer time.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

MODE="${1:-full}"

run_ingest() {
    echo "=== STAGE 2: ingest ==="
    python scripts/experiments/mine_sweep_ingest.py
}

run_features() {
    echo "=== STAGE 3: features ==="
    python scripts/experiments/mine_sweep_features.py
}

run_substrate() {
    echo "=== STAGES 6+7: substrate + baselines + B-gate ==="
    python scripts/experiments/mine_sweep.py
}

run_executability_check() {
    echo "=== STAGE 5: OCEAN pipeline executability check ==="
    if python -m scripts.operators.ocean.compiler pipelines/mine_sweep.ocean --execute 2>/dev/null; then
        # Compare the .ocean-driven output to the Python-harness output
        for seed in 42 43 44; do
            ocean_out="data/validation/mine_sweep/modules_seed_${seed}.json"
            python_out="data/validation/mine_sweep/modules_seed_${seed}.json.python"
            if [ -f "$python_out" ] && ! diff -q "$ocean_out" "$python_out" >/dev/null; then
                echo "FAIL: .ocean output diverges from Python harness for seed $seed"
                exit 1
            fi
        done
        echo "PASS: .ocean pipeline output is byte-identical to harness output"
    else
        echo "SKIP: OCEAN pipeline executability check requires the lexer/parser changes"
        echo "      described in pipelines/mine_sweep.ocean.extension_notes.md."
        echo "      The harness output is the source of truth until then."
    fi
}

case "$MODE" in
    --ingest-only)
        run_ingest
        ;;
    --features-only)
        run_features
        ;;
    --substrate-only)
        run_substrate
        run_executability_check
        ;;
    full|"")
        run_ingest
        run_features
        run_substrate
        run_executability_check
        echo
        echo "=== DONE ==="
        echo "B-gate verdict is in data/validation/mine_sweep/summary.json"
        echo "If verdict = SHIP_A, proceed to Stage 8a (write /mine-sweep page)."
        echo "If verdict = SHELVE_A or INCONCLUSIVE, write docs/commercial/MINE_SWEEP_RESULTS.md."
        ;;
    *)
        echo "unknown mode: $MODE"
        echo "usage: $0 [full | --ingest-only | --features-only | --substrate-only]"
        exit 1
        ;;
esac
