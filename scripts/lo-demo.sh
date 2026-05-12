#!/usr/bin/env bash
# scripts/lo-demo.sh — one-stop wrapper for the live `lo demo` gauntlet.
#
# Usage:
#     ./scripts/lo-demo.sh                       # full live TUI gauntlet
#     ./scripts/lo-demo.sh rehearse              # headless pre-flight check
#     ./scripts/lo-demo.sh client <path>         # and-now-yours
#     ./scripts/lo-demo.sh replay --cloud        # cloud-replay hash-match tail
#
# Anchors PYTHONPATH to the local checkout so the lo CLI, the ocean_cli
# package, and the vendored OCEAN runtime are all importable without a
# `pip install`. Works from any directory the user happens to be in.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

export PYTHONIOENCODING=utf-8

# Use relative paths so the wrapper works the same on Windows (where bash
# uses /c/Users/... paths that Windows Python cannot read) and on Unix.
# CWD is the repo root from the `cd` above.
export PYTHONPATH="cli;packages/ocean-cli/src;packages/ocean-cli/src/ocean_cli/_vendored"

exec python -m lo.main demo "$@"
