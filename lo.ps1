# PowerShell wrapper for the Latent Ocean CLI. Drop this on your PATH
# or call by full path. Avoids the pip-install + hatchling dance.
#
# Usage:
#   C:\Users\diren\Desktop\lsx-latentocean\lo.ps1 cmd
#   C:\Users\diren\Desktop\lsx-latentocean\lo.ps1 demo
#   C:\Users\diren\Desktop\lsx-latentocean\lo.ps1 --help
#
# $PSScriptRoot is PowerShell's analogue of CMD's %~dp0 — the directory
# this script lives in.

$env:PYTHONPATH = "$PSScriptRoot\cli;$env:PYTHONPATH"
& python -m lo @args
