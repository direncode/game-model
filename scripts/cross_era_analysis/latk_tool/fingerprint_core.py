"""Shared LATK fingerprint / query-embedding primitives.

Both the BTUT pipeline and the LATK query tools need to embed text into the
same geometric space. Phase 0 put a placeholder blake2b hash in
``latk_tool.query.novelty.fingerprint_text`` that did not share a space with
the pipeline's actual 48-bit fingerprints. This module is the Phase 1 fix.

Design
------
The honest upgrade from the Phase 0 stand-in is not "compute a bit-identical
48-bit fingerprint for an isolated query" — the pipeline's 48-bit
fingerprints are a function of each entity's rank *relative to the full
corpus*, which is impossible to reproduce from a single text in isolation.

Instead, this module exposes the one geometric object that is well-defined
for an isolated query: the **8D embedding** produced by the pipeline's
``EntityEmbedder`` → ``random_project`` chain. Every piece of stochastic
state in that chain is either seed-deterministic (the JL projection
matrices) or corpus-dependent and small enough to persist (the
``_type_vocab`` and the ``NumericProjector`` means/stds).

``EmbedContext`` captures exactly that state; ``embed_query_to_8d`` uses it
to project an arbitrary query text into the same 8D space the lattice lives
in. Ranking lattice entries by Euclidean distance in 8D is strictly more
faithful than Hamming distance in the lossy 48-bit hash.

This module also preserves the Phase 0 ``fingerprint_text`` function under
the legacy name so that old code paths keep working.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np


FINGERPRINT_BITS = 48
EMBED_8D = 8


# ---------------------------------------------------------------------------
# EmbedContext — persisted per-lattice state
# ---------------------------------------------------------------------------

@dataclass
class EmbedContext:
    """State required to embed a new query into an existing lattice's 8D space.

    All four fields are small — a full EmbedContext for a 6000-entity lattice
    is under 5 KB. This is dumped alongside the BTUT result JSON so the query
    tools can reproduce the exact same geometric projection for arbitrary
    query text.

    Fields
    ------
    type_vocab : dict[str, int]
        The ``EntityEmbedder._type_vocab`` built during corpus embedding.
        Maps entity type names to one-hot indices.

    numeric_means : list[float] | None
        Per-numeric-feature means from ``NumericProjector.fit``. None if
        the corpus had no numeric attributes.

    numeric_stds : list[float] | None
        Per-numeric-feature stds from ``NumericProjector.fit``. None if
        the corpus had no numeric attributes.

    numeric_keys : list[str]
        The ordered list of numeric attribute keys discovered during corpus
        embedding. Required so a query's numeric matrix has the same column
        layout as the corpus's.

    embedding_dim : int
        The full (pre-projection) embedding dim from ``BTUTConfig``. Usually
        32.

    projection_seed : int
        Seed for the 32D → 8D JL projection (``random_project``). Fixed at
        42 by the current pipeline.

    embedder_seed : int
        Seed used across all four sub-projectors in ``EntityEmbedder``.
        Fixed at 42 by the current pipeline.
    """

    type_vocab: Dict[str, int]
    numeric_means: Optional[List[float]]
    numeric_stds: Optional[List[float]]
    numeric_keys: List[str]
    embedding_dim: int
    projection_seed: int = 42
    embedder_seed: int = 42

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type_vocab": dict(self.type_vocab),
            "numeric_means": list(self.numeric_means) if self.numeric_means is not None else None,
            "numeric_stds": list(self.numeric_stds) if self.numeric_stds is not None else None,
            "numeric_keys": list(self.numeric_keys),
            "embedding_dim": int(self.embedding_dim),
            "projection_seed": int(self.projection_seed),
            "embedder_seed": int(self.embedder_seed),
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "EmbedContext":
        return cls(
            type_vocab=dict(d.get("type_vocab", {})),
            numeric_means=list(d["numeric_means"]) if d.get("numeric_means") is not None else None,
            numeric_stds=list(d["numeric_stds"]) if d.get("numeric_stds") is not None else None,
            numeric_keys=list(d.get("numeric_keys", [])),
            embedding_dim=int(d.get("embedding_dim", 32)),
            projection_seed=int(d.get("projection_seed", 42)),
            embedder_seed=int(d.get("embedder_seed", 42)),
        )


# ---------------------------------------------------------------------------
# Lattice loading with 8D survivor embeddings
# ---------------------------------------------------------------------------

@dataclass
class LatticeSurvivor:
    entity_name: str
    entity_type: str
    cluster: str
    fingerprint_bits: str
    composite: float
    era: str
    embedding_8d: Optional[np.ndarray] = None


@dataclass
class LatticeV2:
    """Post-Phase-1 lattice: survivors + EmbedContext + 8D matrix.

    ``embeddings_8d`` is the (S, 8) float32 array of survivor 8D positions.
    ``None`` if the lattice is a legacy Phase 0 result without the embed
    context — in that case fall back to Hamming distance in the 48-bit
    fingerprint space.
    """

    survivors: List[LatticeSurvivor]
    embeddings_8d: Optional[np.ndarray]
    embed_context: Optional[EmbedContext]
    by_cluster: Dict[str, List[int]] = field(default_factory=dict)
    source_path: Optional[str] = None

    @property
    def size(self) -> int:
        return len(self.survivors)

    @property
    def has_v2(self) -> bool:
        return self.embeddings_8d is not None and self.embed_context is not None


def _era_for_entity_name(name: str) -> str:
    lname = name.lower()
    parts = lname.split("__")
    if parts and parts[0].startswith("latk_") and len(parts) > 1:
        parts = parts[1:]
    joined = "__".join(parts)
    historical_prefixes = (
        "historical_", "ancient_", "medieval_", "classical_",
        "panini_", "portroyal_", "humboldt_", "saussure_",
        "newton_", "leonardo_", "vonneumann_", "tesla_", "shannon_",
    )
    modern_markers = (
        "modern_", "arxiv_", "uspto_", "contemporary_",
        "transformer", "distributional", "chomsky", "bnf",
    )
    if joined.startswith("historical_") or "__historical_" in joined:
        return "historical"
    if joined.startswith("modern_") or "__modern_" in joined:
        return "modern"
    if any(joined.startswith(p) for p in historical_prefixes):
        return "historical"
    if any(m in joined for m in modern_markers):
        return "modern"
    return "unknown"


def _parse_entity_blob(entity_str: str) -> Tuple[str, str]:
    """Legacy parser for string-encoded entity blobs in old BTUT results."""
    import ast
    try:
        d = ast.literal_eval(entity_str)
        if isinstance(d, dict):
            return (str(d.get("name", "<unknown>")), str(d.get("type", "<unknown>")))
    except (ValueError, SyntaxError):
        pass
    m = re.search(r"'name':\s*'([^']+)'", entity_str)
    t = re.search(r"'type':\s*'([^']+)'", entity_str)
    return (m.group(1) if m else "<unknown>", t.group(1) if t else "<unknown>")


def load_lattice_v2(btut_result_path: str | Path) -> LatticeV2:
    """Load a BTUT result, recognizing both Phase 0 (legacy) and Phase 1 (v2) formats.

    Phase 1 format adds two top-level keys to the result JSON:
    - ``embed_context``: serialized EmbedContext
    - ``embeddings_8d``: flat list of S*8 floats (row-major survivor 8D coords)
    """
    path = Path(btut_result_path)
    with path.open("r", encoding="utf-8") as fp:
        data = json.load(fp)

    survivors_raw = data.get("survivors", [])
    survivors: List[LatticeSurvivor] = []

    for s in survivors_raw:
        entity_blob = s.get("entity", "")
        scores_blob = s.get("scores", "")
        if isinstance(entity_blob, dict):
            name = str(entity_blob.get("name", "<unknown>"))
            etype = str(entity_blob.get("type", "<unknown>"))
        else:
            name, etype = _parse_entity_blob(str(entity_blob))

        if isinstance(scores_blob, dict):
            composite = float(scores_blob.get("composite", 0.0))
        else:
            import ast
            try:
                d = ast.literal_eval(str(scores_blob))
                composite = float(d.get("composite", 0.0)) if isinstance(d, dict) else 0.0
            except (ValueError, SyntaxError):
                composite = 0.0

        fingerprint = str(s.get("fingerprint_48bit", "")).strip()
        cluster = str(s.get("cluster", "?"))

        survivors.append(
            LatticeSurvivor(
                entity_name=name,
                entity_type=etype,
                cluster=cluster,
                fingerprint_bits=fingerprint,
                composite=composite,
                era=_era_for_entity_name(name),
            )
        )

    # v2 fields
    embeddings_8d: Optional[np.ndarray] = None
    embed_context: Optional[EmbedContext] = None

    if "embeddings_8d" in data and data["embeddings_8d"]:
        flat = np.asarray(data["embeddings_8d"], dtype=np.float32)
        if flat.ndim == 1 and flat.size % EMBED_8D == 0:
            embeddings_8d = flat.reshape(-1, EMBED_8D)
        elif flat.ndim == 2 and flat.shape[1] == EMBED_8D:
            embeddings_8d = flat.astype(np.float32)
        if embeddings_8d is not None and embeddings_8d.shape[0] != len(survivors):
            embeddings_8d = None  # shape mismatch; fall back

    if "embed_context" in data and data["embed_context"]:
        try:
            embed_context = EmbedContext.from_dict(data["embed_context"])
        except Exception:
            embed_context = None

    if embeddings_8d is not None:
        for i, srv in enumerate(survivors):
            srv.embedding_8d = embeddings_8d[i]

    by_cluster: Dict[str, List[int]] = {}
    for i, srv in enumerate(survivors):
        by_cluster.setdefault(srv.cluster, []).append(i)

    return LatticeV2(
        survivors=survivors,
        embeddings_8d=embeddings_8d,
        embed_context=embed_context,
        by_cluster=by_cluster,
        source_path=str(path),
    )


# ---------------------------------------------------------------------------
# Query embedding — the Phase 1 replacement for standalone blake2b hashing
# ---------------------------------------------------------------------------

def embed_query_to_8d(query_text: str, context: EmbedContext) -> np.ndarray:
    """Project an arbitrary text query into the same 8D space as the lattice.

    This uses the same deterministic projection chain the BTUT pipeline uses,
    parametrized by the persisted ``EmbedContext`` state so query embeddings
    live in the exact same geometric space as lattice survivors.

    The BTUT pipeline is the source of truth for the embedder code. We don't
    reimplement it here — we import it lazily so this module keeps working
    even when run outside the backend package (e.g. in standalone research
    scripts on a laptop without the backend installed).

    Fallback
    --------
    If the backend package is not importable, we degrade to a pure-numpy
    reimplementation of just the text channel of the embedder. That is
    enough to put a text-only query into an approximate 8D neighborhood for
    research-tool use but will not match lattice coordinates bit-exactly.
    """
    try:
        from app.services.btut.config import BTUTConfig  # type: ignore
        from app.services.btut.embedder import EntityEmbedder  # type: ignore
        from app.services.btut.streaming import random_project  # type: ignore

        config = BTUTConfig.auto_scale(max(1, len(query_text)), 50.0)
        config.embedding_dim = context.embedding_dim
        embedder = EntityEmbedder(config)
        # Seed the embedder with the persisted type_vocab so entity-type
        # one-hot channels match the lattice's type slots. For a single
        # text query we use type "_query_" which will fall into the "other"
        # bucket — the same bucket any unseen-type query would.
        embedder._type_vocab = dict(context.type_vocab)

        # Seed the numeric projector's fit state so the query's (empty)
        # numeric row is normalized against the same baseline.
        if (
            context.numeric_means is not None
            and context.numeric_stds is not None
            and embedder.numeric_proj is not None
        ):
            embedder.numeric_proj._means = np.asarray(context.numeric_means, dtype=np.float32)
            embedder.numeric_proj._stds = np.asarray(context.numeric_stds, dtype=np.float32)
            # Build the projection matrix deterministically from the seed
            input_dim = len(context.numeric_means)
            rng = np.random.RandomState(embedder.numeric_proj.seed)
            proj = rng.randn(input_dim, embedder.numeric_proj.output_dim).astype(np.float32)
            proj /= np.sqrt(embedder.numeric_proj.output_dim)
            embedder.numeric_proj._projection = proj

        query_entity = {"name": query_text[:200], "type": "_query_", "attributes": {}}
        emb_full = embedder.embed([query_entity], edges=[])
        emb_8d = random_project(emb_full, EMBED_8D, seed=context.projection_seed)
        return emb_8d[0].astype(np.float32)
    except ImportError:
        return _fallback_embed_query_8d(query_text, context)


def _fallback_embed_query_8d(query_text: str, context: EmbedContext) -> np.ndarray:
    """Pure-numpy text-only embedding path for environments without the backend.

    Reimplements TextProjector + random_project with the same seeds. Output is
    an 8D unit vector in the *text channel* subspace — it will not overlap
    perfectly with full-pipeline 8D vectors but will cluster text-similar
    queries near text-similar survivors, which is the minimum useful property.
    """
    hash_dim = 2048
    rng = np.random.RandomState(context.embedder_seed)
    text_proj = rng.randn(hash_dim, 8).astype(np.float32) / np.sqrt(8)

    hashed = np.zeros(hash_dim, dtype=np.float32)
    tokens = [t for t in re.findall(r"[A-Za-z][A-Za-z0-9_\-]+", query_text.lower()) if len(t) > 2]
    for tok in tokens:
        h = hashlib.md5(tok.encode("utf-8")).digest()
        idx = int.from_bytes(h[:4], "little") % hash_dim
        sign = 1 if (h[4] & 1) else -1
        hashed[idx] += sign

    norm = float(np.linalg.norm(hashed))
    if norm > 0:
        hashed /= norm

    emb_text = hashed @ text_proj  # (8,)

    # Place into the full embedding_dim (pad) then JL-project to 8
    full = np.zeros((1, context.embedding_dim), dtype=np.float32)
    full[0, :8] = emb_text
    rng2 = np.random.RandomState(context.projection_seed)
    proj = rng2.randn(context.embedding_dim, EMBED_8D).astype(np.float32) / np.sqrt(EMBED_8D)
    out = full @ proj
    n = float(np.linalg.norm(out[0]))
    if n > 0:
        out[0] /= n
    return out[0]


# ---------------------------------------------------------------------------
# Legacy 48-bit fingerprint (Phase 0 stand-in, preserved for fallback)
# ---------------------------------------------------------------------------

def fingerprint_text_legacy(text: str) -> str:
    """Phase 0 blake2b stand-in. Preserved for legacy lattice compatibility.

    If a lattice file lacks ``embed_context`` / ``embeddings_8d`` (i.e. a
    Phase 0 result), the novelty query falls back to this hash + Hamming
    distance in the 48-bit space.
    """
    tokens = [w for w in re.findall(r"[A-Za-z][A-Za-z0-9_\-]+", text.lower()) if len(w) > 2]
    if not tokens:
        return "0" * FINGERPRINT_BITS
    step = max(1, 15 // 2)
    chunks = [tokens[i:i + 15] for i in range(0, max(1, len(tokens) - 15 + 1), step)]
    acc = 0
    for c in chunks:
        joined = " ".join(sorted(set(c)))
        h = hashlib.blake2b(joined.encode("utf-8"), digest_size=6).digest()
        acc |= int.from_bytes(h, "big") & ((1 << FINGERPRINT_BITS) - 1)
    return bin(acc)[2:].rjust(FINGERPRINT_BITS, "0")[-FINGERPRINT_BITS:]


def hamming_distance(a: str, b: str) -> int:
    if len(a) != len(b):
        return max(len(a), len(b))
    return sum(x != y for x, y in zip(a, b))


# ---------------------------------------------------------------------------
# Nearest-neighbor retrieval in 8D
# ---------------------------------------------------------------------------

def rank_lattice_by_8d(
    query_8d: np.ndarray,
    lattice: LatticeV2,
    top_k: int = 20,
) -> List[Tuple[int, float]]:
    """Rank lattice survivors by Euclidean distance in 8D.

    Returns a list of (survivor_index, distance) tuples, sorted ascending.
    Requires ``lattice.has_v2 == True``.
    """
    if not lattice.has_v2 or lattice.embeddings_8d is None:
        raise ValueError(
            "rank_lattice_by_8d requires a v2 lattice (embed_context + embeddings_8d)."
        )
    diffs = lattice.embeddings_8d - query_8d[np.newaxis, :]
    dists = np.sqrt(np.einsum("ij,ij->i", diffs, diffs))
    order = np.argsort(dists)
    top = order[:top_k]
    return [(int(i), float(dists[i])) for i in top]


def rank_lattice_by_hamming(
    query_text: str,
    lattice: LatticeV2,
    top_k: int = 20,
) -> List[Tuple[int, int]]:
    """Legacy fallback: rank survivors by Hamming distance in the 48-bit space."""
    query_fp = fingerprint_text_legacy(query_text)
    scored = []
    for i, srv in enumerate(lattice.survivors):
        if not srv.fingerprint_bits:
            scored.append((i, FINGERPRINT_BITS))
            continue
        scored.append((i, hamming_distance(query_fp, srv.fingerprint_bits)))
    scored.sort(key=lambda x: (x[1], -lattice.survivors[x[0]].composite))
    return scored[:top_k]
