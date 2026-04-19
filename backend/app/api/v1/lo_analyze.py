"""`lo_core` analysis endpoints — deterministic, offline, no external GenAI.

Exposes the `lo_core` library as HTTP:
  POST /api/v1/lo/analyze      — run cross-dimensional analysis on a BTUT output
  POST /api/v1/lo/validate     — run null-permutation + hold-out validation
  POST /api/v1/lo/narrate      — deterministic template narration from findings
  GET  /api/v1/lo/health       — health + version

This is the SaaS MVP surface. Tenant scoping lives in a follow-up; today
every caller is treated as the same tenant.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, is_dataclass
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from lo_core import __version__ as lo_core_version
from lo_core.analyze import analyze_corpus
from lo_core.generators import TemplateGenerator
from lo_core.schemas import (
    ConvergenceEntry,
    ConvergentCluster,
    CrossEraAnchor,
    Findings,
    SurvivorRank,
)
from lo_core.validate import validate_corpora

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lo", tags=["lo_core"])


def _to_jsonable(obj: Any) -> Any:
    if is_dataclass(obj):
        return _to_jsonable(asdict(obj))
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_jsonable(v) for v in obj]
    return obj


# ─── Request bodies ─────────────────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    """A BTUT output (containing 'survivors') to analyze."""
    corpus_id: str = Field(..., description="Customer identifier for this corpus")
    survivors: list[dict] = Field(..., description="BTUT survivor list")
    role_map: dict[str, dict[str, str]] | None = Field(
        None,
        description="Optional per-corpus subcorpus -> role mapping (overrides default)",
    )


class ValidateRequest(BaseModel):
    """A multi-corpus bundle to run null + hold-out against."""
    corpora: dict[str, list[dict]] = Field(
        ..., description="Mapping of corpus_id -> BTUT survivor list"
    )
    focus_corpus: str
    n_iterations: int = Field(30, ge=5, le=500)
    seed: int = 42
    held_out: list[str] | None = None
    role_map: dict[str, dict[str, str]] | None = None


class NarrateRequest(BaseModel):
    """A previously-computed findings dict to narrate."""
    findings: dict[str, Any]
    entity_name: str | None = None


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "lo_core": lo_core_version, "engine": "internal/template"}


@router.post("/analyze")
async def analyze(req: AnalyzeRequest) -> dict:
    if not req.survivors:
        raise HTTPException(status_code=400, detail="survivors array is empty")
    try:
        findings = analyze_corpus(
            req.survivors,
            corpus_id=req.corpus_id,
            role_map=req.role_map,
        )
    except Exception as e:
        logger.exception("lo_analyze failed for %s", req.corpus_id)
        raise HTTPException(status_code=500, detail=f"analysis failed: {type(e).__name__}: {e}")
    return _to_jsonable(findings)


@router.post("/validate")
async def validate(req: ValidateRequest) -> dict:
    if req.focus_corpus not in req.corpora:
        raise HTTPException(
            status_code=400,
            detail=f"focus_corpus '{req.focus_corpus}' not found in corpora",
        )
    if len(req.corpora) < 2:
        raise HTTPException(
            status_code=400,
            detail="validate requires at least 2 corpora for cross-legend analysis",
        )
    held_out_tuple = tuple(req.held_out) if req.held_out else None
    try:
        report = validate_corpora(
            survivors_by_corpus=req.corpora,
            focus_corpus=req.focus_corpus,
            n_iterations=req.n_iterations,
            seed=req.seed,
            held_out=held_out_tuple,
            role_map=req.role_map,
        )
    except Exception as e:
        logger.exception("lo_validate failed for focus=%s", req.focus_corpus)
        raise HTTPException(status_code=500, detail=f"validation failed: {type(e).__name__}: {e}")
    return _to_jsonable(report)


@router.post("/narrate")
async def narrate(req: NarrateRequest) -> dict:
    """Produce a deterministic narrative from a findings dict."""
    d = req.findings
    try:
        findings = Findings(
            corpus_id=d.get("corpus_id", "?"),
            survivor_count=int(d.get("survivor_count", 0)),
            cluster_count=int(d.get("cluster_count", 0)),
            paradigm_distribution=d.get("paradigm_distribution") or {},
            convergent_clusters=[
                ConvergentCluster(**x) for x in d.get("convergent_clusters") or []
            ],
            cross_era_anchors=[
                CrossEraAnchor(**x) for x in d.get("cross_era_anchors") or []
            ],
            convergence_index=[
                ConvergenceEntry(**x) for x in d.get("convergence_index") or []
            ],
            within_cluster_rank={
                k: SurvivorRank(**v)
                for k, v in (d.get("within_cluster_rank") or {}).items()
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"findings payload did not match Findings schema: {type(e).__name__}: {e}",
        )

    gen = TemplateGenerator()
    corpus_narrative = gen.narrate_corpus(findings)
    entity_narrative = None
    if req.entity_name:
        entity_narrative = gen.narrate_entity(findings, req.entity_name)
    return {
        "corpus_narrative": corpus_narrative,
        "entity_narrative": entity_narrative,
        "source": "lo_core.template",
    }
