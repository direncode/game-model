"""Shared pytest setup.

Pinning the seed-affecting env vars BEFORE the CLI imports anything so
the tests behave identically under fresh-cache and re-run conditions.
Also makes sure the parent ``cli`` directory is on sys.path so plain
``pytest`` from the repo root finds the ``lo`` package without the
caller having to ``pip install -e cli``.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Pin numerical-runtime env vars before any operator import.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

CLI_ROOT = Path(__file__).resolve().parents[1]
if str(CLI_ROOT) not in sys.path:
    sys.path.insert(0, str(CLI_ROOT))
