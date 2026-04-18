"""Contestation: synthetic challenges + consensus rounds."""
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
    entry = ManifestEntry(name="contestation", mode="synthetic")
    next_uuid = deterministic_uuid_factory()
    base = FIXTURE_NOW
    statuses = ["open", "under_review", "resolved", "withdrawn"]

    challenges = []
    for i in range(25):
        challenges.append(
            {
                "id": next_uuid(),
                "target_type": "module" if i % 2 == 0 else "dataset",
                "target_id": next_uuid(),
                "claim": f"Synthetic dispute claim #{i}",
                "status": statuses[i % len(statuses)],
                "raised_by": f"user_{i % 5}",
                "created_at": (base - timedelta(hours=i * 3)).isoformat(),
                "annotator_count": (i % 4) + 1,
            }
        )
    p_ch = out_dir / "challenges.json"
    write_json(p_ch, {"challenges": challenges, "count": len(challenges)})
    add_file(entry, p_ch, "output", "25 synthetic challenges")

    consensus = []
    for ch in challenges:
        if ch["status"] == "resolved":
            consensus.append(
                {
                    "challenge_id": ch["id"],
                    "resolution": "upheld" if hash(ch["id"]) % 2 == 0 else "rejected",
                    "support_votes": (hash(ch["id"]) % 5) + 3,
                    "oppose_votes": (hash(ch["id"]) % 3) + 1,
                    "closed_at": ch["created_at"],
                }
            )
    p_con = out_dir / "consensus.json"
    write_json(p_con, {"consensus": consensus, "count": len(consensus)})
    add_file(entry, p_con, "output", "Consensus outcomes for resolved challenges")

    add_interact(entry, "Read challenges", "Read", "data/samples/contestation/challenges.json")
    return entry
