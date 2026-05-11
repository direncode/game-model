"""End-to-end tests for `ocean run <namespace>.<preset>`."""
from __future__ import annotations

from pathlib import Path

import pytest

from ocean_cli.main import main


def _repo_root() -> Path:
    """Walk up from this file to find the worktree root (contains backend/)."""
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "backend" / "handbook_runner").is_dir():
            return parent
    raise RuntimeError("could not locate repo root")


def test_run_substrate_basic_run_against_handbook_toy_corpus(tmp_path, capsys):
    corpus = _repo_root() / "backend" / "handbook_runner" / "corpora" / "toy_tna_50.ndjson"
    if not corpus.is_file():
        pytest.skip(f"toy corpus not available at {corpus}")
    output = tmp_path / "basic_run_output.json"

    rc = main([
        "run", "substrate.basic_run",
        "--corpus", str(corpus),
        "--target", "50",
        "--output", str(output),
    ])

    assert rc == 0, f"exit code was {rc}"
    assert output.is_file(), f"output artifact not produced at {output}"


def test_run_unknown_namespace_prints_available_and_returns_non_zero(capsys):
    rc = main(["run", "no_such_namespace.basic_run"])
    captured = capsys.readouterr()
    combined = (captured.out + captured.err).lower()
    assert rc != 0
    assert "unknown namespace" in combined
    # `substrate` should be listed among available namespaces
    assert "substrate" in combined


def test_run_unknown_preset_prints_available_and_returns_non_zero(capsys):
    rc = main(["run", "substrate.not_a_real_preset"])
    captured = capsys.readouterr()
    combined = (captured.out + captured.err).lower()
    assert rc != 0
    assert "unknown preset" in combined
    # `basic_run` should be listed among available presets
    assert "basic_run" in combined
