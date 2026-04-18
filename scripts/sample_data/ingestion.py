"""Ingestion: adapter-run records for csv, json, dunc, fsd + normalizer log."""
from __future__ import annotations

from pathlib import Path

from sample_data._common import FIXTURE_NOW, ManifestEntry, add_file, add_interact, write_json


def _adapter_run(adapter: str, rows: int) -> dict:
    return {
        "adapter": adapter,
        "started_at": FIXTURE_NOW.isoformat(),
        "rows_ingested": rows,
        "errors": 0 if adapter != "dunc" else 2,
        "warnings": (
            [] if adapter == "csv" else [f"{adapter}: normalized {rows // 10} rows with fallback schema"]
        ),
        "output_entities": rows,
        "output_edges": max(0, rows - 1),
    }


def run(out_dir: Path) -> ManifestEntry:
    entry = ManifestEntry(name="ingestion", mode="synthetic")

    for name, rows in [("csv", 150), ("json", 200), ("dunc", 90), ("fsd", 180)]:
        p = out_dir / f"{name}_run.json"
        write_json(p, _adapter_run(name, rows))
        add_file(entry, p, "output", f"{name} adapter run record")

    normalizer = {
        "runs": [
            {"source": "csv", "rules_applied": 12, "entities_normalized": 150},
            {"source": "json", "rules_applied": 18, "entities_normalized": 200},
        ],
        "total_normalized": 350,
    }
    p_n = out_dir / "normalizer_log.json"
    write_json(p_n, normalizer)
    add_file(entry, p_n, "output", "Normalizer run log")

    add_interact(
        entry, "Read dunc adapter run", "Read", "data/samples/ingestion/dunc_run.json"
    )
    add_interact(entry, "Read normalizer log", "Read", "data/samples/ingestion/normalizer_log.json")
    return entry
