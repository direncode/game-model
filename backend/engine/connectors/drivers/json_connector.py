"""JSON and JSON Lines connector — load structured/semi-structured data."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from ..base import BaseDatasetAdapter, DatasetMeta, EntityTypeConfig

logger = logging.getLogger(__name__)


def _singularize(name: str) -> str:
    if not name:
        return name
    lower = name.lower()
    if lower.endswith("ies") and len(lower) > 3:
        return name[:-3] + "y"
    if lower.endswith("s") and not lower.endswith("ss"):
        return name[:-1]
    return name


def _flatten(obj: dict, prefix: str = "", sep: str = ".") -> dict:
    """Flatten a nested dict using dot notation.

    Example::

        {"a": {"b": 1, "c": [2,3]}} -> {"a.b": 1, "a.c": [2, 3]}
    """
    items: dict[str, Any] = {}
    for key, value in obj.items():
        new_key = f"{prefix}{sep}{key}" if prefix else key
        if isinstance(value, dict):
            items.update(_flatten(value, new_key, sep))
        else:
            items[new_key] = value
    return items


class JSONConnector(BaseDatasetAdapter):
    """Connect to JSON or JSON Lines files.

    Handles:
    - Single JSON array: ``[{"name": "...", ...}, ...]``
    - JSON Lines: one JSON object per line
    - Nested JSON: auto-flatten to entities
    - JSON with explicit entities/edges: ``{"entities": [...], "edges": [...]}``

    Usage::

        connector = JSONConnector("/path/to/data.json")
        connector = JSONConnector("/path/to/data.jsonl", format="jsonl")
        connector = JSONConnector(json_string, from_string=True)
    """

    def __init__(
        self,
        source: str,
        format: str | None = None,
        entity_type: str | None = None,
        name_field: str | None = None,
        from_string: bool = False,
        encoding: str = "utf-8",
        flatten_nested: bool = True,
    ) -> None:
        self._source = source
        self._from_string = from_string
        self._name_field = name_field
        self._flatten_nested = flatten_nested

        # Read raw text
        if from_string:
            self._text = source
            self._source_name = "json_input"
        else:
            path = Path(source)
            if not path.exists():
                raise FileNotFoundError(f"JSON file not found: {source}")
            self._text = path.read_text(encoding=encoding)
            self._source_name = path.stem

        # Detect format
        if format is not None:
            self._format = format
        elif not from_string and source.endswith(".jsonl"):
            self._format = "jsonl"
        else:
            self._format = self._detect_format()

        self._entity_type = entity_type or _singularize(self._source_name)

        # Parsed data
        self._records: list[dict] = []
        self._explicit_edges: list[dict] = []
        self._all_keys: set[str] = set()
        self._parse()

    # ------------------------------------------------------------------ #
    #  Parsing
    # ------------------------------------------------------------------ #

    def _detect_format(self) -> str:
        """Detect whether the source is JSON array, JSONL, or nested object."""
        stripped = self._text.lstrip()
        if stripped.startswith("["):
            return "json_array"
        if stripped.startswith("{"):
            # Could be a single object or {entities: [...], edges: [...]}
            return "json_object"
        # Multiple lines starting with { => JSONL
        lines = [l.strip() for l in self._text.strip().split("\n") if l.strip()]
        if lines and all(l.startswith("{") for l in lines[:5]):
            return "jsonl"
        return "json_array"

    def _parse(self) -> None:
        """Parse the source into a list of flat record dicts."""
        if self._format == "jsonl":
            self._parse_jsonl()
        elif self._format == "json_object":
            self._parse_json_object()
        else:
            self._parse_json_array()

        # Collect all keys for metadata
        for rec in self._records:
            self._all_keys.update(rec.keys())

        # Auto-detect name field
        if self._name_field is None:
            self._name_field = self._pick_name_field()

        logger.info(
            "Parsed %d records from %s (format=%s)",
            len(self._records),
            self._source_name,
            self._format,
        )

    def _parse_json_array(self) -> None:
        data = json.loads(self._text)
        if not isinstance(data, list):
            data = [data]
        self._records = [self._flatten_record(r) for r in data if isinstance(r, dict)]

    def _parse_jsonl(self) -> None:
        for line in self._text.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if isinstance(obj, dict):
                    self._records.append(self._flatten_record(obj))
            except json.JSONDecodeError:
                logger.warning("Skipping invalid JSON line: %s...", line[:80])

    def _parse_json_object(self) -> None:
        data = json.loads(self._text)
        if not isinstance(data, dict):
            self._records = [self._flatten_record(data)] if isinstance(data, dict) else []
            return

        # Check for explicit entities/edges structure
        if "entities" in data and isinstance(data["entities"], list):
            self._records = [
                self._flatten_record(r) for r in data["entities"]
                if isinstance(r, dict)
            ]
            if "edges" in data and isinstance(data["edges"], list):
                self._explicit_edges = [
                    e for e in data["edges"] if isinstance(e, dict)
                ]
            return

        # Check for a key whose value is a list of objects (common API pattern)
        for key, value in data.items():
            if isinstance(value, list) and value and isinstance(value[0], dict):
                self._entity_type = _singularize(key)
                self._records = [self._flatten_record(r) for r in value if isinstance(r, dict)]
                return

        # Single object — treat as one record
        self._records = [self._flatten_record(data)]

    def _flatten_record(self, record: dict) -> dict:
        """Optionally flatten nested dicts."""
        if not self._flatten_nested:
            return record
        flat: dict[str, Any] = {}
        for key, value in record.items():
            if isinstance(value, dict):
                for fk, fv in _flatten(value, key).items():
                    flat[fk] = fv
            elif isinstance(value, list):
                # Keep short lists as JSON strings, flatten dicts inside
                if value and isinstance(value[0], dict):
                    flat[key] = json.dumps(value, default=str)
                else:
                    flat[key] = value
            else:
                flat[key] = value
        return flat

    def _pick_name_field(self) -> str:
        priority = ["name", "title", "label", "key", "id", "_id"]
        lower_keys = {k.lower(): k for k in self._all_keys}
        for candidate in priority:
            if candidate in lower_keys:
                return lower_keys[candidate]
        return next(iter(self._all_keys), "")

    # ------------------------------------------------------------------ #
    #  BaseDatasetAdapter interface
    # ------------------------------------------------------------------ #

    def get_meta(self) -> DatasetMeta:
        keys = sorted(self._all_keys)
        primary = self._name_field or (keys[0] if keys else "name")
        secondary = ""
        for k in keys:
            if k != primary:
                secondary = k
                break

        return DatasetMeta(
            dataset_id=f"json:{self._source_name}",
            display_name=f"JSON: {self._source_name}",
            description=f"{len(self._records)} records, {len(self._all_keys)} fields",
            entity_types=[
                EntityTypeConfig(
                    name=self._entity_type,
                    color="#ff6b6b",
                    primary_field=primary,
                    secondary_field=secondary,
                    detail_fields=keys[:8],
                )
            ],
            lookup_field="name",
            lookup_label="Record",
        )

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        entities: list[dict] = []
        for idx, record in enumerate(self._records[:limit]):
            # Determine name
            if self._name_field and self._name_field in record:
                name = str(record[self._name_field])
            else:
                name = f"{self._entity_type}:{idx}"

            # Detect entity type from record if present
            etype = self._entity_type
            if "type" in record and isinstance(record["type"], str):
                etype = record["type"]

            attributes = {k: v for k, v in record.items() if v is not None}

            entities.append({
                "name": name,
                "type": etype,
                "attributes": attributes,
            })

        logger.info("Produced %d entities from JSON", len(entities))
        return entities

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        # If explicit edges were provided, return them
        if self._explicit_edges:
            logger.info("Returning %d explicit edges from JSON", len(self._explicit_edges))
            return self._explicit_edges

        # Otherwise infer from _id fields (same logic as CSV)
        entity_index: dict[tuple[str, str], str] = {}
        for ent in entities:
            ename = ent["name"]
            etype = ent["type"]
            entity_index[(etype, ename)] = ename
            for k, v in ent.get("attributes", {}).items():
                if isinstance(v, (str, int, float)):
                    entity_index[(etype, str(v))] = ename

        id_fields = [k for k in self._all_keys if k.endswith("_id") or k.endswith("Id")]
        edges: list[dict] = []

        for ent in entities:
            attrs = ent.get("attributes", {})
            for col in id_fields:
                ref_value = attrs.get(col)
                if ref_value is None:
                    continue
                # Derive referenced type
                if col.endswith("_id"):
                    ref_type = _singularize(col[:-3])
                elif col.endswith("Id"):
                    ref_type = _singularize(col[:-2]).lower()
                else:
                    continue
                target_key = (ref_type, str(ref_value))
                target_name = entity_index.get(target_key)
                if target_name and target_name != ent["name"]:
                    edges.append({
                        "source": ent["name"],
                        "target": target_name,
                        "type": f"{ent['type']}_to_{ref_type}",
                        "weight": 1.0,
                    })

        logger.info("Inferred %d edges from JSON fields", len(edges))
        return edges

    def get_anomaly_tags(
        self,
        record: dict,
        scores: dict,
        cluster_size: int,
        flips: int,
    ) -> list[dict]:
        from .csv_connector import _generic_anomaly_tags
        return _generic_anomaly_tags(record, scores, cluster_size, flips)
