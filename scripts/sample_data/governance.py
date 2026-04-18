"""Governance: access entries, data classifications, retention policies, lineage events."""
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
    entry = ManifestEntry(name="governance", mode="synthetic")
    next_uuid = deterministic_uuid_factory()
    base = FIXTURE_NOW

    access = [
        {
            "actor": f"user_{i % 6}",
            "resource": f"resource_{i % 8}",
            "role": ["viewer", "editor", "admin"][i % 3],
            "granted_at": (base - timedelta(days=i)).isoformat(),
            "expires_at": (base + timedelta(days=30 - i)).isoformat() if i % 2 == 0 else None,
        }
        for i in range(20)
    ]
    p_a = out_dir / "access_entries.json"
    write_json(p_a, {"entries": access, "count": len(access)})
    add_file(entry, p_a, "output", "Access control entries")

    classes = ["public", "internal", "confidential", "restricted"]
    classif = [
        {
            "asset_id": f"asset_{i:03d}",
            "classification": classes[i % len(classes)],
            "pii_detected": i % 5 == 0,
            "classified_at": (base - timedelta(days=i // 2)).isoformat(),
        }
        for i in range(25)
    ]
    p_c = out_dir / "classification_results.json"
    write_json(p_c, {"classifications": classif, "count": len(classif)})
    add_file(entry, p_c, "output", "Data classification results")

    retention = [
        {
            "class": c,
            "retention_days": [30, 365, 1825, 2555][i],
            "policy_id": next_uuid(),
        }
        for i, c in enumerate(classes)
    ]
    p_r = out_dir / "retention_policies.json"
    write_json(p_r, {"policies": retention})
    add_file(entry, p_r, "output", "Retention policies per classification")

    lineage = [
        {
            "parent_asset": f"asset_{(i + 1) % 25:03d}",
            "child_asset": f"asset_{i:03d}",
            "event": ["derived", "copied", "transformed"][i % 3],
            "ts": (base - timedelta(hours=i * 4)).isoformat(),
        }
        for i in range(15)
    ]
    p_l = out_dir / "lineage_events.json"
    write_json(p_l, {"events": lineage})
    add_file(entry, p_l, "output", "Governance lineage events")

    add_interact(entry, "Read access entries", "Read", "data/samples/governance/access_entries.json")
    add_interact(
        entry, "Read classifications", "Read", "data/samples/governance/classification_results.json"
    )
    return entry
