"""Pydantic schemas for the Latent Intelligence platform."""

from app.schemas.common import (
    ErrorResponse,
    MessageResponse,
    PaginatedResponse,
    PaginationParams,
)
from app.schemas.auth import (
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
    UserUpdate,
)
from app.schemas.dataset import (
    DatasetCreate,
    DatasetProfile,
    DatasetResponse,
    EntityTypeResponse,
    RelationshipTypeResponse,
    SchemaMapping,
)
from app.schemas.crystallization import (
    CrystallizationConfig,
    CrystallizationJobResponse,
    TrainingMetricResponse,
)
from app.schemas.module import (
    ConnectionValidate,
    HiddenConnectionResponse,
    ModuleDetailResponse,
    ModuleEntityResponse,
    ModuleRelationshipResponse,
    ModuleResponse,
    ModuleUpdate,
)
from app.schemas.challenge import (
    ChallengeCommentCreate,
    ChallengeCommentResponse,
    ChallengeCreate,
    ChallengeDetailResponse,
    ChallengeResolve,
    ChallengeResponse,
)
from app.schemas.governance import (
    DataClassificationCreate,
    LineageEventResponse,
)
from app.schemas.delivery import (
    AlertRuleCreate,
    AlertRuleResponse,
    AlertRuleUpdate,
    ReportGenerateRequest,
    ReportResponse,
)
from app.schemas.admin import (
    AuditLogListResponse,
    AuditLogResponse,
    UserListResponse,
    UserUpdateRole,
)

__all__ = [
    # common
    "ErrorResponse",
    "MessageResponse",
    "PaginatedResponse",
    "PaginationParams",
    # auth
    "TokenResponse",
    "UserLogin",
    "UserRegister",
    "UserResponse",
    "UserUpdate",
    # dataset
    "DatasetCreate",
    "DatasetProfile",
    "DatasetResponse",
    "EntityTypeResponse",
    "RelationshipTypeResponse",
    "SchemaMapping",
    # crystallization
    "CrystallizationConfig",
    "CrystallizationJobResponse",
    "TrainingMetricResponse",
    # module
    "ConnectionValidate",
    "HiddenConnectionResponse",
    "ModuleDetailResponse",
    "ModuleEntityResponse",
    "ModuleRelationshipResponse",
    "ModuleResponse",
    "ModuleUpdate",
    # challenge
    "ChallengeCommentCreate",
    "ChallengeCommentResponse",
    "ChallengeCreate",
    "ChallengeDetailResponse",
    "ChallengeResolve",
    "ChallengeResponse",
    # governance
    "DataClassificationCreate",
    "LineageEventResponse",
    # delivery
    "AlertRuleCreate",
    "AlertRuleResponse",
    "AlertRuleUpdate",
    "ReportGenerateRequest",
    "ReportResponse",
    # admin
    "AuditLogListResponse",
    "AuditLogResponse",
    "UserListResponse",
    "UserUpdateRole",
]
