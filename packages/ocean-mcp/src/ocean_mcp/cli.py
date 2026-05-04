"""ocean-mcp CLI entry point.

Started by MCP clients via:
    {"command": "ocean-mcp"}

Runs the JSON-RPC stdio server. No flags, no logs to stdout (would
corrupt the MCP framing). All diagnostics go to stderr.
"""
from __future__ import annotations

import sys


def main():
    # The vendored MCP server expects `from scripts.operators.ocean.mcp import serve`.
    # Bring it in via the same path the package's __init__.py set up.
    from scripts.operators.ocean.mcp import serve  # noqa: E402
    serve()


if __name__ == "__main__":
    main()
