"""Premium operator stubs for the public ocean-mcp distribution.

The proprietary implementations (BTUT, TCD-JEPA recursive loop,
content_fp48 Bloom fingerprint, dispersion analysis) live ONLY on
LatentOcean's hosted runtime + (eventually) on SPU silicon. They are
NOT shipped in this package.

This module registers stub classes under the same operator-kind names
so:
  1. The type system + compiler still recognize the kinds (so OCEAN
     programs that reference them type-check cleanly).
  2. Attempting to RUN a premium operator locally raises a clear
     error pointing to the hosted API.
  3. The MCP server's tool_run inspects the compiled DAG; when it
     finds a premium kind, it routes the whole pipeline through
     api.latentocean.com/v1/run instead of dispatching locally.

This is the open-core boundary. The interface is public; the
implementation is not.
"""
from __future__ import annotations

from scripts.operators import Operator, register


# ── Premium operator kinds (must match what the language compiler emits) ─

PREMIUM_OPERATOR_KINDS = {
    "embed.content_fp48",
    "cluster.tcd_recursive_loop",
    "reduce.btut",
    "align.dispersion",
}


class _PremiumStubError(RuntimeError):
    """Raised when a premium operator is invoked without a network call."""

    def __init__(self, kind: str):
        super().__init__(
            f"{kind} is a premium operator. Its implementation lives only "
            f"on LatentOcean's hosted runtime, not in this package.\n"
            f"\n"
            f"To run a pipeline that uses {kind}:\n"
            f"  1. Get an API key at https://latentocean.com/protocols\n"
            f"  2. Set OCEAN_API_KEY in your environment\n"
            f"  3. Re-run — the MCP server / HTTP client routes premium "
            f"operators to api.latentocean.com automatically.\n"
            f"\n"
            f"The compiler still type-checks programs that reference {kind}; "
            f"only execution requires the hosted call."
        )


# Each stub registers the operator-kind so compile-time references resolve.
# Calling .run() raises a clear error directing to the hosted API.

@register
class _ContentFp48EmbedderStub(Operator):
    kind = "embed.content_fp48"
    stage = "embed"
    def run(self, inputs, *, seed, config):
        raise _PremiumStubError(self.kind)


@register
class _TCDRecursiveLoopStub(Operator):
    kind = "cluster.tcd_recursive_loop"
    stage = "cluster"
    def run(self, inputs, *, seed, config):
        raise _PremiumStubError(self.kind)


@register
class _BTUTReducerStub(Operator):
    kind = "reduce.btut"
    stage = "reduce"
    def run(self, inputs, *, seed, config):
        raise _PremiumStubError(self.kind)


@register
class _DispersionAnalysisStub(Operator):
    kind = "align.dispersion"
    stage = "align"
    def run(self, inputs, *, seed, config):
        raise _PremiumStubError(self.kind)
