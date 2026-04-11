"""Four-signal causal linker scaffold.

Cosine is fully wired. Foreign-key / semantic-field / URL-hierarchy are
stubs returning an empty list. Stubs establish the interface for later
expansion without changing callers.

Design note: cosine linking runs on the *8D unit-sphere coordinates*
(not the 384D raw embeddings). The 8D random projection from
``btut.pipeline`` is variance-preserving (Johnson–Lindenstrauss), so
cosine similarity in 8D is a reasonable proxy for 384D similarity —
and this avoids any change to ``btut.pipeline``. If fidelity is ever
insufficient, a future option can be added to re-embed survivors at
384D for linking only.
"""
from __future__ import annotations

import numpy as np

from .types import CausalLink


def link_by_cosine(
    survivors_a: list[dict],
    embeds_a_8d_unit: np.ndarray,
    survivors_b: list[dict],
    embeds_b_8d_unit: np.ndarray,
    threshold: float = 0.75,
) -> list[CausalLink]:
    """Cosine similarity on L2-normalized 8D coords.

    Since both matrices are already unit-norm, cosine == dot product,
    so we use a single matmul. O(n_a * n_b). For the typical
    300-survivor case this is a 300×300 matrix — cheap.
    """
    a = np.asarray(embeds_a_8d_unit, dtype=np.float32)
    b = np.asarray(embeds_b_8d_unit, dtype=np.float32)
    if a.size == 0 or b.size == 0:
        return []

    sims = a @ b.T  # (n_a, n_b)
    hits = np.argwhere(sims >= threshold)
    return [
        CausalLink(
            source_a=survivors_a[i]["entity"]["name"],
            source_b=survivors_b[j]["entity"]["name"],
            signal="cosine",
            strength=float(sims[i, j]),
        )
        for i, j in hits
    ]


def link_by_foreign_key(
    survivors_a: list[dict],
    survivors_b: list[dict],
) -> list[CausalLink]:
    """STUB. Will compare attribute keys like ``cik``, ``pmid``,
    ``patent_id`` across both sides. Returns [] in MVP."""
    return []


def link_by_semantic_field(
    survivors_a: list[dict],
    survivors_b: list[dict],
) -> list[CausalLink]:
    """STUB. Will match shared semantic fields (author, company, year).
    Returns [] in MVP."""
    return []


def link_by_url_hierarchy(
    survivors_a: list[dict],
    survivors_b: list[dict],
) -> list[CausalLink]:
    """STUB. Will compare URL path prefixes for overlapping domains.
    Returns [] in MVP."""
    return []


def link_all(
    survivors_a: list[dict],
    embeds_a_8d_unit: np.ndarray,
    survivors_b: list[dict],
    embeds_b_8d_unit: np.ndarray,
    cosine_threshold: float = 0.75,
) -> list[CausalLink]:
    """Run all four signals, concatenate results."""
    return [
        *link_by_cosine(
            survivors_a, embeds_a_8d_unit,
            survivors_b, embeds_b_8d_unit,
            threshold=cosine_threshold,
        ),
        *link_by_foreign_key(survivors_a, survivors_b),
        *link_by_semantic_field(survivors_a, survivors_b),
        *link_by_url_hierarchy(survivors_a, survivors_b),
    ]
