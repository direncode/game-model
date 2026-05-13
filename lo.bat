@echo off
REM Single-file wrapper that runs the Latent Ocean CLI without needing
REM pip install. Drop this on your PATH or call it by full path.
REM
REM Usage from any plain Windows CMD:
REM   C:\Users\diren\Desktop\lsx-latentocean\lo.bat cmd
REM   C:\Users\diren\Desktop\lsx-latentocean\lo.bat demo
REM   C:\Users\diren\Desktop\lsx-latentocean\lo.bat --help
REM
REM %~dp0 resolves to the directory this .bat lives in (with trailing
REM backslash), so the wrapper finds `cli/` no matter where it is run from.

setlocal
set "REPO_ROOT=%~dp0"
set "PYTHONPATH=%REPO_ROOT%cli;%PYTHONPATH%"
python -m lo %*
endlocal
