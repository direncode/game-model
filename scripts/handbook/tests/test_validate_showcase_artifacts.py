"""Tests for validate_showcase_artifacts."""
from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from scripts.handbook.validate_showcase_artifacts import (
    validate_showcase_artifacts,
    PRESET_DEFINITIONS,
)


def test_preset_definitions_cover_six_showcases():
    namespaces = {d["namespace"] for d in PRESET_DEFINITIONS}
    assert namespaces == {
        "pulse", "atlas", "receipt", "docsouth", "titan", "universal",
    }


def test_each_preset_has_a_committed_artifact():
    repo_root = Path(__file__).resolve().parents[3]
    for d in PRESET_DEFINITIONS:
        artifact = repo_root / d["artifact_path"]
        sha256 = repo_root / (d["artifact_path"] + ".sha256")
        assert artifact.is_file(), f"missing artifact: {artifact}"
        assert sha256.is_file(), f"missing sha256 sidecar: {sha256}"


def test_committed_sha256_matches_committed_artifact():
    repo_root = Path(__file__).resolve().parents[3]
    for d in PRESET_DEFINITIONS:
        artifact = repo_root / d["artifact_path"]
        sha256 = repo_root / (d["artifact_path"] + ".sha256")
        actual = hashlib.sha256(artifact.read_bytes()).hexdigest()
        expected = sha256.read_text().strip()
        assert actual == expected, (
            f"sha256 mismatch for {artifact.name}: file={actual[:12]}, sidecar={expected[:12]}"
        )


def test_validate_showcase_artifacts_returns_empty_on_clean_state():
    errors = validate_showcase_artifacts()
    assert errors == [], f"unexpected errors on clean state: {errors}"
