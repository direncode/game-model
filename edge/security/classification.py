"""Classification marking system for all engine outputs."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class ClassificationLevel(str, Enum):
    """Standard US classification levels."""

    UNCLASSIFIED = "UNCLASSIFIED"
    CUI = "CUI"
    CONFIDENTIAL = "CONFIDENTIAL"
    SECRET = "SECRET"
    TOP_SECRET = "TOP SECRET"


# Ordered from lowest to highest for comparison
_LEVEL_ORDER = {
    ClassificationLevel.UNCLASSIFIED: 0,
    ClassificationLevel.CUI: 1,
    ClassificationLevel.CONFIDENTIAL: 2,
    ClassificationLevel.SECRET: 3,
    ClassificationLevel.TOP_SECRET: 4,
}


@dataclass
class ClassificationBanner:
    """A classification banner with optional caveats (e.g. NOFORN)."""

    level: ClassificationLevel
    caveats: list[str] = field(default_factory=list)

    def __str__(self) -> str:
        base = self.level.value
        if self.caveats:
            base += "//" + "/".join(self.caveats)
        return base

    def as_header(self) -> str:
        """Format for placement at the top of a document."""
        return f"// {self} //"

    def as_footer(self) -> str:
        """Format for placement at the bottom of a document."""
        return f"// {self} //"


class ClassificationMarker:
    """Marks all outputs with classification level.

    Every API response, export file, and narrative produced by the engine
    is wrapped with the appropriate classification banner so that data
    at rest and in transit carries its marking.
    """

    def __init__(
        self,
        default_level: ClassificationLevel = ClassificationLevel.UNCLASSIFIED,
    ) -> None:
        self._default = default_level

    @property
    def default_level(self) -> ClassificationLevel:
        return self._default

    def mark_api_response(
        self,
        data: dict,
        level: ClassificationLevel | None = None,
        caveats: list[str] | None = None,
    ) -> dict:
        """Wrap API response with classification header/footer."""
        effective = level or self._default
        banner = ClassificationBanner(effective, caveats or [])
        return {
            "_classification": str(banner),
            "_classification_level": effective.value,
            "_marked_at": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }

    def mark_export(
        self,
        data: bytes,
        level: ClassificationLevel,
        format: str = "text",
        caveats: list[str] | None = None,
    ) -> bytes:
        """Prepend/append classification to exported files."""
        banner = ClassificationBanner(level, caveats or [])
        header = banner.as_header().encode("utf-8")
        footer = banner.as_footer().encode("utf-8")

        if format == "text":
            return header + b"\n\n" + data + b"\n\n" + footer + b"\n"
        # For binary formats, prepend a metadata block
        meta = f"CLASSIFICATION:{banner}\n".encode("utf-8")
        return meta + data

    def derive_classification(
        self, source_levels: list[ClassificationLevel]
    ) -> ClassificationLevel:
        """Derived classification = highest of all sources.

        When data from multiple classification levels is combined,
        the result inherits the highest level present.
        """
        if not source_levels:
            return self._default
        return max(source_levels, key=lambda l: _LEVEL_ORDER.get(l, 0))
