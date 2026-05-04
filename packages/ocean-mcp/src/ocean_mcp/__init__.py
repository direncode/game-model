"""ocean-mcp — MCP server for the OCEAN substrate-clustering language.

This is the public distribution package. The proprietary operator
implementations (BTUT, TCD-JEPA recursive loop, content_fp48 Bloom
fingerprint, dispersion analysis) are NOT shipped here — they run only
on api.latentocean.com. This package contains:

  * The full OCEAN language toolchain (lexer, parser, type checker,
    compiler, REPL, formatter, linter, doc-gen, LSP, FFI, macros).
  * Reference operators: source.ndjson, embed.tfidf_jl,
    embed.onehot_numeric, cluster.kmeans, align.module, persist.json.
  * Stub registrations for the four premium operator kinds — so OCEAN
    programs that reference them type-check; calling them locally
    raises a clear error directing to the hosted API.
  * The MCP server. When a compiled DAG references a premium kind,
    the server transparently routes the run to api.latentocean.com.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make the vendored toolchain importable as `scripts.operators.ocean.*`.
_VENDORED = Path(__file__).resolve().parent / "_vendored"
if _VENDORED.exists() and str(_VENDORED) not in sys.path:
    sys.path.insert(0, str(_VENDORED))

# Register premium operator stubs after the toolchain is on sys.path so
# the @register decorator finds the operator base class.
from . import _premium_stubs  # noqa: F401, E402

__version__ = "1.1.0"
