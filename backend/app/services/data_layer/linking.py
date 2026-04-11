"""Four-signal causal linker.

All four signals wired:

  * ``link_by_cosine`` — dot product on L2-normalized 8D coords.
  * ``link_by_foreign_key`` — exact match on known identifier fields
    (cik, pmid, patent_id, doi, isin, hs_code, gene_symbol, ...).
  * ``link_by_semantic_field`` — exact match on known domain fields
    (company_name, author_name, industry, country, year, ...).
  * ``link_by_url_hierarchy`` — same scheme + host + first path segment
    on any attribute whose value looks like a URL.

Design notes:
  * Cosine runs on the *8D unit-sphere coordinates*, not the 384D raw
    embeddings. The 8D random projection from ``btut.pipeline`` is
    variance-preserving (Johnson–Lindenstrauss), so cosine similarity
    in 8D is a reasonable proxy for 384D similarity. This avoids any
    change to ``btut.pipeline``.
  * Foreign-key and semantic-field use *positive* allowlists rather
    than skip lists. Allowlists fail closed: if a new adapter adds a
    noisy attribute, the linker ignores it until we add it here.
  * All four signals scan the ``entity["attributes"]`` dict of the raw
    BTUT survivor records (not the typed ``Survivor`` dataclass), so
    this module stays independent of ``types.Survivor``'s shape.
"""
from __future__ import annotations

from urllib.parse import urlparse

import numpy as np

from .types import CausalLink


# Known identifier fields across adapters. Exact match on any of these
# is a strong cross-source signal. Keep lowercase; lookup is case-sensitive.
FOREIGN_KEY_FIELDS: frozenset[str] = frozenset({
    # Finance / EDGAR
    "cik", "ticker", "isin", "cusip", "company_cik",
    # PubMed
    "pmid", "mesh_id", "gene_symbol", "doi",
    # Patents
    "patent_id", "patent_number", "assignee_id",
    # Comtrade
    "hs_code", "country_code", "reporter_code", "partner_code",
    # Generic
    "uuid", "id", "external_id",
})


# Known domain fields that carry meaningful cross-source signal when
# they match exactly. Weaker than foreign keys (strength 0.8 vs 1.0).
SEMANTIC_FIELDS: frozenset[str] = frozenset({
    # Organizations
    "company_name", "assignee", "assignee_name", "organization",
    # People
    "author_name", "inventor", "author",
    # Scientific / taxonomic
    "organism", "gene_name", "protein",
    # Geographic
    "state", "country", "region", "city",
    # Temporal
    "year", "pub_year", "filing_year",
    # Classification
    "industry", "sic", "sector", "ipc_class",
    "affiliation", "journal",
})


def _normalize_value(v: object) -> str:
    """Normalize an attribute value for comparison. Returns empty for
    values that are too trivial to link on (empty string, ``"0"``,
    numeric zero, None)."""
    if v is None:
        return ""
    if isinstance(v, (int, float)):
        if v == 0:
            return ""
        return str(v)
    if isinstance(v, str):
        s = v.strip()
        if not s or s in {"0", "00", "000", "null", "none", "na", "n/a"}:
            return ""
        return s.lower()
    return str(v).strip().lower()


def _entity_attrs(survivor: dict) -> dict:
    """Return ``survivor["entity"]["attributes"]`` with safe fallbacks."""
    ent = survivor.get("entity") or {}
    attrs = ent.get("attributes") or {}
    return attrs if isinstance(attrs, dict) else {}


def _entity_name(survivor: dict) -> str:
    return str((survivor.get("entity") or {}).get("name", ""))


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
    """Exact match on known identifier fields.

    For each survivor in A, index (key, normalized_value) → name for
    every identifier attribute in ``FOREIGN_KEY_FIELDS``. Then scan B
    for matching (key, value). Every hit is a link with strength 1.0
    (exact identifier match is the strongest possible non-semantic
    signal).

    O(n_a + n_b) via a dict index.
    """
    # Build (key, value) → list[name_a] index over A.
    index: dict[tuple[str, str], list[str]] = {}
    for s in survivors_a:
        attrs = _entity_attrs(s)
        name = _entity_name(s)
        for k in FOREIGN_KEY_FIELDS:
            if k not in attrs:
                continue
            v = _normalize_value(attrs[k])
            if not v:
                continue
            index.setdefault((k, v), []).append(name)

    links: list[CausalLink] = []
    for s_b in survivors_b:
        attrs = _entity_attrs(s_b)
        name_b = _entity_name(s_b)
        for k in FOREIGN_KEY_FIELDS:
            if k not in attrs:
                continue
            v = _normalize_value(attrs[k])
            if not v:
                continue
            for name_a in index.get((k, v), ()):
                links.append(
                    CausalLink(
                        source_a=name_a,
                        source_b=name_b,
                        signal="foreign_key",
                        strength=1.0,
                    )
                )
    return links


def link_by_semantic_field(
    survivors_a: list[dict],
    survivors_b: list[dict],
) -> list[CausalLink]:
    """Exact match on known domain fields (author, company, year, ...).

    Same index-based strategy as ``link_by_foreign_key``, but keyed on
    ``SEMANTIC_FIELDS`` and with strength 0.8 — meaningful but weaker
    than an identifier match (e.g. two different papers can share
    ``author_name`` without being the same entity).
    """
    index: dict[tuple[str, str], list[str]] = {}
    for s in survivors_a:
        attrs = _entity_attrs(s)
        name = _entity_name(s)
        for k in SEMANTIC_FIELDS:
            if k not in attrs:
                continue
            v = _normalize_value(attrs[k])
            if not v:
                continue
            index.setdefault((k, v), []).append(name)

    links: list[CausalLink] = []
    for s_b in survivors_b:
        attrs = _entity_attrs(s_b)
        name_b = _entity_name(s_b)
        for k in SEMANTIC_FIELDS:
            if k not in attrs:
                continue
            v = _normalize_value(attrs[k])
            if not v:
                continue
            for name_a in index.get((k, v), ()):
                links.append(
                    CausalLink(
                        source_a=name_a,
                        source_b=name_b,
                        signal="semantic_field",
                        strength=0.8,
                    )
                )
    return links


def _url_prefix_key(url: str) -> tuple[str, str, str] | None:
    """Parse a URL into (scheme, host, first_path_segment).

    Returns None if the value doesn't parse as a URL with an http(s)
    scheme. Used as the linker's "same section of same site" key.
    """
    try:
        p = urlparse(url)
    except Exception:
        return None
    if p.scheme not in ("http", "https") or not p.netloc:
        return None
    # First non-empty path segment, or "" if path is just "/".
    segs = [s for s in p.path.split("/") if s]
    first = segs[0].lower() if segs else ""
    return (p.scheme, p.netloc.lower(), first)


def link_by_url_hierarchy(
    survivors_a: list[dict],
    survivors_b: list[dict],
) -> list[CausalLink]:
    """Match survivors that share (scheme, host, first path segment).

    Scans every attribute value of every survivor. Attributes whose
    value parses as an http(s) URL contribute their URL prefix key to
    an index; hits on the B side become links with strength 0.7.
    """
    index: dict[tuple[str, str, str], list[str]] = {}
    for s in survivors_a:
        name = _entity_name(s)
        attrs = _entity_attrs(s)
        for v in attrs.values():
            if not isinstance(v, str):
                continue
            key = _url_prefix_key(v)
            if key is None:
                continue
            index.setdefault(key, []).append(name)

    links: list[CausalLink] = []
    for s_b in survivors_b:
        name_b = _entity_name(s_b)
        attrs = _entity_attrs(s_b)
        for v in attrs.values():
            if not isinstance(v, str):
                continue
            key = _url_prefix_key(v)
            if key is None:
                continue
            for name_a in index.get(key, ()):
                links.append(
                    CausalLink(
                        source_a=name_a,
                        source_b=name_b,
                        signal="url_hierarchy",
                        strength=0.7,
                    )
                )
    return links


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
