"""Base adapter for BTUT multi-dataset support.

Each dataset (EDGAR, PubMed, Patents, etc.) implements this interface
to provide domain-specific entity construction, anomaly tagging,
and display configuration while sharing the same BTUT core pipeline.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class EntityTypeConfig:
    """Display configuration for an entity type within a dataset."""

    name: str  # e.g. "company", "paper", "patent"
    color: str  # Hex color for UI, e.g. "#00d4ff"
    primary_field: str  # Attribute key for display name, e.g. "company_name"
    secondary_field: str = ""  # Attribute key for subtitle, e.g. "ticker"
    detail_fields: list[str] = field(default_factory=list)  # Extra fields to show


@dataclass
class DatasetMeta:
    """Metadata about a dataset for the UI and query engine."""

    dataset_id: str  # e.g. "edgar", "pubmed"
    display_name: str  # e.g. "SEC EDGAR"
    description: str  # One-line description
    entity_types: list[EntityTypeConfig] = field(default_factory=list)
    lookup_field: str = "name"  # Primary lookup key in attributes (e.g. "ticker", "pmid")
    lookup_label: str = "ID"  # UI label for that field (e.g. "Ticker", "PMID")


class BaseDatasetAdapter(ABC):
    """Abstract base class for dataset adapters.

    Each adapter knows how to:
    1. Fetch entities and edges from its data source
    2. Generate domain-specific anomaly tags
    3. Provide display configuration for the UI
    """

    @abstractmethod
    def get_meta(self) -> DatasetMeta:
        """Return static metadata about this dataset."""
        ...

    @abstractmethod
    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        """Fetch entities in {name, type, attributes} format.

        The attributes dict can contain any mix of:
        - Text values (str) -> embedded via text projector
        - Numeric values (int, float) -> embedded via numeric projector
        - Time-series (list[float]) -> embedded via time-series projector
        """
        ...

    @abstractmethod
    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        """Derive edges from the fetched entities.

        Returns list of {source, target, type, weight} dicts.
        Source and target must match entity name fields.
        """
        ...

    @abstractmethod
    def get_anomaly_tags(
        self,
        record: dict,
        scores: dict,
        cluster_size: int,
        flips: int,
    ) -> list[dict]:
        """Generate domain-specific anomaly tags for an entity.

        Returns list of {tag: str, severity: str, description: str}.
        Severity: "critical", "high", "medium", "info".

        Note: Generic BTUT tags (EXTREME_OUTLIER, UNIQUE_FINGERPRINT, etc.)
        are handled by the query engine. This method adds DOMAIN-SPECIFIC
        tags only (e.g., RECENT_CIK for EDGAR, RETRACTED for PubMed).
        """
        ...

    def get_data_quality_signals(self, record: dict) -> list[str]:
        """Check for missing or suspicious attributes.

        Returns list of signal strings. Default: check that primary/secondary
        fields from entity type config are present.
        """
        meta = self.get_meta()
        attrs = record.get("attributes", {})
        entity_type = record.get("type", "")
        signals = []

        for tc in meta.entity_types:
            if tc.name == entity_type:
                if tc.primary_field and not attrs.get(tc.primary_field):
                    signals.append(f"MISSING_{tc.primary_field.upper()}: Expected {tc.primary_field} for {entity_type}")
                break

        return signals if signals else ["CLEAN: All expected attributes present"]

    def get_display_fields(self, record: dict) -> dict:
        """Map entity attributes to display fields.

        Returns {primary: str, secondary: str, detail: dict}.
        Default implementation uses EntityTypeConfig.
        """
        meta = self.get_meta()
        attrs = record.get("attributes", {})
        entity_type = record.get("type", "")

        for tc in meta.entity_types:
            if tc.name == entity_type:
                return {
                    "primary": str(attrs.get(tc.primary_field, record.get("name", ""))),
                    "secondary": str(attrs.get(tc.secondary_field, "")) if tc.secondary_field else "",
                    "detail": {k: attrs.get(k, "") for k in tc.detail_fields if attrs.get(k)},
                }

        return {"primary": record.get("name", ""), "secondary": "", "detail": {}}

    def get_type_colors(self) -> dict[str, str]:
        """Return {type_name: hex_color} mapping for the UI."""
        return {tc.name: tc.color for tc in self.get_meta().entity_types}
