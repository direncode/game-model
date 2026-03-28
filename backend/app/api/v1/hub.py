"""Dataset Hub endpoints — search, preview, and import from Hugging Face."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.db.neo4j import get_neo4j, Neo4jConnection
from app.db.session import get_db
from app.services.hub import hf_importer

router = APIRouter(prefix="/hub", tags=["hub"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class HubSearchResult(BaseModel):
    id: str
    name: str
    author: str
    description: str
    downloads: int
    likes: int
    tags: list[str]
    last_modified: str


class HubDatasetInfo(BaseModel):
    id: str
    name: str
    author: str
    description: str
    downloads: int
    likes: int
    tags: list[str]
    configs: list[str]
    splits: list[str]
    columns: list[dict]
    sample_rows: list[dict]
    last_modified: str


class ImportRequest(BaseModel):
    hf_dataset_id: str
    name: str | None = None
    config: str | None = None
    split: str | None = None
    max_rows: int = 10000


class ImportResponse(BaseModel):
    dataset_id: str
    dataset_name: str
    hf_dataset_id: str
    entity_count: int
    relationship_count: int
    status: str


class CategoryResponse(BaseModel):
    name: str
    tags: list[str]


class FeaturedDataset(BaseModel):
    id: str
    name: str
    description: str
    tags: list[str]
    category: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/search", response_model=list[HubSearchResult])
async def search_hub_datasets(
    q: str = Query(..., min_length=1, description="Search query"),
    category: str | None = Query(None, description="Filter by category name"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_active_user),
):
    """Search Hugging Face datasets by keyword."""
    results = await hf_importer.search_datasets(
        query=q, limit=limit, offset=offset, category=category
    )
    return results


@router.get("/dataset/{dataset_id:path}", response_model=HubDatasetInfo)
async def get_hub_dataset_info(
    dataset_id: str,
    user=Depends(get_current_active_user),
):
    """Get detailed info about a specific Hugging Face dataset."""
    return await hf_importer.get_dataset_info(dataset_id)


@router.post("/import", response_model=ImportResponse)
async def import_hub_dataset(
    body: ImportRequest,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j),
):
    """Import a Hugging Face dataset into the platform."""
    result = await hf_importer.import_dataset(
        hf_dataset_id=body.hf_dataset_id,
        user_id=user.id,
        db=db,
        neo4j=neo4j,
        name=body.name,
        config=body.config,
        split=body.split,
        max_rows=body.max_rows,
    )
    return result


@router.get("/categories", response_model=list[CategoryResponse])
async def get_hub_categories(
    user=Depends(get_current_active_user),
):
    """Get available dataset categories with their HF tag mappings."""
    return hf_importer.get_categories()


@router.get("/featured", response_model=list[FeaturedDataset])
async def get_hub_featured(
    user=Depends(get_current_active_user),
):
    """Get curated featured datasets recommended for TCD-JEPA analysis."""
    return hf_importer.get_featured()
