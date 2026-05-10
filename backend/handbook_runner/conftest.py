"""Pytest configuration for handbook_runner tests.

Adds the repo root to sys.path so that ``from backend.handbook_runner.x``
imports resolve even when there is no top-level ``backend`` package marker.
"""
from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
