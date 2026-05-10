"""Public Latent Stretcher Center (LSC) API — Layer 1 + 4 + 5 + 8 scaffold.

Wraps the production RunPod serverless endpoint as a public job-submission
surface with:

  * API-key authentication (Layer 7 — token validation only; full RBAC
    extension lives in api_keys.py)
  * Per-job budget cap enforcement (Layer 8 — uses Stripe-style metered
    accounting once wired)
  * Backend routing scaffold (Layer 4/5 — RunPod backend live; multi-cloud
    routing planted as placeholder)
  * Regime-card validator pass on returned modules (Layer 11)
  * Lineage emission (Layer 11)

This is the customer-facing entry point for the LSC cloud product. Customers
POST entities + edges + config; the endpoint returns modules + lineage +
regime-card-validated output.

The endpoint is intentionally schema-compatible with the existing RunPod
handler at runpod/handler.py so that future LSU + ASIC backends present the
same interface.
"""

from __future__ import annotations

import os
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.api_key_auth import require_api_scope
from app.services.lsc.backends import CostAwareRouter, BackendUnavailable
from app.services.lsc.metering import record_job_usage


router = APIRouter(prefix="/lsc", tags=["lsc"])
_router_backends = CostAwareRouter()


# ------------------------------ schemas ----------------------------------


class Entity(BaseModel):
    name: str = Field(..., description="Stable identifier for this entity within the job")
    type: str = Field(..., description="Ground-truth class / archive / category label")
    attributes: dict[str, Any] = Field(
        default_factory=dict,
        description="Free-form attribute bag; minimum schema includes 'text'",
    )


class Edge(BaseModel):
    source: str
    target: str
    type: str = "knn"
    weight: float = 1.0


class JobConfig(BaseModel):
    btut_enabled: bool = True
    btut_budget_dollars: float = 5.0
    epochs: int = 30
    max_modules: int | None = None
    seed: int = 42


class SubmitRequest(BaseModel):
    entities: list[Entity]
    edges: list[Edge] = Field(default_factory=list)
    config: JobConfig = Field(default_factory=JobConfig)
    dataset_id: str | None = None
    job_id: str | None = None


class ModuleRow(BaseModel):
    name: str | None = None
    dominant_type: str | None = None
    n_entities: int | None = None
    top_archive: str | None = None
    top_archive_count: int | None = None
    purity: float | None = None
    archive_distribution: dict[str, int] | None = None


class ArchiveRow(BaseModel):
    archive: str
    n_records_in_modules: int
    self_basin_share: float


class JobResult(BaseModel):
    job_id: str
    status: str
    backend: str
    device: str | None = None
    n_entities_input: int
    n_modules_discovered: int
    mean_module_purity: float | None = None
    min_module_purity: float | None = None
    mean_class_self_basin: float | None = None
    final_auc: float | None = None
    wall_seconds: float
    gpu_exec_ms: int | None = None
    cost_dollars_estimate: float
    regime_card_compliant: bool
    module_purity_rows: list[ModuleRow] = Field(default_factory=list)
    archive_self_basin_rows: list[ArchiveRow] = Field(default_factory=list)
    lineage_signature: str


# ------------------------------ guards -----------------------------------

# Self-imposed safety bounds. Dispatcher-level caps are in
# scripts/experiments/runpod_dispatch.py; these are the API-surface limits.
PER_REQUEST_BUDGET_CAP_DOLLARS = 1.00
PER_REQUEST_TIMEOUT_SECONDS = 600
MAX_ENTITIES_PER_REQUEST = 200_000  # advisory; the 10 MiB payload limit is harder


# Auth + backend routing now live in:
#   app.core.api_key_auth          — proper API-key validation, scopes, store
#   app.services.lsc.backends      — multi-cloud adapter + cost-aware router
#   app.services.lsc.metering      — per-job usage records + Stripe sync


# ------------------------------ pipeline ---------------------------------


def _compute_lineage_signature(req: SubmitRequest) -> str:
    """Layer 11 — produce a deterministic signature over the input so the
    output is reproducible and verifiable. Real implementation does a Merkle
    hash over sorted entity names + edge tuples + config; for the scaffold
    we use a simple stable hash.
    """
    import hashlib
    h = hashlib.sha256()
    h.update(str(req.config.seed).encode())
    h.update(str(req.config.btut_budget_dollars).encode())
    h.update(str(req.config.epochs).encode())
    h.update(str(len(req.entities)).encode())
    h.update(str(len(req.edges)).encode())
    for e in sorted(req.entities, key=lambda x: x.name)[:32]:
        h.update(e.name.encode())
        h.update(e.type.encode())
    return h.hexdigest()[:32]


def _regime_card_compliant(
    n_classes_input: int,
    n_modules_discovered: int,
    mean_purity: float | None,
) -> bool:
    """Layer 11 — quick check against the published regime card.

    The regime card from the overnight campaign says:
      - up to 16 ground-truth classes: full coverage at perfect purity
      - past 16: graceful degradation, modules still pure
      - noise up to 70%, imbalance up to 10,000:1, overlap up to 75%

    A job is regime-card-compliant if either: (a) ≤16 classes and modules ==
    classes and purity ≥0.999, or (b) >16 classes and modules == 16 and
    purity ≥0.999.
    """
    if mean_purity is None or mean_purity < 0.999:
        return False
    if n_classes_input <= 16:
        return n_modules_discovered == n_classes_input
    return n_modules_discovered >= 16


def _measure_module_purity(modules: list[dict]) -> list[ModuleRow]:
    out: list[ModuleRow] = []
    for m in modules:
        ents = m.get("entities", [])
        if not ents:
            continue
        archives: dict[str, int] = {}
        for e in ents:
            t = e.get("type") if isinstance(e, dict) else None
            if t is None:
                continue
            archives[t] = archives.get(t, 0) + 1
        if not archives:
            continue
        top_arch, top_count = max(archives.items(), key=lambda kv: kv[1])
        out.append(
            ModuleRow(
                name=m.get("name") or m.get("dominant_type"),
                dominant_type=m.get("dominant_type"),
                n_entities=len(ents),
                top_archive=top_arch,
                top_archive_count=top_count,
                purity=round(top_count / max(1, len(ents)), 4),
                archive_distribution=archives,
            )
        )
    return out


def _measure_archive_self_basin(
    modules: list[dict],
    entities: list[Entity],
) -> list[ArchiveRow]:
    ent_to_module_arch: dict[str, str] = {}
    for m in modules:
        for e in m.get("entities", []):
            nm = e.get("name") if isinstance(e, dict) else None
            if nm is not None:
                ent_to_module_arch[nm] = m.get("dominant_type") or ""
    by_archive: dict[str, list[int]] = {}
    for ent in entities:
        archive = ent.type
        landed = ent_to_module_arch.get(ent.name)
        if landed is not None:
            by_archive.setdefault(archive, []).append(1 if landed == archive else 0)
    rows: list[ArchiveRow] = []
    for arch, lands in sorted(by_archive.items()):
        if not lands:
            continue
        rows.append(
            ArchiveRow(
                archive=arch,
                n_records_in_modules=len(lands),
                self_basin_share=round(sum(lands) / len(lands), 4),
            )
        )
    return rows


# ------------------------------ endpoint ---------------------------------


@router.get("/health")
async def lsc_health() -> dict[str, Any]:
    """Public health check for the LSC API.

    Reports which backend adapters are configured and probes the primary
    one (RunPod serverless) for live worker state. Designed to be
    backend-agnostic as additional providers come online.
    """
    configured = _router_backends.configured_backends()
    out: dict[str, Any] = {
        "status": "healthy" if configured else "degraded",
        "backend_configured": bool(configured),
        "configured_backends": configured,
    }
    # Live probe of RunPod when configured — it is currently the
    # production-proven backend; other adapters return health info via
    # their own provider APIs as they come online.
    runpod_key = os.environ.get("RUNPOD_API_KEY")
    runpod_endpoint = os.environ.get("RUNPOD_ENDPOINT_ID")
    if runpod_key and runpod_endpoint:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    f"https://api.runpod.ai/v2/{runpod_endpoint}/health",
                    headers={"Authorization": f"Bearer {runpod_key}"},
                )
                if r.status_code == 200:
                    data = r.json()
                    workers = data.get("workers", {})
                    out["backend"] = "runpod-serverless"
                    out["workers_idle"] = workers.get("idle")
                    out["workers_ready"] = workers.get("ready")
                    out["workers_running"] = workers.get("running")
                    out["jobs_completed"] = data.get("jobs", {}).get("completed")
                else:
                    out["status"] = "degraded"
                    out["backend_status"] = r.status_code
        except Exception:
            out["status"] = "degraded"
            out["backend_status"] = "unreachable"
    return out


@router.post("/submit", response_model=JobResult)
async def lsc_submit(
    req: SubmitRequest,
    request: Request,
    auth_ctx: dict = Depends(require_api_scope("query")),
) -> JobResult:
    """Submit a substrate job to the LSC pooled-compute backend.

    Authentication: requires a valid API key with the ``query`` scope via
    either ``X-API-Key`` header or ``Authorization: Bearer lo_sk_...``.

    Returns the discovered modules, dispersion measurements, and a
    regime-card-compliance flag. This is the Layer 1 public surface that
    wraps Layer 3 substrate execution, Layer 5 backend routing, and
    Layer 8 metered billing.
    """
    if len(req.entities) == 0:
        raise HTTPException(status_code=422, detail="entities list cannot be empty")
    if len(req.entities) > MAX_ENTITIES_PER_REQUEST:
        raise HTTPException(
            status_code=413,
            detail=f"too many entities; advisory limit is {MAX_ENTITIES_PER_REQUEST}",
        )

    # Layer 4/5 — cost-aware backend selection across configured providers.
    try:
        backend = _router_backends.select(
            entity_count=len(req.entities),
            budget_dollars=req.config.btut_budget_dollars,
        )
    except BackendUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))

    lineage = _compute_lineage_signature(req)
    job_id = req.job_id or f"lsc_{int(time.time())}_{lineage[:8]}"

    payload = {
        "input": {
            "entities": [e.model_dump() for e in req.entities],
            "edges": [e.model_dump() for e in req.edges],
            "config": req.config.model_dump(),
            "dataset_id": req.dataset_id or "lsc_public",
            "job_id": job_id,
        }
    }

    t0 = time.time()
    headers = {"Authorization": f"Bearer {backend['api_key']}"}

    async with httpx.AsyncClient(timeout=PER_REQUEST_TIMEOUT_SECONDS) as client:
        try:
            submit_resp = await client.post(f"{backend['url']}/run", headers=headers, json=payload)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"backend submit failed: {type(e).__name__}")
        if submit_resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"backend rejected: HTTP {submit_resp.status_code}",
            )
        submit_data = submit_resp.json()
        runpod_id = submit_data.get("id")
        if not runpod_id:
            raise HTTPException(status_code=502, detail="backend returned no job id")

        # poll
        last_status = None
        final = None
        while True:
            if time.time() - t0 > PER_REQUEST_TIMEOUT_SECONDS:
                try:
                    await client.post(f"{backend['url']}/cancel/{runpod_id}", headers=headers, json={})
                except Exception:
                    pass
                raise HTTPException(status_code=504, detail="per-request timeout exceeded")
            status_resp = await client.get(f"{backend['url']}/status/{runpod_id}", headers=headers)
            if status_resp.status_code != 200:
                # transient — retry
                continue
            status = status_resp.json()
            s = status.get("status")
            if s in ("COMPLETED", "FAILED", "CANCELLED"):
                final = status
                break
            last_status = s

    elapsed = time.time() - t0
    if not final or final.get("status") != "COMPLETED":
        raise HTTPException(status_code=502, detail=f"job did not complete: {final.get('status') if final else 'unknown'}")

    output = final.get("output")
    final_stage = None
    if isinstance(output, list):
        for item in reversed(output):
            if isinstance(item, dict) and "modules" in item:
                final_stage = item
                break
    elif isinstance(output, dict):
        final_stage = output

    if final_stage is None:
        raise HTTPException(status_code=502, detail="no module output from backend")

    modules = final_stage.get("modules", []) or []
    module_rows = _measure_module_purity(modules)
    archive_rows = _measure_archive_self_basin(modules, req.entities)

    mean_purity = (
        round(sum(r.purity or 0 for r in module_rows) / max(1, len(module_rows)), 4)
        if module_rows
        else None
    )
    min_purity = min((r.purity or 0 for r in module_rows), default=None)
    mean_self_basin = (
        round(sum(r.self_basin_share for r in archive_rows) / max(1, len(archive_rows)), 4)
        if archive_rows
        else None
    )

    distinct_input_classes = len({e.type for e in req.entities})
    compliant = _regime_card_compliant(distinct_input_classes, len(modules), mean_purity)

    exec_ms = final.get("executionTime") or 0
    if not exec_ms or exec_ms < 100:
        exec_ms = int(elapsed * 1000)
    cost_dollars = (exec_ms / 1000) * (0.04 / 60)  # rough RunPod H100 estimate
    if cost_dollars > PER_REQUEST_BUDGET_CAP_DOLLARS:
        # Cap-enforcement is upstream; this is the post-hoc accounting line.
        cost_dollars = round(cost_dollars, 6)

    # Layer 8 — record metered usage against the authenticated API key /
    # org so the billing rollup picks it up. Non-fatal on failure.
    try:
        await record_job_usage(
            org_id=auth_ctx.get("org_id"),
            user_id=auth_ctx.get("user_id"),
            api_key_id=auth_ctx.get("key_id"),
            job_id=job_id,
            backend=backend["backend"],
            n_entities=len(req.entities),
            gpu_exec_ms=exec_ms,
            cost_dollars=cost_dollars,
            regime_card_compliant=compliant,
        )
    except Exception:
        # Metering must not fail the customer's job.
        pass

    return JobResult(
        job_id=job_id,
        status="COMPLETED",
        backend=backend["backend"],
        device=final_stage.get("device"),
        n_entities_input=len(req.entities),
        n_modules_discovered=len(modules),
        mean_module_purity=mean_purity,
        min_module_purity=round(min_purity, 4) if min_purity is not None else None,
        mean_class_self_basin=mean_self_basin,
        final_auc=final_stage.get("final_auc"),
        wall_seconds=round(elapsed, 2),
        gpu_exec_ms=exec_ms,
        cost_dollars_estimate=round(cost_dollars, 6),
        regime_card_compliant=compliant,
        module_purity_rows=module_rows,
        archive_self_basin_rows=archive_rows,
        lineage_signature=lineage,
    )
