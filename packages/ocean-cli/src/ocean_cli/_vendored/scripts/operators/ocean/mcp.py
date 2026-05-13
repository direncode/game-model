"""OCEAN MCP server — exposes the language + operator runtime as MCP tools.

Speaks Anthropic's Model Context Protocol over JSON-RPC on stdio. Any
MCP-compatible client (Claude Desktop, Cursor, Goose, Continue.dev,
hyperscaler agent runtimes, internal tooling) can register this server
and call OCEAN as a set of agent tools.

Tools exposed:

    ocean.compile      — compile .ocean source → DAG config (no execution)
    ocean.validate     — typecheck source, return diagnostics
    ocean.run          — compile + execute, return artifact JSON
    ocean.list_ops     — enumerate registered operators with schemas
    ocean.list_stdlib  — enumerate stdlib functions with docs
    ocean.format       — pretty-print source canonically
    ocean.lint         — style + dead-code analysis

Resources exposed:

    ocean://docs/spec  — the OCEAN language spec (docs/OCEAN_LANG.md)
    ocean://stdlib/{file} — stdlib source files
    ocean://operators/{kind} — operator schemas as JSON

Usage in a client config (Claude Desktop's mcp_config.json, for example):

    {
      "mcpServers": {
        "ocean": {
          "command": "python",
          "args": ["-m", "scripts.operators.ocean.mcp"]
        }
      }
    }

The protocol shape is intentionally close to the LSP server in this
package — same JSON-RPC machinery, different method namespace.
"""
from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.ocean.compiler import compile_ocean, CompileError
from scripts.operators.ocean.parser import parse_ocean, ParseError, DEFAULT_OPERATOR_KIND
from scripts.operators.ocean.lexer import LexerError
from scripts.operators.ocean.typecheck import TypeError_
from scripts.operators.schema import all_schemas, SCHEMAS


# ── Protocol framing ────────────────────────────────────────────────────

def read_message() -> dict | None:
    """One Content-Length-framed JSON-RPC message from stdin."""
    headers = {}
    while True:
        line = sys.stdin.buffer.readline()
        if not line:
            return None
        line = line.decode("ascii").strip()
        if not line:
            break
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    length = int(headers.get("content-length", "0"))
    if not length:
        return None
    body = sys.stdin.buffer.read(length).decode("utf-8")
    return json.loads(body)


def write_message(payload: dict):
    body = json.dumps(payload).encode("utf-8")
    sys.stdout.buffer.write(f"Content-Length: {len(body)}\r\n\r\n".encode("ascii"))
    sys.stdout.buffer.write(body)
    sys.stdout.buffer.flush()


# ── Tool implementations ────────────────────────────────────────────────

def tool_compile(source: str) -> dict:
    """Compile source → DAG config without running."""
    try:
        cfg = compile_ocean(source, source_name="<mcp-call>")
        return {"ok": True, "config": cfg}
    except (LexerError, ParseError, TypeError_, CompileError) as e:
        return {"ok": False, "error": e.pretty("<mcp-call>")}


def tool_validate(source: str) -> dict:
    """Typecheck-only. Returns structured diagnostics."""
    diags = []
    try:
        compile_ocean(source, source_name="<mcp-call>")
    except (LexerError, ParseError, TypeError_, CompileError) as e:
        diags.append({
            "severity":   "error",
            "category":   type(e).__name__,
            "line":       getattr(e, "line", 0) or getattr(getattr(e, "token", None), "line", 0),
            "col":        getattr(e, "col", 0)  or getattr(getattr(e, "token", None), "col", 0),
            "message":    getattr(e, "message", str(e)),
            "suggestion": getattr(e, "suggestion", None),
        })
    return {"ok": True, "diagnostics": diags}


PREMIUM_OPERATOR_KINDS = {
    "embed.content_fp48",
    "cluster.tcd_recursive_loop",
    "reduce.btut",
    "align.dispersion",
}


def _route_run_to_api(source: str, api_key: str | None) -> dict:
    """When a compiled program references premium operators, the local
    install can't execute them. Route the entire run to the hosted API.

    The api endpoint is api.latentocean.com/v1/run by default; override
    via OCEAN_API_BASE env var.
    """
    import os
    import urllib.request
    import urllib.error

    api_base = os.environ.get("OCEAN_API_BASE", "https://api.latentocean.com")
    body = json.dumps({"source": source}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    req = urllib.request.Request(
        f"{api_base}/v1/run", data=body, headers=headers, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 402:
            return {
                "ok": False,
                "error": "premium-operator call requires a paid OCEAN_API_KEY. "
                         "Get one at https://latentocean.com/protocols",
            }
        return {"ok": False, "error": f"hosted API returned HTTP {e.code}: {e.read().decode('utf-8')[:200]}"}
    except Exception as e:
        return {"ok": False, "error": f"could not reach hosted API at {api_base}: {e}"}


def tool_run(source: str) -> dict:
    """Compile + execute. Returns the persisted artifact + step timings.

    If the compiled DAG references any premium operator (BTUT, TCD,
    content_fp48, dispersion), the entire pipeline is routed to the
    hosted API at api.latentocean.com — the proprietary implementations
    don't ship with this package.
    """
    import os
    os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
    try:
        import torch  # pre-load to dodge sklearn/torch DLL clash
    except Exception:
        pass

    try:
        from scripts.operators import run_pipeline, PipelineConfig, StepConfig
        # Pre-import operator modules so they register
        import scripts.operators.source   # noqa: F401
        import scripts.operators.embed    # noqa: F401
        import scripts.operators.cluster  # noqa: F401
        import scripts.operators.align    # noqa: F401
        import scripts.operators.narrate  # noqa: F401
        import scripts.operators.persist  # noqa: F401

        cfg = compile_ocean(source, source_name="<mcp-call>")

        # Detect premium operators in the DAG and route to hosted API
        uses_premium = any(s["kind"] in PREMIUM_OPERATOR_KINDS for s in cfg.get("steps", []))
        if uses_premium:
            api_key = os.environ.get("OCEAN_API_KEY")
            return _route_run_to_api(source, api_key)
        pipeline = PipelineConfig(
            seed=cfg["seed"],
            steps=[StepConfig(**{k: v for k, v in s.items()
                                 if k in {"name", "kind", "inputs", "config"}})
                   for s in cfg["steps"]],
        )
        state = run_pipeline(pipeline, verbose=False)
        timings = state.get("_pipeline.timings", [])
        # Try to find the persist step's output path
        artifact_path = None
        for k, v in state.items():
            if k.endswith(".output_path"):
                artifact_path = v
        artifact = None
        if artifact_path:
            try:
                artifact = json.loads(Path(artifact_path).read_text(encoding="utf-8"))
            except Exception:
                artifact = {"_error": "could not read artifact"}
        return {
            "ok":       True,
            "timings":  timings,
            "artifact": artifact,
            "artifact_path": artifact_path,
        }
    except (LexerError, ParseError, TypeError_, CompileError) as e:
        return {"ok": False, "error": e.pretty("<mcp-call>")}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}",
                "traceback": traceback.format_exc()}


def tool_list_ops() -> dict:
    return {"ok": True, "operators": all_schemas()}


def tool_list_stdlib() -> dict:
    """Return stdlib file paths + their docstrings."""
    stdlib_dir = REPO_ROOT / "scripts" / "operators" / "ocean" / "stdlib"
    out = []
    if stdlib_dir.exists():
        for f in stdlib_dir.glob("*.ocean"):
            try:
                from scripts.operators.ocean.docgen import extract_doc_comments
                docs = extract_doc_comments(f.read_text(encoding="utf-8"))
            except Exception:
                docs = []
            out.append({
                "file":      f.name,
                "uri":       f"ocean://stdlib/{f.name}",
                "functions": [{"name": d.name, "summary": d.summary,
                               "args":  d.args} for d in docs],
            })
    return {"ok": True, "files": out}


def tool_format(source: str, write: bool = False) -> dict:
    try:
        from scripts.operators.ocean.format import format_program
        prog = parse_ocean(source, source_name="<mcp-call>")
        return {"ok": True, "formatted": format_program(prog)}
    except (LexerError, ParseError) as e:
        return {"ok": False, "error": e.pretty("<mcp-call>")}


def tool_lint(source: str) -> dict:
    try:
        from scripts.operators.ocean.lint import Linter
        prog = parse_ocean(source, source_name="<mcp-call>")
        linter = Linter(source.splitlines())
        lints = linter.lint_program(prog)
        return {"ok": True, "lints": [
            {"severity": l.severity, "line": l.line, "col": l.col,
             "code": l.code, "message": l.message}
            for l in lints
        ]}
    except (LexerError, ParseError) as e:
        return {"ok": False, "error": e.pretty("<mcp-call>")}


# ── Tool registry (MCP "tools" per the protocol) ────────────────────────

TOOLS = [
    {
        "name":        "ocean_compile",
        "description": "Compile OCEAN source code to an operator-DAG configuration. "
                       "Does not execute. Returns the DAG JSON or compile errors.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "source": {"type": "string", "description": "OCEAN program source"}
            },
            "required": ["source"],
        },
    },
    {
        "name":        "ocean_validate",
        "description": "Type-check OCEAN source. Returns structured diagnostics "
                       "(error category, line, col, message, suggestion).",
        "inputSchema": {
            "type": "object",
            "properties": {"source": {"type": "string"}},
            "required": ["source"],
        },
    },
    {
        "name":        "ocean_run",
        "description": "Compile and execute an OCEAN program end-to-end. "
                       "Returns step timings + the persisted artifact JSON.",
        "inputSchema": {
            "type": "object",
            "properties": {"source": {"type": "string"}},
            "required": ["source"],
        },
    },
    {
        "name":        "ocean_list_ops",
        "description": "Enumerate all registered operators with their parameter "
                       "schemas (English label, type, default, range).",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name":        "ocean_list_stdlib",
        "description": "Enumerate OCEAN stdlib functions (basic_run, seed_sweep, "
                       "anomaly_focused, content_vs_structural).",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name":        "ocean_format",
        "description": "Pretty-print OCEAN source to canonical form.",
        "inputSchema": {
            "type": "object",
            "properties": {"source": {"type": "string"}},
            "required": ["source"],
        },
    },
    {
        "name":        "ocean_lint",
        "description": "Style + dead-code analysis on OCEAN source.",
        "inputSchema": {
            "type": "object",
            "properties": {"source": {"type": "string"}},
            "required": ["source"],
        },
    },
]


# ── Main MCP loop ───────────────────────────────────────────────────────

def serve():
    initialized = False
    while True:
        msg = read_message()
        if msg is None:
            return
        method = msg.get("method")
        msg_id = msg.get("id")
        params = msg.get("params") or {}

        if method == "initialize":
            write_message({
                "jsonrpc": "2.0", "id": msg_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools":     {},
                        "resources": {},
                        "prompts":   {},
                    },
                    "serverInfo": {
                        "name":    "ocean-mcp",
                        "version": "1.1.0",
                    },
                },
            })
            initialized = True
            continue

        if method == "shutdown":
            write_message({"jsonrpc": "2.0", "id": msg_id, "result": None})
            continue
        if method == "exit":
            return
        if method == "notifications/initialized":
            continue  # client confirmation; no reply needed

        if method == "tools/list":
            write_message({
                "jsonrpc": "2.0", "id": msg_id,
                "result": {"tools": TOOLS},
            })
            continue

        if method == "tools/call":
            name = params.get("name", "")
            arguments = params.get("arguments", {})
            try:
                if name == "ocean_compile":
                    result = tool_compile(arguments.get("source", ""))
                elif name == "ocean_validate":
                    result = tool_validate(arguments.get("source", ""))
                elif name == "ocean_run":
                    result = tool_run(arguments.get("source", ""))
                elif name == "ocean_list_ops":
                    result = tool_list_ops()
                elif name == "ocean_list_stdlib":
                    result = tool_list_stdlib()
                elif name == "ocean_format":
                    result = tool_format(arguments.get("source", ""),
                                         arguments.get("write", False))
                elif name == "ocean_lint":
                    result = tool_lint(arguments.get("source", ""))
                else:
                    write_message({
                        "jsonrpc": "2.0", "id": msg_id,
                        "error": {"code": -32601, "message": f"unknown tool: {name}"},
                    })
                    continue
                write_message({
                    "jsonrpc": "2.0", "id": msg_id,
                    "result": {
                        "content": [{
                            "type": "text",
                            "text": json.dumps(result, indent=2, default=str),
                        }],
                        "isError": not result.get("ok", True),
                    },
                })
            except Exception as e:
                write_message({
                    "jsonrpc": "2.0", "id": msg_id,
                    "error": {"code": -32603,
                              "message": f"internal: {type(e).__name__}: {e}"},
                })
            continue

        if method == "resources/list":
            write_message({
                "jsonrpc": "2.0", "id": msg_id,
                "result": {"resources": [
                    {"uri": "ocean://docs/spec",
                     "name": "OCEAN language spec",
                     "description": "Authoritative reference for OCEAN v1.1",
                     "mimeType": "text/markdown"},
                    {"uri": "ocean://docs/spu",
                     "name": "SPU architecture spec",
                     "description": "Substrate Processing Unit hardware spec",
                     "mimeType": "text/markdown"},
                    {"uri": "ocean://stdlib/substrate.ocean",
                     "name": "OCEAN stdlib — substrate-clustering presets",
                     "description": "Reusable pipeline functions",
                     "mimeType": "text/x-ocean"},
                ]},
            })
            continue

        if method == "resources/read":
            uri = params.get("uri", "")
            try:
                contents = _read_resource(uri)
                write_message({
                    "jsonrpc": "2.0", "id": msg_id,
                    "result": {"contents": [{
                        "uri":      uri,
                        "mimeType": _resource_mime(uri),
                        "text":     contents,
                    }]},
                })
            except FileNotFoundError:
                write_message({
                    "jsonrpc": "2.0", "id": msg_id,
                    "error": {"code": -32602, "message": f"resource not found: {uri}"},
                })
            continue

        # Unknown method
        if msg_id is not None:
            write_message({
                "jsonrpc": "2.0", "id": msg_id,
                "error": {"code": -32601, "message": f"method not found: {method}"},
            })


def _read_resource(uri: str) -> str:
    if uri == "ocean://docs/spec":
        return (REPO_ROOT / "docs" / "OCEAN_LANG.md").read_text(encoding="utf-8")
    if uri == "ocean://docs/spu":
        return (REPO_ROOT / "docs" / "SPU_ARCHITECTURE.md").read_text(encoding="utf-8")
    if uri.startswith("ocean://stdlib/"):
        name = uri[len("ocean://stdlib/"):]
        return (REPO_ROOT / "scripts" / "operators" / "ocean" / "stdlib" / name).read_text(encoding="utf-8")
    raise FileNotFoundError(uri)


def _resource_mime(uri: str) -> str:
    if uri.endswith(".md") or "/docs/" in uri:
        return "text/markdown"
    if uri.endswith(".ocean") or "/stdlib/" in uri:
        return "text/x-ocean"
    return "text/plain"


if __name__ == "__main__":
    serve()
