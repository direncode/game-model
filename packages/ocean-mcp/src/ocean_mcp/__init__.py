"""ocean-mcp — MCP server for the OCEAN substrate-clustering language.

This is the distribution package. The actual MCP-server implementation +
language toolchain are vendored alongside; importing this package brings
the runtime onto sys.path so MCP clients can call the OCEAN tools.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make the vendored toolchain importable as `scripts.operators.ocean.*`.
_VENDORED = Path(__file__).resolve().parent / "_vendored"
if _VENDORED.exists() and str(_VENDORED) not in sys.path:
    sys.path.insert(0, str(_VENDORED))

__version__ = "1.1.0"
