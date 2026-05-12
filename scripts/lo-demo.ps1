# scripts/lo-demo.ps1 — PowerShell wrapper for the live `lo demo` gauntlet.
#
# Usage:
#     .\scripts\lo-demo.ps1                       # full live TUI gauntlet
#     .\scripts\lo-demo.ps1 rehearse              # headless pre-flight check
#     .\scripts\lo-demo.ps1 client <path>         # and-now-yours
#     .\scripts\lo-demo.ps1 replay --cloud        # cloud-replay hash-match tail
#
# Anchors PYTHONPATH to the local checkout so the lo CLI, the ocean_cli
# package, and the vendored OCEAN runtime are all importable without
# `pip install`.

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONPATH = "$RepoRoot\cli;$RepoRoot\packages\ocean-cli\src;$RepoRoot\packages\ocean-cli\src\ocean_cli\_vendored"

python -m lo.main demo @args
