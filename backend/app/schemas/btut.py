"""Pydantic response schemas for BTUT query endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ScoresResponse(BaseModel):
    composite: float = 0
    diversity: float = 0
    reconstruction: float = 0
    anomaly: float = 0


class SurvivorResponse(BaseModel):
    rank: int = 0
    name: str = ""
    ticker: str = ""
    type: str = ""
    cik: str = ""
    cluster: int = -1
    flips: int = 0
    fingerprint: str = ""
    scores: ScoresResponse = Field(default_factory=ScoresResponse)
    anomaly_story: str = ""


class SurvivorListResponse(BaseModel):
    survivors: list[SurvivorResponse]
    total: int = 0
    entity_type_filter: str | None = None
    sort_by: str = "composite"


class BTUTStatusResponse(BaseModel):
    pipeline_status: str = "no_data"
    total_entities: int = 0
    total_clusters: int = 0
    unique_fingerprints: int = 0
    survivor_count: int = 0
    reduction_ratio: int = 0
    survivor_types: dict[str, int] = Field(default_factory=dict)
    reconstruction: dict = Field(default_factory=dict)
    wall_seconds: float = 0
    result_file: str = ""


class TypeStats(BaseModel):
    count: int = 0
    avg_composite: float = 0
    avg_anomaly: float = 0
    max_composite: float = 0
    max_anomaly: float = 0


class TopEntry(BaseModel):
    name: str = ""
    ticker: str = ""
    type: str = ""
    composite: float = 0


class ExtrapolationResponse(BaseModel):
    entities: int = 0
    estimated_survivors: int = 0
    estimated_hours: float = 0


class BTUTSummaryResponse(BaseModel):
    total_entities: int = 0
    total_clusters: int = 0
    unique_fingerprints: int = 0
    survivor_count: int = 0
    reduction_ratio: int = 0
    survivor_types: dict[str, int] = Field(default_factory=dict)
    reconstruction: dict = Field(default_factory=dict)
    type_statistics: dict[str, TypeStats] = Field(default_factory=dict)
    top_5_overall: list[TopEntry] = Field(default_factory=list)
    wall_seconds: float = 0
    extrapolation_3000tb: ExtrapolationResponse = Field(default_factory=ExtrapolationResponse)


class LatticeProfile(BaseModel):
    total_flips: int = 0
    total_rotations: int = 48
    flip_rate: float = 0
    fingerprint_48bit: str = ""
    coarse_resolution: str = ""
    medium_resolution: str = ""
    fine_resolution: str = ""


class PeerResponse(BaseModel):
    name: str = ""
    ticker: str = ""
    type: str = ""
    composite: float = 0


class ClusterInfo(BaseModel):
    id: int = -1
    total_members: int = 0
    peers: list[PeerResponse] = Field(default_factory=list)


class CompanyAnalysisResponse(BaseModel):
    ticker: str = ""
    company_name: str = ""
    cik: str = ""
    entity_type: str = ""
    anomaly_story: str = ""
    scores: ScoresResponse = Field(default_factory=ScoresResponse)
    lattice_profile: LatticeProfile = Field(default_factory=LatticeProfile)
    cluster: ClusterInfo = Field(default_factory=ClusterInfo)
    attributes: dict = Field(default_factory=dict)


class ClusterResponse(BaseModel):
    cluster_id: int = -1
    member_count: int = 0
    type_distribution: dict[str, int] = Field(default_factory=dict)
    avg_composite: float = 0
    max_composite: float = 0
    sample_members: list[PeerResponse] = Field(default_factory=list)


class ClusterListResponse(BaseModel):
    clusters: list[ClusterResponse]
    total: int = 0
    min_size_filter: int = 1


class ResolutionProfile(BaseModel):
    fingerprint: str = ""
    flips: int = 0
    flip_rate: float = 0
    interpretation: str = ""


class MagnitudeResponse(BaseModel):
    ticker: str = ""
    company_name: str = ""
    magnitude_profile: ScoresResponse = Field(default_factory=ScoresResponse)
    multi_resolution_analysis: dict[str, ResolutionProfile] = Field(default_factory=dict)
    total_flips: int = 0
    anomaly_story: str = ""


class SearchHit(BaseModel):
    name: str = ""
    ticker: str = ""
    type: str = ""
    matched_field: str = ""
    composite: float = 0
    is_survivor: bool = False


class SearchResultResponse(BaseModel):
    query: str = ""
    field: str | None = None
    results: list[SearchHit] = Field(default_factory=list)
    total: int = 0
