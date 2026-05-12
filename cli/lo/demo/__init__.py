"""`lo demo` — the live Latent Ocean gauntlet for highest-tier client demos.

Five wildly different corpora, one canonical OCEAN program, eight verbs.
Local execution with a cloud-replay tail that proves byte-identical
artifacts across machines.

Entry points are wired into cli/lo/main.py.
"""
from __future__ import annotations

from pathlib import Path

DEMO_ROOT = Path(__file__).parent
CORPORA_ROOT = DEMO_ROOT / "corpora"
PROGRAM_FREE = DEMO_ROOT / "program.ocean"
PROGRAM_PRO = DEMO_ROOT / "program_pro.ocean"

CORPUS_ORDER = ["patents", "edgar", "docsouth", "arxiv", "substrate"]

__all__ = [
    "DEMO_ROOT",
    "CORPORA_ROOT",
    "PROGRAM_FREE",
    "PROGRAM_PRO",
    "CORPUS_ORDER",
]
