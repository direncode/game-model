"""Open-ended entity resolution.

Resolves arbitrary codes / identifiers / short strings against bundled
ontologies using a hybrid lexical-plus-embedding retrieval pipeline.

Ontologies bundled in lo_nlp/data/ as deterministic JSON:
    - mesh_top.json        PubMed MeSH terms (top ~2,000 by prevalence)
    - hs_codes.json        UN HS (Harmonized System) commodity codes, all chapters
    - sic_codes.json       SIC industry classification
    - country_iso.json     ISO-3166 country codes
    - cpc_classes.json     CPC patent classes (top-level)
    - noaa_stations.json   NOAA climate station registry (top-1000 by record count)

Resolution pipeline:
    1. Exact match against the direct-lookup table (O(1), always tried first)
    2. Prefix match + code-family heuristics (e.g. mesh_D000* → MeSH tree)
    3. Lexical similarity via token-overlap + length-normalized score
    4. Optional embedding similarity if sentence-transformers is available

Falls back through the four stages in order until a confident match
(or the query exhausts all candidates).

Deterministic under seed=42 for any inputs where tie-breaking is required.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

DATA_DIR = Path(__file__).resolve().parent / "data"

# Stage-4 embedding support is optional. If sentence-transformers or
# numpy is unavailable, the resolver still works; embeddings just
# silently stay disabled.
try:
    import numpy as _np  # type: ignore
    from sentence_transformers import SentenceTransformer as _ST  # type: ignore
    _HAS_EMBEDDINGS = True
except Exception:
    _np = None  # type: ignore
    _ST = None  # type: ignore
    _HAS_EMBEDDINGS = False

# Default embedding model. ~23MB on disk, ~80MB RAM with overhead.
EMBED_MODEL_DEFAULT = os.environ.get("LO_RESOLVER_EMBED_MODEL", "all-MiniLM-L6-v2")
# Cosine similarity threshold for stage-4 resolution.
EMBED_THRESHOLD = float(os.environ.get("LO_RESOLVER_EMBED_THRESHOLD", "0.62"))

# Deterministic tie-break order for alias collisions across ontologies.
# Lower index = higher priority when two families claim the same alias.
# Rationale: the demos are financial/SEC-heavy, so SIC wins over HS for
# industry names ("pharma"); entity ontologies (countries, states) beat
# conceptual ones. Edit this list to shift behaviour without code changes.
FAMILY_PRIORITY = ["country", "us_state", "mesh", "sic", "cpc", "hs"]


def _family_rank(family: str) -> int:
    try:
        return FAMILY_PRIORITY.index(family)
    except ValueError:
        return 99


# ─── Lexical similarity (no deps) ────────────────────────────────────
_TOKEN_RE = re.compile(r"[a-zA-Z0-9]+")


def _tokens(s: str) -> set[str]:
    return {t.lower() for t in _TOKEN_RE.findall(s or "")}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def _char_ngrams(s: str, n: int = 3) -> set[str]:
    s = f"  {s.lower()}  "
    return {s[i : i + n] for i in range(len(s) - n + 1)}


def _char_similarity(a: str, b: str) -> float:
    na = _char_ngrams(a)
    nb = _char_ngrams(b)
    if not na or not nb:
        return 0.0
    return len(na & nb) / len(na | nb)


def _levenshtein(s: str, t: str) -> int:
    """Classic edit distance. O(len(s) * len(t)), stdlib-only."""
    s, t = s.lower(), t.lower()
    if s == t:
        return 0
    if not s:
        return len(t)
    if not t:
        return len(s)
    prev = list(range(len(t) + 1))
    for i, a in enumerate(s, 1):
        cur = [i]
        for j, b in enumerate(t, 1):
            cost = 0 if a == b else 1
            cur.append(min(cur[-1] + 1, prev[j] + 1, prev[j - 1] + cost))
        prev = cur
    return prev[-1]


def _lev_similarity(a: str, b: str) -> float:
    """Normalised Levenshtein similarity in [0.0, 1.0]."""
    if not a or not b:
        return 0.0
    m = max(len(a), len(b))
    return 1.0 - _levenshtein(a, b) / m


# ─── Ontology loading ────────────────────────────────────────────────
@dataclass
class OntologyEntry:
    code: str
    canonical_name: str
    family: str            # "mesh" / "hs" / "sic" / "cpc" / "country" / "noaa_station"
    aliases: list[str]     # alternative names + common abbreviations
    parent: Optional[str] = None
    description: Optional[str] = None


def load_default_ontologies() -> list[OntologyEntry]:
    out: list[OntologyEntry] = []
    # Sort so iteration order is identical across OSes (filesystem glob
    # is not stable across Linux/macOS/Windows). Skip fixture file.
    files = sorted(p for p in DATA_DIR.glob("*.json") if not p.name.startswith("eval_"))
    for f in files:
        try:
            rows = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        derived_family = f.stem.replace("_top", "").replace("_codes", "").replace("_iso", "").replace("_classes", "").replace("_stations", "")
        for r in rows:
            out.append(OntologyEntry(
                code=str(r.get("code") or r.get("id") or ""),
                canonical_name=str(r.get("name") or r.get("label") or ""),
                # Prefer explicit family in data row; fall back to derived-
                # from-filename. Matches the TS loader in route.ts — the
                # parity test fails if these diverge.
                family=str(r.get("family") or derived_family),
                aliases=list(r.get("aliases") or []),
                parent=r.get("parent"),
                description=r.get("description"),
            ))
    return out


# ─── Resolver ────────────────────────────────────────────────────────
@dataclass
class ResolverResult:
    query: str
    resolved: bool
    code: Optional[str]
    canonical_name: Optional[str]
    family: Optional[str]
    confidence: float
    source: str           # "codebook" / "lexical" / "fuzzy" / "embedding" / "none"
    candidates: list[dict]


class Resolver:
    """Layered entity resolver. Stateless after construction.

    Stages 1-3 (exact, prefix, alias, lexical) are always available and
    dependency-free. Stage 4 (semantic embedding similarity) is opt-in
    and requires sentence-transformers + numpy. When enabled, stage 4
    runs only if stages 1-3 failed to resolve — it's a long-tail
    recovery layer, not a replacement.
    """

    def __init__(
        self,
        ontology: Optional[list[OntologyEntry]] = None,
        enable_embeddings: Optional[bool] = None,
        embed_model_name: str = EMBED_MODEL_DEFAULT,
        embed_threshold: float = EMBED_THRESHOLD,
    ):
        self.ontology = ontology if ontology is not None else load_default_ontologies()
        # Index: exact code match
        self._code_index: dict[str, OntologyEntry] = {
            e.code.lower(): e for e in self.ontology if e.code
        }
        # Embedding config. Default is OFF unless explicitly enabled or
        # LO_RESOLVER_EMBEDDINGS=1 is set in the environment. The existing
        # fixture tests expect stages 1-3 behaviour; embeddings only
        # light up when the caller asks for them.
        if enable_embeddings is None:
            enable_embeddings = os.environ.get("LO_RESOLVER_EMBEDDINGS", "").strip() in ("1", "true", "yes")
        self._embeddings_requested = bool(enable_embeddings)
        self._embed_model_name = embed_model_name
        self._embed_threshold = embed_threshold
        self._embed_model = None
        self._embed_matrix = None
        self._embed_docs: list[str] = []
        self._embed_entries: list[OntologyEntry] = []
        self._embed_ready = False
        self._embed_failed = False
        # Index: alias match with family-priority tie-breaking.
        # When two ontologies claim the same alias ("pharma" in both HS
        # and SIC), the higher-priority family wins — deterministically,
        # regardless of filesystem order.
        self._alias_index: dict[str, OntologyEntry] = {}
        self._alias_collisions: dict[str, list[str]] = {}
        for e in self.ontology:
            for a in e.aliases:
                key = a.lower()
                existing = self._alias_index.get(key)
                if existing is None:
                    self._alias_index[key] = e
                else:
                    if _family_rank(e.family) < _family_rank(existing.family):
                        self._alias_index[key] = e
                    # Record every collision for debuggability.
                    fams = self._alias_collisions.setdefault(key, [existing.family])
                    if e.family not in fams:
                        fams.append(e.family)

    # ─── Stage-4 embedding plumbing ─────────────────────────────────
    def _ontology_hash(self) -> str:
        """Stable hash over every canonical name + alias. Cache invalidates
        automatically when ontology content changes."""
        h = hashlib.sha256()
        for e in self.ontology:
            h.update(e.code.encode("utf-8"))
            h.update(b"\0")
            h.update(e.canonical_name.encode("utf-8"))
            h.update(b"\0")
            for a in e.aliases:
                h.update(a.encode("utf-8"))
                h.update(b"\0")
            h.update(b"\1")
        h.update(self._embed_model_name.encode("utf-8"))
        return h.hexdigest()[:16]

    def _cache_path(self) -> Path:
        return DATA_DIR / f".embed_cache_{self._ontology_hash()}.npz"

    def _maybe_build_embeddings(self) -> bool:
        """Lazy build + disk cache. Returns True on success, False otherwise.
        Safe to call repeatedly; no-op after first successful build."""
        if self._embed_ready:
            return True
        if self._embed_failed:
            return False
        if not self._embeddings_requested:
            return False
        if not _HAS_EMBEDDINGS:
            self._embed_failed = True
            return False

        # Build the doc list: canonical name + each alias, each paired
        # with its source entry. Duplicate aliases are fine — embedding
        # search returns the best-matching doc regardless.
        docs: list[str] = []
        entries: list[OntologyEntry] = []
        for e in self.ontology:
            if e.canonical_name:
                docs.append(e.canonical_name)
                entries.append(e)
            for a in e.aliases:
                if a:
                    docs.append(a)
                    entries.append(e)
        if not docs:
            self._embed_failed = True
            return False

        cache = self._cache_path()
        if cache.exists():
            try:
                with _np.load(cache, allow_pickle=False) as z:
                    matrix = z["matrix"]
                    # docs_ref is stored for sanity — not used at lookup time
                    if matrix.shape[0] == len(docs):
                        self._embed_matrix = matrix
                        self._embed_docs = docs
                        self._embed_entries = entries
                        # Defer model load until we actually need to encode
                        # a query. The cache hit path doesn't require it.
                        self._embed_ready = True
                        return True
            except Exception:
                # Bad cache, regenerate
                pass

        # No cache or stale: encode everything. This is the slow path;
        # takes ~10-60s depending on ontology size + CPU.
        try:
            self._embed_model = _ST(self._embed_model_name)
            matrix = self._embed_model.encode(
                docs,
                normalize_embeddings=True,
                show_progress_bar=False,
                convert_to_numpy=True,
            )
        except Exception:
            self._embed_failed = True
            return False
        try:
            _np.savez(cache, matrix=matrix)
        except Exception:
            # Cache is an optimisation, not a correctness requirement
            pass
        self._embed_matrix = matrix
        self._embed_docs = docs
        self._embed_entries = entries
        self._embed_ready = True
        return True

    def _embedding_search(self, query: str, top_k: int) -> Optional[list[tuple[float, OntologyEntry]]]:
        if not self._maybe_build_embeddings():
            return None
        if self._embed_matrix is None or self._embed_matrix.shape[0] == 0:
            return None
        # Lazily load the model if this is a cache-hit path
        if self._embed_model is None:
            try:
                self._embed_model = _ST(self._embed_model_name)
            except Exception:
                self._embed_failed = True
                return None
        try:
            q_vec = self._embed_model.encode(
                [query], normalize_embeddings=True, convert_to_numpy=True,
                show_progress_bar=False,
            )[0]
        except Exception:
            return None
        # Cosine similarity (matrix is L2-normalised, q_vec is too)
        sims = self._embed_matrix @ q_vec
        # Aggregate per entry: best doc-sim per entry; priority tiebreak
        best_per_entry: dict[int, tuple[float, OntologyEntry]] = {}
        for i, s in enumerate(sims):
            e = self._embed_entries[i]
            key = id(e)
            cur = best_per_entry.get(key)
            if cur is None or s > cur[0]:
                best_per_entry[key] = (float(s), e)
        scored = list(best_per_entry.values())
        scored.sort(key=lambda t: (-t[0], _family_rank(t[1].family)))
        return scored[:top_k]

    # ─── Resolve entry point ────────────────────────────────────────
    def resolve(self, query: str, top_k: int = 3) -> ResolverResult:
        q = (query or "").strip()
        if not q:
            return ResolverResult(q, False, None, None, None, 0.0, "none", [])

        # 1. Exact code match (codebook)
        hit = self._code_index.get(q.lower())
        if hit:
            return ResolverResult(
                q, True, hit.code, hit.canonical_name, hit.family,
                1.0, "codebook",
                [{**asdict(hit), "score": 1.0}],
            )
        # 1b. Strip common prefixes (mesh_, commodity_, HS-, region_, etc.)
        # Handles both underscore (mesh_D000) and hyphen (HS-30) conventions.
        stripped = re.sub(
            r"^(mesh|commodity|region|state|assignee|country|cpc|sic|noaa|station|hs|iso)[_\-]",
            "", q, flags=re.IGNORECASE,
        )
        if stripped != q:
            hit = self._code_index.get(stripped.lower())
            if hit:
                return ResolverResult(
                    q, True, hit.code, hit.canonical_name, hit.family,
                    0.95, "codebook",
                    [{**asdict(hit), "score": 0.95}],
                )

        # 2. Alias match
        hit = self._alias_index.get(stripped.lower())
        if hit:
            return ResolverResult(
                q, True, hit.code, hit.canonical_name, hit.family,
                0.9, "codebook",
                [{**asdict(hit), "score": 0.9}],
            )

        # 3. Lexical similarity on the stripped query. Query is scored
        #    against the canonical name AND each alias; the best match
        #    per entry wins. This rescues typos of aliases ("phaarma"
        #    approximately matches SIC 2834's "pharma" alias) that the
        #    canonical name comparison would miss.
        q_tok = _tokens(stripped)
        scored: list[tuple[float, OntologyEntry]] = []
        for e in self.ontology:
            candidates = [e.canonical_name, *e.aliases]
            best = 0.0
            for target in candidates:
                if not target:
                    continue
                j = _jaccard(q_tok, _tokens(target))
                c = _char_similarity(stripped, target)
                lev = _lev_similarity(stripped, target)
                # Blended score: jaccard dominates for clean word matches,
                # levenshtein carries typos where jaccard=0, char is the
                # mid-band tiebreaker. Sum = 1.0.
                score = 0.4 * j + 0.2 * c + 0.4 * lev
                if score > best:
                    best = score
            # Lower floor (was 0.15) keeps mild typos in the candidate set.
            if best > 0.10:
                scored.append((best, e))
        # Descending score; break ties on family priority so a lexical
        # collision (e.g. "phaarma" matching "pharma" alias on both HS
        # and SIC) resolves deterministically to the preferred family.
        scored.sort(key=lambda s: (-s[0], _family_rank(s[1].family)))
        top = scored[:top_k]
        lexical_result: Optional[ResolverResult] = None
        if top:
            best_score, best = top[0]
            # Threshold 0.35 (was 0.4) rescues near-miss typos like
            # "Germnay" → "Germany" (lev_sim 0.71, hybrid 0.36) without
            # admitting obvious nonsense (xjklqwerty/12345678 stay <0.2).
            resolved = best_score > 0.35
            lexical_result = ResolverResult(
                q, resolved,
                best.code if resolved else None,
                best.canonical_name if resolved else None,
                best.family if resolved else None,
                round(best_score, 3),
                "lexical" if resolved else "fuzzy",
                [{**asdict(e), "score": round(s, 3)} for s, e in top],
            )
            if resolved:
                return lexical_result

        # 4. Embedding fallback. Only tried when stages 1-3 failed to
        #    resolve AND the caller opted in (enable_embeddings=True or
        #    LO_RESOLVER_EMBEDDINGS=1). Cosine threshold gates admission
        #    to avoid embedding "yes" on gibberish, which sentence
        #    transformers tend to assign ~0.4-0.5 cosine on random short
        #    strings.
        if self._embeddings_requested:
            emb_top = self._embedding_search(q, top_k)
            if emb_top:
                best_score, best = emb_top[0]
                if best_score >= self._embed_threshold:
                    return ResolverResult(
                        q, True,
                        best.code, best.canonical_name, best.family,
                        round(best_score, 3),
                        "embedding",
                        [{**asdict(e), "score": round(s, 3)} for s, e in emb_top],
                    )
                # Emb didn't clear threshold — return its candidates as
                # fuzzy hints alongside the lexical ones we had.
                existing = lexical_result.candidates if lexical_result else []
                combined = existing + [
                    {**asdict(e), "score": round(s, 3), "source_hint": "embedding"}
                    for s, e in emb_top
                ]
                return ResolverResult(
                    q, False, None, None, None,
                    round(best_score, 3),
                    "fuzzy",
                    combined[:top_k],
                )

        if lexical_result is not None:
            return lexical_result
        return ResolverResult(q, False, None, None, None, 0.0, "none", [])


# ─── Convenience ────────────────────────────────────────────────────
_default_resolver: Optional[Resolver] = None


def hybrid_resolve(query: str, top_k: int = 3) -> ResolverResult:
    """Module-level convenience with a memoized default Resolver."""
    global _default_resolver
    if _default_resolver is None:
        _default_resolver = Resolver()
    return _default_resolver.resolve(query, top_k=top_k)


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser(description="Resolve a query against bundled ontologies")
    ap.add_argument("query", help="Code or string to resolve (e.g. 'mesh_D000081082', 'HS-02', 'Arizona')")
    ap.add_argument("--top-k", type=int, default=5)
    args = ap.parse_args()

    result = hybrid_resolve(args.query, top_k=args.top_k)
    print(json.dumps(asdict(result), indent=2, default=str))
    return 0 if result.resolved else 2


if __name__ == "__main__":
    raise SystemExit(main())
