"""Data Estate vertical — API routes.

Prefix: /data-estate
All routes use existing RBAC via require_role/require_permission.
"""
from __future__ import annotations

import uuid
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.core.permissions import require_role
from app.db.session import get_db
from app.models.data_estate import (
    EstateAllocationRequest,
    EstateLedgerEntry,
    EstateScoringTemplate,
    EstateSubmission,
)
from app.models.module_registry import ModuleRegistryEntry
from app.schemas.data_estate import (
    AllocationDecisionRequest,
    AllocationRequestCreate,
    AllocationRequestOut,
    ChatRequest,
    ChatResponse,
    CrystallizeRequest,
    DashboardOut,
    LedgerEntryCreateRequest,
    LedgerEntryOut,
    LedgerSummaryOut,
    ScoringTemplateCreate,
    ScoringTemplateOut,
    SubmissionCreateRequest,
    SubmissionOut,
    SubmissionReviewRequest,
)
from app.services.data_estate.allocation_overlay import AllocationOverlay
from app.services.data_estate.context_builder import build_estate_context
from app.services.data_estate.ingestion_pipeline import compute_file_hash
from app.services.data_estate.model_router import ModelRouter
from app.services.data_estate.scoring_engine import ScoringEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data-estate", tags=["data-estate"])


# ── Submissions (The Scroll) ──────────────────────────────────────


@router.post("/submit", response_model=SubmissionOut)
async def submit_document(
    body: SubmissionCreateRequest,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a document for moderation and eventual crystallization."""
    file_hash = compute_file_hash(body.raw_text)

    # Check for duplicates
    existing = await db.execute(
        select(EstateSubmission).where(
            EstateSubmission.org_id == user.organization_id,
            EstateSubmission.file_hash == file_hash,
            EstateSubmission.status != "rejected",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A document with identical content already exists",
        )

    submission = EstateSubmission(
        org_id=user.organization_id,
        title=body.title,
        raw_text=body.raw_text,
        file_hash=file_hash,
        status="pending",
        submitted_by=user.id,
        estate_tag=body.estate_tag,
    )
    db.add(submission)
    await db.flush()

    return SubmissionOut(
        id=submission.id,
        org_id=submission.org_id,
        title=submission.title,
        status=submission.status,
        estate_tag=submission.estate_tag,
        submitted_by=submission.submitted_by,
        created_at=submission.created_at,
        updated_at=submission.updated_at,
    )


@router.get("/submissions", response_model=list[SubmissionOut])
async def list_submissions(
    status_filter: str | None = None,
    estate_tag: str | None = None,
    limit: int = 50,
    offset: int = 0,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List submissions (operator+ sees all, others see own)."""
    stmt = (
        select(EstateSubmission)
        .where(EstateSubmission.org_id == user.organization_id)
        .order_by(EstateSubmission.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if status_filter:
        stmt = stmt.where(EstateSubmission.status == status_filter)
    if estate_tag:
        stmt = stmt.where(EstateSubmission.estate_tag == estate_tag)
    # Non-operators only see their own submissions
    if user.role not in ("operator", "admin"):
        stmt = stmt.where(EstateSubmission.submitted_by == user.id)

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        SubmissionOut(
            id=r.id,
            org_id=r.org_id,
            title=r.title,
            status=r.status,
            estate_tag=r.estate_tag,
            submitted_by=r.submitted_by,
            reviewed_by=r.reviewed_by,
            review_note=r.review_note,
            dataset_id=r.dataset_id,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.post("/submissions/{submission_id}/review", response_model=SubmissionOut)
async def review_submission(
    submission_id: uuid.UUID,
    body: SubmissionReviewRequest,
    user: Any = Depends(require_role("operator")),
    db: AsyncSession = Depends(get_db),
):
    """Approve or reject a submission. Approval triggers crystallization."""
    result = await db.execute(
        select(EstateSubmission).where(EstateSubmission.id == submission_id)
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.status != "pending":
        raise HTTPException(
            status_code=400, detail=f"Submission already {submission.status}"
        )

    submission.status = "approved" if body.action == "approve" else "rejected"
    submission.reviewed_by = user.id
    submission.review_note = body.note
    await db.flush()

    # On approval, trigger crystallization via Celery
    if body.action == "approve":
        try:
            from app.tasks.data_estate_crystallize import crystallize_estate_task

            crystallize_estate_task.delay(
                submission_id=str(submission.id),
                org_id=str(submission.org_id),
            )
        except Exception as exc:
            logger.warning("Failed to queue crystallization: %s", exc)

    return SubmissionOut(
        id=submission.id,
        org_id=submission.org_id,
        title=submission.title,
        status=submission.status,
        estate_tag=submission.estate_tag,
        submitted_by=submission.submitted_by,
        reviewed_by=submission.reviewed_by,
        review_note=submission.review_note,
        dataset_id=submission.dataset_id,
        created_at=submission.created_at,
        updated_at=submission.updated_at,
    )


@router.get("/scroll", response_model=list[SubmissionOut])
async def get_scroll(
    estate_tag: str = "default",
    limit: int = 50,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Public view of approved documents in the estate."""
    result = await db.execute(
        select(EstateSubmission)
        .where(
            EstateSubmission.org_id == user.organization_id,
            EstateSubmission.status == "approved",
            EstateSubmission.estate_tag == estate_tag,
        )
        .order_by(EstateSubmission.created_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        SubmissionOut(
            id=r.id,
            org_id=r.org_id,
            title=r.title,
            status=r.status,
            estate_tag=r.estate_tag,
            submitted_by=r.submitted_by,
            reviewed_by=r.reviewed_by,
            dataset_id=r.dataset_id,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


# ── Modules ────────────────────────────────────────────────────────


@router.get("/modules")
async def list_estate_modules(
    limit: int = 50,
    min_quality: float = 0.0,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List crystallized estate modules from the registry."""
    result = await db.execute(
        select(ModuleRegistryEntry)
        .where(
            ModuleRegistryEntry.vertical == "data_estate",
            ModuleRegistryEntry.quality_score >= min_quality,
        )
        .order_by(ModuleRegistryEntry.quality_score.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "module_type": r.module_type,
            "purity": r.purity,
            "quality_score": r.quality_score,
            "members": r.members,
            "description": r.description,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# ── Ledger ──────────────────────────────────────────────────────────


@router.get("/ledger", response_model=list[LedgerEntryOut])
async def list_ledger(
    category_tag: str | None = None,
    limit: int = 100,
    offset: int = 0,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List allocation ledger entries."""
    overlay = AllocationOverlay(db)
    entries = await overlay.list_entries(
        org_id=user.organization_id,
        category_tag=category_tag,
        limit=limit,
        offset=offset,
    )
    return [
        LedgerEntryOut(
            id=e.id,
            org_id=e.org_id,
            amount=e.amount,
            label=e.label,
            category_tag=e.category_tag,
            version=e.version,
            effective_date=e.effective_date,
            created_by=e.created_by,
            metadata=e.metadata_,
            created_at=e.created_at,
        )
        for e in entries
    ]


@router.post("/ledger", response_model=LedgerEntryOut)
async def create_ledger_entry(
    body: LedgerEntryCreateRequest,
    user: Any = Depends(require_role("operator")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new ledger entry."""
    overlay = AllocationOverlay(db)
    entry = await overlay.create_entry(
        org_id=user.organization_id,
        amount=body.amount,
        label=body.label,
        category_tag=body.category_tag,
        effective_date=body.effective_date,
        created_by=user.id,
        metadata=body.metadata,
    )
    return LedgerEntryOut(
        id=entry.id,
        org_id=entry.org_id,
        amount=entry.amount,
        label=entry.label,
        category_tag=entry.category_tag,
        version=entry.version,
        effective_date=entry.effective_date,
        created_by=entry.created_by,
        metadata=entry.metadata_,
        created_at=entry.created_at,
    )


@router.get("/ledger/summary", response_model=LedgerSummaryOut)
async def ledger_summary(
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated ledger summary."""
    overlay = AllocationOverlay(db)
    summary = await overlay.get_summary(user.organization_id)
    return LedgerSummaryOut(**summary)


# ── Allocation Requests ─────────────────────────────────────────────


@router.post("/allocations/request", response_model=AllocationRequestOut)
async def create_allocation_request(
    body: AllocationRequestCreate,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit an allocation request with AI scoring."""
    # Load scoring templates for this org
    tmpl_result = await db.execute(
        select(EstateScoringTemplate).where(
            EstateScoringTemplate.org_id == user.organization_id,
            EstateScoringTemplate.is_active == True,  # noqa: E712
        )
    )
    templates = [
        {
            "name": t.name,
            "weight": t.weight,
            "evaluator_type": t.evaluator_type,
            "evaluator_config": t.evaluator_config,
            "is_active": t.is_active,
        }
        for t in tmpl_result.scalars().all()
    ]

    # Load recent requests for duplicate detection
    recent_result = await db.execute(
        select(EstateAllocationRequest)
        .where(EstateAllocationRequest.org_id == user.organization_id)
        .order_by(EstateAllocationRequest.created_at.desc())
        .limit(20)
    )
    recent = [
        {
            "justification": r.justification,
            "amount": r.amount,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in recent_result.scalars().all()
    ]

    # Score the request
    router_instance = ModelRouter()
    engine = ScoringEngine(model_router=router_instance)
    score_result = await engine.score(
        amount=body.amount,
        justification=body.justification,
        category_tag=body.category_tag,
        templates=templates,
        recent_requests=recent,
    )

    alloc = EstateAllocationRequest(
        org_id=user.organization_id,
        amount=body.amount,
        justification=body.justification,
        category_tag=body.category_tag,
        score_result=score_result.to_dict(),
        status="pending",
        requested_by=user.id,
    )
    db.add(alloc)
    await db.flush()

    return AllocationRequestOut(
        id=alloc.id,
        org_id=alloc.org_id,
        amount=alloc.amount,
        justification=alloc.justification,
        category_tag=alloc.category_tag,
        score_result=alloc.score_result,
        status=alloc.status,
        requested_by=alloc.requested_by,
        created_at=alloc.created_at,
    )


@router.get("/allocations", response_model=list[AllocationRequestOut])
async def list_allocations(
    status_filter: str | None = None,
    limit: int = 50,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List allocation requests."""
    stmt = (
        select(EstateAllocationRequest)
        .where(EstateAllocationRequest.org_id == user.organization_id)
        .order_by(EstateAllocationRequest.created_at.desc())
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(EstateAllocationRequest.status == status_filter)

    result = await db.execute(stmt)
    return [
        AllocationRequestOut(
            id=r.id,
            org_id=r.org_id,
            amount=r.amount,
            justification=r.justification,
            category_tag=r.category_tag,
            score_result=r.score_result,
            status=r.status,
            requested_by=r.requested_by,
            decided_by=r.decided_by,
            decision_note=r.decision_note,
            created_at=r.created_at,
        )
        for r in result.scalars().all()
    ]


@router.post("/allocations/{alloc_id}/decide", response_model=AllocationRequestOut)
async def decide_allocation(
    alloc_id: uuid.UUID,
    body: AllocationDecisionRequest,
    user: Any = Depends(require_role("operator")),
    db: AsyncSession = Depends(get_db),
):
    """Admin decision on an allocation request."""
    result = await db.execute(
        select(EstateAllocationRequest).where(EstateAllocationRequest.id == alloc_id)
    )
    alloc = result.scalar_one_or_none()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation request not found")

    status_map = {"approve": "approved", "deny": "denied", "flag": "flagged"}
    alloc.status = status_map[body.action]
    alloc.decided_by = user.id
    alloc.decision_note = body.note
    await db.flush()

    # On approval, auto-create ledger entry
    if body.action == "approve":
        overlay = AllocationOverlay(db)
        await overlay.create_entry(
            org_id=alloc.org_id,
            amount=alloc.amount,
            label=alloc.justification[:500],
            category_tag=alloc.category_tag,
            effective_date=alloc.created_at.date(),
            created_by=user.id,
        )

    return AllocationRequestOut(
        id=alloc.id,
        org_id=alloc.org_id,
        amount=alloc.amount,
        justification=alloc.justification,
        category_tag=alloc.category_tag,
        score_result=alloc.score_result,
        status=alloc.status,
        requested_by=alloc.requested_by,
        decided_by=alloc.decided_by,
        decision_note=alloc.decision_note,
        created_at=alloc.created_at,
    )


# ── Chat ────────────────────────────────────────────────────────────


@router.post("/chat", response_model=ChatResponse)
async def estate_chat(
    body: ChatRequest,
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """RAG-powered chat over the estate's crystallized knowledge."""
    # Load modules
    mod_result = await db.execute(
        select(ModuleRegistryEntry)
        .where(ModuleRegistryEntry.vertical == "data_estate")
        .order_by(ModuleRegistryEntry.quality_score.desc())
        .limit(20)
    )
    modules = [
        {
            "id": str(m.id),
            "module_type": m.module_type,
            "purity": m.purity,
            "quality_score": m.quality_score,
            "members": m.members,
            "description": m.description,
        }
        for m in mod_result.scalars().all()
    ]

    # Load submissions
    sub_result = await db.execute(
        select(EstateSubmission)
        .where(
            EstateSubmission.org_id == user.organization_id,
            EstateSubmission.estate_tag == body.estate_tag,
        )
        .order_by(EstateSubmission.created_at.desc())
        .limit(10)
    )
    submissions = [
        {"title": s.title, "status": s.status}
        for s in sub_result.scalars().all()
    ]

    # Load ledger
    overlay = AllocationOverlay(db)
    ledger_entries = await overlay.list_entries(user.organization_id, limit=20)
    ledger_dicts = [
        {"amount": e.amount, "category_tag": e.category_tag, "label": e.label}
        for e in ledger_entries
    ]

    # Load pending allocations
    alloc_result = await db.execute(
        select(EstateAllocationRequest).where(
            EstateAllocationRequest.org_id == user.organization_id,
            EstateAllocationRequest.status == "pending",
        )
    )
    pending = [
        {"amount": a.amount, "category_tag": a.category_tag}
        for a in alloc_result.scalars().all()
    ]

    # Build context and complete
    context = build_estate_context(modules, submissions, ledger_dicts, pending)
    model = ModelRouter()

    system_prompt = (
        "You are a knowledgeable assistant for a data estate. "
        "You have access to the estate's crystallized knowledge modules, "
        "submission history, and allocation data. Use this context to "
        "answer questions accurately and cite relevant modules.\n\n"
        f"ESTATE CONTEXT:\n{context}"
    )

    answer = await model.complete(body.question, system=system_prompt)

    return ChatResponse(
        answer=answer,
        sources=[m["id"] for m in modules[:5]],
        module_hits=len(modules),
    )


# ── Dashboard ───────────────────────────────────────────────────────


@router.get("/dashboard", response_model=DashboardOut)
async def estate_dashboard(
    user: Any = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Command center aggregated metrics."""
    org_id = user.organization_id

    # Submission counts
    sub_result = await db.execute(
        select(EstateSubmission.status, func.count(EstateSubmission.id))
        .where(EstateSubmission.org_id == org_id)
        .group_by(EstateSubmission.status)
    )
    sub_counts = dict(sub_result.all())
    total_subs = sum(sub_counts.values())
    pending_subs = sub_counts.get("pending", 0)
    approved_subs = sub_counts.get("approved", 0)

    # Module counts
    mod_result = await db.execute(
        select(ModuleRegistryEntry.module_type, func.count(ModuleRegistryEntry.id))
        .where(ModuleRegistryEntry.vertical == "data_estate")
        .group_by(ModuleRegistryEntry.module_type)
    )
    mod_counts = dict(mod_result.all())
    total_modules = sum(mod_counts.values())

    # Ledger
    overlay = AllocationOverlay(db)
    ledger_summary = await overlay.get_summary(org_id)

    # Pending allocations
    alloc_result = await db.execute(
        select(func.count(EstateAllocationRequest.id)).where(
            EstateAllocationRequest.org_id == org_id,
            EstateAllocationRequest.status == "pending",
        )
    )
    pending_allocs = alloc_result.scalar() or 0

    return DashboardOut(
        total_submissions=total_subs,
        pending_submissions=pending_subs,
        approved_submissions=approved_subs,
        total_modules=total_modules,
        modules_by_type=mod_counts,
        ledger_total=ledger_summary["total_allocated"],
        ledger_categories=len(ledger_summary["category_totals"]),
        allocation_requests_pending=pending_allocs,
    )
