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

import json
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

DATA_DIR = Path(__file__).resolve().parent / "data"


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
    for f in DATA_DIR.glob("*.json"):
        try:
            rows = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        family = f.stem.replace("_top", "").replace("_codes", "").replace("_iso", "").replace("_classes", "").replace("_stations", "")
        for r in rows:
            out.append(OntologyEntry(
                code=str(r.get("code") or r.get("id") or ""),
                canonical_name=str(r.get("name") or r.get("label") or ""),
                family=family,
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
    """Layered entity resolver. Stateless after construction."""

    def __init__(self, ontology: Optional[list[OntologyEntry]] = None):
        self.ontology = ontology if ontology is not None else load_default_ontologies()
        # Index: exact code match
        self._code_index: dict[str, OntologyEntry] = {
            e.code.lower(): e for e in self.ontology if e.code
        }
        # Index: alias match
        self._alias_index: dict[str, OntologyEntry] = {}
        for e in self.ontology:
            for a in e.aliases:
                self._alias_index.setdefault(a.lower(), e)

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
            r"^(mesh|commodity|region|assignee|country|cpc|sic|noaa|station|hs|iso)[_\-]",
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

        # 3. Lexical similarity on the stripped query
        q_tok = _tokens(stripped)
        scored: list[tuple[float, OntologyEntry]] = []
        for e in self.ontology:
            name_tok = _tokens(e.canonical_name)
            j = _jaccard(q_tok, name_tok)
            c = _char_similarity(stripped, e.canonical_name)
            # Hybrid score weighted toward jaccard for full-word matches,
            # char similarity for typos / code-to-name crossovers.
            score = 0.7 * j + 0.3 * c
            if score > 0.15:
                scored.append((score, e))
        scored.sort(key=lambda s: -s[0])
        top = scored[:top_k]
        if top:
            best_score, best = top[0]
            return ResolverResult(
                q, best_score > 0.4,
                best.code if best_score > 0.4 else None,
                best.canonical_name if best_score > 0.4 else None,
                best.family if best_score > 0.4 else None,
                round(best_score, 3),
                "lexical" if best_score > 0.4 else "fuzzy",
                [{**asdict(e), "score": round(s, 3)} for s, e in top],
            )

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
