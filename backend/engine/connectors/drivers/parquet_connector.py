"""Parquet connector — read Apache Parquet files."""
from __future__ import annotations

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


class ParquetConnector(BaseDatasetAdapter):
    """Connect to Parquet files (local or remote).

    Requires ``pyarrow``. Install with: ``pip install pyarrow``

    Usage::

        connector = ParquetConnector("/path/to/data.parquet")
        connector = ParquetConnector(["/path/a.parquet", "/path/b.parquet"])
    """

    def __init__(
        self,
        source: str | list[str],
        entity_type: str | None = None,
        name_column: str | None = None,
    ) -> None:
        try:
            import pyarrow.parquet as pq  # noqa: F401
        except ImportError:
            raise ImportError(
                "pyarrow is required for Parquet support. "
                "Install with: pip install pyarrow"
            )

        if isinstance(source, str):
            self._paths = [Path(source)]
        else:
            self._paths = [Path(s) for s in source]

        for p in self._paths:
            if not p.exists():
                raise FileNotFoundError(f"Parquet file not found: {p}")

        self._name_column = name_column
        self._source_name = self._paths[0].stem if self._paths else "parquet"
        self._entity_type = entity_type or _singularize(self._source_name)

        # Read schema eagerly, data lazily
        self._pq = pq
        self._schema = self._pq.read_schema(str(self._paths[0]))
        self._columns: list[str] = [f.name for f in self._schema]

        if self._name_column is None:
            self._name_column = self._pick_name_column()

    def _pick_name_column(self) -> str:
        priority = ["name", "title", "label", "key", "id"]
        lower_cols = {c.lower(): c for c in self._columns}
        for candidate in priority:
            if candidate in lower_cols:
                return lower_cols[candidate]
        return self._columns[0] if self._columns else ""

    # ------------------------------------------------------------------ #
    #  BaseDatasetAdapter interface
    # ------------------------------------------------------------------ #

    def get_meta(self) -> DatasetMeta:
        # Get total row count
        total_rows = sum(
            self._pq.read_metadata(str(p)).num_rows for p in self._paths
        )
        primary = self._name_column or (self._columns[0] if self._columns else "name")
        secondary = ""
        for c in self._columns:
            if c != primary:
                secondary = c
                break

        return DatasetMeta(
            dataset_id=f"parquet:{self._source_name}",
            display_name=f"Parquet: {self._source_name}",
            description=f"{total_rows} rows, {len(self._columns)} columns across {len(self._paths)} file(s)",
            entity_types=[
                EntityTypeConfig(
                    name=self._entity_type,
                    color="#51cf66",
                    primary_field=primary,
                    secondary_field=secondary,
                    detail_fields=self._columns[:8],
                )
            ],
            lookup_field="name",
            lookup_label="Record",
        )

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        entities: list[dict] = []
        remaining = limit

        for path in self._paths:
            if remaining <= 0:
                break

            table = self._pq.read_table(str(path))
            # Convert to Python dicts via pandas for simplicity
            try:
                df = table.to_pandas()
            except Exception:
                # Fallback: iterate rows manually
                for i in range(min(table.num_rows, remaining)):
                    row = {col: table.column(col)[i].as_py() for col in self._columns}
                    entities.append(self._row_to_entity(row, len(entities)))
                    remaining -= 1
                continue

            for _, row_series in df.head(remaining).iterrows():
                row = row_series.to_dict()
                # Convert numpy types to Python native
                clean_row: dict[str, Any] = {}
                for k, v in row.items():
                    try:
                        if hasattr(v, "item"):
                            clean_row[k] = v.item()
                        elif v is not None and str(v) != "nan":
                            clean_row[k] = v
                    except (ValueError, TypeError):
                        clean_row[k] = str(v)
                entities.append(self._row_to_entity(clean_row, len(entities)))
                remaining -= 1

        logger.info("Produced %d entities from Parquet", len(entities))
        return entities

    def _row_to_entity(self, row: dict, idx: int) -> dict:
        if self._name_column and self._name_column in row:
            name = str(row[self._name_column])
        else:
            name = f"{self._entity_type}:{idx}"

        attributes = {k: v for k, v in row.items() if v is not None}
        return {
            "name": name,
            "type": self._entity_type,
            "attributes": attributes,
        }

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        """Infer edges from _id columns."""
        entity_index: dict[tuple[str, str], str] = {}
        for ent in entities:
            ename = ent["name"]
            etype = ent["type"]
            entity_index[(etype, ename)] = ename
            for k, v in ent.get("attributes", {}).items():
                if isinstance(v, (str, int, float)):
                    entity_index[(etype, str(v))] = ename

        id_columns = [c for c in self._columns if c.endswith("_id")]
        edges: list[dict] = []

        for ent in entities:
            attrs = ent.get("attributes", {})
            for col in id_columns:
                ref_value = attrs.get(col)
                if ref_value is None:
                    continue
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

        logger.info("Inferred %d edges from Parquet _id columns", len(edges))
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
