"""Delivery: synthetic alerts, embedding API log, exports, webhook events."""
from __future__ import annotations

from datetime import timedelta
from pathlib import Path

from sample_data._common import (
    FIXTURE_NOW,
    ManifestEntry,
    add_file,
    add_interact,
    deterministic_uuid_factory,
    write_json,
)


def run(out_dir: Path) -> ManifestEntry:
    entry = ManifestEntry(name="delivery", mode="synthetic")
    next_uuid = deterministic_uuid_factory()
    base = FIXTURE_NOW

    alerts = [
        {
            "id": next_uuid(),
            "level": ["info", "warn", "critical"][i % 3],
            "title": f"Alert #{i}: threshold breach",
            "body": f"Metric exceeded threshold at sample #{i}.",
            "created_at": (base - timedelta(minutes=i * 5)).isoformat(),
        }
        for i in range(20)
    ]
    p_a = out_dir / "alerts.json"
    write_json(p_a, {"alerts": alerts, "count": len(alerts)})
    add_file(entry, p_a, "output", "Delivered alerts")

    embedding_log = [
        {
            "request_id": next_uuid(),
            "input_bytes": 128 + i * 16,
            "output_dims": 8,
            "latency_ms": 12 + (i % 20),
            "ts": (base - timedelta(seconds=i * 30)).isoformat(),
        }
        for i in range(15)
    ]
    p_em = out_dir / "embeddings_api_log.json"
    write_json(p_em, {"requests": embedding_log})
    add_file(entry, p_em, "output", "Embedding API request log")

    exports = [
        {
            "export_id": next_uuid(),
            "format": ["csv", "parquet", "json"][i % 3],
            "rows": 100 * (i + 1),
            "bytes": 1024 * (i + 1),
            "ts": (base - timedelta(hours=i)).isoformat(),
        }
        for i in range(10)
    ]
    p_ex = out_dir / "exports.json"
    write_json(p_ex, {"exports": exports})
    add_file(entry, p_ex, "output", "Data export records")

    webhooks = [
        {
            "event": "alert.created" if i % 2 == 0 else "export.completed",
            "url": f"https://example.test/webhook/{i}",
            "status": "delivered" if i % 3 else "retry",
            "ts": (base - timedelta(minutes=i * 11)).isoformat(),
        }
        for i in range(12)
    ]
    p_w = out_dir / "webhooks.json"
    write_json(p_w, {"webhooks": webhooks})
    add_file(entry, p_w, "output", "Webhook delivery log")

    add_interact(entry, "Read alerts", "Read", "data/samples/delivery/alerts.json")
    add_interact(
        entry,
        "Grep critical alerts",
        "Grep",
        args={"pattern": '"level": "critical"', "path": "data/samples/delivery"},
    )
    return entry
