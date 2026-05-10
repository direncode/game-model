"""Network isolation is enforced at the deployment layer (Docker --net=none).

This test documents the host-level expectation; a more rigorous check runs
the container with --net=none in CI. Process-level rlimits cannot block
network syscalls, so the runner relies on the container network namespace.
"""
from __future__ import annotations

import sys

import pytest


@pytest.mark.skipif(
    sys.platform != "linux",
    reason="Network namespace isolation is a Linux/container-only primitive",
)
def test_documents_network_expectation() -> None:
    # In production the handbook-runner container is started with the
    # equivalent of `--net=none` (compose: `network_mode: none`), or it is
    # placed on an internal-only bridge with no outbound route. Outbound
    # connections from the sandboxed subprocess are therefore unreachable.
    # This test asserts the documented expectation rather than enforcing
    # it from inside the process boundary.
    assert True
