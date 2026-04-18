"""Audit: synthetic audit events + SIEM export."""
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
    entry = ManifestEntry(name="audit", mode="synthetic")
    next_uuid = deterministic_uuid_factory()

    event_types = ["login", "data_access", "config_change", "export", "delete"]
    severities = ["info", "warn", "critical"]
    base = FIXTURE_NOW
    events = []
    for i in range(30):
        events.append(
            {
                "id": next_uuid(),
                "event_type": event_types[i % len(event_types)],
                "severity": severities[i % len(severities)],
                "actor": f"user_{i % 6}",
                "resource": f"resource_{i % 10}",
                "timestamp": (base - timedelta(minutes=i * 7)).isoformat(),
                "metadata": {"ip": f"10.0.0.{i % 255}", "seed_index": i},
            }
        )
    p_ev = out_dir / "audit_events.json"
    write_json(p_ev, {"events": events, "count": len(events)})
    add_file(entry, p_ev, "output", "30 synthetic audit events")

    siem = {
        "export_format": "json-lines",
        "total_events": len(events),
        "filters": {"severity": "warn+"},
        "events_warn_or_critical": [e for e in events if e["severity"] != "info"],
    }
    p_siem = out_dir / "siem_export.json"
    write_json(p_siem, siem)
    add_file(entry, p_siem, "output", "SIEM export payload (warn+)")

    add_interact(entry, "Read audit events", "Read", "data/samples/audit/audit_events.json")
    add_interact(
        entry,
        "Grep critical events",
        "Grep",
        args={"pattern": '"severity": "critical"', "path": "data/samples/audit"},
    )
    return entry
