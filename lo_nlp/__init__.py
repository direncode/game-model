"""Latent Ocean NLP stack.

Three capabilities, all optional enhancements to the deterministic
substrate:

    resolve.py   — open-ended entity resolution (retrieval-augmented)
    narrative.py — per-finding narrative enhancement (LLM-backed)
    playbook.py  — per-vertical playbook authoring (data-conditioned)

Every layer has a deterministic fallback so the substrate remains
operational when NLP dependencies are unavailable (air-gap mode).
"""

__version__ = "0.1.0"

from lo_nlp.resolve import (
    Resolver,
    ResolverResult,
    hybrid_resolve,
    load_default_ontologies,
)

__all__ = ["Resolver", "ResolverResult", "hybrid_resolve", "load_default_ontologies"]
