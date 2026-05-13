"""Regression: content_fp48 must NOT type-check into a Euclidean cluster.

Before the typecheck split, both `embed.tfidf_jl` and `embed.content_fp48`
output T_Z; downstream `cluster.tcd_recursive_loop` accepted T_Z, so
piping the fp48 fingerprints into TCD type-checked fine and then crashed
at runtime when torch.from_numpy() tried to read uint64 as float32.

After the split, content_fp48 outputs T_Z_FP48 and the cluster verbs
still accept only T_Z. The mismatch surfaces as a TypeError_ with a
helpful suggestion.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.ocean.parser import parse_ocean  # noqa: E402
from scripts.operators.ocean.typecheck import typecheck, TypeError_  # noqa: E402


def _check(src: str) -> None:
    prog = parse_ocean(src, source_name="<test>")
    typecheck(prog)


def test_tfidf_into_kmeans_typechecks() -> None:
    src = """\
seed 42
load corpus.ndjson take 100 records balanced by label label field is label
embed text into 128 dimensions using tf-idf
cluster for 16 rounds max 24 modules using kmeans
"""
    _check(src)


def test_content_fp48_into_tcd_rejected() -> None:
    src = """\
seed 42
load corpus.ndjson take 100 records balanced by label label field is label
embed text into 128 dimensions using content fingerprint
cluster for 16 rounds max 24 modules using tcd recursive loop
"""
    with pytest.raises(TypeError_) as exc:
        _check(src)
    msg = exc.value.pretty("<test>")
    assert "Z_FP48" in msg or "content_fp48" in msg.lower() or "hamming" in msg.lower()


def test_content_fp48_into_kmeans_rejected() -> None:
    src = """\
seed 42
load corpus.ndjson take 100 records balanced by label label field is label
embed text into 128 dimensions using content fingerprint
cluster for 16 rounds max 24 modules using kmeans
"""
    with pytest.raises(TypeError_):
        _check(src)
