"""Populate on-disk sample data across all unaddressed verticals.

Usage:
    python scripts/populate_samples.py

Writes fixtures under data/samples/<vertical>/ and a MANIFEST.json index.
Serial execution, continue-on-failure. Seed=42 for determinism.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Set import paths FIRST (before any `sample_data` or `app.*` imports).
_SCRIPTS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPTS_DIR.parent
_BACKEND_ROOT = _REPO_ROOT / "backend"
for _p in (str(_SCRIPTS_DIR), str(_BACKEND_ROOT)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import json  # noqa: E402
import logging  # noqa: E402
import subprocess  # noqa: E402
import time  # noqa: E402

from sample_data._common import (  # noqa: E402
    REPO_ROOT,
    SAMPLES_ROOT,
    ManifestEntry,
    manifest_entry_to_dict,
    run_populator,
)

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(name)s %(levelname)s %(message)s",
)
log = logging.getLogger("populate_samples")

VERTICALS: list[tuple[str, str]] = [
    ("audit", "synthetic"),
    ("btut", "real"),
    ("contestation", "synthetic"),
    ("crystallization", "real"),
    ("data_estate", "real"),
    ("data_layer", "real"),
    ("delivery", "synthetic"),
    ("flow_engine", "real"),
    ("fsd", "real"),
    ("governance", "synthetic"),
    ("hub", "real"),
    ("ingestion", "synthetic"),
    ("interpretation", "synthetic"),
    ("latk", "real"),
    ("modules", "real"),
    ("qr_identity", "real"),
]

SKIPPED: list[tuple[str, str]] = [
    (
        "niv",
        "service not implemented; design in docs/plans/2026-04-11-niv-vertical-design.md",
    ),
    (
        "polymath_secret_detection",
        "service not implemented; design in docs/plans/2026-04-10-polymath-secret-detection-design.md",
    ),
]


def _git_sha() -> str:
    try:
        out = subprocess.check_output(
            ["git", "-C", str(REPO_ROOT), "rev-parse", "HEAD"], text=True
        )
        return out.strip()[:7]
    except Exception:
        return "unknown"


def main() -> int:
    SAMPLES_ROOT.mkdir(parents=True, exist_ok=True)
    entries: list[dict] = []

    log.info("Populating %d verticals...", len(VERTICALS))
    wall_start = time.time()

    for name, mode in VERTICALS:
        log.info("=== %s (mode=%s) ===", name, mode)
        try:
            module = __import__(f"sample_data.{name}", fromlist=["run"])
            entry = run_populator(name, module.run, mode=mode)
        except Exception as e:
            entry = ManifestEntry(
                name=name,
                status="failed",
                mode=mode,
                error=f"import error: {type(e).__name__}: {e}",
            )
        entries.append(manifest_entry_to_dict(entry))
        log.info("    %s in %d ms", entry.status, entry.elapsed_ms)

    for name, reason in SKIPPED:
        entries.append(
            manifest_entry_to_dict(
                ManifestEntry(name=name, status="skipped", mode="skipped", skip_reason=reason)
            )
        )

    manifest = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "git_sha": _git_sha(),
        "seed": 42,
        "total_verticals": len(entries),
        "success_count": sum(1 for e in entries if e["status"] == "success"),
        "wall_ms": int((time.time() - wall_start) * 1000),
        "verticals": entries,
    }
    (SAMPLES_ROOT / "MANIFEST.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True, default=str), encoding="utf-8"
    )
    log.info("Wrote %s", SAMPLES_ROOT / "MANIFEST.json")
    log.info("Success: %d / %d", manifest["success_count"], len(VERTICALS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
