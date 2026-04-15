"""CSV/TSV file connector — load any tabular file as entities."""
from __future__ import annotations

import csv
import io
import logging
from pathlib import Path
from typing import Any

from ..base import BaseDatasetAdapter, DatasetMeta, EntityTypeConfig

logger = logging.getLogger(__name__)


def _sniff_delimiter(sample: str) -> str:
    """Auto-detect CSV delimiter from a text sample."""
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t;|")
        return dialect.delimiter
    except csv.Error:
        return ","


def _singularize(name: str) -> str:
    """Naive English singularization for entity type names."""
    if not name:
        return name
    lower = name.lower()
    if lower.endswith("ies") and len(lower) > 3:
        return name[:-3] + "y"
    if lower.endswith("s") and not lower.endswith("ss"):
        return name[:-1]
    return name


class CSVConnector(BaseDatasetAdapter):
    """Connect to CSV/TSV files.

    Usage::

        connector = CSVConnector("/path/to/data.csv")
        connector = CSVConnector("/path/to/data.tsv", delimiter="\\t")
        connector = CSVConnector(csv_string, from_string=True)
    """

    def __init__(
        self,
        source: str,
        delimiter: str | None = None,
        entity_type: str | None = None,
        name_column: str | None = None,
        from_string: bool = False,
        encoding: str = "utf-8",
    ) -> None:
        self._source = source
        self._from_string = from_string
        self._encoding = encoding
        self._name_column = name_column

        # Read raw text
        if from_string:
            self._text = source
            self._source_name = "csv_input"
        else:
            path = Path(source)
            if not path.exists():
                raise FileNotFoundError(f"CSV file not found: {source}")
            self._text = path.read_text(encoding=encoding)
            self._source_name = path.stem

        # Delimiter: explicit, or auto-detect
        if delimiter is not None:
            self._delimiter = delimiter
        else:
            sample = self._text[:8192]
            self._delimiter = _sniff_delimiter(sample)

        # Entity type: explicit, or derived from filename
        self._entity_type = entity_type or _singularize(self._source_name)

        # Parse once
        self._rows: list[dict] = []
        self._headers: list[str] = []
        self._parse()

    # ------------------------------------------------------------------ #
    #  Parsing
    # ------------------------------------------------------------------ #

    def _parse(self) -> None:
        """Parse CSV text into list of dicts."""
        reader = csv.DictReader(
            io.StringIO(self._text),
            delimiter=self._delimiter,
        )
        self._headers = list(reader.fieldnames or [])
        self._rows = list(reader)

        # If no name_column specified, pick a sensible default
        if self._name_column is None:
            self._name_column = self._pick_name_column()

        logger.info(
            "Parsed %d rows, %d columns from %s (delimiter=%r)",
            len(self._rows),
            len(self._headers),
            self._source_name,
            self._delimiter,
        )

    def _pick_name_column(self) -> str:
        """Heuristic to choose the name/identifier column."""
        # Prefer columns named 'name', 'id', 'title', 'key'
        priority = ["name", "title", "label", "key", "id"]
        lower_headers = {h.lower(): h for h in self._headers}
        for candidate in priority:
            if candidate in lower_headers:
                return lower_headers[candidate]
        # Fall back to first column
        return self._headers[0] if self._headers else ""

    # ------------------------------------------------------------------ #
    #  BaseDatasetAdapter interface
    # ------------------------------------------------------------------ #

    def get_meta(self) -> DatasetMeta:
        """Return metadata about this CSV dataset."""
        # Detect primary/secondary fields
        primary = self._name_column or (self._headers[0] if self._headers else "name")
        secondary = ""
        for h in self._headers:
            if h != primary:
                secondary = h
                break

        return DatasetMeta(
            dataset_id=f"csv:{self._source_name}",
            display_name=f"CSV: {self._source_name}",
            description=f"{len(self._rows)} rows, {len(self._headers)} columns",
            entity_types=[
                EntityTypeConfig(
                    name=self._entity_type,
                    color="#00d4ff",
                    primary_field=primary,
                    secondary_field=secondary,
                    detail_fields=self._headers[:8],
                )
            ],
            lookup_field="name",
            lookup_label="Row",
        )

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        """Convert CSV rows to entities."""
        entities: list[dict] = []
        for idx, row in enumerate(self._rows[:limit]):
            # Determine entity name
            if self._name_column and self._name_column in row:
                name = str(row[self._name_column])
            else:
                name = f"{self._entity_type}:{idx}"

            # Build attributes, coercing numeric strings
            attributes: dict[str, Any] = {}
            for key, value in row.items():
                if value is None or value == "":
                    continue
                attributes[key] = _coerce_value(value)

            entities.append({
                "name": name,
                "type": self._entity_type,
                "attributes": attributes,
            })

        logger.info("Produced %d entities from CSV", len(entities))
        return entities

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        """Infer edges from columns ending in _id (FK-like references).

        If a column ``user_id`` exists and there are entities of type
        ``user``, create an edge from the current entity to the referenced
        entity.
        """
        # Build entity index: (type, attribute_value) -> entity_name
        entity_index: dict[tuple[str, str], str] = {}
        for ent in entities:
            ename = ent["name"]
            etype = ent["type"]
            entity_index[(etype, ename)] = ename
            for k, v in ent.get("attributes", {}).items():
                entity_index[(etype, str(v))] = ename

        # Detect _id columns
        id_columns = [h for h in self._headers if h.endswith("_id")]
        edges: list[dict] = []

        for ent in entities:
            attrs = ent.get("attributes", {})
            for col in id_columns:
                ref_value = attrs.get(col)
                if ref_value is None:
                    continue
                # The referenced type is the column name minus _id
                ref_type = _singularize(col[:-3])
                target_key = (ref_type, str(ref_value))
                target_name = entity_index.get(target_key)
                if target_name and target_name != ent["name"]:
                    edges.append({
                        "source": ent["name"],
                        "target": target_name,
                        "type": f"{self._entity_type}_to_{ref_type}",
                        "weight": 1.0,
                    })

        logger.info("Inferred %d edges from CSV _id columns", len(edges))
        return edges

    def get_anomaly_tags(
        self,
        record: dict,
        scores: dict,
        cluster_size: int,
        flips: int,
    ) -> list[dict]:
        """Generic anomaly tags for CSV entities."""
        return _generic_anomaly_tags(record, scores, cluster_size, flips)


# ── Shared helpers ─────────────────────────────────────────────────────


def _coerce_value(value: str) -> Any:
    """Try to coerce a string to int or float."""
    try:
        return int(value)
    except (ValueError, TypeError):
        pass
    try:
        return float(value)
    except (ValueError, TypeError):
        pass
    return value


def _generic_anomaly_tags(
    record: dict,
    scores: dict,
    cluster_size: int,
    flips: int,
) -> list[dict]:
    """Reusable anomaly-tag logic for file-based connectors."""
    tags: list[dict] = []
    isolation = scores.get("isolation_score", 0)
    anomaly_score = scores.get("anomaly_score", 0)

    if isolation > 0.9:
        tags.append({
            "tag": "HIGHLY_ISOLATED",
            "severity": "high",
            "description": f"Isolation score {isolation:.2f}",
        })
    elif isolation > 0.7:
        tags.append({
            "tag": "ISOLATED",
            "severity": "medium",
            "description": f"Isolation score {isolation:.2f}",
        })

    if cluster_size <= 2:
        tags.append({
            "tag": "MICRO_CLUSTER",
            "severity": "medium",
            "description": f"Cluster of only {cluster_size} entities",
        })

    if flips >= 5:
        tags.append({
            "tag": "UNSTABLE_ASSIGNMENT",
            "severity": "high",
            "description": f"Cluster assignment changed {flips} times",
        })

    if anomaly_score > 0.95:
        tags.append({
            "tag": "STATISTICAL_OUTLIER",
            "severity": "critical",
            "description": f"Anomaly score {anomaly_score:.3f}",
        })
    elif anomaly_score > 0.8:
        tags.append({
            "tag": "ANOMALOUS",
            "severity": "high",
            "description": f"Anomaly score {anomaly_score:.3f}",
        })

    attrs = record.get("attributes", {})
    missing = sum(1 for v in attrs.values() if v is None or v == "")
    if attrs and missing / len(attrs) > 0.5:
        tags.append({
            "tag": "SPARSE_DATA",
            "severity": "info",
            "description": f"{missing}/{len(attrs)} attributes empty",
        })

    if not tags:
        tags.append({
            "tag": "NORMAL",
            "severity": "info",
            "description": "No anomalies detected",
        })

    return tags
