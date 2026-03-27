"""Challenge endpoints: create, list, detail, comment, resolve."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_active_user
from app.core.exceptions import NotFoundError
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.challenge import Challenge, ChallengeComment
from app.models.crystallization import CrystallizationJob
from app.schemas.challenge import (
    ChallengeCommentCreate,
    ChallengeCommentResponse,
    ChallengeCreate,
    ChallengeDetailResponse,
    ChallengeResolve,
    ChallengeResponse,
)
from app.schemas.common import PaginatedResponse, PaginationParams

router = APIRouter(tags=["challenges"])


@router.post("/challenges", response_model=ChallengeResponse, status_code=201)
async def create_challenge(
    body: ChallengeCreate,
    user=Depends(require_permission("create_challenges")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new challenge (analyst+ only)."""
    # Find the latest completed job for the target — we need dataset_id and job_id
    # The caller must supply enough context; derive dataset from target if needed.
    # For now, require a recent completed job that references the target's dataset.
    # We look up by target_id in modules or connections to get dataset_id/job_id.
    from app.models.module import Module, HiddenConnection

    dataset_id: uuid.UUID | None = None
    job_id: uuid.UUID | None = None

    if body.target_type == "module":
        res = await db.execute(select(Module).where(Module.id == body.target_id))
        module = res.scalar_one_or_none()
        if module:
            dataset_id = module.dataset_id
            job_id = module.job_id
    elif body.target_type == "connection":
        res = await db.execute(
            select(HiddenConnection).where(HiddenConnection.id == body.target_id)
        )
        conn = res.scalar_one_or_none()
        if conn:
            job_res = await db.execute(
                select(CrystallizationJob).where(CrystallizationJob.id == conn.job_id)
            )
            job_obj = job_res.scalar_one_or_none()
            if job_obj:
                dataset_id = job_obj.dataset_id
                job_id = job_obj.id

    if dataset_id is None or job_id is None:
        raise NotFoundError(detail="Could not resolve dataset/job for the given target")

    challenge = Challenge(
        dataset_id=dataset_id,
        job_id=job_id,
        challenge_type=body.challenge_type,
        target_type=body.target_type,
        target_id=body.target_id,
        challenger_id=user.id,
        title=body.title,
        reasoning=body.reasoning,
        evidence=body.evidence,
        proposed_resolution=body.proposed_resolution,
        status="open",
    )
    db.add(challenge)
    await db.flush()
    await db.refresh(challenge)
    return challenge


@router.get(
    "/datasets/{dataset_id}/challenges",
    response_model=PaginatedResponse[ChallengeResponse],
)
async def list_challenges(
    dataset_id: uuid.UUID,
    pagination: PaginationParams = Depends(),
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List challenges for a dataset (paginated)."""
    offset = (pagination.page - 1) * pagination.per_page

    count_q = (
        select(func.count())
        .select_from(Challenge)
        .where(Challenge.dataset_id == dataset_id)
    )
    total = (await db.execute(count_q)).scalar_one()

    q = (
        select(Challenge)
        .where(Challenge.dataset_id == dataset_id)
        .order_by(Challenge.created_at.desc())
        .offset(offset)
        .limit(pagination.per_page)
    )
    result = await db.execute(q)
    challenges = result.scalars().all()

    return PaginatedResponse[ChallengeResponse].create(
        items=[ChallengeResponse.model_validate(c) for c in challenges],
        total=total,
        page=pagination.page,
        per_page=pagination.per_page,
    )


@router.get("/challenges/{challenge_id}", response_model=ChallengeDetailResponse)
async def get_challenge_detail(
    challenge_id: uuid.UUID,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get challenge detail with comments."""
    result = await db.execute(
        select(Challenge)
        .options(selectinload(Challenge.comments))
        .where(Challenge.id == challenge_id)
    )
    challenge = result.scalar_one_or_none()
    if challenge is None:
        raise NotFoundError(detail="Challenge not found")
    return challenge


@router.post(
    "/challenges/{challenge_id}/comments",
    response_model=ChallengeCommentResponse,
    status_code=201,
)
async def add_comment(
    challenge_id: uuid.UUID,
    body: ChallengeCommentCreate,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a comment to a challenge."""
    result = await db.execute(select(Challenge).where(Challenge.id == challenge_id))
    if result.scalar_one_or_none() is None:
        raise NotFoundError(detail="Challenge not found")

    comment = ChallengeComment(
        challenge_id=challenge_id,
        author_id=user.id,
        content=body.content,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment)
    return comment


@router.put("/challenges/{challenge_id}/resolve", response_model=ChallengeResponse)
async def resolve_challenge(
    challenge_id: uuid.UUID,
    body: ChallengeResolve,
    user=Depends(require_permission("resolve_challenges")),
    db: AsyncSession = Depends(get_db),
):
    """Resolve a challenge (operator+ only)."""
    result = await db.execute(select(Challenge).where(Challenge.id == challenge_id))
    challenge = result.scalar_one_or_none()
    if challenge is None:
        raise NotFoundError(detail="Challenge not found")

    challenge.status = body.status
    challenge.resolution_reasoning = body.resolution_reasoning
    challenge.resolved_by = user.id
    challenge.resolved_at = datetime.now(timezone.utc)
    db.add(challenge)
    await db.flush()
    await db.refresh(challenge)
    return challenge
