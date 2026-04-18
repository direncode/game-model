"""QR Identity: real code_generator for codes, schema-constructed records.

`QRIdentityService.mint` is async + DB-backed; we bypass it and build
records directly with real codes from `generate_code()` and optional PNGs
from `generate_qr_image()`.
"""
from __future__ import annotations

import base64
import random
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sample_data._common import ManifestEntry, add_file, add_interact, write_json


def run(out_dir: Path) -> ManifestEntry:
    entry = ManifestEntry(name="qr_identity", mode="real")

    # Deterministic fixture variant: use the real `_ALPHABET` constant but a
    # seeded RNG, so regenerating the fixture doesn't churn committed PNGs.
    # Live `generate_code` uses `secrets` (non-seedable) by design.
    from app.services.qr_identity.code_generator import _ALPHABET

    rng = random.Random(42)
    uuid_rng = random.Random(42)

    def _det_code() -> str:
        left = "".join(rng.choice(_ALPHABET) for _ in range(4))
        right = "".join(rng.choice(_ALPHABET) for _ in range(4))
        return f"{left}-{right}"

    def _det_uuid() -> str:
        return str(uuid.UUID(int=uuid_rng.getrandbits(128)))

    subject_types = ["dataset", "module", "report", "run", "survivor_bundle"]
    tiers = ["public", "org", "admin"]
    fixed_ts = "2026-04-18T00:00:00+00:00"
    records: list[dict] = []
    for i in range(20):
        records.append(
            {
                "id": _det_uuid(),
                "code": _det_code(),
                "subject_type": subject_types[i % len(subject_types)],
                "subject_id": _det_uuid(),
                "tier": tiers[i % len(tiers)],
                "org_id": _det_uuid() if i % 2 == 0 else None,
                "minted_by": f"user_{i % 5}",
                "metadata": {"seed_index": i},
                "created_at": fixed_ts,
            }
        )

    p_ids = out_dir / "identity_records.json"
    write_json(p_ids, {"records": records, "count": len(records)})
    add_file(entry, p_ids, "output", "20 QR identity records with real codes")

    chains = []
    for i in range(5):
        head = records[i]
        child = records[i + 5]
        grandchild = records[i + 10]
        chains.append(
            {
                "root": head["code"],
                "events": [
                    {
                        "parent": head["code"],
                        "child": child["code"],
                        "event_type": "derived",
                        "ts": head["created_at"],
                    },
                    {
                        "parent": child["code"],
                        "child": grandchild["code"],
                        "event_type": "promoted",
                        "ts": child["created_at"],
                    },
                ],
                "depth": 3,
            }
        )
    p_chains = out_dir / "lineage_chains.json"
    write_json(p_chains, {"chains": chains})
    add_file(entry, p_chains, "output", "5 depth-3 lineage chains over the minted records")

    png_dir = out_dir / "qr_codes"
    png_dir.mkdir(parents=True, exist_ok=True)
    png_count = 0
    try:
        from app.services.qr_identity.code_generator import generate_qr_image

        for i in range(5):
            b64 = generate_qr_image(f"https://latentocean.local/qr/{records[i]['code']}")
            png_bytes = base64.b64decode(b64)
            png_path = png_dir / f"{records[i]['code']}.png"
            png_path.write_bytes(png_bytes)
            png_count += 1
    except Exception as e:
        entry.status = "partial"
        entry.mode = "hybrid"
        entry.error = f"qr png rendering failed: {type(e).__name__}: {e}"

    if png_count > 0:
        for png in sorted(png_dir.glob("*.png")):
            add_file(entry, png, "media", "QR code PNG rendered via real generate_qr_image()")

    add_interact(entry, "Read identity records", "Read", "data/samples/qr_identity/identity_records.json")
    add_interact(
        entry,
        "Grep admin tier",
        "Grep",
        args={"pattern": '"tier": "admin"', "path": "data/samples/qr_identity"},
    )
    return entry
