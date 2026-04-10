"""LATK public query API.

Exposes the Phase 1 ``novelty`` and ``route_to_ancestors`` endpoints over
persisted LATK lattice files (produced by ``run_btut_pipeline`` with
embed_context + embeddings_8d).

Endpoints
---------
``POST /api/v1/latk/novelty``
    Body: ``{query: str, lattice_id: str, top_k?: int, method?: str}``
    Returns: NoveltyReport JSON with nearest entities, matched clusters,
    era distribution, novelty score, and notes.

``POST /api/v1/latk/route-to-ancestors``
    Body: ``{query: str, lattice_id: str, top_k?: int}``
    Returns: top historical ancestor entities from the novelty report, with
    the cluster context that links them to the query. This is the headline
    LATK operation: "paste a modern text, get historical ancestors."

``GET /api/v1/latk/lattices``
    Returns the list of available lattices and their metadata.

``GET /api/v1/latk/health``
    Health probe.

Lattice files are loaded lazily and cached per-process. The lookup
``LATTICE_REGISTRY`` maps a short ID (e.g. ``latk_mini``, ``linguistics``,
``physics``) to a relative path under the repo's ``scripts/cross_era_analysis/output``
directory.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/latk", tags=["latk"])


# ---------------------------------------------------------------------------
# Path discovery
# ---------------------------------------------------------------------------

# The latk_tool package lives outside the backend package in
# scripts/cross_era_analysis/. Find it at import time by trying a few
# candidate locations.
#
# On the host (where this file is at `backend/app/api/v1/latk.py`),
# ``parents[4]`` is the repo root.
#
# Inside the production docker container (where backend/ is copied into
# ``/app`` so this file is at `/app/app/api/v1/latk.py`), ``parents[3]``
# is ``/app`` and the scripts tree must be mounted at
# ``/app/scripts/cross_era_analysis`` via docker-compose.override.yml.
#
# An explicit ``LATK_CEA_DIR`` env var always wins.
_THIS = Path(__file__).resolve()
_CANDIDATES: List[Path] = []
_env_override = os.environ.get("LATK_CEA_DIR")
if _env_override:
    _CANDIDATES.append(Path(_env_override))
_CANDIDATES.extend([
    _THIS.parents[4] / "scripts" / "cross_era_analysis",  # host repo layout
    _THIS.parents[3] / "scripts" / "cross_era_analysis",  # container with /app as root
    Path("/app/scripts/cross_era_analysis"),               # explicit container path
    Path("/scripts/cross_era_analysis"),                   # alt container mount
])
_CEA_DIR = next((p for p in _CANDIDATES if p.exists()), _CANDIDATES[0])
if str(_CEA_DIR) not in sys.path:
    sys.path.insert(0, str(_CEA_DIR))

try:
    from latk_tool.query.novelty import (  # type: ignore
        load_lattice,
        query_novelty,
        format_report,
    )
    _LATK_AVAILABLE = True
    _LATK_IMPORT_ERROR: Optional[str] = None
except Exception as exc:  # pragma: no cover
    _LATK_AVAILABLE = False
    _LATK_IMPORT_ERROR = str(exc)
    logger.warning("LATK tool not importable: %s", exc)


LATTICE_REGISTRY: Dict[str, Path] = {
    # --- Commercial primary corpora (the headline for investor demos) ---
    "edgar": _CEA_DIR / "output" / "edgar_btut_result_v2.json",
    "physics": _CEA_DIR / "output" / "latk_physics_btut_result_v2.json",
    # --- Commercial legacy (Phase 0 format, hamming fallback) ---
    # These are pre-patch BTUT runs and don't have embed_context/8D
    # embeddings. The novelty query auto-falls-back to Hamming distance
    # ranking so they still work for demos.
    "pubmed": _CEA_DIR / "output" / "phase0_commercial" / "pubmed_btut_result.json",
    "patents": _CEA_DIR / "output" / "phase0_commercial" / "patents_btut_result.json",
    "comtrade": _CEA_DIR / "output" / "phase0_commercial" / "comtrade_btut_result.json",
    "climate": _CEA_DIR / "output" / "phase0_commercial" / "climate_btut_result.json",
    # --- Research dev-set corpora (tuned the parsing pipeline) ---
    "linguistics": _CEA_DIR / "output" / "linguistics_btut_result_v2.json",
    "polymath": _CEA_DIR / "output" / "polymath_btut_result_v2.json",
    "heterogeneous": _CEA_DIR / "output" / "heterogeneous_btut_result_v2.json",
    "tesla_crossera": _CEA_DIR / "output" / "tesla_crossera_btut_result_v2.json",
    "latk_mini": _CEA_DIR / "output" / "latk_mini_btut_result_v2.json",
    # --- Legacy Phase 0 research lattices (hamming fallback) ---
    "linguistics_legacy": _CEA_DIR / "output" / "linguistics_btut_result.json",
    "polymath_legacy": _CEA_DIR / "output" / "polymath_btut_result.json",
    "heterogeneous_legacy": _CEA_DIR / "output" / "heterogeneous_btut_result.json",
    "latk_mini_legacy": _CEA_DIR / "output" / "latk_mini_btut_result.json",
}

# Per-lattice default entity_types filter. Applied when the caller does not
# supply one explicitly. Used to suppress low-text-density entities that
# dominate the geometric top-N for text queries.
LATTICE_DEFAULT_FILTER: Dict[str, List[str]] = {
    # Commercial primary
    "physics": ["writing", "chunk"],
    "edgar": ["filing", "financial_fact"],
    # Commercial legacy (each has its own dominant content type)
    "pubmed": ["paper", "mesh_term"],
    "patents": ["patent", "cpc_class"],
    "comtrade": ["trade_flow", "commodity"],
    "climate": ["station", "region"],
    # Research dev-set
    "polymath": ["writing", "chunk", "concept", "event", "location"],
    "heterogeneous": ["writing", "chunk", "concept", "event", "location"],
    "tesla_crossera": ["patent_chunk"],
}


import threading as _threading

_LATTICE_CACHE: Dict[str, Any] = {}
_LATTICE_CACHE_LOCKS: Dict[str, _threading.Lock] = {}
_LATTICE_CACHE_MASTER_LOCK = _threading.Lock()


def _get_lattice(lattice_id: str):
    """Thread-safe per-lattice lazy load with double-checked locking.

    Under high concurrency (50+ simultaneous requests in the stress test)
    the previous implementation raced on first load: multiple threads saw
    the cache miss, all called ``load_lattice`` concurrently, wasted work
    and exhausted starlette's sync thread pool. Now each lattice has its
    own lock, and the first thread to acquire it loads while others wait.
    """
    if not _LATK_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=f"LATK tool not available: {_LATK_IMPORT_ERROR}",
        )
    if lattice_id not in LATTICE_REGISTRY:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown lattice_id '{lattice_id}'. Known: {sorted(LATTICE_REGISTRY.keys())}",
        )
    # Fast path: already cached, no locking needed
    cached = _LATTICE_CACHE.get(lattice_id)
    if cached is not None:
        return cached

    path = LATTICE_REGISTRY[lattice_id]
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Lattice file not found on disk: {path}",
        )

    # Slow path: acquire per-lattice lock so only one thread loads
    with _LATTICE_CACHE_MASTER_LOCK:
        lock = _LATTICE_CACHE_LOCKS.setdefault(lattice_id, _threading.Lock())

    with lock:
        # Double check — another thread may have loaded while we waited
        cached = _LATTICE_CACHE.get(lattice_id)
        if cached is not None:
            return cached
        lattice = load_lattice(path)
        _LATTICE_CACHE[lattice_id] = lattice
        return lattice


def prewarm_all_lattices() -> Dict[str, Any]:
    """Load every registered lattice whose file exists into the cache.

    Called automatically on router import (see bottom of file) so the
    first request per lattice does not pay the cold-load cost. Returns a
    summary dict for logging.
    """
    results: Dict[str, Any] = {"loaded": [], "skipped": [], "errors": []}
    for lid, path in LATTICE_REGISTRY.items():
        if not path.exists():
            results["skipped"].append({"lattice_id": lid, "reason": "file missing"})
            continue
        try:
            lat = load_lattice(path)
            _LATTICE_CACHE[lid] = lat
            results["loaded"].append({"lattice_id": lid, "size": lat.size, "has_v2": lat.has_v2})
        except Exception as exc:  # pragma: no cover
            results["errors"].append({"lattice_id": lid, "error": str(exc)})
    return results


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class NoveltyRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=10_000)
    lattice_id: str = Field(..., description="Lattice key from /latk/lattices")
    top_k: int = Field(20, ge=1, le=100)
    method: str = Field("combined", description="'combined' | '8d' | 'hamming'")
    entity_types: Optional[List[str]] = Field(
        None,
        description="Optional filter; if set, only return matches whose entity_type is in this list. "
                    "Useful for physics queries where you want to suppress author 'person' entities and "
                    "restrict to 'writing' or 'chunk' content.",
    )


class NearestEntity(BaseModel):
    entity_name: str
    entity_type: str
    cluster: str
    distance: float
    hamming_distance: int
    composite: float
    era: str


class NoveltyResponse(BaseModel):
    query_text: str
    novelty_score: float
    ranking_method: str
    nearest_entities: List[NearestEntity]
    matched_clusters: List[str]
    era_distribution: Dict[str, int]
    notes: List[str]
    lattice_id: str
    lattice_size: int


class RouteToAncestorsRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=10_000)
    lattice_id: str
    top_k: int = Field(20, ge=1, le=100)
    entity_types: Optional[List[str]] = Field(
        None,
        description="Optional filter; same semantics as the /novelty endpoint's field.",
    )


class AncestorEntity(BaseModel):
    entity_name: str
    entity_type: str
    cluster: str
    era: str
    distance: float
    composite: float


class RouteToAncestorsResponse(BaseModel):
    query_text: str
    lattice_id: str
    ancestors: List[AncestorEntity]
    descendant_context: List[AncestorEntity]
    novelty_score: float
    notes: List[str]


class LatticeInfo(BaseModel):
    lattice_id: str
    path: str
    exists: bool
    size: Optional[int] = None
    has_v2: Optional[bool] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok" if _LATK_AVAILABLE else "degraded",
        "latk_tool_importable": _LATK_AVAILABLE,
        "import_error": _LATK_IMPORT_ERROR,
        "known_lattices": sorted(LATTICE_REGISTRY.keys()),
        "cea_dir": str(_CEA_DIR),
    }


@router.get("/lattices", response_model=List[LatticeInfo])
def list_lattices() -> List[LatticeInfo]:
    out: List[LatticeInfo] = []
    for lid, path in LATTICE_REGISTRY.items():
        info = LatticeInfo(
            lattice_id=lid,
            path=str(path),
            exists=path.exists(),
        )
        if path.exists() and _LATK_AVAILABLE:
            try:
                lat = _get_lattice(lid)
                info.size = lat.size
                info.has_v2 = lat.has_v2
            except HTTPException:
                pass
            except Exception:
                pass
        out.append(info)
    return out


@router.post("/novelty", response_model=NoveltyResponse)
def novelty(req: NoveltyRequest) -> NoveltyResponse:
    lattice = _get_lattice(req.lattice_id)
    # Apply per-lattice default filter if the caller didn't specify one.
    effective_types = req.entity_types
    if effective_types is None:
        effective_types = LATTICE_DEFAULT_FILTER.get(req.lattice_id)
    report = query_novelty(
        req.query,
        lattice,
        top_k=req.top_k,
        method=req.method,
        entity_types=effective_types,
    )
    return NoveltyResponse(
        query_text=report.query_text,
        novelty_score=report.novelty_score,
        ranking_method=report.ranking_method,
        nearest_entities=[
            NearestEntity(
                entity_name=m.entity_name,
                entity_type=m.entity_type,
                cluster=m.cluster,
                distance=float(m.distance),
                hamming_distance=int(m.hamming_distance),
                composite=float(m.composite),
                era=m.era,
            )
            for m in report.nearest_entities
        ],
        matched_clusters=report.matched_clusters,
        era_distribution=report.era_distribution,
        notes=report.notes,
        lattice_id=req.lattice_id,
        lattice_size=lattice.size,
    )


@router.post("/route-to-ancestors", response_model=RouteToAncestorsResponse)
def route_to_ancestors(req: RouteToAncestorsRequest) -> RouteToAncestorsResponse:
    """Project a modern query text and return its historical ancestors.

    This is the LATK headline operation. The caller pastes a modern text
    (paper, quote, patent claim, etc.) and gets back the historical
    entities in the lattice that its 8D neighborhood points at.
    """
    lattice = _get_lattice(req.lattice_id)
    effective_types = req.entity_types
    if effective_types is None:
        effective_types = LATTICE_DEFAULT_FILTER.get(req.lattice_id)
    report = query_novelty(
        req.query,
        lattice,
        top_k=req.top_k * 2,
        method="combined",
        entity_types=effective_types,
    )

    ancestors = [
        AncestorEntity(
            entity_name=m.entity_name,
            entity_type=m.entity_type,
            cluster=m.cluster,
            era=m.era,
            distance=float(m.distance),
            composite=float(m.composite),
        )
        for m in report.nearest_entities
        if m.era == "historical"
    ][: req.top_k]

    descendants = [
        AncestorEntity(
            entity_name=m.entity_name,
            entity_type=m.entity_type,
            cluster=m.cluster,
            era=m.era,
            distance=float(m.distance),
            composite=float(m.composite),
        )
        for m in report.nearest_entities
        if m.era == "modern"
    ][: req.top_k]

    return RouteToAncestorsResponse(
        query_text=report.query_text,
        lattice_id=req.lattice_id,
        ancestors=ancestors,
        descendant_context=descendants,
        novelty_score=report.novelty_score,
        notes=report.notes,
    )


# ---------------------------------------------------------------------------
# Module-level prewarm on import
# ---------------------------------------------------------------------------

# Populate the lattice cache at module import time so the first request
# per lattice doesn't pay the cold-load cost. This is safe because
# load_lattice is side-effect-free and reads a JSON file into RAM; the
# cost is bounded by the sum of v2 lattice file sizes (currently ~8 MB).
if _LATK_AVAILABLE:
    try:
        _prewarm_summary = prewarm_all_lattices()
        logger.info(
            "LATK prewarm: loaded=%d skipped=%d errors=%d",
            len(_prewarm_summary["loaded"]),
            len(_prewarm_summary["skipped"]),
            len(_prewarm_summary["errors"]),
        )
    except Exception as _exc:  # pragma: no cover
        logger.warning("LATK prewarm failed: %s", _exc)
