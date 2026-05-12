"""CI drift gate for the bundled showcase artifacts.

Hooks into scripts.handbook.build.py --check. For each free-tier
showcase preset, verify that the committed artifact's SHA-256 matches
the committed sidecar. Catches the case where a preset was edited but
the artifact was not regenerated.

Premium artifacts are NOT verified by this script (no API key in CI).
Their freshness is the responsibility of the release author.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

PRESET_DEFINITIONS: list[dict] = [
    {"namespace": "pulse",     "preset": "uspto",      "artifact_path": "frontend/data/showcases/pulse/uspto_artifact.json"},
    {"namespace": "atlas",     "preset": "arxiv",      "artifact_path": "frontend/data/showcases/atlas/arxiv_artifact.json"},
    {"namespace": "receipt",   "preset": "edgar",      "artifact_path": "frontend/data/showcases/receipt/edgar_artifact.json"},
    {"namespace": "docsouth",  "preset": "narratives", "artifact_path": "frontend/data/showcases/docsouth/narratives_artifact.json"},
    {"namespace": "titan",     "preset": "benchmark",  "artifact_path": "frontend/data/showcases/titan/benchmark_artifact.json"},
    {"namespace": "universal", "preset": "substrate",  "artifact_path": "frontend/data/showcases/universal/substrate_artifact.json"},
]


def validate_showcase_artifacts() -> list[str]:
    errors: list[str] = []
    for d in PRESET_DEFINITIONS:
        artifact_rel = d["artifact_path"]
        sidecar_rel = artifact_rel + ".sha256"
        artifact = REPO_ROOT / artifact_rel
        sidecar = REPO_ROOT / sidecar_rel

        if not artifact.is_file():
            errors.append(f"missing artifact: {artifact_rel}")
            continue
        if not sidecar.is_file():
            errors.append(f"missing sha256 sidecar: {sidecar_rel}")
            continue

        actual = hashlib.sha256(artifact.read_bytes()).hexdigest()
        expected = sidecar.read_text(encoding="utf-8").strip()
        if actual != expected:
            errors.append(
                f"{artifact_rel}: sha256 drift, file={actual[:12]}, sidecar={expected[:12]}"
            )

    return errors
