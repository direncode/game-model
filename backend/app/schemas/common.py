"""Common/shared Pydantic schemas used across the application."""

from __future__ import annotations

import math
from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Query parameters for paginated endpoints."""

    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    per_page: int = Field(default=20, ge=1, le=100, description="Items per page")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper."""

    items: list[T]
    total: int
    page: int
    per_page: int
    pages: int

    @classmethod
    def create(cls, items: list[T], total: int, page: int, per_page: int) -> "PaginatedResponse[T]":
        """Factory that computes page count automatically."""
        return cls(
            items=items,
            total=total,
            page=page,
            per_page=per_page,
            pages=math.ceil(total / per_page) if per_page > 0 else 0,
        )


class MessageResponse(BaseModel):
    """Simple message response."""

    message: str


class ErrorResponse(BaseModel):
    """Error response payload."""

    detail: str
    status_code: int
