"""lo_core — Latent Ocean core engine.

Self-contained, deterministic structural discovery pipeline.
No external GenAI on the critical path. Fine-tuning is additive, never core.

Public API:
    from lo_core import analyze_corpus, validate_corpora, Findings

    findings = analyze_corpus(survivors, role_map=None)          # -> Findings
    report   = validate_corpora({"corp_a": survivors_a, ...})    # -> ValidationReport
"""
from __future__ import annotations

__version__ = "0.1.0"

from lo_core.analyze import analyze_corpus
from lo_core.generators import Generator, TemplateGenerator
from lo_core.schemas import (
    ConvergenceEntry,
    CrossEraAnchor,
    Findings,
    ParadigmHypothesis,
    TripleBridge,
    ValidationReport,
)
from lo_core.validate import validate_corpora

__all__ = [
    "__version__",
    "analyze_corpus",
    "validate_corpora",
    "Findings",
    "ValidationReport",
    "ParadigmHypothesis",
    "CrossEraAnchor",
    "ConvergenceEntry",
    "TripleBridge",
    "Generator",
    "TemplateGenerator",
]
