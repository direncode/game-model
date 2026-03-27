"""Embedding query endpoints: similarity search and batch computation."""

from __future__ import annotations

import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.db.session import get_db

router = APIRouter(prefix="/embeddings", tags=["embeddings"])


# ── Request / response schemas (endpoint-specific) ───────────────


class EmbeddingQueryRequest(BaseModel):
    """Query for similar entities by embedding."""

    dataset_id: uuid.UUID
    entity_name: Optional[str] = None
    embedding: Optional[list[float]] = None
    top_k: int = Field(default=10, ge=1, le=100)


class SimilarEntityResult(BaseModel):
    """A single similarity result."""

    entity_name: str
    entity_type: str
    similarity: float
    module_id: Optional[uuid.UUID] = None


class BatchSimilarityRequest(BaseModel):
    """Batch similarity computation request."""

    dataset_id: uuid.UUID
    entity_pairs: list[list[str]]


class BatchSimilarityResult(BaseModel):
    """Similarity score for an entity pair."""

    source: str
    target: str
    similarity: float


# ── Endpoints ────────────────────────────────────────────────────


@router.post("/query", response_model=list[SimilarEntityResult])
async def query_similar_entities(
    body: EmbeddingQueryRequest,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Find entities most similar to a query entity or embedding vector.

    This endpoint queries the vector store (pgvector / FAISS) for nearest
    neighbours. The actual implementation depends on the embedding backend
    configured for the deployment.
    """
    # Placeholder: in production, this queries pgvector or a FAISS index
    # stored alongside the crystallization checkpoint.
    return []


@router.post("/batch", response_model=list[BatchSimilarityResult])
async def batch_similarity(
    body: BatchSimilarityRequest,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Compute pairwise similarity for a batch of entity pairs.

    Each pair in *entity_pairs* is a two-element list [source_name, target_name].
    Returns the cosine similarity between their learned embeddings.
    """
    # Placeholder: batch cosine similarity via the embedding backend
    results = []
    for pair in body.entity_pairs:
        if len(pair) == 2:
            results.append(
                BatchSimilarityResult(source=pair[0], target=pair[1], similarity=0.0)
            )
    return results
