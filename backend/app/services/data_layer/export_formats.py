"""Multi-format export: Parquet, Arrow, CSV for survivors.

Parquet and Arrow require ``pyarrow`` (optional). CSV uses stdlib only.
All three share ``_survivors_to_flat_rows`` which flattens the
``Survivor`` dataclass into a dict-per-row suitable for any tabular
format. Coordinate arrays are exploded into individual columns
(``coord_8d_0`` through ``coord_8d_7``, ``coord_3d_0`` through
``coord_3d_2``) for proper columnar storage.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .types import Survivor


def _parse_attrs(entity: dict) -> dict:
    """Parse JSON-string attributes to dict (matching linking.py pattern)."""
    attrs = entity.get("attributes")
    if isinstance(attrs, dict):
        return attrs
    if isinstance(attrs, str):
        try:
            parsed = json.loads(attrs)
            return parsed if isinstance(parsed, dict) else {}
        except (ValueError, TypeError):
            return {}
    return {}


def _survivors_to_flat_rows(survivors: list["Survivor"]) -> list[dict]:
    """Flatten Survivor dataclass into tabular dicts.

    Columns: name, type, source_id, cluster, composite_score,
    display_name, fingerprint, coord_8d_0..coord_8d_7,
    coord_3d_0..coord_3d_2 (None if no 3D coords).
    """
    rows: list[dict] = []
    for s in survivors:
        ent = s.entity or {}
        attrs = _parse_attrs(ent)
        row: dict = {
            "name": ent.get("name", ""),
            "type": ent.get("type", ""),
            "source_id": attrs.get("_source_id", ent.get("_source_id", "")),
            "display_name": s.display_name or ent.get("name", ""),
            "cluster": s.cluster,
            "composite_score": s.scores.get("composite", 0.0) if s.scores else 0.0,
            "diversity_score": s.scores.get("diversity", 0.0) if s.scores else 0.0,
            "reconstruction_score": s.scores.get("reconstruction", 0.0) if s.scores else 0.0,
            "anomaly_score": s.scores.get("anomaly", 0.0) if s.scores else 0.0,
            "fingerprint": s.fingerprint or "",
        }
        # Explode 8D coords into individual columns.
        for i, v in enumerate(s.coord_8d or []):
            row[f"coord_8d_{i}"] = round(float(v), 6)
        # Pad missing dims (shouldn't happen but be safe).
        for i in range(len(s.coord_8d or []), 8):
            row[f"coord_8d_{i}"] = 0.0
        # 3D coords (optional).
        if s.coord_3d is not None:
            for i, v in enumerate(s.coord_3d):
                row[f"coord_3d_{i}"] = round(float(v), 6)
        else:
            for i in range(3):
                row[f"coord_3d_{i}"] = None
        rows.append(row)
    return rows


def to_csv(survivors: list["Survivor"], path: Path) -> Path:
    """Write survivors to a CSV file (stdlib csv, no pandas)."""
    rows = _survivors_to_flat_rows(survivors)
    if not rows:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("", encoding="utf-8")
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    return path


def to_parquet(survivors: list["Survivor"], path: Path) -> Path:
    """Write survivors to a Parquet file via pyarrow.

    Raises ImportError if pyarrow is not installed — callers should
    handle this gracefully (try/except ImportError).
    """
    import pyarrow as pa
    import pyarrow.parquet as pq

    rows = _survivors_to_flat_rows(survivors)
    table = pa.Table.from_pylist(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, str(path))
    return path


def to_arrow(survivors: list["Survivor"]) -> "pa.Table":
    """Return an in-memory Arrow table (zero-copy IPC ready).

    Raises ImportError if pyarrow is not installed.
    """
    import pyarrow as pa

    rows = _survivors_to_flat_rows(survivors)
    return pa.Table.from_pylist(rows)
