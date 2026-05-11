"""Tests for vendor_strip: assert proprietary identifiers are gone after strip."""
from __future__ import annotations

from pathlib import Path

import pytest


PROPRIETARY = (
    "ContentFP48Embedder",
    "BTUTReducer",
    "TCDRecursiveLoop",
    "DispersionAlignment",
)


def test_proprietary_identifiers_absent_in_vendored_tree():
    """Read every vendored .py file and assert no proprietary class name appears."""
    vendored = Path(__file__).resolve().parents[1] / "src/ocean_cli/_vendored"
    assert vendored.is_dir(), f"_vendored tree missing at {vendored}"

    for py in vendored.rglob("*.py"):
        text = py.read_text(encoding="utf-8")
        for ident in PROPRIETARY:
            assert ident not in text, (
                f"proprietary identifier '{ident}' leaked into {py.relative_to(vendored)}"
            )


def test_premium_stubs_registered():
    """All four premium operator names must be findable via the premium-stub gate."""
    from ocean_cli._premium_stubs import PREMIUM_OPS

    assert set(PREMIUM_OPS) == {
        "embed.content_fp48",
        "reduce.btut",
        "cluster.tcd_recursive_loop",
        "align.dispersion",
    }


def test_premium_invocation_raises_premium_error():
    """Calling a premium-stub run() raises PremiumOperatorError with the standard message."""
    from ocean_cli._premium_stubs import PremiumOperatorError
    from ocean_cli._vendored.scripts.operators import embed

    stub = embed._REGISTRY["embed.content_fp48"]
    with pytest.raises(PremiumOperatorError) as ei:
        stub.run([])
    msg = str(ei.value)
    assert "requires a paid API key" in msg
    assert "latentocean.com/protocols" in msg
